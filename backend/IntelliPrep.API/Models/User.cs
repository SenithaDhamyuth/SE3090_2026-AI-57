using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Student"; // "Student", "Tutor", or "Administrator"

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}