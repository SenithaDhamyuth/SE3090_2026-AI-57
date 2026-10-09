using System.Security.Claims;
using System.Text.Json;
using BCrypt.Net;
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

        // Fetch the latest approved AND published study plan for this student
        var plan = await _db.StudyPlans
            .AsNoTracking()
            .Where(p => p.IsApproved && p.IsPublished && (p.StudentId == studentId || p.StudentId == 0))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (plan == null)
        {
            return NotFound(new { message = "No published study plan found. Please wait for your admin to publish a plan." });
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
    // Called by Flutter "Progress" tab to fetch the student's submitted attempts.
    // Returns sessions where StudentId matches (from QR field) OR where the
    // session GUID exists in the request. The latest submitted attempt remains
    // available even though the exam session returns to Ready for another try.
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
            .Where(s => s.EndTime != null && s.StudentProfileId == studentId)
            .OrderByDescending(s => s.EndTime)
            .Select(s => new
            {
                sessionGuid       = s.SessionId,
                subject           = s.Subject,
                title             = s.Title ?? s.Subject,
                totalScore        = s.TotalScore,
                endTime           = s.EndTime != null ? s.EndTime.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : null,
                durationMinutes   = s.DurationMinutes,
                questionsJson     = s.QuestionsJson,
                answersJson       = s.AnswersJson,
                originalObjective = s.OriginalObjective
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
                status = "Submitted",
                s.subject,
                s.title,
                s.totalScore,
                totalQuestions = qCount,
                s.endTime,
                s.durationMinutes,
                s.questionsJson,
                s.answersJson,
                s.originalObjective
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
            startTime        = session.StartTime,
            isTimerLocked    = session.IsTimerLocked,
            questionsJson    = session.QuestionsJson,  // raw JSON array of MCQs
            message          = "Exam session validated. You may begin.",
        });
    }

    /// <summary>
    /// Starts the timed attempt using its QR access code, or returns the
    /// existing timer state when the attempt has already started.
    /// </summary>
    [HttpPost("papers/start/{accessCode}")]
    public async Task<IActionResult> StartExamByAccessCode(
        string accessCode,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(accessCode))
            return BadRequest(new { message = "Access code is required." });

        var normalizedAccessCode = accessCode.Trim();
        var startedAt = DateTime.UtcNow;
        await _db.ExamSessions
            .Where(s => s.SessionId == normalizedAccessCode
                && (s.Status == "Ready" || s.Status == "Completed"))
            .ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(s => s.DurationMinutes, s => s.DurationMinutes > 0 ? s.DurationMinutes : 30)
                    .SetProperty(s => s.StartTime, startedAt)
                    .SetProperty(s => s.Status, "InProgress")
                    .SetProperty(s => s.IsTimerLocked, true),
                cancellationToken);

        var session = await _db.ExamSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SessionId == normalizedAccessCode, cancellationToken);

        if (session is null)
            return NotFound(new { message = "No exam session was found for this access code." });

        if (session.Status == "Abandoned")
            return BadRequest(new { message = "This exam session is no longer available.", status = session.Status });

        if (session.Status != "InProgress" || !session.IsTimerLocked)
        {
            return BadRequest(new { message = "This exam session is not ready to start.", status = session.Status });
        }

        var effectiveDurationMinutes = session.DurationMinutes > 0 ? session.DurationMinutes : 30;
        var elapsedSeconds = Math.Max(0, (int)(DateTime.UtcNow - session.StartTime).TotalSeconds);
        var remainingSeconds = Math.Max(0, effectiveDurationMinutes * 60 - elapsedSeconds);

        return Ok(new
        {
            sessionGuid = session.SessionId,
            status = session.Status,
            durationMinutes = effectiveDurationMinutes,
            remainingSeconds
        });
    }

    /// <summary>Returns the authoritative remaining time for a QR-authorized exam.</summary>
    [HttpGet("papers/timer/{accessCode}")]
    public async Task<IActionResult> GetExamTimer(
        string accessCode,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(accessCode))
            return BadRequest(new { message = "Access code is required." });

        var session = await _db.ExamSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SessionId == accessCode.Trim(), cancellationToken);

        if (session is null)
            return NotFound(new { message = "No exam session was found for this access code." });

        if (session.Status != "InProgress" || !session.IsTimerLocked)
            return Conflict(new { message = "The exam timer is not running.", status = session.Status });

        var effectiveDurationMinutes = session.DurationMinutes > 0 ? session.DurationMinutes : 30;
        var elapsedSeconds = Math.Max(0, (int)(DateTime.UtcNow - session.StartTime).TotalSeconds);
        var remainingSeconds = Math.Max(0, effectiveDurationMinutes * 60 - elapsedSeconds);

        return Ok(new
        {
            sessionGuid = session.SessionId,
            status = session.Status,
            durationMinutes = effectiveDurationMinutes,
            remainingSeconds
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

        if (session.Status != "InProgress" || !session.IsTimerLocked)
            return Conflict(new { message = "There is no active attempt to submit.", status = session.Status });

        var previousSessionScore = session.EndTime.HasValue ? session.TotalScore : 0;

        // Save this as the latest result and make the same QR available again.
        session.AnswersJson   = dto.AnswersJson ?? "[]";
        session.TotalScore    = dto.TotalScore;
        session.Status        = "Ready";
        session.EndTime       = DateTime.UtcNow;
        session.IsTimerLocked = false;

        // Update student's cumulative points if profile exists
        if (session.StudentProfileId > 0)
        {
            var profile = await _db.StudentProfiles
                .FirstOrDefaultAsync(p => p.Id == session.StudentProfileId, cancellationToken);

            if (profile != null)
            {
                profile.TotalPoints += dto.TotalScore - previousSessionScore;
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

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/student/profile
    //
    // Allows an authenticated student to update their display name.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("profile")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int studentId))
        {
            _logger.LogWarning("[StudentController] UpdateProfile: Invalid or missing NameIdentifier claim.");
            return Unauthorized(new { message = "Invalid student token." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.Id == studentId && u.Role == "Student",
            cancellationToken);

        if (user == null)
            return NotFound(new { message = "Student account not found." });

        // Update fields
        user.FullName = request.FullName.Trim();

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[StudentController] Profile updated for student {Id} ({Email}).",
            user.Id, user.Email);

        return Ok(new
        {
            message  = "Profile updated successfully.",
            fullName = user.FullName,
            email    = user.Email
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

/// <summary>Request body for PUT /api/student/profile.</summary>
public class UpdateProfileRequest
{
    /// <summary>Updated display name for the student.</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MinLength(2, ErrorMessage = "Full name must be at least 2 characters.")]
    [System.ComponentModel.DataAnnotations.MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

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
    public async Task<IActionResult> GetStudentMarks(
        [FromQuery] int? sessionId,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("[AdminMarksController] Fetching all completed exam sessions.");

        // Load the latest submitted result for each session.
        var rawSessions = await _db.ExamSessions
            .AsNoTracking()
            .Where(s => s.EndTime != null && (!sessionId.HasValue || s.Id == sessionId.Value))
            .OrderByDescending(s => s.EndTime)
            .Select(s => new
            {
                sessionId         = s.Id,
                sessionGuid       = s.SessionId,
                studentProfileId  = s.StudentProfileId,
                studentId         = s.StudentId,
                subject           = s.Subject,
                title             = s.Title ?? s.Subject,
                totalScore        = s.TotalScore,
                endTime           = s.EndTime,
                startTime         = s.StartTime,
                durationMinutes   = s.DurationMinutes,
                questionsJson     = s.QuestionsJson,
                originalObjective = s.OriginalObjective,
            })
            .ToListAsync(cancellationToken);

        // Enrich with student names via StudentProfiles → Users join
        var profileIds = rawSessions.Select(s => s.studentProfileId).Distinct().ToList();
        var profiles   = await _db.StudentProfiles
            .AsNoTracking()
            .Where(p => profileIds.Contains(p.Id))
            .Select(p => new { p.Id, p.UserId })
            .ToListAsync(cancellationToken);

        // Parse UserId strings into ints to join with Users
        var userIds = profiles
            .Select(p => int.TryParse(p.UserId, out var uid) ? uid : 0)
            .Where(uid => uid > 0)
            .Distinct()
            .ToList();

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName, u.Email })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var profileMap = profiles.ToDictionary(
            p => p.Id,
            p =>
            {
                if (int.TryParse(p.UserId, out var uid) && users.TryGetValue(uid, out var u))
                    return (name: u.FullName, email: u.Email);
                return (name: $"Student #{p.Id}", email: string.Empty);
            });

        // Count questions and build result
        var result = rawSessions.Select(s =>
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

            profileMap.TryGetValue(s.studentProfileId, out var student);

            return new
            {
                s.sessionId,
                s.sessionGuid,
                s.studentId,
                studentName   = student.name ?? $"Student #{s.studentId}",
                studentEmail  = student.email ?? string.Empty,
                s.subject,
                s.title,
                s.totalScore,
                totalQuestions  = qCount,
                endTime         = s.endTime?.ToString("yyyy-MM-dd HH:mm") + (s.endTime.HasValue ? " UTC" : string.Empty),
                startTime       = s.startTime.ToString("yyyy-MM-dd HH:mm") + " UTC",
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
