using System.ComponentModel.DataAnnotations;

namespace IntelliPrep.API.Models
{
    /// <summary>
    /// Defines the official syllabus boundary for an A/L ICT topic.
    /// The AI Study Planner agent reads these rows as RAG context to ensure
    /// it never generates content that falls outside the national curriculum.
    /// </summary>
    public class SyllabusLimit
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Topic name as it appears in the A/L ICT syllabus (e.g., "Networking").</summary>
        [Required]
        [MaxLength(150)]
        public string TopicName { get; set; } = string.Empty;

        /// <summary>Comma-separated list of sub-topics explicitly allowed for this topic.</summary>
        [Required]
        public string AllowedSubtopics { get; set; } = string.Empty;

        /// <summary>
        /// Comma-separated list of sub-topics that must be excluded (e.g., university-level content).
        /// The LLM prompt will explicitly name these to prevent hallucination.
        /// </summary>
        public string ExcludedSubtopics { get; set; } = string.Empty;
    }
}
