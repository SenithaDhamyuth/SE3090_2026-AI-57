using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IntelliPrep.API.Models
{
    public class ExamSession
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Client-generated session GUID for idempotency checks.</summary>
        public string SessionId { get; set; } = Guid.NewGuid().ToString();

        /// <summary>FK reference to the StudentProfile that owns this session.</summary>
        public int StudentProfileId { get; set; }

        // ── Legacy / compatibility fields ──────────────────────────
        /// <summary>Retained for backward-compat with ExamSessionController.create.</summary>
        public string StudentId { get; set; } = string.Empty;

        public string Subject { get; set; } = string.Empty;

        public int DurationMinutes { get; set; }

        // ── Core assessment fields ──────────────────────────────────
        /// <summary>"Pending" | "InProgress" | "Completed" | "Abandoned"</summary>
        [Required]
        public string Status { get; set; } = "Pending";

        public DateTime StartTime { get; set; } = DateTime.UtcNow;

        public DateTime? EndTime { get; set; }

        /// <summary>JSON array of student answers, e.g. [{"questionId":1,"answer":"A"}]</summary>
        public string AnswersJson { get; set; } = "[]";

        /// <summary>Computed score after submission.</summary>
        public int TotalScore { get; set; } = 0;

        /// <summary>Transaction lock — prevents double-starting the timer.</summary>
        public bool IsTimerLocked { get; set; } = false;
    }
}