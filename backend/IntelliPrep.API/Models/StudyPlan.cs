using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IntelliPrep.API.Models
{
    /// <summary>
    /// Persists an AI-generated day-by-day study schedule for a specific student.
    ///
    /// HUMAN-IN-THE-LOOP: <see cref="IsApproved"/> is always initialised to <c>false</c>.
    /// An admin must explicitly approve the plan via the dashboard before the student
    /// can view it — satisfying the human-in-the-loop viva requirement.
    /// </summary>
    public class StudyPlan
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Foreign key to <see cref="User.Id"/> for the target student.</summary>
        [Required]
        public int StudentId { get; set; }

        /// <summary>The date the student wants to sit their A/L ICT exam.</summary>
        [Required]
        public DateTime TargetExamDate { get; set; }

        /// <summary>
        /// Serialised JSON array produced by Agent 2, e.g.:
        /// [{"day":1,"date":"2026-09-26","topic":"Logic Gates","subtopics":"...","priority":"High"}]
        /// </summary>
        [Required]
        [Column(TypeName = "text")]
        public string PlanDetailsJson { get; set; } = "[]";

        /// <summary>
        /// Set to <c>false</c> on creation.
        /// Admin flips this to <c>true</c> via the approval endpoint to release to the student.
        /// </summary>
        public bool IsApproved { get; set; } = false;

        /// <summary>The admin user who approved the plan (null until approved).</summary>
        [MaxLength(150)]
        public string? ApprovedByEmail { get; set; }

        public DateTime? ApprovedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
