using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    public class StudentProfile
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty; 

        [Required]
        public string TargetExam { get; set; } = "A/L"; // e.g., A/L, O/L

        public string PreferredSubject { get; set; } = "ICT";

        // To track their gamification/progress in the MVP
        public int TotalPoints { get; set; } = 0; 
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}