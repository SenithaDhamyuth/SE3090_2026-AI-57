using System.Security.Claims;
using System.Text.Json;
using IntelliPrep.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

[ApiController]
[Route("api/student")]
[Authorize(Roles = "Student")]
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
            .Where(p => p.StudentId == studentId && p.IsApproved)
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
                targetExamDate = plan.TargetExamDate.ToString("yyyy-MM-dd"),
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
}
