using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace IntelliPrep.API.Controllers;

[ApiController]
[Route("api/admin")]
public class StudentManagementController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public StudentManagementController(ApplicationDbContext context)
    {
        _context = context;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET api/admin/students
    // Returns all student accounts ordered by creation date (newest first).
    // ═══════════════════════════════════════════════════════════════════════
    [HttpGet("students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStudents(CancellationToken cancellationToken)
    {
        var students = await _context.Users
            .Where(u => u.Role == "Student")
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new StudentListItemDto
            {
                Id              = u.Id,
                FullName        = u.FullName,
                Email           = u.Email,
                CreatedAt       = u.CreatedAt,
                PhoneNumber     = u.PhoneNumber,
                Address         = u.Address,
                College         = u.College,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .ToListAsync(cancellationToken);

        return Ok(students);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POST api/admin/students
    // Creates a new student account.
    // ═══════════════════════════════════════════════════════════════════════
    [HttpPost("students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateStudent(
        [FromBody] CreateStudentRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new { message = "Full name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        if (Encoding.UTF8.GetByteCount(request.InitialPassword) > 72)
        {
            return BadRequest(new { message = "Initial password must be no longer than 72 UTF-8 bytes." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken))
        {
            return Conflict(new { message = "A student with this email already exists." });
        }

        var student = new User
        {
            FullName     = request.FullName.Trim(),
            Email        = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.InitialPassword),
            Role         = "Student",
            PhoneNumber  = request.PhoneNumber?.Trim(),
            Address      = request.Address?.Trim(),
            College      = request.College?.Trim()
        };

        _context.Users.Add(student);
        await _context.SaveChangesAsync(cancellationToken);

        return Created("/api/admin/students", new
        {
            message   = "Student account created successfully.",
            studentId = student.Id,
            fullName  = student.FullName,
            email     = student.Email
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUT api/admin/students/{id}
    // Updates an existing student account's details.
    // ═══════════════════════════════════════════════════════════════════════
    [HttpPut("students/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStudent(
        int id,
        [FromBody] UpdateStudentRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var student = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id && u.Role == "Student", cancellationToken);

        if (student == null)
        {
            return NotFound(new { message = $"Student with ID {id} was not found." });
        }

        // Only update fields that were supplied in the request body
        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            student.FullName = request.FullName.Trim();
        }

        if (request.PhoneNumber != null)
        {
            student.PhoneNumber = request.PhoneNumber.Trim();
        }

        if (request.Address != null)
        {
            student.Address = request.Address.Trim();
        }

        if (request.College != null)
        {
            student.College = request.College.Trim();
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message     = "Student updated successfully.",
            studentId   = student.Id,
            fullName    = student.FullName,
            email       = student.Email,
            phoneNumber = student.PhoneNumber,
            address     = student.Address,
            college     = student.College
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DELETE api/admin/students/{id}
    // Removes a student account (and cascade-deletes related data via EF).
    // ═══════════════════════════════════════════════════════════════════════
    [HttpDelete("students/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteStudent(int id, CancellationToken cancellationToken)
    {
        var student = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id && u.Role == "Student", cancellationToken);

        if (student == null)
        {
            return NotFound(new { message = $"Student with ID {id} was not found." });
        }

        _context.Users.Remove(student);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = $"Student '{student.FullName}' (ID: {id}) deleted successfully." });
    }
}

// ─────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────

/// <summary>Payload returned in the GET /api/admin/students list.</summary>
public class StudentListItemDto
{
    public int      Id              { get; set; }
    public string   FullName        { get; set; } = string.Empty;
    public string   Email           { get; set; } = string.Empty;
    public DateTime CreatedAt       { get; set; }
    public string?  PhoneNumber     { get; set; }
    public string?  Address         { get; set; }
    public string?  College         { get; set; }
    public string?  ProfileImageUrl { get; set; }
}

// Phone number pattern: optional leading +, then 7-20 chars of digits/spaces/hyphens/parens
// Using a non-verbatim string so we can control the exact character class correctly.
internal static class PhonePattern
{
    internal const string Regex = @"^[+]?[0-9\s\-()\]{7,20}$";
    internal const string Error = "PhoneNumber must be 7\u201320 characters and may contain digits, spaces, +, -, (, and ).";
}

/// <summary>Request body for POST /api/admin/students.</summary>
public class CreateStudentRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string InitialPassword { get; set; } = string.Empty;

    /// <summary>Optional. Validated only when provided.</summary>
    [RegularExpression(@"^[+]?[\d\s\-()]{7,20}$",
        ErrorMessage = "PhoneNumber must be 7-20 characters and may contain digits, spaces, +, -, (, and ).")]
    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [MaxLength(255)]
    public string? Address { get; set; }

    [MaxLength(150)]
    public string? College { get; set; }
}

/// <summary>Request body for PUT /api/admin/students/{id}.</summary>
public class UpdateStudentRequest
{
    [MinLength(2)]
    [MaxLength(100)]
    public string? FullName { get; set; }

    /// <summary>Optional. Validated only when provided.</summary>
    [RegularExpression(@"^[+]?[\d\s\-()]{7,20}$",
        ErrorMessage = "PhoneNumber must be 7-20 characters and may contain digits, spaces, +, -, (, and ).")]
    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [MaxLength(255)]
    public string? Address { get; set; }

    [MaxLength(150)]
    public string? College { get; set; }
}
