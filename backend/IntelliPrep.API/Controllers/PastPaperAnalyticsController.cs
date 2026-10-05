using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

/// <summary>
/// Analytics endpoints for PastPaperAnalytics records.
/// Route prefix: api/admin/analytics
/// All endpoints require the Admin role.
/// </summary>
[ApiController]
[Route("api/admin/analytics")]
[Authorize(Roles = "Admin")]
public class PastPaperAnalyticsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IAIAgentService      _aiAgent;
    private readonly ILogger<PastPaperAnalyticsController> _logger;

    public PastPaperAnalyticsController(
        ApplicationDbContext db,
        IAIAgentService      aiAgent,
        ILogger<PastPaperAnalyticsController> logger)
    {
        _db      = db;
        _aiAgent = aiAgent;
        _logger  = logger;
    }

    // ── GET api/admin/analytics ───────────────────────────────────────────────
    /// <summary>
    /// Returns the latest AI-generated analytic records from the PastPaperAnalytics
    /// table. Returns an empty array if no analysis has been run yet.
    /// This endpoint does NOT compute anything — call POST /analyze to run the AI.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        // Read only the single highest-probability record per topic
        // (avoids showing duplicates when analysis has been run multiple times)
        var records = await _db.PastPaperAnalytics
            .AsNoTracking()
            .OrderByDescending(r => r.ProbabilityPercentage)
            .ToListAsync(ct);

        // Deduplicate: keep only the latest / highest probability per topic name
        var byTopic = records
            .GroupBy(r => r.TopicName, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(r => r.CreatedAt).First())
            .OrderByDescending(r => r.ProbabilityPercentage)
            .ToList();

        return Ok(byTopic.Select(r => new
        {
            id                    = r.Id,
            topicName             = r.TopicName,
            year                  = r.Year,
            probabilityPercentage = r.ProbabilityPercentage,
            generatedByAgent      = r.GeneratedByAgent,
            createdAt             = r.CreatedAt
        }));
    }

    // ── POST api/admin/analytics/analyze ─────────────────────────────────────
    /// <summary>
    /// Returns cached analytics when the Questions table has not changed. Otherwise,
    /// triggers Agent 1 to recompute probabilities and replace the previous
    /// AI-generated rows in PastPaperAnalytics.
    ///
    /// Recalculation calls the Groq LLM, so the frontend should show a loading state
    /// while a new analysis is running.
    /// </summary>
    [HttpPost("analyze")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RunAnalysis(CancellationToken ct)
    {
        _logger.LogInformation("[AnalyticsController] Admin triggered AI analysis on /api/admin/analytics/analyze");

        var questionCount = await _db.Questions.CountAsync(ct);
        var cachedRecords = await _db.PastPaperAnalytics
            .AsNoTracking()
            .Where(r => r.GeneratedByAgent)
            .OrderByDescending(r => r.ProbabilityPercentage)
            .ToListAsync(ct);

        if (cachedRecords.Count > 0
            && cachedRecords.All(r => r.SourceQuestionCount == questionCount))
        {
            _logger.LogInformation(
                "[AnalyticsController] Returning cached analytics for {QuestionCount} questions.",
                questionCount);

            return Ok(new
            {
                success        = true,
                message        = "Returning cached topic probabilities; no new past-paper questions were added.",
                topicsAnalysed = cachedRecords.Select(r => r.TopicName)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count(),
                rowsSaved      = cachedRecords.Count,
                records        = cachedRecords.Select(r => new
                {
                    id                    = r.Id,
                    topicName             = r.TopicName,
                    year                  = r.Year,
                    probabilityPercentage = r.ProbabilityPercentage,
                    generatedByAgent      = r.GeneratedByAgent,
                    createdAt             = r.CreatedAt
                })
            });
        }

        // ── 1. Gather all distinct topic names from the Questions table ────────
        var topics = await _db.Questions
            .AsNoTracking()
            .Where(q => !string.IsNullOrEmpty(q.Lesson_Name))
            .Select(q => q.Lesson_Name!)
            .Distinct()
            .ToListAsync(ct);

        if (topics.Count == 0)
        {
            _logger.LogWarning("[AnalyticsController] No questions in DB — cannot run analysis.");
            return BadRequest(new
            {
                success = false,
                message = "No questions found in the database. Upload past paper questions first before running analysis."
            });
        }

        _logger.LogInformation(
            "[AnalyticsController] Found {N} distinct topics to analyse: {Topics}",
            topics.Count, string.Join(", ", topics));

        // ── 2. Invoke Agent 1 (LLM Past Paper Analyst) ────────────────────────
        //       AnalyzePastPapersAsync already: builds the LLM prompt, calls Groq,
        //       validates the JSON, and SAVES to PastPaperAnalytics table.
        //       We use year=0 to signify "aggregated across all years".
        var request = new AnalyzePastPapersRequest
        {
            Topics             = topics,
            Year               = 0, // 0 = multi-year aggregate analysis
            SourceQuestionCount = questionCount
        };

        var result = await _aiAgent.AnalyzePastPapersAsync(request, ct);

        if (!result.Success)
        {
            _logger.LogError(
                "[AnalyticsController] Agent 1 analysis failed: {Message}", result.Message);
            return StatusCode(500, new
            {
                success = false,
                message = result.Message,
                rawLlmOutput = result.RawLlmOutput
            });
        }

        _logger.LogInformation(
            "[AnalyticsController] ✅ Agent 1 analysis complete — {N} records saved.",
            result.RowsSaved);

        // ── 3. Return the freshly saved records directly ───────────────────────
        //       Re-fetch from DB so the response reflects actual persisted data.
        var saved = await _db.PastPaperAnalytics
            .AsNoTracking()
            .Where(r => r.GeneratedByAgent)
            .OrderByDescending(r => r.ProbabilityPercentage)
            .ToListAsync(ct);

        // Deduplicate by topic (keep most recent)
        var deduped = saved
            .GroupBy(r => r.TopicName, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(r => r.CreatedAt).First())
            .OrderByDescending(r => r.ProbabilityPercentage)
            .ToList();

        return Ok(new
        {
            success      = true,
            message      = $"AI analysis complete. {result.RowsSaved} topic probabilities calculated and saved.",
            topicsAnalysed = topics.Count,
            rowsSaved    = result.RowsSaved,
            records      = deduped.Select(r => new
            {
                id                    = r.Id,
                topicName             = r.TopicName,
                year                  = r.Year,
                probabilityPercentage = r.ProbabilityPercentage,
                generatedByAgent      = r.GeneratedByAgent,
                createdAt             = r.CreatedAt
            })
        });
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
            GeneratedByAgent      = false,
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
