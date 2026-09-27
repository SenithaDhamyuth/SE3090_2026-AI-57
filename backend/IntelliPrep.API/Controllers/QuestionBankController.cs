using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

/// <summary>
/// Question Bank management — route: api/admin/questions
/// All endpoints require the Admin role.
/// </summary>
[ApiController]
[Route("api/admin/questions")]
[Authorize(Roles = "Admin")]
public class QuestionBankController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<QuestionBankController> _logger;

    public QuestionBankController(ApplicationDbContext db, ILogger<QuestionBankController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── GET api/admin/questions ─────────────────────────────────────────────
    /// <summary>
    /// Returns all questions, optionally filtered by year and/or lesson name.
    /// Ordered by Year desc, then Lesson_Name asc.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? year,
        [FromQuery] string? lesson,
        CancellationToken ct)
    {
        var query = _db.Questions.AsNoTracking().AsQueryable();

        if (year.HasValue && year > 0)
            query = query.Where(q => q.Year == year.Value);

        if (!string.IsNullOrWhiteSpace(lesson))
            query = query.Where(q => q.Lesson_Name.Contains(lesson));

        var questions = await query
            .OrderByDescending(q => q.Year)
            .ThenBy(q => q.Lesson_Name)
            .Select(q => new QuestionListItemDto
            {
                Question_ID    = q.Question_ID,
                Year           = q.Year,
                Paper_Type     = q.Paper_Type,
                Lesson_Name    = q.Lesson_Name,
                Difficulty     = q.Difficulty_Level,
                Question_Text  = q.Question_Text,
                Correct_Option = q.Correct_Option_No,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            totalCount = questions.Count,
            questions
        });
    }

    // ── GET api/admin/questions/{id} ────────────────────────────────────────
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
    {
        var q = await _db.Questions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Question_ID == id, ct);

        if (q is null)
            return NotFound(new { message = $"Question '{id}' not found." });

        return Ok(q);
    }

    // ── POST api/admin/questions ────────────────────────────────────────────
    /// <summary>
    /// Creates a new MCQ in the Question Bank.
    /// Question_ID is auto-generated as {Year}_MCQ_{epoch_ms}.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreateQuestionRequest req,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // Auto-generate a unique ID
        var uniqueId = $"{req.Year}_MCQ_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var question = new Question
        {
            Question_ID      = uniqueId,
            Year             = req.Year,
            Paper_Type       = req.Paper_Type?.Trim() ?? "MCQ",
            Lesson_Name      = req.Lesson_Name.Trim(),
            Difficulty_Level = req.Difficulty_Level?.Trim() ?? "Medium",
            Question_Text    = req.Question_Text.Trim(),
            Option_1         = req.Option_1.Trim(),
            Option_2         = req.Option_2.Trim(),
            Option_3         = req.Option_3.Trim(),
            Option_4         = req.Option_4.Trim(),
            Option_5         = req.Option_5?.Trim() ?? string.Empty,
            Correct_Answer   = req.Correct_Option_No switch
            {
                1 => req.Option_1.Trim(),
                2 => req.Option_2.Trim(),
                3 => req.Option_3.Trim(),
                4 => req.Option_4.Trim(),
                5 => req.Option_5?.Trim() ?? string.Empty,
                _ => string.Empty,
            },
            Correct_Option_No   = req.Correct_Option_No,
            Image_Filename      = "NONE",
            Image_Description   = "NONE",
        };

        await _db.Questions.AddAsync(question, ct);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "[QuestionBank] Created question {Id} ({Lesson}, {Year}).",
            uniqueId, question.Lesson_Name, question.Year);

        return CreatedAtAction(nameof(GetById), new { id = uniqueId }, new
        {
            message     = "Question created successfully.",
            question_id = uniqueId,
            lesson_name = question.Lesson_Name,
            year        = question.Year,
        });
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public sealed class QuestionListItemDto
{
    public string Question_ID    { get; set; } = string.Empty;
    public int    Year           { get; set; }
    public string Paper_Type     { get; set; } = string.Empty;
    public string Lesson_Name    { get; set; } = string.Empty;
    public string Difficulty     { get; set; } = string.Empty;
    public string Question_Text  { get; set; } = string.Empty;
    public int    Correct_Option { get; set; }
}

public sealed class CreateQuestionRequest
{
    [Required]
    [Range(2000, 2099, ErrorMessage = "Year must be between 2000 and 2099.")]
    public int Year { get; set; }

    public string? Paper_Type { get; set; }

    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Lesson_Name { get; set; } = string.Empty;

    public string? Difficulty_Level { get; set; }

    [Required]
    [StringLength(2000, MinimumLength = 5)]
    public string Question_Text { get; set; } = string.Empty;

    [Required]
    public string Option_1 { get; set; } = string.Empty;

    [Required]
    public string Option_2 { get; set; } = string.Empty;

    [Required]
    public string Option_3 { get; set; } = string.Empty;

    [Required]
    public string Option_4 { get; set; } = string.Empty;

    public string? Option_5 { get; set; }

    [Required]
    [Range(1, 5, ErrorMessage = "Correct_Option_No must be between 1 and 5.")]
    public int Correct_Option_No { get; set; }
}
