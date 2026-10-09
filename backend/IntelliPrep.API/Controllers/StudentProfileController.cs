using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntelliPrep.API.Models;
using IntelliPrep.API.Data;

namespace IntelliPrep.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StudentProfileController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public StudentProfileController(
            ApplicationDbContext context,
            IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        // ─────────────────────────────────────────────────────────────────
        // POST api/studentprofile/create
        // Creates a StudentProfile record for the given user.
        // ─────────────────────────────────────────────────────────────────
        [HttpPost("create")]
        public async Task<IActionResult> CreateProfile([FromBody] StudentProfile profile)
        {
            // Check if a profile already exists for this user
            var existingProfile = await _context.StudentProfiles
                .FirstOrDefaultAsync(p => p.UserId == profile.UserId);

            if (existingProfile != null)
            {
                return BadRequest("A profile already exists for this user.");
            }

            profile.CreatedAt = DateTime.UtcNow;

            _context.StudentProfiles.Add(profile);
            await _context.SaveChangesAsync();

            return Ok(profile);
        }

        // ─────────────────────────────────────────────────────────────────
        // GET api/studentprofile/all
        // Returns all student profiles ordered by creation date.
        // ─────────────────────────────────────────────────────────────────
        [HttpGet("all")]
        public async Task<IActionResult> GetAllProfiles()
        {
            var profiles = await _context.StudentProfiles
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(profiles);
        }

        // ─────────────────────────────────────────────────────────────────
        // GET api/studentprofile/{userId}
        // Returns a single student profile by userId.
        // ─────────────────────────────────────────────────────────────────
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetProfile(string userId)
        {
            var profile = await _context.StudentProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                return NotFound("Student profile not found.");
            }

            return Ok(profile);
        }

        // ─────────────────────────────────────────────────────────────────
        // PUT api/studentprofile/update-details
        // Allows an authenticated student to update their FullName, Phone,
        // Address, and College on the Users table directly.
        // ─────────────────────────────────────────────────────────────────
        [HttpPut("update-details")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> UpdateDetails(
            [FromBody] UpdateStudentDetailsDto dto,
            CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized(new { message = "User is not authenticated." });

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Student", cancellationToken);

            if (user == null)
                return NotFound(new { message = "Student account not found." });

            // Only overwrite fields that were explicitly provided (non-null)
            if (dto.FullName != null)
                user.FullName = dto.FullName.Trim();

            if (dto.PhoneNumber != null)
                user.PhoneNumber = dto.PhoneNumber.Trim();

            if (dto.Address != null)
                user.Address = dto.Address.Trim();

            if (dto.College != null)
                user.College = dto.College.Trim();

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                message     = "Details updated successfully.",
                fullName    = user.FullName,
                email       = user.Email,
                phoneNumber = user.PhoneNumber,
                address     = user.Address,
                college     = user.College,
                profileImageUrl = user.ProfileImageUrl
            });
        }

        // ─────────────────────────────────────────────────────────────────
        // POST api/studentprofile/upload-picture
        // Saves a profile picture to wwwroot/uploads and updates ProfileImageUrl.
        // ─────────────────────────────────────────────────────────────────
        [HttpPost("upload-picture")]
        public async Task<IActionResult> UploadProfilePicture(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded.");
            }

            // Extract the authenticated user's ID from JWT claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("User is not authenticated.");
            }

            if (file.Length > 2 * 1024 * 1024)
            {
                return BadRequest("File size exceeds 2MB limit.");
            }

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest("Invalid file type. Only JPG and PNG are allowed.");
            }

            // Resolve wwwroot path; create it if it doesn't exist
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            if (!Directory.Exists(webRootPath))
            {
                Directory.CreateDirectory(webRootPath);
            }

            var uploadsFolder = Path.Combine(webRootPath, "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("User not found.");
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            user.ProfileImageUrl = $"/uploads/{fileName}";
            await _context.SaveChangesAsync();

            return Ok(new { profileImageUrl = user.ProfileImageUrl });
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // DTO
    // ─────────────────────────────────────────────────────────────────────

    /// <summary>Request body for PUT api/studentprofile/update-details.</summary>
    public class UpdateStudentDetailsDto
    {
        [MinLength(2), MaxLength(100)]
        public string? FullName { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(150)]
        public string? College { get; set; }
    }
}