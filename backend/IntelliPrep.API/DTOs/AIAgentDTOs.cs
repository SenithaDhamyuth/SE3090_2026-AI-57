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
    // Agent 1 (Data Analyst) — Predicted Topic Distribution DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// How many questions appeared for a specific topic in a specific year.
    /// Used as a component of the per-topic year-over-year breakdown.
    /// </summary>
    public sealed record YearTopicCount
    {
        /// <summary>Examination year (e.g. 2022).</summary>
        [JsonPropertyName("year")]
        public int Year { get; init; }

        /// <summary>Raw count of questions for this topic in this year.</summary>
        [JsonPropertyName("rawCount")]
        public int RawCount { get; init; }

        /// <summary>
        /// Exponential weight assigned to this year by the weighting engine.
        /// Rounded to 4 decimal places for readability.
        /// </summary>
        [JsonPropertyName("yearWeight")]
        public double YearWeight { get; init; }

        /// <summary>Weighted contribution of this year to the topic score.</summary>
        [JsonPropertyName("weightedContribution")]
        public double WeightedContribution { get; init; }
    }

    /// <summary>
    /// Per-topic output produced by the deterministic weighted-probability engine
    /// (Agent 1 — Data Analyst).  Describes exactly how many questions a topic
    /// should receive in a predicted 50-question paper.
    /// </summary>
    public sealed record PredictedTopicDistribution
    {
        /// <summary>Normalised lesson/topic name from the Questions table.</summary>
        [JsonPropertyName("topicName")]
        public string TopicName { get; init; } = string.Empty;

        /// <summary>
        /// Total raw question count across ALL historical years for this topic.
        /// </summary>
        [JsonPropertyName("totalRawCount")]
        public int TotalRawCount { get; init; }

        /// <summary>
        /// Sum of (yearWeight × yearCount) across all years for this topic.
        /// Higher weight → more recent years dominate.
        /// </summary>
        [JsonPropertyName("weightedScore")]
        public double WeightedScore { get; init; }

        /// <summary>
        /// Normalised probability (0–100) derived from this topic's weighted score
        /// relative to all topics.  Represents the predicted likelihood that a
        /// question in the upcoming paper will belong to this topic.
        /// </summary>
        [JsonPropertyName("weightedProbabilityPct")]
        public double WeightedProbabilityPct { get; init; }

        /// <summary>
        /// Whole-number question count allocated to this topic in a predicted
        /// 50-question paper, calculated by distributing based on weighted probability.
        /// The allocation step guarantees the sum equals exactly 50 (using the
        /// largest-remainder method to resolve rounding).
        /// </summary>
        [JsonPropertyName("allocatedQuestions")]
        public int AllocatedQuestions { get; init; }

        /// <summary>
        /// Trend direction compared to a simple linear regression of the year-over-year
        /// raw counts.  One of: "Rising", "Falling", "Stable".
        /// </summary>
        [JsonPropertyName("trend")]
        public string Trend { get; init; } = "Stable";

        /// <summary>Year-by-year breakdown used to derive the above scores.</summary>
        [JsonPropertyName("yearBreakdown")]
        public List<YearTopicCount> YearBreakdown { get; init; } = [];
    }

    /// <summary>
    /// Top-level result returned by
    /// <see cref="IAIAgentService.PredictTopicDistributionAsync"/>.
    /// </summary>
    public sealed record PredictTopicDistributionResult
    {
        public bool   Success { get; init; }
        public string Message { get; init; } = string.Empty;

        /// <summary>Total questions read from the Questions table.</summary>
        [JsonPropertyName("totalQuestionsAnalysed")]
        public int TotalQuestionsAnalysed { get; init; }

        /// <summary>Distinct years found in the dataset.</summary>
        [JsonPropertyName("yearsAnalysed")]
        public List<int> YearsAnalysed { get; init; } = [];

        /// <summary>
        /// The exponential base used for year weighting (e.g. 5 means the most
        /// recent year carries 5× the weight of the oldest year).
        /// </summary>
        [JsonPropertyName("decayBase")]
        public double DecayBase { get; init; }

        /// <summary>
        /// Predicted paper size that the allocation was computed for (always 50).
        /// </summary>
        [JsonPropertyName("targetPaperSize")]
        public int TargetPaperSize { get; init; } = 50;

        /// <summary>
        /// Ordered list of topics (highest allocated questions first).
        /// Each entry carries the full probability + allocation breakdown.
        /// </summary>
        [JsonPropertyName("distribution")]
        public List<PredictedTopicDistribution> Distribution { get; init; } = [];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 2 — Study Planner DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Input to Agent 2. Contains the target exam date and optional exclusions needed to
    /// generate a general, syllabus-bounded, bi-weekly study plan template for any student.
    /// StudentId is intentionally omitted — the plan is a general template derived from dataset weights.
    /// </summary>
    public sealed record GenerateStudyPlanRequest
    {
        /// <summary>
        /// ISO 8601 target exam date. The planner will create one entry per day
        /// from today until this date, structured into bi-weekly (14-day) blocks.
        /// </summary>
        [JsonPropertyName("targetExamDate")]
        public DateTime TargetExamDate { get; init; }

        /// <summary>
        /// Optional list of topic names the LLM must completely ignore when
        /// building the study plan. Matched case-insensitively in the prompt.
        /// Example: ["Boolean Algebra", "File Handling"]
        /// </summary>
        [JsonPropertyName("excludedTopics")]
        public List<string> ExcludedTopics { get; init; } = [];
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

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 2 — Web Researcher DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// A single recent tech/current-events item gathered by Agent 2 for one topic.
    /// </summary>
    public sealed record ResearchEventDto
    {
        /// <summary>Short headline for the event (one sentence).</summary>
        [JsonPropertyName("headline")]
        public string Headline { get; init; } = string.Empty;

        /// <summary>
        /// How this event is relevant to the A/L ICT topic
        /// (one sentence, suitable for use as a MCQ scenario).
        /// </summary>
        [JsonPropertyName("relevance")]
        public string Relevance { get; init; } = string.Empty;
    }

    /// <summary>
    /// Research context gathered by Agent 2 for one ICT topic.
    /// Holds the topic name and a list of recent real-world events.
    /// </summary>
    public sealed record TopicResearchContext
    {
        [JsonPropertyName("topicName")]
        public string TopicName { get; init; } = string.Empty;

        [JsonPropertyName("recentEvents")]
        public string RecentEvents { get; init; } = string.Empty;

        [JsonPropertyName("globalTrends")]
        public string GlobalTrends { get; init; } = string.Empty;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 3 — Paper Generator DTOs
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Request body for <c>POST api/aiagent/generate-paper</c>.
    /// No fields are required — the engine derives everything from the
    /// Questions table and SyllabusLimits via the prediction pipeline.
    /// </summary>
    public sealed record GeneratePaperRequest
    {
        /// <summary>
        /// Number of top-probability topics Agent 2 (Researcher) should
        /// gather news/events for.  Defaults to 3; clamped to [1, 10].
        /// </summary>
        [JsonPropertyName("researchTopicCount")]
        public int ResearchTopicCount { get; init; } = 3;

        /// <summary>
        /// Optional per-topic overrides explicitly requested by the user.
        /// These are treated as non-negotiable constraints by Agent 3, for example:
        /// [{ "topicName": "IP Addresses", "questionCount": 4 }].
        /// </summary>
        [JsonPropertyName("manualTopicRequests")]
        public List<ManualTopicRequest> ManualTopicRequests { get; init; } = [];

        /// <summary>
        /// Optional seed year to restrict the Agent 1b probability calculation
        /// to questions up to (and including) this year.  0 = use all years.
        /// </summary>
        [JsonPropertyName("upToYear")]
        public int UpToYear { get; init; } = 0;
    }

    /// <summary>
    /// A user-specified topic requirement that must be respected exactly.
    /// </summary>
    public sealed record ManualTopicRequest
    {
        [JsonPropertyName("topicName")]
        public string TopicName { get; init; } = string.Empty;

        [JsonPropertyName("questionCount")]
        public int QuestionCount { get; init; }
    }

    /// <summary>
    /// One generated MCQ produced by Agent 3 (Paper Generator).
    /// Shape enforced by deterministic validation after the LLM call.
    /// </summary>
    public sealed record GeneratedMcqDto
    {
        /// <summary>Sequential question number (1–50).</summary>
        [JsonPropertyName("questionNo")]
        public int QuestionNo { get; init; }

        /// <summary>The ICT topic this question belongs to.</summary>
        [JsonPropertyName("topic")]
        public string Topic { get; init; } = string.Empty;

        /// <summary>Full question text.</summary>
        [JsonPropertyName("questionText")]
        public string QuestionText { get; init; } = string.Empty;

        /// <summary>Exactly 4 answer options.</summary>
        [JsonPropertyName("options")]
        public List<string> Options { get; init; } = [];

        /// <summary>
        /// 1-based index of the correct answer (1, 2, 3, or 4).
        /// </summary>
        [JsonPropertyName("correctOption")]
        public int CorrectOption { get; init; }

        /// <summary>
        /// One-sentence explanation of why the correct answer is correct.
        /// Useful for the student feedback view.
        /// </summary>
        [JsonPropertyName("explanation")]
        public string Explanation { get; init; } = string.Empty;
    }

    /// <summary>
    /// Top-level result returned by
    /// <see cref="IAIAgentService.GeneratePredictedPaperAsync"/>.
    /// </summary>
    public sealed record GeneratePaperResult
    {
        public bool   Success { get; init; }
        public string Message { get; init; } = string.Empty;

        /// <summary>Raw LLM output preserved for debugging/audit.</summary>
        public string? RawLlmOutput { get; init; }

        /// <summary>
        /// The predicted topic distribution used to instruct Agent 3.
        /// Included for transparency / display in the admin UI.
        /// </summary>
        [JsonPropertyName("topicDistribution")]
        public List<PredictedTopicDistribution> TopicDistribution { get; init; } = [];

        /// <summary>
        /// Research context gathered by Agent 2 for the top topics.
        /// </summary>
        [JsonPropertyName("researchContext")]
        public List<TopicResearchContext> ResearchContext { get; init; } = [];

        /// <summary>The 50 generated MCQs (empty on failure).</summary>
        [JsonPropertyName("questions")]
        public List<GeneratedMcqDto> Questions { get; init; } = [];

        /// <summary>Total number of MCQs generated (should always be 50 on success).</summary>
        [JsonPropertyName("questionCount")]
        public int QuestionCount => Questions.Count;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 3 — ExamSynthesizerAgent Input / Output Contracts
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Strict INPUT contract for Agent 3 (<c>ExamSynthesizerAgent</c>).
    ///
    /// Carries the user's objective, the subject, the requested question count,
    /// and an optional per-topic distribution that Agent 3 must honour exactly.
    /// </summary>
    public sealed record SynthesizerInput
    {
        /// <summary>A/L ICT subject (e.g. "Networking", "Logic Gates").</summary>
        [JsonPropertyName("subject")]
        public string Subject { get; init; } = string.Empty;

        /// <summary>
        /// The user's verbatim learning objective — drives focus for the LLM.
        /// Example: "I want questions on NAND gate combinations."
        /// </summary>
        [JsonPropertyName("objective")]
        public string Objective { get; init; } = string.Empty;

        /// <summary>Exact number of MCQs that must be generated.</summary>
        [JsonPropertyName("requestedQuestionCount")]
        public int RequestedQuestionCount { get; init; } = 5;

        /// <summary>
        /// Optional per-topic breakdown: topic → exact question count.
        /// The values must sum to <see cref="RequestedQuestionCount"/>.
        /// Example: { "IP Addresses": 3, "Subnetting": 2 }
        /// </summary>
        [JsonPropertyName("topicDistribution")]
        public Dictionary<string, int> TopicDistribution { get; init; } = [];
    }

    /// <summary>
    /// Strict OUTPUT contract produced by Agent 3 (<c>ExamSynthesizerAgent</c>).
    /// Passed directly to Agent 4 (<c>ValidationAgentService</c>) for validation
    /// before any DB persistence occurs.
    /// </summary>
    public sealed record SynthesizerOutput
    {
        [JsonPropertyName("subject")]
        public string Subject { get; init; } = string.Empty;

        [JsonPropertyName("objective")]
        public string Objective { get; init; } = string.Empty;

        [JsonPropertyName("requestedQuestionCount")]
        public int RequestedQuestionCount { get; init; }

        [JsonPropertyName("topicDistribution")]
        public Dictionary<string, int> TopicDistribution { get; init; } = [];

        /// <summary>Raw JSON string returned by the LLM — preserved for audit/debug.</summary>
        [JsonPropertyName("rawLlmJson")]
        public string RawLlmJson { get; init; } = string.Empty;

        /// <summary>Parsed MCQ list ready for Agent 4 deterministic validation.</summary>
        [JsonPropertyName("questions")]
        public List<SynthesizedMcqItem> Questions { get; init; } = [];
    }

    /// <summary>
    /// A single MCQ produced by Agent 3.
    /// Validated by Agent 4 before persistence.
    /// </summary>
    public sealed class SynthesizedMcqItem
    {
        [JsonPropertyName("questionText")]
        public string QuestionText { get; set; } = string.Empty;

        /// <summary>MUST contain exactly 5 non-empty strings.</summary>
        [JsonPropertyName("options")]
        public List<string> Options { get; set; } = [];

        /// <summary>Zero-based index into <see cref="Options"/>. MUST be in [0, 4].</summary>
        [JsonPropertyName("correctOptionIndex")]
        public int CorrectOptionIndex { get; set; }

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        /// <summary>Provenance tag — set automatically by Agent 3.</summary>
        [JsonPropertyName("generatedBy")]
        public string GeneratedBy { get; set; } = "Agent3:ExamSynthesizer";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 4 — ValidationAgentService Result DTO
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Result returned by Agent 4 (<c>ValidationAgentService</c>) after running
    /// the deterministic check loop over Agent 3's output.
    /// </summary>
    public sealed record AgentValidationResult
    {
        /// <summary><c>true</c> if all checks passed and the session was persisted.</summary>
        public bool Success { get; init; }

        /// <summary>Human-readable summary of the outcome.</summary>
        public string Message { get; init; } = string.Empty;

        /// <summary>How many synthesis+validation attempts were made (1 = passed first time).</summary>
        [JsonPropertyName("attemptsTaken")]
        public int AttemptsTaken { get; init; }

        /// <summary>The ExamSession.Id that was updated on success.</summary>
        [JsonPropertyName("sessionId")]
        public int SessionId { get; init; }

        /// <summary>
        /// The validated MCQ list (populated even on failure so callers can inspect
        /// the last attempt's questions for debugging).
        /// </summary>
        [JsonPropertyName("questions")]
        public List<SynthesizedMcqItem> Questions { get; init; } = [];

        /// <summary>Raw LLM JSON from the last attempt — useful for audit logs.</summary>
        [JsonPropertyName("rawLlmJson")]
        public string? RawLlmJson { get; init; }

        /// <summary>
        /// List of deterministic check errors from ALL attempts.
        /// Empty on success.
        /// </summary>
        [JsonPropertyName("errors")]
        public List<string> Errors { get; init; } = [];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 3 — Internal Groq request / response DTOs
    // (scoped to ExamSynthesizerAgent — not exposed via API endpoints)
    // ═══════════════════════════════════════════════════════════════════════

    internal sealed class SynthesizerGroqRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("messages")]
        public List<SynthesizerGroqMessage> Messages { get; set; } = [];

        [JsonPropertyName("temperature")]
        public float Temperature { get; set; } = 0.7f;

        [JsonPropertyName("max_tokens")]
        public int MaxTokens { get; set; } = 4000;

        [JsonPropertyName("stream")]
        public bool Stream { get; set; } = false;
    }

    internal sealed class SynthesizerGroqMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    internal sealed class SynthesizerGroqResponse
    {
        [JsonPropertyName("choices")]
        public List<SynthesizerGroqChoice>? Choices { get; set; }
    }

    internal sealed class SynthesizerGroqChoice
    {
        [JsonPropertyName("message")]
        public SynthesizerGroqMessage? Message { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent 3 — Internal seed model
    // (used only during few-shot seed loading inside ExamSynthesizerAgent)
    // ═══════════════════════════════════════════════════════════════════════

    internal sealed class SynthesizerSeedQuestion
    {
        public string Source          { get; set; } = string.Empty;
        public string LessonName      { get; set; } = string.Empty;
        public string DifficultyLevel { get; set; } = string.Empty;
        public string QuestionText    { get; set; } = string.Empty;
        public string Option1         { get; set; } = string.Empty;
        public string Option2         { get; set; } = string.Empty;
        public string Option3         { get; set; } = string.Empty;
        public string Option4         { get; set; } = string.Empty;
        public string Option5         { get; set; } = string.Empty;
        public string CorrectAnswer   { get; set; } = string.Empty;
    }
}
