using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IntelliPrep.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TestController : ControllerBase
    {
        [HttpGet("admin-only")]
        [Authorize(Roles = "Administrator")]
        public IActionResult GetAdminData()
        {
            return Ok(new { message = "Welcome Admin! Your token works perfectly." });
        }
    }
}