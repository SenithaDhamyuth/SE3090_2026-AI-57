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

    /// <summary>
    /// Request body for PUT /api/assessment/approve/{sessionId}.
    /// Carries the admin-curated question list from the HITL edit UI in the
    /// React admin frontend. When provided, AssessmentController overwrites
    /// QuestionsJson with this payload before flipping status to "Ready".
    /// </summary>
    public class ApproveSessionDto
    {
        /// <summary>
        /// Admin-edited list of MCQ questions. Each object must match the schema
        /// expected by the Flutter exam_timer_screen:
        ///   { questionText, options: string[], correctOptionIndex: int, explanation?: string }
        /// </summary>
        public List<EditedQuestionDto> EditedQuestions { get; set; } = new();
    }

    /// <summary>Single MCQ question entry as edited by the admin in the HITL UI.</summary>
    public class EditedQuestionDto
    {
        public string QuestionText      { get; set; } = string.Empty;
        public List<string> Options     { get; set; } = new();
        public int CorrectOptionIndex   { get; set; }
        public string? Explanation      { get; set; }
    }
}
