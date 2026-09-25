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

        public StudentProfileController(ApplicationDbContext context)
        {
            _context = context;
        }

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

        [HttpGet("all")]
        public async Task<IActionResult> GetAllProfiles()
        {
            var profiles = await _context.StudentProfiles
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(profiles);
        }

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
    }
}