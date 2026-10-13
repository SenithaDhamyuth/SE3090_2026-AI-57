using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace IntelliPrep.API.DTOs
{
    public class UserRegistrationDto
    {
        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;

    }

    public class UserLoginDto
    {
        [Required, EmailAddress]
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [JsonPropertyName("password")]
        public string Password { get; set; } = string.Empty;
    }

    public sealed class VerifyPasswordChangeDto
    {
        [Required, RegularExpression(@"^\d{6}$")]
        public string Code { get; set; } = string.Empty;

        [Required, MinLength(6), MaxLength(72)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordRequestDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public sealed class ForgotPasswordVerifyDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, RegularExpression(@"^\d{6}$")]
        public string Code { get; set; } = string.Empty;

        [Required, MinLength(6), MaxLength(72)]
        public string NewPassword { get; set; } = string.Empty;
    }
}