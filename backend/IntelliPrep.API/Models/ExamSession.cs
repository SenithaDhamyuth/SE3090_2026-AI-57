using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    public class ExamSession
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string StudentId { get; set; } = string.Empty; 
        
        [Required]
        public string Subject { get; set; } = string.Empty;
        
        public int DurationMinutes { get; set; }
        
       
        public bool IsTimerLocked { get; set; } = false; 
        
        public DateTime StartTime { get; set; } = DateTime.UtcNow;
        
        public string Status { get; set; } = "Pending";
}
}