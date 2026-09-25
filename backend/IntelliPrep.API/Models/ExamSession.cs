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
        /// <summary>"Pending" | "Ready" | "InProgress" | "Completed" | "Abandoned"</summary>
        [Required]
        public string Status { get; set; } = "Pending";

        public DateTime StartTime { get; set; } = DateTime.UtcNow;

        public DateTime? EndTime { get; set; }

        /// <summary>JSON array of student answers, e.g. [{"questionId":1,"answer":"A"}]</summary>
        public string AnswersJson { get; set; } = "[]";

        /// <summary>
        /// JSON array of LLM-generated MCQ questions produced by ContentSynthesizerService.
        /// Schema: [{ "questionText": "...", "options": [...], "correctOptionIndex": 0, "explanation": "..." }]
        /// Populated by POST /api/assessment/synthesize/{sessionId} (UC5.2).
        /// </summary>
        public string QuestionsJson { get; set; } = "[]";

        /// <summary>Computed score after submission.</summary>
        public int TotalScore { get; set; } = 0;

        /// <summary>Transaction lock — prevents double-starting the timer.</summary>
        public bool IsTimerLocked { get; set; } = false;

        // ── Member 2 dynamic synthesis fields ─────────────────────────
        /// <summary>
        /// The verbatim learning objective typed by the user in the "Request Mock Exam" modal
        /// (e.g. "I want 4 questions on Logic Gates focusing on NAND gate combinations").
        /// Passed to the LLM prompt so generated questions directly address the user's intent.
        /// </summary>
        public string? OriginalObjective { get; set; }

        /// <summary>
        /// Number of MCQs the user explicitly requested (parsed from OriginalObjective via Regex \d+).
        /// Defaults to 5 when no number is found in the objective string.
        /// </summary>
        public int RequestedQuestionCount { get; set; } = 5;
    }
}