using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

/// <summary>
/// AIAgentController — exposes the two AI agents and the human-in-the-loop
/// study plan approval endpoint to the React Admin Dashboard.
///
/// All endpoints require the caller to be authenticated with the "Admin" role.
/// Route: api/aiagent
/// </summary>
[ApiController]
[Route("api/aiagent")]
[Authorize(Roles = "Admin")]
public class AIAgentController : ControllerBase
{
    private readonly IAIAgentService      _agentService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AIAgentController> _logger;

    public AIAgentController(
        IAIAgentService           agentService,
        ApplicationDbContext      db,
        ILogger<AIAgentController> logger)
    {
        _agentService = agentService;
        _db           = db;
        _logger       = logger;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 1 — POST api/aiagent/analyze-papers
    // Agent 1: Past Paper Analyst
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Triggers Agent 1 (Past Paper Analyst).
    ///
    /// Sends the supplied topic list to the Groq LLM, which computes
    /// probability percentages for each topic based on historical frequency.
    /// Valid results are persisted to the PastPaperAnalytics table.
    /// </summary>
    /// <remarks>
    /// Sample request body:
    /// <code>
    /// {
    ///   "topics": ["Networking", "Logic Gates", "Database Management"],
    ///   "year": 2024
    /// }
    /// </code>
    /// </remarks>
    [HttpPost("analyze-papers")]
    [ProducesResponseType(typeof(AnalyzePastPapersResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> AnalyzePapers(
        [FromBody] AnalyzePastPapersRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (request.Topics == null || request.Topics.Count == 0)
            return BadRequest(new { message = "At least one topic must be provided in the 'topics' array." });

        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered AnalyzePapers — {Count} topics.",
            adminEmail, request.Topics.Count);

        var result = await _agentService.AnalyzePastPapersAsync(request, cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning(
                "[AIAgentController] AnalyzePapers failed: {Msg}", result.Message);

            // 400 for validation/prompt failures; the service never throws so
            // any failure here is a bad-input or LLM-output problem.
            return BadRequest(new
            {
                message      = result.Message,
                rawLlmOutput = result.RawLlmOutput
            });
        }

        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 2 — POST api/aiagent/generate-plan
    // Agent 2: Study Planner (Lite-RAG)
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Triggers Agent 2 (Study Planner).
    ///
    /// Loads SyllabusLimits and PastPaperAnalytics from the database as RAG
    /// context, then calls the Groq LLM to generate a day-by-day study plan.
    /// The resulting StudyPlan row is saved with <c>IsApproved = false</c>.
    /// An admin must call <c>PUT approve-plan/{planId}</c> before the student
    /// can see the plan.
    /// </summary>
    /// <remarks>
    /// Sample request body:
    /// <code>
    /// {
    ///   "studentId": 7,
    ///   "targetExamDate": "2026-12-15T00:00:00Z"
    /// }
    /// </code>
    /// </remarks>
    [HttpPost("generate-plan")]
    [ProducesResponseType(typeof(GenerateStudyPlanResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GeneratePlan(
        [FromBody] GenerateStudyPlanRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (request.StudentId <= 0)
            return BadRequest(new { message = "A valid StudentId (> 0) is required." });

        if (request.TargetExamDate <= DateTime.UtcNow.Date)
            return BadRequest(new { message = "TargetExamDate must be a future date." });

        // Verify the student exists before spending an LLM call
        var studentExists = await _db.Users.AnyAsync(
            u => u.Id == request.StudentId && u.Role == "Student",
            cancellationToken);

        if (!studentExists)
            return NotFound(new { message = $"No student account found with Id = {request.StudentId}." });

        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered GeneratePlan for studentId={Id}, target={Date}.",
            adminEmail, request.StudentId, request.TargetExamDate.ToString("yyyy-MM-dd"));

        var result = await _agentService.GenerateStudyPlanAsync(request, cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning(
                "[AIAgentController] GeneratePlan failed: {Msg}", result.Message);

            return BadRequest(new
            {
                message      = result.Message,
                rawLlmOutput = result.RawLlmOutput
            });
        }

        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 3 — PUT api/aiagent/approve-plan/{planId}
    // Human-in-the-loop approval step
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Approves an AI-generated study plan (human-in-the-loop step).
    ///
    /// Fetches the <see cref="StudyPlan"/> by <paramref name="planId"/>,
    /// sets <c>IsApproved = true</c>, records which admin approved it and when,
    /// then persists the changes. After this call the student can view their plan.
    /// </summary>
    [HttpPut("approve-plan/{planId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApprovePlan(
        [FromRoute] int planId,
        CancellationToken cancellationToken)
    {
        if (planId <= 0)
            return BadRequest(new { message = "planId must be a positive integer." });

        var plan = await _db.StudyPlans.FindAsync([planId], cancellationToken);

        if (plan is null)
            return NotFound(new { message = $"Study plan with Id = {planId} was not found." });

        if (plan.IsApproved)
        {
            return BadRequest(new
            {
                message    = $"Study plan {planId} has already been approved.",
                approvedBy = plan.ApprovedByEmail,
                approvedAt = plan.ApprovedAt
            });
        }

        // ── Human-in-the-loop: stamp who approved and when ──────────────
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";

        plan.IsApproved      = true;
        plan.ApprovedByEmail = adminEmail;
        plan.ApprovedAt      = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[AIAgentController] ✅ Study plan Id={PlanId} approved by '{Admin}' at {Time}.",
            planId, adminEmail, plan.ApprovedAt);

        return Ok(new
        {
            message      = $"Study plan {planId} has been approved successfully.",
            studyPlanId  = plan.Id,
            studentId    = plan.StudentId,
            isApproved   = plan.IsApproved,
            approvedBy   = plan.ApprovedByEmail,
            approvedAt   = plan.ApprovedAt
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 4 — GET api/aiagent/plans
    // List all study plans (with approval status) for the admin dashboard
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Returns all study plans ordered by creation date (newest first),
    /// so the admin dashboard can display pending-approval items at a glance.
    /// </summary>
    [HttpGet("plans")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllPlans(CancellationToken cancellationToken)
    {
        var plans = await _db.StudyPlans
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.StudentId,
                targetExamDate = p.TargetExamDate.ToString("yyyy-MM-dd"),
                p.IsApproved,
                p.ApprovedByEmail,
                approvedAt = p.ApprovedAt.HasValue
                    ? p.ApprovedAt.Value.ToString("yyyy-MM-dd HH:mm") + " UTC"
                    : null,
                createdAt  = p.CreatedAt.ToString("yyyy-MM-dd HH:mm") + " UTC",
                // Omit PlanDetailsJson to keep the list response lightweight
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            totalPlans   = plans.Count,
            pendingCount = plans.Count(p => !p.IsApproved),
            plans
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 5 — GET api/aiagent/plans/{planId}
    // Fetch the full plan detail including the JSON schedule
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Returns the full study plan details for a given <paramref name="planId"/>,
    /// including the raw <c>PlanDetailsJson</c> schedule array.
    /// </summary>
    [HttpGet("plans/{planId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlanById(
        [FromRoute] int planId,
        CancellationToken cancellationToken)
    {
        var plan = await _db.StudyPlans
            .AsNoTracking()
            .Where(p => p.Id == planId)
            .FirstOrDefaultAsync(cancellationToken);

        if (plan is null)
            return NotFound(new { message = $"Study plan with Id = {planId} was not found." });

        return Ok(new
        {
            plan.Id,
            plan.StudentId,
            targetExamDate  = plan.TargetExamDate.ToString("yyyy-MM-dd"),
            plan.IsApproved,
            plan.ApprovedByEmail,
            approvedAt      = plan.ApprovedAt?.ToString("yyyy-MM-dd HH:mm") + (plan.ApprovedAt.HasValue ? " UTC" : string.Empty),
            createdAt       = plan.CreatedAt.ToString("yyyy-MM-dd HH:mm") + " UTC",
            planDetailsJson = plan.PlanDetailsJson   // full schedule for rendering
        });
    }
}
