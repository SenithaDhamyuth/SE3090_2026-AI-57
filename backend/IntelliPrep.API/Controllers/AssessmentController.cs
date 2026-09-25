using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace IntelliPrep.API.Controllers
{
    /// <summary>
    /// AssessmentController — Member 1 &amp; 2 core controller.
    ///
    /// Endpoints:
    ///   1. request-exam           → PlanningCoordinatorService  (Groq agentic plan)
    ///   2. start-timer            → DB transaction lock (idempotency guard)
    ///   3. submit                 → persist answers + score → Completed
    ///   4. synthesize/{sessionId} → ContentSynthesizerService  (Groq MCQ generation, UC5.2)
    ///   5. sessions               → list all sessions (admin frontend)
    /// </summary>
    [Route("api/assessment")]
    [ApiController]
    public class AssessmentController : ControllerBase
    {
        private readonly ApplicationDbContext          _context;
        private readonly PlanningCoordinatorService    _planner;
        private readonly ContentSynthesizerService     _synthesizer;
        private readonly ILogger<AssessmentController> _logger;

        public AssessmentController(
            ApplicationDbContext          context,
            PlanningCoordinatorService    planner,
            ContentSynthesizerService     synthesizer,
            ILogger<AssessmentController> logger)
        {
            _context     = context;
            _planner     = planner;
            _synthesizer = synthesizer;
            _logger      = logger;
        }

        // ─────────────────────────────────────────────────────────────
        // POST /api/assessment/request-exam
        // Invokes the agentic PlanningCoordinatorService and scaffolds
        // an ExamSession record in "Pending" status.
        // ─────────────────────────────────────────────────────────────
        [HttpPost("request-exam")]
        public async Task<IActionResult> RequestExam([FromBody] RequestExamDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Objective))
                return BadRequest(new { error = "Objective is required." });

            _logger.LogInformation("[AssessmentController] request-exam called | Objective: {Obj}", dto.Objective);

            // Delegate to the Planning Coordinator (agentic AI workflow)
            var planJson = await _planner.GenerateExamPlanAsync(dto.Objective);

            // ── Parse requested question count from the objective string ──────
            // Regex finds the first integer mentioned (e.g. "4 questions" → 4).
            // Falls back to 5 if the user didn't specify a number.
            var countMatch             = Regex.Match(dto.Objective, @"\d+");
            var requestedQuestionCount = countMatch.Success
                ? Math.Clamp(int.Parse(countMatch.Value), 1, 50)  // cap at 50 for sanity
                : 5;

            // Create a pending ExamSession scaffold for this plan
            var session = new ExamSession
            {
                SessionId              = Guid.NewGuid().ToString(),
                Subject                = dto.Subject,
                Status                 = "Pending",
                StartTime              = DateTime.UtcNow,
                AnswersJson            = "[]",
                TotalScore             = 0,
                IsTimerLocked          = false,
                OriginalObjective      = dto.Objective,          // verbatim user intent
                RequestedQuestionCount = requestedQuestionCount, // parsed from objective
            };

            _context.ExamSessions.Add(session);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message                = "Exam plan generated successfully by the Planning Coordinator Agent.",
                examSession            = session,
                agenticPlan            = System.Text.Json.JsonDocument.Parse(planJson).RootElement,
                parsedQuestionCount    = requestedQuestionCount,
            });
        }

        // ─────────────────────────────────────────────────────────────
        // POST /api/assessment/start-timer
        // Transaction lock guard: prevents double-starting the same
        // session (IsTimerLocked acts as an optimistic concurrency flag).
        // ─────────────────────────────────────────────────────────────
        [HttpPost("start-timer")]
        public async Task<IActionResult> StartTimer([FromBody] StartTimerDto dto)
        {
            _logger.LogInformation("[AssessmentController] start-timer called | SessionId: {Id}", dto.SessionId);

            // Use an explicit DB transaction for atomicity (transaction lock pattern)
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var session = await _context.ExamSessions
                    .FirstOrDefaultAsync(s => s.Id == dto.SessionId);

                if (session == null)
                    return NotFound(new { error = $"ExamSession with ID {dto.SessionId} not found." });

                // ── Idempotency guard — prevent double-start ──────────
                if (session.IsTimerLocked)
                {
                    return Conflict(new
                    {
                        error   = "Timer is already locked and running for this session.",
                        session = new { session.Id, session.Status, session.StartTime, session.IsTimerLocked }
                    });
                }

                if (session.Status == "Completed")
                    return BadRequest(new { error = "Cannot start timer on a completed session." });

                // Apply transaction lock
                session.IsTimerLocked = true;
                session.Status        = "InProgress";
                session.StartTime     = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("[AssessmentController] Timer locked for session {Id}.", session.Id);

                return Ok(new
                {
                    message = "Timer started and locked successfully.",
                    session = new
                    {
                        session.Id,
                        session.SessionId,
                        session.Status,
                        session.StartTime,
                        session.IsTimerLocked
                    }
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "[AssessmentController] start-timer transaction rolled back for session {Id}.", dto.SessionId);
                return StatusCode(500, new { error = "An internal error occurred while starting the timer." });
            }
        }

        // ─────────────────────────────────────────────────────────────
        // POST /api/assessment/submit
        // Accepts the student's answers, persists them, updates the
        // TotalScore on StudentProfile, and marks the session Completed.
        // ─────────────────────────────────────────────────────────────
        [HttpPost("submit")]
        public async Task<IActionResult> SubmitExam([FromBody] SubmitExamDto dto)
        {
            _logger.LogInformation("[AssessmentController] submit called | SessionId: {Id}", dto.SessionId);

            var session = await _context.ExamSessions
                .FirstOrDefaultAsync(s => s.Id == dto.SessionId);

            if (session == null)
                return NotFound(new { error = $"ExamSession with ID {dto.SessionId} not found." });

            if (session.Status == "Completed")
                return BadRequest(new { error = "This session has already been submitted." });

            // Persist answers and score
            session.AnswersJson   = dto.AnswersJson;
            session.TotalScore    = dto.TotalScore;
            session.Status        = "Completed";
            session.EndTime       = DateTime.UtcNow;
            session.IsTimerLocked = false; // Release lock on completion

            // Update TotalPoints on the owning StudentProfile (if linked)
            if (session.StudentProfileId > 0)
            {
                var profile = await _context.StudentProfiles
                    .FirstOrDefaultAsync(p => p.Id == session.StudentProfileId);

                if (profile != null)
                {
                    profile.TotalPoints += dto.TotalScore;
                    _logger.LogInformation(
                        "[AssessmentController] StudentProfile {ProfileId} TotalPoints updated to {Points}.",
                        profile.Id, profile.TotalPoints);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message    = "Exam submitted successfully.",
                sessionId  = session.Id,
                totalScore = session.TotalScore,
                endTime    = session.EndTime,
                status     = session.Status
            });
        }

        // ─────────────────────────────────────────────────────────────
        // POST /api/assessment/synthesize/{sessionId}
        // UC5.2 — ContentSynthesizerService: reads historical ICT data
        // (Excel → DB → built-in seed), calls Groq LLM for 5 new MCQs,
        // stores them in QuestionsJson, and flips Status → "Ready".
        // ─────────────────────────────────────────────────────────────
        [HttpPost("synthesize/{sessionId:int}")]
        public async Task<IActionResult> SynthesizeQuestions(
            int    sessionId,
            [FromQuery] string subject = "ICT")
        {
            _logger.LogInformation(
                "[AssessmentController] synthesize called | SessionId: {Id} | Subject: {Sub}",
                sessionId, subject);

            // Validate session exists and is in a synthesizable state
            var session = await _context.ExamSessions.FindAsync(sessionId);
            if (session == null)
                return NotFound(new { error = $"ExamSession {sessionId} not found." });

            if (session.Status == "Completed")
                return BadRequest(new { error = "Cannot synthesize questions for a completed session." });

            if (session.Status == "Ready")
            {
                // Idempotent: return the already-synthesized questions
                _logger.LogInformation(
                    "[AssessmentController] Session {Id} already has synthesized questions. Returning cached.", sessionId);

                return Ok(new
                {
                    message      = "Questions already synthesized for this session.",
                    sessionId,
                    status       = session.Status,
                    questionsJson = session.QuestionsJson
                });
            }

            try
            {
                // Use Subject from query param; fall back to session's Subject field
                var effectiveSubject = !string.IsNullOrWhiteSpace(subject)
                    ? subject
                    : (!string.IsNullOrWhiteSpace(session.Subject) ? session.Subject : "ICT");

                var generatedMcqs = await _synthesizer.SynthesizeAndPersistAsync(sessionId, effectiveSubject);

                return Ok(new
                {
                    message          = $"Successfully synthesized {generatedMcqs.Count} questions for '{effectiveSubject}'.",
                    sessionId,
                    subject          = effectiveSubject,
                    questionsCount   = generatedMcqs.Count,
                    status           = "Ready",
                    questions        = generatedMcqs
                });
            }
            catch (KeyNotFoundException knfEx)
            {
                _logger.LogError(knfEx, "[AssessmentController] Session {Id} not found during synthesis.", sessionId);
                return NotFound(new { error = knfEx.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AssessmentController] Synthesis failed for session {Id}.", sessionId);
                return StatusCode(500, new { error = "An error occurred during question synthesis. Please retry." });
            }
        }

        // ─────────────────────────────────────────────────────────────
        // GET /api/assessment/sessions
        // Returns all exam sessions (for the admin ExamSessions frontend)
        // ─────────────────────────────────────────────────────────────
        [HttpGet("sessions")]
        public async Task<IActionResult> GetAllSessions()
        {
            var sessions = await _context.ExamSessions
                .OrderByDescending(s => s.StartTime)
                .Select(s => new
                {
                    s.Id,
                    s.SessionId,
                    s.StudentProfileId,
                    s.StudentId,
                    s.Subject,
                    s.Status,
                    s.StartTime,
                    s.EndTime,
                    s.TotalScore,
                    s.IsTimerLocked,
                    // Full JSON string — parsed by ViewQuestionsModal in the React frontend
                    s.QuestionsJson,
                    // Convenience flag so the table Actions column can show "Ready" badge
                    questionsReady = s.QuestionsJson != "[]" && s.QuestionsJson != ""
                })
                .ToListAsync();

            return Ok(sessions);
        }

        [HttpDelete("sessions/{id:int}")]
        public async Task<IActionResult> DeleteSession(int id)
        {
            var session = await _context.ExamSessions.FindAsync(id);
            if (session == null)
                return NotFound(new { error = $"ExamSession with ID {id} not found." });

            _context.ExamSessions.Remove(session);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"ExamSession {id} deleted successfully.", deletedId = id });
        }
    }
}
