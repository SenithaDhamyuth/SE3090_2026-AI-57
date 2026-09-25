using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Production implementation of <see cref="IAIAgentService"/>.
    ///
    /// Architecture summary:
    ///   • Uses the existing named "GroqClient" HttpClient registered in Program.cs.
    ///   • All LLM calls use temperature 0.1 to maximise JSON determinism.
    ///   • JSON validation is <b>deterministic</b>: every required field is checked;
    ///     hallucinated or missing fields cause the run to fail gracefully.
    ///   • Both public methods are "never-throw" — exceptions are caught, logged,
    ///     and returned as <c>Success = false</c> to the controller.
    ///   • Lite-RAG: Agent 2 reads <c>SyllabusLimits</c> + <c>PastPaperAnalytics</c>
    ///     from the DB and injects them verbatim into the system prompt.
    ///   • Human-in-the-loop: <c>StudyPlan.IsApproved</c> is always <c>false</c> on creation.
    /// </summary>
    public sealed class AIAgentService : IAIAgentService
    {
        // ── Named HttpClient key — must match the name registered in Program.cs ──
        public const string HttpClientName = "GroqClient";

        // ── Shared JSON options (used for both serialising requests and
        //    deserialising LLM responses) ────────────────────────────────────────
        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented               = false
        };

        private readonly ApplicationDbContext           _db;
        private readonly IConfiguration                 _configuration;
        private readonly IHttpClientFactory             _httpClientFactory;
        private readonly ILogger<AIAgentService>        _logger;

        public AIAgentService(
            ApplicationDbContext        db,
            IConfiguration              configuration,
            IHttpClientFactory          httpClientFactory,
            ILogger<AIAgentService>     logger)
        {
            _db                 = db;
            _configuration      = configuration;
            _httpClientFactory  = httpClientFactory;
            _logger             = logger;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 1 — Past Paper Analyst
        // ═══════════════════════════════════════════════════════════════════════

        /// <inheritdoc/>
        public async Task<AnalyzePastPapersResult> AnalyzePastPapersAsync(
            AnalyzePastPapersRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "[AIAgent:Agent1] AnalyzePastPapersAsync started — {Count} topics, year={Year}",
                request.Topics.Count, request.Year);

            if (request.Topics.Count == 0)
            {
                return Fail<AnalyzePastPapersResult>("No topics provided. Supply at least one topic string.");
            }

            string rawLlmOutput = string.Empty;

            try
            {
                // ── 1. Build the system prompt ─────────────────────────────────
                var systemPrompt = BuildAgent1SystemPrompt();
                var userMessage  = BuildAgent1UserMessage(request.Topics, request.Year);

                _logger.LogDebug("[AIAgent:Agent1] Calling Groq LLM...");

                // ── 2. Call LLM ────────────────────────────────────────────────
                rawLlmOutput = await CallGroqAsync(systemPrompt, userMessage, cancellationToken);

                _logger.LogDebug("[AIAgent:Agent1] Raw LLM response ({Len} chars) received.", rawLlmOutput.Length);

                // ── 3. Strip markdown fences and validate JSON ─────────────────
                var cleanJson = StripMarkdownFences(rawLlmOutput);
                List<TopicProbabilityDto> probabilities;

                try
                {
                    probabilities = JsonSerializer.Deserialize<List<TopicProbabilityDto>>(cleanJson, _jsonOpts)
                        ?? throw new JsonException("Deserialised to null.");
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning(jsonEx,
                        "[AIAgent:Agent1] LLM returned malformed JSON. Raw output: {Raw}", rawLlmOutput);
                    return new AnalyzePastPapersResult
                    {
                        Success       = false,
                        Message       = $"LLM returned invalid JSON: {jsonEx.Message}",
                        RawLlmOutput  = rawLlmOutput
                    };
                }

                // ── 4. Deterministic structural validation ─────────────────────
                var invalid = probabilities
                    .Where(p => string.IsNullOrWhiteSpace(p.TopicName)
                             || p.ProbabilityPercentage < 0
                             || p.ProbabilityPercentage > 100)
                    .ToList();

                if (invalid.Count > 0)
                {
                    _logger.LogWarning(
                        "[AIAgent:Agent1] {N} records failed validation (empty name or out-of-range probability). Aborting persistence.",
                        invalid.Count);
                    return new AnalyzePastPapersResult
                    {
                        Success      = false,
                        Message      = $"{invalid.Count} LLM-generated records failed validation. No data was saved.",
                        RawLlmOutput = rawLlmOutput,
                        Probabilities = probabilities
                    };
                }

                // ── 5. Map & persist to PastPaperAnalytics table ───────────────
                var entities = probabilities.Select(p => new PastPaperAnalytic
                {
                    TopicName             = p.TopicName.Trim(),
                    ProbabilityPercentage = Math.Round(p.ProbabilityPercentage, 2),
                    Year                  = request.Year,
                    GeneratedByAgent      = true,
                    CreatedAt             = DateTime.UtcNow
                }).ToList();

                await _db.PastPaperAnalytics.AddRangeAsync(entities, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:Agent1] ✅ {N} PastPaperAnalytic rows saved to DB.", entities.Count);

                return new AnalyzePastPapersResult
                {
                    Success       = true,
                    Message       = $"Successfully analysed {entities.Count} topics and saved to database.",
                    RowsSaved     = entities.Count,
                    Probabilities = probabilities,
                    RawLlmOutput  = rawLlmOutput
                };
            }
            catch (TaskCanceledException tcEx) when (tcEx.InnerException is TimeoutException
                                                  || tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("[AIAgent:Agent1] LLM request timed out.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = "Groq API request timed out. Check network or increase TimeoutSeconds in appsettings.",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[AIAgent:Agent1] HTTP error calling Groq API.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = $"Groq API HTTP error: {httpEx.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:Agent1] Unexpected error.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = $"Unexpected error: {ex.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 2 — Study Planner (Lite-RAG)
        // ═══════════════════════════════════════════════════════════════════════

        /// <inheritdoc/>
        public async Task<GenerateStudyPlanResult> GenerateStudyPlanAsync(
            GenerateStudyPlanRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "[AIAgent:Agent2] GenerateStudyPlanAsync started — studentId={StudentId}, targetDate={Date}",
                request.StudentId, request.TargetExamDate.ToString("yyyy-MM-dd"));

            if (request.TargetExamDate <= DateTime.UtcNow.Date)
            {
                return Fail<GenerateStudyPlanResult>("TargetExamDate must be in the future.");
            }

            string rawLlmOutput = string.Empty;

            try
            {
                // ── 1. Lite-RAG: Load context from DB ──────────────────────────
                _logger.LogDebug("[AIAgent:Agent2] Loading SyllabusLimits and PastPaperAnalytics for RAG context...");

                var syllabusLimits = await _db.SyllabusLimits
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                var pastPaperAnalytics = await _db.PastPaperAnalytics
                    .AsNoTracking()
                    .OrderByDescending(p => p.ProbabilityPercentage)
                    .ToListAsync(cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:Agent2] RAG context: {SL} syllabus limits, {PP} past paper analytics loaded.",
                    syllabusLimits.Count, pastPaperAnalytics.Count);

                // ── 2. Build the massive RAG-injected system prompt ────────────
                var systemPrompt = BuildAgent2SystemPrompt(syllabusLimits, pastPaperAnalytics, request.TargetExamDate);
                var userMessage  = BuildAgent2UserMessage(request.StudentId, request.TargetExamDate);

                _logger.LogDebug("[AIAgent:Agent2] System prompt built ({Len} chars). Calling Groq LLM...", systemPrompt.Length);

                // ── 3. Call LLM ────────────────────────────────────────────────
                rawLlmOutput = await CallGroqAsync(systemPrompt, userMessage, cancellationToken);

                _logger.LogDebug("[AIAgent:Agent2] Raw LLM response ({Len} chars) received.", rawLlmOutput.Length);

                // ── 4. Strip markdown fences and validate JSON ─────────────────
                var cleanJson = StripMarkdownFences(rawLlmOutput);
                List<StudyDayDto> planDays;

                try
                {
                    planDays = JsonSerializer.Deserialize<List<StudyDayDto>>(cleanJson, _jsonOpts)
                        ?? throw new JsonException("Deserialised to null.");
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning(jsonEx,
                        "[AIAgent:Agent2] LLM returned malformed JSON. Raw output: {Raw}", rawLlmOutput);
                    return new GenerateStudyPlanResult
                    {
                        Success = false,
                        Message = $"LLM returned invalid JSON: {jsonEx.Message}",
                        RawLlmOutput = rawLlmOutput
                    };
                }

                // ── 5. Deterministic field-level validation ────────────────────
                var validPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "High", "Medium", "Low" };
                var invalidDays = planDays
                    .Where(d => d.Day <= 0
                             || string.IsNullOrWhiteSpace(d.Date)
                             || string.IsNullOrWhiteSpace(d.Topic)
                             || !validPriorities.Contains(d.Priority))
                    .ToList();

                if (invalidDays.Count > 0)
                {
                    _logger.LogWarning(
                        "[AIAgent:Agent2] {N} study day entries failed validation. Aborting persistence.",
                        invalidDays.Count);
                    return new GenerateStudyPlanResult
                    {
                        Success      = false,
                        Message      = $"{invalidDays.Count} study days failed validation. No plan was saved.",
                        PlanDays     = planDays,
                        RawLlmOutput = rawLlmOutput
                    };
                }

                // ── 6. Persist StudyPlan with IsApproved = false (HITL) ────────
                var studyPlan = new StudyPlan
                {
                    StudentId      = request.StudentId,
                    TargetExamDate = request.TargetExamDate,
                    PlanDetailsJson = JsonSerializer.Serialize(planDays, _jsonOpts),
                    IsApproved     = false,   // ← HUMAN-IN-THE-LOOP: admin must approve
                    CreatedAt      = DateTime.UtcNow
                };

                await _db.StudyPlans.AddAsync(studyPlan, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:Agent2] ✅ StudyPlan (Id={Id}) saved with IsApproved=false. Awaiting admin approval.",
                    studyPlan.Id);

                return new GenerateStudyPlanResult
                {
                    Success      = true,
                    Message      = $"Study plan generated with {planDays.Count} day(s). Awaiting admin approval (IsApproved=false).",
                    StudyPlanId  = studyPlan.Id,
                    IsApproved   = false,
                    PlanDays     = planDays,
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (TaskCanceledException tcEx) when (tcEx.InnerException is TimeoutException
                                                  || tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("[AIAgent:Agent2] LLM request timed out.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = "Groq API request timed out.",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[AIAgent:Agent2] HTTP error calling Groq API.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = $"Groq API HTTP error: {httpEx.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:Agent2] Unexpected error.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = $"Unexpected error: {ex.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Prompt Builders
        // ═══════════════════════════════════════════════════════════════════════

        private static string BuildAgent1SystemPrompt() =>
            """
            You are an expert A/L ICT Data Analyst specialising in Sri Lanka national examination past papers.
            Your sole task is to analyse the provided list of topics and compute how frequently each topic
            appeared across past A/L ICT examinations, then translate that into an estimated probability
            percentage (0–100) that each topic will appear in the next exam.

            STRICT OUTPUT RULES — violating any rule makes your response useless:
            1. Output ONLY a valid JSON array. No markdown. No code fences (```). No explanations. No preamble.
            2. Every element MUST exactly match this shape:
               {"topicName": "<string>", "probabilityPercentage": <number 0-100>}
            3. ProbabilityPercentage values across all topics MUST sum to approximately 100.
            4. TopicName must be a non-empty string exactly as provided in the input list.
            5. Do NOT add any extra fields. Do NOT wrap the array in an object.

            Example of valid output (for 2 topics):
            [{"topicName":"Networking","probabilityPercentage":30},{"topicName":"Logic Gates","probabilityPercentage":25}]
            """;

        private static string BuildAgent1UserMessage(List<string> topics, int year)
        {
            var sb = new StringBuilder();
            sb.AppendLine(year > 0
                ? $"Analyse the following A/L ICT topics from the {year} past paper:"
                : "Analyse the following A/L ICT topics from aggregated past papers:");
            sb.AppendLine();
            foreach (var topic in topics)
                sb.AppendLine($"- {topic}");
            sb.AppendLine();
            sb.AppendLine("Return ONLY the JSON array as specified. No other text.");
            return sb.ToString();
        }

        private static string BuildAgent2SystemPrompt(
            List<SyllabusLimit> syllabusLimits,
            List<PastPaperAnalytic> analytics,
            DateTime targetDate)
        {
            var sb = new StringBuilder();

            sb.AppendLine(
                "You are an expert A/L ICT Study Planner for Sri Lanka national curriculum students. " +
                "Your task is to generate a detailed, realistic, day-by-day study schedule.");
            sb.AppendLine();

            // ── Syllabus Boundaries (RAG) ──────────────────────────────────────
            sb.AppendLine("═══ SYLLABUS BOUNDARIES (MANDATORY) ═══");
            sb.AppendLine("You MUST strictly limit ALL content to these boundaries:");
            if (syllabusLimits.Count == 0)
            {
                sb.AppendLine("  (No specific limits found — use the standard A/L ICT syllabus.)");
            }
            else
            {
                foreach (var limit in syllabusLimits)
                {
                    sb.AppendLine($"  Topic: {limit.TopicName}");
                    sb.AppendLine($"    Allowed sub-topics : {limit.AllowedSubtopics}");
                    if (!string.IsNullOrWhiteSpace(limit.ExcludedSubtopics))
                        sb.AppendLine($"    EXCLUDED sub-topics: {limit.ExcludedSubtopics} — DO NOT include these under any circumstances.");
                }
            }
            sb.AppendLine();

            // ── Past Paper Probabilities (RAG) ─────────────────────────────────
            sb.AppendLine("═══ PAST PAPER PRIORITY WEIGHTS ═══");
            sb.AppendLine("Allocate MORE study days to HIGH-probability topics and FEWER to LOW-probability ones:");
            if (analytics.Count == 0)
            {
                sb.AppendLine("  (No past-paper data found — distribute topics evenly.)");
            }
            else
            {
                foreach (var a in analytics)
                    sb.AppendLine($"  {a.TopicName}: {a.ProbabilityPercentage}% probability");
            }
            sb.AppendLine();

            // ── Schedule constraints ───────────────────────────────────────────
            var today    = DateTime.UtcNow.Date;
            var daysLeft = (targetDate.Date - today).Days;

            sb.AppendLine("═══ SCHEDULE CONSTRAINTS ═══");
            sb.AppendLine($"  Start date : {today:yyyy-MM-dd} (today)");
            sb.AppendLine($"  End date   : {targetDate:yyyy-MM-dd} (exam day — last entry should be a light revision day)");
            sb.AppendLine($"  Total days : {daysLeft}");
            sb.AppendLine("  - Each day must have exactly ONE main topic.");
            sb.AppendLine("  - Subtopics must come from the Allowed list above.");
            sb.AppendLine("  - Priority must be exactly one of: High | Medium | Low (matching the past-paper weights).");
            sb.AppendLine("  - Include at least one 'Revision & Mock Test' day before the exam.");
            sb.AppendLine();

            // ── Output format ──────────────────────────────────────────────────
            sb.AppendLine("═══ STRICT OUTPUT RULES ═══");
            sb.AppendLine("1. Output ONLY a valid JSON array. No markdown. No code fences (```). No explanations.");
            sb.AppendLine("2. The array must contain exactly one entry per day from today to the exam date.");
            sb.AppendLine("3. Every element MUST exactly match this shape:");
            sb.AppendLine("   {\"day\":<int>,\"date\":\"<YYYY-MM-DD>\",\"topic\":\"<string>\",\"subtopics\":\"<comma-separated string>\",\"priority\":\"High|Medium|Low\"}");
            sb.AppendLine("4. Do NOT add extra fields. Do NOT wrap the array in an object.");

            return sb.ToString();
        }

        private static string BuildAgent2UserMessage(int studentId, DateTime targetDate) =>
            $"Generate the complete study plan for Student ID {studentId}. " +
            $"Target exam date: {targetDate:yyyy-MM-dd}. " +
            $"Return ONLY the JSON array — no other text.";

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Groq HTTP Helper
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Sends one chat-completion request to Groq (OpenAI-compatible format)
        /// and returns the raw text content from the first choice.
        /// Throws <see cref="HttpRequestException"/> or <see cref="JsonException"/> on failure.
        /// </summary>
        private async Task<string> CallGroqAsync(
            string systemPrompt,
            string userMessage,
            CancellationToken cancellationToken)
        {
            var model = _configuration["Groq:Model"] ?? "llama3-70b-8192";

            var requestBody = new GroqChatRequest
            {
                Model       = model,
                Temperature = 0.1f,   // Deliberately low for deterministic JSON
                MaxTokens   = 4096,
                Messages    =
                [
                    new GroqMessage { Role = "system", Content = systemPrompt },
                    new GroqMessage { Role = "user",   Content = userMessage  }
                ]
            };

            var bodyJson    = JsonSerializer.Serialize(requestBody, _jsonOpts);
            var httpContent = new StringContent(bodyJson, Encoding.UTF8, "application/json");

            var httpClient   = _httpClientFactory.CreateClient(HttpClientName);
            var httpResponse = await httpClient.PostAsync(string.Empty, httpContent, cancellationToken);
            var responseBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);

            if (!httpResponse.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "[AIAgent] Groq API returned HTTP {Status}: {Body}",
                    (int)httpResponse.StatusCode, responseBody);
                throw new HttpRequestException(
                    $"Groq API error {(int)httpResponse.StatusCode}: {responseBody}",
                    null,
                    httpResponse.StatusCode);
            }

            var groqResponse = JsonSerializer.Deserialize<GroqChatResponse>(responseBody, _jsonOpts)
                ?? throw new JsonException("Groq response envelope deserialised to null.");

            var content = groqResponse.Choices?.FirstOrDefault()?.Message?.Content
                ?? throw new JsonException("Groq response contained no choices or empty content.");

            return content;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Utilities
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Defensively strips leading ``` json ... ``` or ``` ... ``` code fences
        /// that LLMs sometimes add despite being instructed not to.
        /// </summary>
        private static string StripMarkdownFences(string raw)
        {
            var trimmed = raw.Trim();
            if (!trimmed.StartsWith("```")) return trimmed;

            var firstNewline = trimmed.IndexOf('\n');
            var lastFence    = trimmed.LastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline)
                return trimmed[(firstNewline + 1)..lastFence].Trim();

            return trimmed;
        }

        /// <summary>Convenience factory for early-exit failure results.</summary>
        private static T Fail<T>(string message) where T : new()
        {
            // Use pattern matching to set Success=false and Message without reflection overhead
            return typeof(T) switch
            {
                var t when t == typeof(AnalyzePastPapersResult) => (T)(object)new AnalyzePastPapersResult
                    { Success = false, Message = message },
                var t when t == typeof(GenerateStudyPlanResult) => (T)(object)new GenerateStudyPlanResult
                    { Success = false, Message = message },
                _ => new T()
            };
        }
    }
}
