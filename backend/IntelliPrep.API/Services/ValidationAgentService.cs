using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Agent 4 — ValidationAgentService
    ///
    /// Sole responsibility: Evaluate Agent 3's (<see cref="ExamSynthesizerAgent"/>) output
    /// BEFORE it reaches the Admin or the database.
    ///
    /// Deterministic checks performed on every attempt:
    ///   (a) Exact question count matches the requested count.
    ///   (b) Every question has EXACTLY 5 options.
    ///   (c) The <c>correctOptionIndex</c> is a valid zero-based index into <c>options</c>
    ///       AND the value at that index is non-empty (i.e. the correct answer exists).
    ///
    /// Retry loop:
    ///   • If checks fail, sends a structured error back to Agent 3 and asks for regeneration.
    ///   • Maximum retries: <see cref="MaxRetries"/> (default 2 additional attempts = 3 total).
    ///   • On retry exhaustion: returns a failure result without persisting.
    ///
    /// On success:
    ///   • Saves the validated questions JSON to <c>ExamSession.QuestionsJson</c>.
    ///   • Sets <c>ExamSession.Status = "PendingAdminApproval"</c>.
    /// </summary>
    public class ValidationAgentService
    {
        /// <summary>Maximum number of extra regeneration attempts after the first failure.</summary>
        public const int MaxRetries = 2;

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            WriteIndented        = true,
            PropertyNameCaseInsensitive = true
        };

        private readonly ExamSynthesizerAgent              _synthesizer;
        private readonly ApplicationDbContext              _context;
        private readonly ILogger<ValidationAgentService>  _logger;

        public ValidationAgentService(
            ExamSynthesizerAgent             synthesizer,
            ApplicationDbContext             context,
            ILogger<ValidationAgentService> logger)
        {
            _synthesizer = synthesizer;
            _context     = context;
            _logger      = logger;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Public entry point
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Runs the full Agent 3 → Agent 4 loop for a given <see cref="SynthesizerInput"/>.
        ///
        /// 1. Calls Agent 3 (<see cref="ExamSynthesizerAgent.SynthesizeAsync"/>).
        /// 2. Runs deterministic checks (count / 5-options / correct-index).
        /// 3. On failure: crafts a structured error message, calls Agent 3 again (up to <see cref="MaxRetries"/> retries).
        /// 4. On pass: persists to <c>ExamSession</c> with Status = "PendingAdminApproval" and returns success.
        /// </summary>
        public async Task<AgentValidationResult> ValidateAndPersistAsync(
            SynthesizerInput input,
            int sessionId)
        {
            _logger.LogInformation(
                "[Agent4:Validation] Starting validation loop | SessionId={SessionId} | Subject='{Subject}' | RequestedCount={Count}",
                sessionId, input.Subject, input.RequestedQuestionCount);

            SynthesizerOutput? lastOutput = null;
            List<string>       allErrors  = [];

            for (int attempt = 1; attempt <= MaxRetries + 1; attempt++)
            {
                _logger.LogInformation(
                    "[Agent4:Validation] Attempt {Attempt}/{Total} — calling Agent 3 (ExamSynthesizer).",
                    attempt, MaxRetries + 1);

                // ── Call Agent 3 ──────────────────────────────────────────────
                SynthesizerInput currentInput = attempt == 1
                    ? input
                    : BuildRetryInput(input, allErrors, attempt);

                try
                {
                    lastOutput = await _synthesizer.SynthesizeAsync(currentInput);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "[Agent4:Validation] Agent 3 threw an exception on attempt {Attempt}.", attempt);

                    allErrors.Add($"Attempt {attempt}: Agent 3 threw an exception — {ex.Message}");

                    if (attempt > MaxRetries)
                        break;

                    continue;
                }

                // ── Run deterministic checks ──────────────────────────────────
                var (passed, errors) = RunDeterministicChecks(
                    lastOutput.Questions,
                    input.RequestedQuestionCount,
                    attempt);

                if (passed)
                {
                    _logger.LogInformation(
                        "[Agent4:Validation] ✅ All checks passed on attempt {Attempt}. Persisting to session {SessionId}.",
                        attempt, sessionId);

                    await PersistValidatedOutputAsync(sessionId, lastOutput);

                    return new AgentValidationResult
                    {
                        Success        = true,
                        Message        = $"Agent 3 output validated and persisted after {attempt} attempt(s). " +
                                         $"Session {sessionId} is now PendingAdminApproval.",
                        AttemptsTaken  = attempt,
                        SessionId      = sessionId,
                        Questions      = lastOutput.Questions,
                        RawLlmJson     = lastOutput.RawLlmJson
                    };
                }

                // ── Checks failed ─────────────────────────────────────────────
                _logger.LogWarning(
                    "[Agent4:Validation] ❌ Attempt {Attempt} failed {Count} check(s): {Errors}",
                    attempt, errors.Count, string.Join(" | ", errors));

                allErrors.AddRange(errors);

                if (attempt > MaxRetries)
                {
                    _logger.LogError(
                        "[Agent4:Validation] Max retries ({Max}) exhausted. Aborting without persistence.",
                        MaxRetries);
                    break;
                }
            }

            // ── Retry limit hit — return failure ──────────────────────────────
            return new AgentValidationResult
            {
                Success       = false,
                Message       = $"Agent 3 failed all {MaxRetries + 1} attempt(s). " +
                                $"No questions were saved to session {sessionId}.",
                AttemptsTaken = MaxRetries + 1,
                SessionId     = sessionId,
                Errors        = allErrors,
                Questions     = lastOutput?.Questions ?? [],
                RawLlmJson    = lastOutput?.RawLlmJson
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Deterministic Checks (a) (b) (c)
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Runs the three mandatory deterministic validation rules.
        /// Returns (true, []) on success, or (false, errorMessages) listing every violation.
        /// </summary>
        internal static (bool Passed, List<string> Errors) RunDeterministicChecks(
            List<SynthesizedMcqItem> questions,
            int requestedCount,
            int attemptNumber)
        {
            var errors = new List<string>();

            // ── Check (a): Exact question count ───────────────────────────────
            if (questions.Count != requestedCount)
            {
                errors.Add(
                    $"[Check A] Question count mismatch: expected {requestedCount}, " +
                    $"got {questions.Count}.");
            }

            // ── Check (b) & (c): Per-question integrity ───────────────────────
            for (int i = 0; i < questions.Count; i++)
            {
                var q = questions[i];
                var qLabel = $"Question[{i + 1}]";

                // (b) Exactly 5 options
                int optionCount = q.Options?.Count ?? 0;
                if (optionCount != 5)
                {
                    errors.Add(
                        $"[Check B] {qLabel} has {optionCount} option(s); exactly 5 required.");
                }

                // (c) correctOptionIndex is within the options list
                if (q.Options != null && q.Options.Count > 0)
                {
                    if (q.CorrectOptionIndex < 0 || q.CorrectOptionIndex >= q.Options.Count)
                    {
                        errors.Add(
                            $"[Check C] {qLabel} correctOptionIndex={q.CorrectOptionIndex} is out of " +
                            $"range [0, {q.Options.Count - 1}].");
                    }
                    else if (string.IsNullOrWhiteSpace(q.Options[q.CorrectOptionIndex]))
                    {
                        errors.Add(
                            $"[Check C] {qLabel} options[{q.CorrectOptionIndex}] (the correct answer) is empty.");
                    }
                }
                else
                {
                    errors.Add($"[Check C] {qLabel} has no options — cannot verify correct option.");
                }

                // Extra: question text must not be blank
                if (string.IsNullOrWhiteSpace(q.QuestionText))
                {
                    errors.Add($"[Check D] {qLabel} has an empty questionText.");
                }
            }

            bool passed = errors.Count == 0;
            return (passed, errors);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Retry: craft a corrective input for Agent 3
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Builds a corrected <see cref="SynthesizerInput"/> that injects the previous
        /// validation errors into the objective so Agent 3 knows exactly what to fix.
        /// </summary>
        private static SynthesizerInput BuildRetryInput(
            SynthesizerInput originalInput,
            List<string>     accumulatedErrors,
            int              attemptNumber)
        {
            var errorSummary = string.Join("\n  • ", accumulatedErrors.TakeLast(6));

            var correctedObjective =
                $"[Agent 4 Retry — Attempt {attemptNumber}]\n" +
                $"Your previous output failed the following deterministic checks:\n" +
                $"  • {errorSummary}\n\n" +
                $"MANDATORY CORRECTIONS — you MUST fix ALL of the above before returning JSON:\n" +
                $"  1. Output EXACTLY {originalInput.RequestedQuestionCount} questions.\n" +
                $"  2. Each question MUST have EXACTLY 5 options.\n" +
                $"  3. correctOptionIndex MUST be a valid zero-based index into the options array (0–4).\n" +
                $"  4. The value at options[correctOptionIndex] MUST be non-empty.\n\n" +
                $"Original objective: {originalInput.Objective}";

            return originalInput with { Objective = correctedObjective };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Persistence — only called after all checks pass
        // ─────────────────────────────────────────────────────────────────────

        private async Task PersistValidatedOutputAsync(int sessionId, SynthesizerOutput output)
        {
            var session = await _context.ExamSessions.FindAsync(sessionId)
                ?? throw new KeyNotFoundException($"ExamSession {sessionId} not found.");

            session.QuestionsJson = JsonSerializer.Serialize(output.Questions, _jsonOpts);
            session.Status        = "PendingAdminApproval";

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "[Agent4:Validation] Session {Id} updated → Status='PendingAdminApproval', " +
                "{Count} validated question(s) stored.",
                sessionId, output.Questions.Count);
        }
    }
}
