using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers
{
    /// <summary>
    /// AssessmentController — Member 1 core controller.
    ///
    /// Three endpoints orchestrate the full student assessment lifecycle:
    ///   1. request-exam   → delegates to PlanningCoordinatorService (agentic AI workflow)
    ///   2. start-timer    → applies a DB transaction lock (idempotency guard)
    ///   3. submit         → persists answers, score, and marks session Completed
    /// </summary>
    [Route("api/assessment")]
    [ApiController]
    public class AssessmentController : ControllerBase
    {
        private readonly ApplicationDbContext        _context;
        private readonly PlanningCoordinatorService  _planner;
        private readonly ILogger<AssessmentController> _logger;

        public AssessmentController(
            ApplicationDbContext       context,
            PlanningCoordinatorService planner,
            ILogger<AssessmentController> logger)
        {
            _context = context;
            _planner = planner;
            _logger  = logger;
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

            // Create a pending ExamSession scaffold for this plan
            var session = new ExamSession
            {
                SessionId        = Guid.NewGuid().ToString(),
                Subject          = dto.Subject,
                Status           = "Pending",
                StartTime        = DateTime.UtcNow,
                AnswersJson      = "[]",
                TotalScore       = 0,
                IsTimerLocked    = false
            };

            _context.ExamSessions.Add(session);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message     = "Exam plan generated successfully by the Planning Coordinator Agent.",
                examSession = session,
                agenticPlan = System.Text.Json.JsonDocument.Parse(planJson).RootElement
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
                    s.IsTimerLocked
                })
                .ToListAsync();

            return Ok(sessions);
        }
    }
}
