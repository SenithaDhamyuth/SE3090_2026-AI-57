using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IntelliPrep.API.Models
{
    /// <summary>
    /// Stores the AI-computed topic probability data derived from historical past papers.
    /// Rows are written by Agent 1 (Past Paper Analyst) and read by Agent 2 (Study Planner)
    /// as prioritisation weights via Lite-RAG injection.
    /// </summary>
    public class PastPaperAnalytic
    {
        [Key]
        public int Id { get; set; }

        /// <summary>The A/L ICT topic analysed (e.g., "Networking", "Logic Gates").</summary>
        [Required]
        [MaxLength(150)]
        public string TopicName { get; set; } = string.Empty;

        /// <summary>
        /// Past-paper year the raw data was sampled from.
        /// Use 0 for an aggregated multi-year analysis run.
        /// </summary>
        public int Year { get; set; }

        /// <summary>
        /// Probability (0–100) that this topic will appear in the upcoming exam,
        /// as computed by the Past Paper Analyst LLM agent.
        /// </summary>
        [Range(0, 100)]
        [Column(TypeName = "numeric(5,2)")]
        public decimal ProbabilityPercentage { get; set; }

        /// <summary>True when this row was written by an AI agent rather than a human admin.</summary>
        public bool GeneratedByAgent { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
