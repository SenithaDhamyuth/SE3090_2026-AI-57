namespace IntelliPrep.API.DTOs
{
    /// <summary>Request body for POST /api/assessment/request-exam</summary>
    public class RequestExamDto
    {
        /// <summary>Free-text learning objective sent to the Planning Coordinator.</summary>
        public string Objective { get; set; } = string.Empty;

        /// <summary>Optional: target exam type (A/L, O/L, etc.)</summary>
        public string TargetExam { get; set; } = "A/L";

        /// <summary>Optional: subject preference for question selection.</summary>
        public string Subject { get; set; } = "ICT";
    }

    /// <summary>Request body for POST /api/assessment/start-timer</summary>
    public class StartTimerDto
    {
        /// <summary>ID of the ExamSession to lock and start.</summary>
        public int SessionId { get; set; }
    }

    /// <summary>Request body for POST /api/assessment/submit</summary>
    public class SubmitExamDto
    {
        /// <summary>ID of the ExamSession being submitted.</summary>
        public int SessionId { get; set; }

        /// <summary>
        /// JSON array of student answers.
        /// Example: [{"questionId": 1, "answer": "A"}, {"questionId": 2, "answer": "C"}]
        /// </summary>
        public string AnswersJson { get; set; } = "[]";

        /// <summary>Calculated score to persist (can be validated server-side in Sprint 2).</summary>
        public int TotalScore { get; set; }
    }
}
