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

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == request.Email.Trim().ToLower()))
        {
            return Conflict(new { message = "A student with this email already exists." });
        }

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateDefaultPassword()
            : request.Password.Trim();

        var student = new User
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
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
