using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using IntelliPrep.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace IntelliPrep.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            ApplicationDbContext context,
            IConfiguration configuration,
            IEmailSender emailSender,
            ILogger<AuthController> logger)
        {
            _context = context;
            _configuration = configuration;
            _emailSender = emailSender;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(
            UserRegistrationDto request,
            CancellationToken cancellationToken)
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            if (await _context.Users.AnyAsync(
                u => u.Email.ToLower() == normalizedEmail, cancellationToken))
            {
                return Conflict(new { message = "Unable to register with the supplied details." });
            }

            var user = new User
            {
                FullName = request.FullName.Trim(),
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = "Student"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "User registered successfully!" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(
            UserLoginDto request,
            CancellationToken cancellationToken)
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(
                u => u.Email.ToLower() == normalizedEmail, cancellationToken);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var token = GenerateJwtToken(user);
            return Ok(new { token, role = user.Role, userId = user.Id });
        }

        [Authorize(Roles = "Student")]
        [HttpPost("password-change/request")]
        public async Task<IActionResult> RequestPasswordChange(CancellationToken cancellationToken)
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                return Unauthorized(new { message = "Invalid student token." });
            }

            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Id == userId && u.Role == "Student", cancellationToken);
            if (user is null)
            {
                return Unauthorized(new { message = "Invalid student token." });
            }

            var now = DateTimeOffset.UtcNow;
            var latestChallenge = await _context.PasswordResetTokens
                .Where(token => token.UserId == userId)
                .OrderByDescending(token => token.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (latestChallenge is not null && now - latestChallenge.CreatedAt < TimeSpan.FromMinutes(1))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { message = "Please wait before requesting another verification code." });
            }

            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            var challenge = new PasswordResetToken
            {
                UserId = userId,
                TokenHash = HashResetCode(code),
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(10)
            };

            var activeChallenges = await _context.PasswordResetTokens
                .Where(token => token.UserId == userId && token.UsedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var activeChallenge in activeChallenges)
            {
                activeChallenge.UsedAt = now;
            }

            _context.PasswordResetTokens.Add(challenge);
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                await _emailSender.SendPasswordChangeCodeAsync(
                    user.Email, user.FullName, code, cancellationToken);
            }
            catch (EmailDeliveryException exception)
            {
                challenge.UsedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogError(exception, "Could not deliver password change code for user {UserId}.", userId);
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "The verification email could not be sent. Please try again later." });
            }

            return Ok(new { message = "A verification code was sent to your email address." });
        }

        [Authorize(Roles = "Student")]
        [HttpPost("password-change/verify")]
        public async Task<IActionResult> VerifyPasswordChange(
            [FromBody] VerifyPasswordChangeDto request,
            CancellationToken cancellationToken)
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                return Unauthorized(new { message = "Invalid student token." });
            }

            if (Encoding.UTF8.GetByteCount(request.NewPassword) > 72)
            {
                return BadRequest(new { message = "Password must be no longer than 72 UTF-8 bytes." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, cancellationToken);

            var now = DateTimeOffset.UtcNow;
            var challenge = await _context.PasswordResetTokens
                .Where(token => token.UserId == userId && token.UsedAt == null)
                .OrderByDescending(token => token.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (challenge is null || challenge.ExpiresAt <= now || challenge.FailedAttempts >= 5)
            {
                return BadRequest(new { message = "The verification code is invalid or expired." });
            }

            if (!MatchesResetCode(request.Code, challenge.TokenHash))
            {
                challenge.FailedAttempts++;
                if (challenge.FailedAttempts >= 5)
                {
                    challenge.UsedAt = now;
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return BadRequest(new { message = "The verification code is invalid or expired." });
            }

            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Id == userId && u.Role == "Student", cancellationToken);
            if (user is null)
            {
                return Unauthorized(new { message = "Invalid student token." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            challenge.UsedAt = now;
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new { message = "Password updated successfully." });
        }

        [AllowAnonymous]
        [HttpPost("forgot-password/request")]
        public async Task<IActionResult> ForgotPasswordRequest(
            [FromBody] ForgotPasswordRequestDto request,
            CancellationToken cancellationToken)
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail && u.Role == "Student", cancellationToken);
            
            if (user is null)
            {
                // Return Ok even if not found to prevent email enumeration
                return Ok(new { message = "If the email exists, a verification code was sent." });
            }

            var now = DateTimeOffset.UtcNow;
            var latestChallenge = await _context.PasswordResetTokens
                .Where(token => token.UserId == user.Id)
                .OrderByDescending(token => token.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (latestChallenge is not null && now - latestChallenge.CreatedAt < TimeSpan.FromMinutes(1))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { message = "Please wait before requesting another verification code." });
            }

            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            var challenge = new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = HashResetCode(code),
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(10)
            };

            var activeChallenges = await _context.PasswordResetTokens
                .Where(token => token.UserId == user.Id && token.UsedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var activeChallenge in activeChallenges)
            {
                activeChallenge.UsedAt = now;
            }

            _context.PasswordResetTokens.Add(challenge);
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                await _emailSender.SendPasswordChangeCodeAsync(
                    user.Email, user.FullName, code, cancellationToken);
            }
            catch (EmailDeliveryException exception)
            {
                challenge.UsedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogError(exception, "Could not deliver password change code for user {UserId}.", user.Id);
                // Even on error, generic message
                return Ok(new { message = "If the email exists, a verification code was sent." });
            }

            return Ok(new { message = "If the email exists, a verification code was sent." });
        }

        [AllowAnonymous]
        [HttpPost("forgot-password/verify")]
        public async Task<IActionResult> ForgotPasswordVerify(
            [FromBody] ForgotPasswordVerifyDto request,
            CancellationToken cancellationToken)
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .SingleOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail && u.Role == "Student", cancellationToken);
            
            if (user is null)
            {
                return BadRequest(new { message = "The verification code is invalid or expired." });
            }

            if (Encoding.UTF8.GetByteCount(request.NewPassword) > 72)
            {
                return BadRequest(new { message = "Password must be no longer than 72 UTF-8 bytes." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, cancellationToken);

            var now = DateTimeOffset.UtcNow;
            var challenge = await _context.PasswordResetTokens
                .Where(token => token.UserId == user.Id && token.UsedAt == null)
                .OrderByDescending(token => token.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (challenge is null || challenge.ExpiresAt <= now || challenge.FailedAttempts >= 5)
            {
                return BadRequest(new { message = "The verification code is invalid or expired." });
            }

            if (!MatchesResetCode(request.Code, challenge.TokenHash))
            {
                challenge.FailedAttempts++;
                if (challenge.FailedAttempts >= 5)
                {
                    challenge.UsedAt = now;
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return BadRequest(new { message = "The verification code is invalid or expired." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            challenge.UsedAt = now;
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new { message = "Password updated successfully." });
        }

        private string HashResetCode(string code)
        {
            var key = _configuration["PasswordReset:HashKey"];
            if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            {
                throw new InvalidOperationException(
                    "PasswordReset:HashKey must be configured with at least 32 bytes of secret material.");
            }

            var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(code));
            return Convert.ToHexString(hash);
        }

        private bool MatchesResetCode(string code, string storedHash)
        {
            var providedHash = Convert.FromHexString(HashResetCode(code));
            var expectedHash = Convert.FromHexString(storedHash);
            return CryptographicOperations.FixedTimeEquals(providedHash, expectedHash);
        }

        private string GenerateJwtToken(User user)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7), // Token valid for 7 days
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}