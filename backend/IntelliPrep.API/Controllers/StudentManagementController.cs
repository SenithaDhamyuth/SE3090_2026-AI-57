using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Controllers;

[ApiController]
[Route("api/admin")]
public class StudentManagementController : ControllerBase
{
    private readonly ApplicationDbContext  _context;
    private readonly INotificationService  _notificationService;

    public StudentManagementController(
        ApplicationDbContext context,
        INotificationService notificationService)
    {
        _context             = context;
        _notificationService = notificationService;
    }

    [HttpGet("students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStudents()
    {
        var students = await _context.Users
            .Where(u => u.Role == "Student")
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new StudentListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(students);
    }

    [HttpPost("students")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateStudent([FromBody] CreateStudentRequest request)
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

        var normalizedEmail = request.Email.Trim();

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail.ToLower()))
        {
            return Conflict(new { message = "A student with this email already exists." });
        }

        // Always auto-generate a secure 8-character temporary password.
        // The admin never needs to set one — the student receives it via email.
        var temporaryPassword = GenerateSecurePassword();

        var student = new User
        {
            FullName     = request.FullName.Trim(),
            Email        = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(temporaryPassword),
            Role         = "Student"
        };

        _context.Users.Add(student);
        await _context.SaveChangesAsync();

        // Send welcome email with credentials (best-effort, non-blocking on failure).
        await _notificationService.SendWelcomeEmailAsync(
            toEmail:           student.Email,
            toName:            student.FullName,
            temporaryPassword: temporaryPassword);

        return Ok(new
        {
            message  = "Student account created and welcome email sent.",
            studentId = student.Id,
            fullName  = student.FullName,
            email     = student.Email
        });
    }

    [HttpPut("students/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStudent(int id, [FromBody] UpdateStudentRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var student = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == "Student");
        if (student == null)
        {
            return NotFound(new { message = "Student not found." });
        }

        var fullName = request.FullName?.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return BadRequest(new { message = "Full name is required." });
        }

        var email = request.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        var emailExists = await _context.Users.AnyAsync(u => u.Id != id && u.Email.ToLower() == email.ToLower());
        if (emailExists)
        {
            return Conflict(new { message = "A student with this email already exists." });
        }

        student.FullName = fullName;
        student.Email = email;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Student updated successfully.",
            student = new StudentListItemDto
            {
                Id = student.Id,
                FullName = student.FullName,
                Email = student.Email,
                CreatedAt = student.CreatedAt
            }
        });
    }

    [HttpDelete("students/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteStudent(int id)
    {
        var student = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == "Student");
        if (student == null)
        {
            return NotFound(new { message = "Student not found." });
        }

        _context.Users.Remove(student);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Student deleted successfully." });
    }

    private static string GenerateSecurePassword()
    {
        // Cryptographically secure 8-character password guaranteed to contain
        // at least one uppercase, one lowercase, one digit, and one special char.
        const string upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower   = "abcdefghjkmnpqrstuvwxyz";
        const string digits  = "23456789";
        const string special = "@#!$&";
        const string all     = upper + lower + digits + special;

        Span<byte> buf = stackalloc byte[16];
        System.Security.Cryptography.RandomNumberGenerator.Fill(buf);

        // Ensure one char from each required class
        char[] pw =
        [
            upper  [buf[0]  % upper.Length],
            lower  [buf[1]  % lower.Length],
            digits [buf[2]  % digits.Length],
            special[buf[3]  % special.Length],
            all    [buf[4]  % all.Length],
            all    [buf[5]  % all.Length],
            all    [buf[6]  % all.Length],
            all    [buf[7]  % all.Length],
        ];

        // Fisher-Yates shuffle so the pattern chars don't cluster at the start
        for (int i = pw.Length - 1; i > 0; i--)
        {
            int j = buf[8 + (i % 8)] % (i + 1);
            (pw[i], pw[j]) = (pw[j], pw[i]);
        }

        return new string(pw);
    }
}

public class CreateStudentRequest
{
    [Required]
    [MinLength(2)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    // Password is intentionally omitted — the backend auto-generates it
    // and emails it to the student.
}

public class UpdateStudentRequest
{
    [Required]
    [MinLength(2)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class StudentListItemDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
