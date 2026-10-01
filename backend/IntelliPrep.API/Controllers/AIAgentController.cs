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
    private readonly IntelliPrep.API.Services.INotificationService _notifier;
    private readonly ValidationAgentService _validationAgent;

    public AIAgentController(
        IAIAgentService           agentService,
        ApplicationDbContext      db,
        ILogger<AIAgentController> logger,
        IntelliPrep.API.Services.INotificationService notifier,
        ValidationAgentService    validationAgent)
    {
        _agentService    = agentService;
        _db              = db;
        _logger          = logger;
        _notifier        = notifier;
        _validationAgent = validationAgent;
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
    // Endpoint 2 — GET api/aiagent/predict-distribution
    // Agent 1b: Data Analyst — deterministic weighted probability engine
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Triggers Agent 1b (Data Analyst).
    ///
    /// Reads every question from the <c>Questions</c> table, groups by
    /// <c>Lesson_Name</c> and <c>Year</c>, applies exponential-decay weighting
    /// (recent years carry more weight), then distributes a 50-question paper
    /// using the Hamilton largest-remainder method — guaranteeing the total
    /// equals exactly 50.  Each topic also receives a trend label
    /// ("Rising" / "Falling" / "Stable") from OLS linear regression.
    ///
    /// This endpoint is <b>fully deterministic</b> (no LLM call) and is safe
    /// to call repeatedly without side effects.
    /// </summary>
    [HttpGet("predict-distribution")]
    [ProducesResponseType(typeof(PredictTopicDistributionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> PredictDistribution(CancellationToken cancellationToken)
    {
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered PredictDistribution.", adminEmail);

        var result = await _agentService.PredictTopicDistributionAsync(cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning(
                "[AIAgentController] PredictDistribution failed: {Msg}", result.Message);
            return BadRequest(new { message = result.Message });
        }

        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 3 — POST api/aiagent/generate-paper
    // Agent 3: Predicted Paper Generator (Chain of Agent 1b -> Agent 2 -> Agent 3)
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Triggers the full 3-agent predicted paper generation pipeline.
    ///
    /// 1. Runs the Data Analyst (Agent 1b) to get the weighted topic distribution.
    /// 2. Runs the Web Researcher (Agent 2) to gather current real-world tech events.
    /// 3. Calls the Paper Generator (Agent 3) to produce exactly 50 MCQs conforming
    ///    to the statistical distribution and RAG context (SyllabusLimits + Research).
    /// </summary>
    [HttpPost("generate-paper")]
    [ProducesResponseType(typeof(GeneratePaperResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GeneratePaper(
        [FromBody] GeneratePaperRequest request,
        CancellationToken cancellationToken)
    {
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered GeneratePaper.", adminEmail);

        var result = await _agentService.GeneratePredictedPaperAsync(request, cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning(
                "[AIAgentController] GeneratePaper failed: {Msg}", result.Message);

            return BadRequest(new
            {
                message      = result.Message,
                rawLlmOutput = result.RawLlmOutput
            });
        }

        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint 4 — POST api/aiagent/generate-plan
    // Agent 4: Study Planner (Lite-RAG)
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
    ///   "excludedTopics": ["Boolean Algebra", "File Handling"]
    /// }
    /// </code>
    /// <c>excludedTopics</c> is optional — omit it or pass an empty array to
    /// include all topics in scope.
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

        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered GeneratePlan.",
            adminEmail);

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
        [FromBody] ApproveStudyPlanRequest request,
        CancellationToken cancellationToken)
    {
        if (planId <= 0)
            return BadRequest(new { message = "planId must be a positive integer." });

        if (request.PlanDetailsJson == null || request.PlanDetailsJson.Count != 7)
            return BadRequest(new { message = "planDetailsJson must contain exactly 7 study days." });

        var validPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "High", "Medium", "Low" };
        var invalidDays = request.PlanDetailsJson
            .Select((day, index) => new { day, expectedDay = index + 1 })
            .Where(item => item.day is null
                || item.day.Day != item.expectedDay
                || string.IsNullOrWhiteSpace(item.day.Topic)
                || string.IsNullOrWhiteSpace(item.day.Subtopics)
                || !validPriorities.Contains(item.day.Priority))
            .ToList();

        if (invalidDays.Count > 0)
            return BadRequest(new { message = "Each day must have its expected day number, topic, subtopics, and a valid priority (High, Medium, or Low)." });

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

        // ── Human-in-the-loop: save edited plan and stamp who approved ──────────────
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown-admin";

        plan.PlanDetailsJson = System.Text.Json.JsonSerializer.Serialize(request.PlanDetailsJson, new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
        plan.IsApproved      = true;
        plan.ApprovedByEmail = adminEmail;
        plan.ApprovedAt      = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[AIAgentController] ✅ Study plan Id={PlanId} approved by '{Admin}' at {Time}.",
            planId, adminEmail, plan.ApprovedAt);

        // ── Third-party notification: email the student ─────────────────
        // Fetch the student's registered email from the Users table.
        var student = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == plan.StudentId)
            .Select(u => new { u.Email, u.FullName })
            .FirstOrDefaultAsync(cancellationToken);

        if (student is not null)
        {
            // Fire-and-forget: notification failure must not affect the approval response.
            _ = _notifier.SendApprovalEmailAsync(
                    student.Email,
                    student.FullName,
                    "ICT Study Plan",
                    cancellationToken);
        }
        else
        {
            _logger.LogWarning(
                "[AIAgentController] Student {Id} not found in Users table — skipping email.",
                plan.StudentId);
        }

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
            plan.IsApproved,
            plan.ApprovedByEmail,
            approvedAt      = plan.ApprovedAt?.ToString("yyyy-MM-dd HH:mm") + (plan.ApprovedAt.HasValue ? " UTC" : string.Empty),
            createdAt       = plan.CreatedAt.ToString("yyyy-MM-dd HH:mm") + " UTC",
            planDetailsJson = plan.PlanDetailsJson   // full schedule for rendering
        });
    }

    /// <summary>Rejects and deletes a pending study plan.</summary>
    [HttpDelete("plans/{planId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeletePendingPlan(
        [FromRoute] int planId,
        CancellationToken cancellationToken)
    {
        var plan = await _db.StudyPlans.FindAsync([planId], cancellationToken);
        if (plan is null)
            return NotFound(new { message = $"Study plan with Id = {planId} was not found." });

        _db.StudyPlans.Remove(plan);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "[AIAgentController] ✅ Study plan Id={PlanId} deleted by admin.",
            planId);

        return Ok(new { message = $"Study plan #{planId} has been deleted successfully." });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Endpoint — POST api/aiagent/synthesize-exam/{sessionId}
    // Agent 3 (ExamSynthesizerAgent) → Agent 4 (ValidationAgentService)
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Runs the Agent 3 → Agent 4 agentic pipeline for exam MCQ synthesis:
    ///
    /// 1. Agent 3 (<c>ExamSynthesizerAgent</c>): Fetches syllabus constraints via its
    ///    built-in "FetchSyllabusLimits" Tool, loads few-shot seed questions, builds a
    ///    grounded prompt, and calls the Groq LLM to generate exactly the requested MCQs.
    ///
    /// 2. Agent 4 (<c>ValidationAgentService</c>): Runs three deterministic checks:
    ///    (a) Exact question count, (b) exactly 5 options per question, (c) correct
    ///    option index is within range.  On failure it injects the error list back into
    ///    Agent 3 and retries (max <c>ValidationAgentService.MaxRetries</c> = 2 extra attempts).
    ///
    /// 3. On validation pass: saves the questions JSON to <c>ExamSession.QuestionsJson</c>
    ///    and sets <c>Status = "PendingAdminApproval"</c>.
    /// </summary>
    /// <param name="sessionId">The ID of the target ExamSession to persist questions into.</param>
    /// <param name="request">
    /// The Agent 3 input contract carrying objective, subject, question count, and optional
    /// topic distribution.
    /// </param>
    /// <remarks>
    /// Sample request body:
    /// <code>
    /// {
    ///   "subject": "Networking",
    ///   "objective": "Focus on OSI model layers and TCP/IP protocols",
    ///   "requestedQuestionCount": 10,
    ///   "topicDistribution": { "OSI Model": 5, "TCP/IP": 5 }
    /// }
    /// </code>
    /// </remarks>
    [HttpPost("synthesize-exam/{sessionId:int}")]
    [ProducesResponseType(typeof(AgentValidationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AgentValidationResult), StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SynthesizeExam(
        [FromRoute] int            sessionId,
        [FromBody]  SynthesizerInput request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (sessionId <= 0)
            return BadRequest(new { message = "sessionId must be a positive integer." });

        if (!string.IsNullOrWhiteSpace(request.Subject) == false)
            return BadRequest(new { message = "subject is required." });

        // Verify session exists and grab the actual constraints the student requested
        var session = await _db.ExamSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null)
            return NotFound(new { message = $"ExamSession with Id={sessionId} was not found." });

        // CRITICAL FIX: Ignore the generic DTO values. Use the exact constraints saved in the database
        // when the student first requested the exam.
        var overriddenRequest = new SynthesizerInput
        {
            Subject = request.Subject,
            Objective = !string.IsNullOrWhiteSpace(session.OriginalObjective) ? session.OriginalObjective : request.Objective,
            RequestedQuestionCount = session.RequestedQuestionCount > 0 ? session.RequestedQuestionCount : request.RequestedQuestionCount,
            TopicDistribution = request.TopicDistribution
        };

        if (overriddenRequest.RequestedQuestionCount <= 0)
            return BadRequest(new { message = "requestedQuestionCount must be greater than 0." });

        var adminEmail = User.FindFirstValue(System.Security.Claims.ClaimTypes.Email) ?? "unknown-admin";
        _logger.LogInformation(
            "[AIAgentController] Admin '{Admin}' triggered SynthesizeExam | SessionId={SessionId} | Subject='{Subject}' | Exact DB Count={Count} | DB Objective='{Obj}'",
            adminEmail, sessionId, overriddenRequest.Subject, overriddenRequest.RequestedQuestionCount, overriddenRequest.Objective);

        // ── Run Agent 3 → Agent 4 pipeline ────────────────────────────────
        var result = await _validationAgent.ValidateAndPersistAsync(overriddenRequest, sessionId);

        if (!result.Success)
        {
            _logger.LogWarning(
                "[AIAgentController] SynthesizeExam failed after {Attempts} attempt(s): {Msg}",
                result.AttemptsTaken, result.Message);

            // 422 Unprocessable: the pipeline ran but could not produce valid output
            return UnprocessableEntity(result);
        }

        _logger.LogInformation(
            "[AIAgentController] ✅ SynthesizeExam succeeded in {Attempts} attempt(s). " +
            "Session {SessionId} is now PendingAdminApproval.",
            result.AttemptsTaken, sessionId);

        return Ok(result);
    }
}
