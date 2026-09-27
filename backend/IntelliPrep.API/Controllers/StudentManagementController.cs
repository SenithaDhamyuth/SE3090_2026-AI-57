using System.ComponentModel.DataAnnotations;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateDefaultPassword()
            : request.Password.Trim();

        var student = new User
        {
            FullName = request.FullName.Trim(),
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Student"
        };

        _context.Users.Add(student);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Student account created successfully.",
            studentId = student.Id,
            fullName = student.FullName,
            email = student.Email,
            temporaryPassword = password
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

    private static string GenerateDefaultPassword()
    {
        return "Student@" + Guid.NewGuid().ToString("N")[..8];
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

    public string? Password { get; set; }
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
