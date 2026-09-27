using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

/// <summary>
/// CRUD endpoints for PastPaperAnalytics records.
/// Route prefix: api/admin/analytics
/// All endpoints require the Admin role.
/// </summary>
[ApiController]
[Route("api/admin/analytics")]
[Authorize(Roles = "Admin")]
public class PastPaperAnalyticsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PastPaperAnalyticsController(ApplicationDbContext db)
    {
        _db = db;
    }

    // ── GET api/admin/analytics ───────────────────────────────────────────────
    /// <summary>Returns all past-paper analytic records, ordered by probability descending.</summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var totalQuestions = await _db.Questions.CountAsync(ct);
        if (totalQuestions == 0)
        {
            return Ok(Array.Empty<object>());
        }

        var groupedCounts = await _db.Questions
            .AsNoTracking()
            .GroupBy(q => q.Lesson_Name)
            .Select(g => new { TopicName = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var records = groupedCounts
            .Select(g => new
            {
                TopicName = g.TopicName,
                ProbabilityPercentage = Math.Round((double)g.Count / totalQuestions * 100, 2)
            })
            .OrderByDescending(x => x.ProbabilityPercentage)
            .ToList();

        return Ok(records.Select(r => new
        {
            topicName = r.TopicName,
            probabilityPercentage = r.ProbabilityPercentage
        }));
    }

    // ── GET api/admin/analytics/{id} ──────────────────────────────────────────
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var r = await _db.PastPaperAnalytics.FindAsync([id], ct);
        if (r is null)
            return NotFound(new { message = $"Record {id} not found." });

        return Ok(new AnalyticDto
        {
            Id                    = r.Id,
            TopicName             = r.TopicName,
            Year                  = r.Year,
            ProbabilityPercentage = r.ProbabilityPercentage,
            GeneratedByAgent      = r.GeneratedByAgent,
            CreatedAt             = r.CreatedAt
        });
    }

    // ── POST api/admin/analytics ──────────────────────────────────────────────
    /// <summary>Creates a new analytic record entered manually by an admin.</summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateAnalyticRequest req, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = new PastPaperAnalytic
        {
            TopicName             = req.TopicName.Trim(),
            Year                  = req.Year,
            ProbabilityPercentage = Math.Round(req.ProbabilityPercentage, 2),
            GeneratedByAgent      = false,   // ← manually entered by admin
            CreatedAt             = DateTime.UtcNow
        };

        await _db.PastPaperAnalytics.AddAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, new
        {
            message = "Analytic record created successfully.",
            id      = entity.Id
        });
    }

    // ── PUT api/admin/analytics/{id} ──────────────────────────────────────────
    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAnalyticRequest req, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await _db.PastPaperAnalytics.FindAsync([id], ct);
        if (entity is null)
            return NotFound(new { message = $"Record {id} not found." });

        entity.TopicName             = req.TopicName.Trim();
        entity.Year                  = req.Year;
        entity.ProbabilityPercentage = Math.Round(req.ProbabilityPercentage, 2);

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Record updated successfully.", id = entity.Id });
    }

    // ── DELETE api/admin/analytics/{id} ──────────────────────────────────────
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await _db.PastPaperAnalytics.FindAsync([id], ct);
        if (entity is null)
            return NotFound(new { message = $"Record {id} not found." });

        _db.PastPaperAnalytics.Remove(entity);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Record deleted successfully." });
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed class AnalyticDto
{
    public int      Id                    { get; init; }
    public string   TopicName             { get; init; } = string.Empty;
    public int      Year                  { get; init; }
    public decimal  ProbabilityPercentage { get; init; }
    public bool     GeneratedByAgent      { get; init; }
    public DateTime CreatedAt             { get; init; }
}

public sealed class CreateAnalyticRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(150)]
    public string TopicName { get; init; } = string.Empty;

    [Range(0, 9999)]
    public int Year { get; init; }

    [Required]
    [Range(0, 100)]
    public decimal ProbabilityPercentage { get; init; }
}

public sealed class UpdateAnalyticRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(150)]
    public string TopicName { get; init; } = string.Empty;

    [Range(0, 9999)]
    public int Year { get; init; }

    [Required]
    [Range(0, 100)]
    public decimal ProbabilityPercentage { get; init; }
}
