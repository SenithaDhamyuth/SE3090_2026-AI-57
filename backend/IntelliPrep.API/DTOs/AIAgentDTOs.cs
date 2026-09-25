using System.Text.Json.Serialization;

namespace IntelliPrep.API.DTOs
{
    // ═══════════════════════════════════════════════════════════════════════
    // Agent 1 — Past Paper Analyst DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Input to Agent 1. Contains the raw list of topics extracted from
    /// past A/L ICT papers that the admin wants analysed.
    /// </summary>
    public sealed record AnalyzePastPapersRequest
    {
        /// <summary>Flat list of topic strings from past papers, e.g. ["Networking","Logic Gates"].</summary>
        [JsonPropertyName("topics")]
        public List<string> Topics { get; init; } = [];

        /// <summary>Optional: restrict analysis to a specific exam year.</summary>
        [JsonPropertyName("year")]
        public int Year { get; init; } = 0;
    }

    /// <summary>
    /// One element in the JSON array that Agent 1 is forced to return.
    /// Shape: { "topicName": "Networking", "probabilityPercentage": 25 }
    /// </summary>
    public sealed record TopicProbabilityDto
    {
        [JsonPropertyName("topicName")]
        public string TopicName { get; init; } = string.Empty;

        [JsonPropertyName("probabilityPercentage")]
        public decimal ProbabilityPercentage { get; init; }
    }

    /// <summary>
    /// Returned to the API caller after Agent 1 has finished processing.
    /// </summary>
    public sealed record AnalyzePastPapersResult
    {
        public bool Success { get; init; }
        public string Message { get; init; } = string.Empty;

        /// <summary>Number of PastPaperAnalytic rows persisted to the database.</summary>
        public int RowsSaved { get; init; }

        /// <summary>The raw LLM output, useful for debugging in development.</summary>
        public string? RawLlmOutput { get; init; }

        /// <summary>The validated and parsed probabilities (empty on failure).</summary>
        public List<TopicProbabilityDto> Probabilities { get; init; } = [];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 2 — Study Planner DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Input to Agent 2. Contains the student and target date needed to
    /// generate a personalised, syllabus-bounded daily study plan.
    /// </summary>
    public sealed record GenerateStudyPlanRequest
    {
        [JsonPropertyName("studentId")]
        public int StudentId { get; init; }

        /// <summary>
        /// ISO 8601 target exam date. The planner will create one entry per day
        /// from today until this date.
        /// </summary>
        [JsonPropertyName("targetExamDate")]
        public DateTime TargetExamDate { get; init; }
    }

    /// <summary>
    /// One day in the JSON array that Agent 2 is forced to return.
    /// Shape: { "day": 1, "date": "2026-10-01", "topic": "...", "subtopics": "...", "priority": "High" }
    /// </summary>
    public sealed record StudyDayDto
    {
        [JsonPropertyName("day")]
        public int Day { get; init; }

        [JsonPropertyName("date")]
        public string Date { get; init; } = string.Empty;

        [JsonPropertyName("topic")]
        public string Topic { get; init; } = string.Empty;

        [JsonPropertyName("subtopics")]
        public string Subtopics { get; init; } = string.Empty;

        /// <summary>Must be "High", "Medium", or "Low".</summary>
        [JsonPropertyName("priority")]
        public string Priority { get; init; } = "Medium";
    }

    /// <summary>
    /// Returned to the API caller after Agent 2 has finished.
    /// IsApproved will always be false — admin must approve via the dashboard.
    /// </summary>
    public sealed record GenerateStudyPlanResult
    {
        public bool Success { get; init; }
        public string Message { get; init; } = string.Empty;

        /// <summary>The StudyPlan.Id of the newly persisted row (0 on failure).</summary>
        public int StudyPlanId { get; init; }

        /// <summary>Always false on creation. Requires admin approval.</summary>
        public bool IsApproved { get; init; } = false;

        public List<StudyDayDto> PlanDays { get; init; } = [];

        /// <summary>Raw LLM output preserved for debugging/audit.</summary>
        public string? RawLlmOutput { get; init; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Groq / OpenAI-compatible request & response envelope DTOs
    // (internal — not exposed via API endpoints)
    // ═══════════════════════════════════════════════════════════════════════

    internal sealed record GroqMessage
    {
        [JsonPropertyName("role")]    public string Role    { get; init; } = string.Empty;
        [JsonPropertyName("content")] public string Content { get; init; } = string.Empty;
    }

    internal sealed record GroqChatRequest
    {
        [JsonPropertyName("model")]       public string         Model       { get; init; } = string.Empty;
        [JsonPropertyName("messages")]    public List<GroqMessage> Messages { get; init; } = [];
        [JsonPropertyName("temperature")] public float          Temperature { get; init; } = 0.1f;
        [JsonPropertyName("max_tokens")]  public int            MaxTokens   { get; init; } = 4096;
    }

    internal sealed record GroqChatResponse
    {
        [JsonPropertyName("choices")] public List<GroqChoice>? Choices { get; init; }
    }

    internal sealed record GroqChoice
    {
        [JsonPropertyName("message")] public GroqMessage? Message { get; init; }
    }
}
