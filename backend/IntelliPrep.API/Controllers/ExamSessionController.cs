using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntelliPrep.API.Models;
using IntelliPrep.API.Data; 

namespace IntelliPrep.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExamSessionController : ControllerBase
    {
        private readonly ApplicationDbContext _context; 

        public ExamSessionController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateSession([FromBody] ExamSession session)
        {
            session.StartTime = DateTime.UtcNow;
            session.Status = "Pending";
            session.IsTimerLocked = false;

            _context.ExamSessions.Add(session);
            await _context.SaveChangesAsync();

            return Ok(session);
        }

        [HttpPost("{id}/lock")]
        public async Task<IActionResult> LockTimer(int id)
        {
            var session = await _context.ExamSessions.FindAsync(id);
            if (session == null) 
            {
                return NotFound("Session not found.");
            }

            if (session.IsTimerLocked)
            {
                return BadRequest("Timer is already locked and running for this session.");
            }

            session.IsTimerLocked = true;
            session.Status = "InProgress";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Timer locked successfully.", session });
        }
    }
}