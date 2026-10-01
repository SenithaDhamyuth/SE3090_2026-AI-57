using System.Security.Claims;
using System.Text.Json;
using IntelliPrep.API.Data;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

[ApiController]
[Route("api/student")]
public class StudentController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<StudentController> _logger;

    public StudentController(ApplicationDbContext db, ILogger<StudentController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Fetches the latest approved AI study plan for the currently authenticated student.
    /// Used by the Flutter mobile app.
    /// </summary>
    [HttpGet("my-plan")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyPlan(CancellationToken cancellationToken)
    {
        // Extract student ID from the JWT claims
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        if (!int.TryParse(userIdClaim, out int studentId))
        {
            _logger.LogWarning("[StudentController] Invalid or missing NameIdentifier claim.");
            return Unauthorized(new { message = "Invalid student token." });
        }

        // Fetch the latest approved study plan for this student
        var plan = await _db.StudyPlans
            .AsNoTracking()
            .Where(p => p.IsApproved && (p.StudentId == studentId || p.StudentId == 0))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (plan == null)
        {
            return NotFound(new { message = "No approved study plan found. Waiting for admin approval." });
        }

        try
        {
            // Parse the JSON array to return structured JSON rather than an escaped string
            var planDetails = JsonSerializer.Deserialize<object>(plan.PlanDetailsJson);
            
            return Ok(new
            {
                planId = plan.Id,
                approvedAt = plan.ApprovedAt,
                schedule = planDetails
            });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "[StudentController] Failed to deserialize PlanDetailsJson for plan {Id}", plan.Id);
            return StatusCode(500, new { message = "Internal error parsing study plan details." });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/student/my-results
    //
    // Called by Flutter "Progress" tab to fetch the student's completed exams.
    // Returns sessions where StudentId matches (from QR field) OR where the
    // session GUID exists in the request.  Since Flutter submits anonymously,
    // we return any Completed session associated with the student's JWT userId.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("my-results")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyResults(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int studentId))
            return Unauthorized(new { message = "Invalid student token." });

        // We match on StudentProfileId since that is stamped when session is created
        var sessions = await _db.ExamSessions
            .AsNoTracking()
            .Where(s => s.Status == "Completed" && s.StudentProfileId == studentId)
            .OrderByDescending(s => s.EndTime)
            .Select(s => new
            {
                sessionGuid     = s.SessionId,
                subject         = s.Subject,
                totalScore      = s.TotalScore,
                endTime         = s.EndTime != null ? s.EndTime.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : null,
                durationMinutes = s.DurationMinutes,
                questionsJson   = s.QuestionsJson,
            })
            .ToListAsync(cancellationToken);

        // Calculate question count per session
        var results = sessions.Select(s =>
        {
            int qCount = 0;
            try
            {
                if (!string.IsNullOrWhiteSpace(s.questionsJson) && s.questionsJson != "[]")
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(s.questionsJson);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                        qCount = doc.RootElement.GetArrayLength();
                }
            }
            catch { /* ignore */ }

            return new
            {
                s.sessionGuid,
                s.subject,
                s.totalScore,
                totalQuestions = qCount,
                s.endTime,
                s.durationMinutes,
            };
        }).ToList();

        return Ok(new { results });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/student/papers/join/{accessCode}
    //
    // Called by the Flutter QR scanner (UC2.2) immediately after a QR scan.
    // The QR code encodes the session's GUID (ExamSession.SessionId).
    //
    // Returns the session metadata + questions JSON so the Flutter app can
    // start the timed exam. No auth required — the access code IS the auth.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("papers/join/{accessCode}")]
    public async Task<IActionResult> JoinExamByAccessCode(
        string accessCode,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[StudentController] papers/join called | AccessCode: {Code}", accessCode);

        if (string.IsNullOrWhiteSpace(accessCode))
            return BadRequest(new { message = "Access code is required." });

        // Trim any whitespace / URL-encoding artefacts
        accessCode = accessCode.Trim();

        // Look up the session by its GUID (SessionId field)
        var session = await _db.ExamSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SessionId == accessCode, cancellationToken);

        if (session == null)
        {
            _logger.LogWarning(
                "[StudentController] papers/join — no session found for code '{Code}'.", accessCode);
            return NotFound(new
            {
                message    = "Invalid or expired access code. Please ask your teacher to regenerate the QR.",
                accessCode
            });
        }

        // Guard: only expose sessions that have questions ready
        if (session.Status == "Pending")
            return BadRequest(new
            {
                message = "This exam has not been prepared yet. Questions are still being generated.",
                status  = session.Status
            });

        // Guard: block access to sessions awaiting admin approval
        if (session.Status == "PendingAdminApproval")
            return StatusCode(403, new
            {
                message = "This exam is pending admin approval. Your tutor must approve it before you can begin.",
                status  = session.Status
            });

        if (session.Status == "Completed")
            return BadRequest(new
            {
                message = "This exam session has already been completed.",
                status  = session.Status
            });

        if (session.Status == "Abandoned")
            return StatusCode(410, new
            {
                message = "This exam session was rejected by an admin and is no longer available.",
                status  = session.Status
            });

        _logger.LogInformation(
            "[StudentController] papers/join — session {Id} found | Status: {Status}",
            session.Id, session.Status);

        // Return everything the Flutter app needs to start the exam
        return Ok(new
        {
            sessionDbId      = session.Id,            // int PK — used for POST /submit
            sessionGuid      = session.SessionId,      // GUID used as QR payload
            subject          = session.Subject,
            durationMinutes  = session.DurationMinutes > 0 ? session.DurationMinutes : 30,
            status           = session.Status,
            questionsJson    = session.QuestionsJson,  // raw JSON array of MCQs
            message          = "Exam session validated. You may begin.",
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/student/submit
    //
    // Called by the Flutter app when the student submits or the timer expires.
    // Accepts the session GUID (not the int PK) so the Flutter side never has
    // to know the DB primary key.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("submit")]
    public async Task<IActionResult> SubmitExam(
        [FromBody] StudentSubmitDto dto,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "[StudentController] submit called | SessionGuid: {Guid}", dto.SessionGuid);

        if (string.IsNullOrWhiteSpace(dto.SessionGuid))
            return BadRequest(new { message = "sessionGuid is required." });

        var session = await _db.ExamSessions
            .FirstOrDefaultAsync(s => s.SessionId == dto.SessionGuid, cancellationToken);

        if (session == null)
            return NotFound(new { message = $"No exam session found for GUID '{dto.SessionGuid}'." });

        if (session.Status == "Completed")
        {
            _logger.LogInformation(
                "[StudentController] Session {Guid} already submitted — returning idempotent OK.",
                dto.SessionGuid);
            return Ok(new
            {
                message    = "Exam already submitted (idempotent).",
                sessionId  = session.Id,
                totalScore = session.TotalScore,
                status     = session.Status
            });
        }

        // Persist answers and mark as Completed
        session.AnswersJson   = dto.AnswersJson ?? "[]";
        session.TotalScore    = dto.TotalScore;
        session.Status        = "Completed";
        session.EndTime       = DateTime.UtcNow;
        session.IsTimerLocked = false;

        // Update student's cumulative points if profile exists
        if (session.StudentProfileId > 0)
        {
            var profile = await _db.StudentProfiles
                .FirstOrDefaultAsync(p => p.Id == session.StudentProfileId, cancellationToken);

            if (profile != null)
            {
                profile.TotalPoints += dto.TotalScore;
                _logger.LogInformation(
                    "[StudentController] StudentProfile {ProfileId} TotalPoints → {Points}.",
                    profile.Id, profile.TotalPoints);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[StudentController] Session {Guid} submitted | Score: {Score}",
            dto.SessionGuid, session.TotalScore);

        return Ok(new
        {
            message    = "Exam submitted successfully.",
            sessionId  = session.Id,
            totalScore = session.TotalScore,
            endTime    = session.EndTime,
            status     = session.Status
        });
    }
}

/// <summary>Request body for POST /api/student/submit (Flutter → backend).</summary>
public class StudentSubmitDto
{
    /// <summary>GUID string from the QR code (ExamSession.SessionId).</summary>
    public string SessionGuid { get; set; } = string.Empty;

    /// <summary>JSON-encoded answers map, e.g. {"1":2,"2":0}.</summary>
    public string? AnswersJson { get; set; } = "[]";

    /// <summary>Score calculated client-side.</summary>
    public int TotalScore { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN MARKS CONTROLLER
// GET /api/admin/marks
// Returns all completed exam sessions for the admin Student Marks dashboard.
// ─────────────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/admin")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public class AdminMarksController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AdminMarksController> _logger;

    public AdminMarksController(ApplicationDbContext db, ILogger<AdminMarksController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Returns all completed exam sessions with student info for the admin marks dashboard.
    /// </summary>
    [HttpGet("marks")]
    public async Task<IActionResult> GetStudentMarks(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[AdminMarksController] Fetching all completed exam sessions.");

        var sessions = await _db.ExamSessions
            .AsNoTracking()
            .Where(s => s.Status == "Completed")
            .OrderByDescending(s => s.EndTime)
            .Select(s => new
            {
                sessionId       = s.Id,
                sessionGuid     = s.SessionId,
                studentId       = s.StudentId,
                subject         = s.Subject,
                totalScore      = s.TotalScore,
                totalQuestions  = 0, // calculated below
                endTime         = s.EndTime != null ? s.EndTime.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : null,
                startTime       = s.StartTime.ToString("yyyy-MM-dd HH:mm") + " UTC",
                durationMinutes = s.DurationMinutes,
                questionsJson   = s.QuestionsJson,
                originalObjective = s.OriginalObjective,
            })
            .ToListAsync(cancellationToken);

        // Count questions from the JSON
        var result = sessions.Select(s =>
        {
            int qCount = 0;
            try
            {
                if (!string.IsNullOrWhiteSpace(s.questionsJson) && s.questionsJson != "[]")
                {
                    var arr = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(s.questionsJson);
                    if (arr.ValueKind == System.Text.Json.JsonValueKind.Array)
                        qCount = arr.GetArrayLength();
                }
            }
            catch { /* ignore */ }

            return new
            {
                s.sessionId,
                s.sessionGuid,
                s.studentId,
                s.subject,
                s.totalScore,
                totalQuestions  = qCount,
                s.endTime,
                s.startTime,
                s.durationMinutes,
                s.originalObjective,
            };
        }).ToList();

        return Ok(new
        {
            totalSessions = result.Count,
            sessions      = result
        });
    }
}

