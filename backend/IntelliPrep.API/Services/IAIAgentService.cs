using IntelliPrep.API.DTOs;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Contract for the AI agent workflow:
    ///   Agent 1a — Past Paper Analyst  → <see cref="AnalyzePastPapersAsync"/>
    ///   Agent 1b — Data Analyst        → <see cref="PredictTopicDistributionAsync"/>
    ///   Agent 2  — Study Planner       → <see cref="GenerateStudyPlanAsync"/>
    ///
    /// Both public methods are fully self-contained: they call the LLM (or run
    /// deterministic maths), validate output, and persist results. The caller only
    /// needs to inspect the returned result object — no internal state leaks out.
    /// </summary>
    public interface IAIAgentService
    {
        /// <summary>
        /// Agent 1a — Past Paper Analyst.
        ///
        /// Sends <paramref name="request"/>.Topics to the Groq LLM instructing it to
        /// compute probability percentages for each topic based on historical frequency.
        /// If the LLM returns valid JSON, the results are persisted to <c>PastPaperAnalytics</c>.
        /// </summary>
        /// <param name="request">Input containing the raw topic list and optional year.</param>
        /// <param name="cancellationToken">Propagated to all async I/O operations.</param>
        /// <returns>
        /// An <see cref="AnalyzePastPapersResult"/> describing success/failure,
        /// the parsed probabilities, and the number of database rows saved.
        /// Never throws — all exceptions are caught and returned as <c>Success = false</c>.
        /// </returns>
        Task<AnalyzePastPapersResult> AnalyzePastPapersAsync(
            AnalyzePastPapersRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Agent 1b — Data Analyst (deterministic, no LLM call).
        ///
        /// Reads every row from the <c>Questions</c> table, groups by
        /// <c>Lesson_Name</c> and <c>Year</c>, then applies an exponential-decay
        /// weighting scheme (configurable base, default 5×) so that recent years
        /// count more than older ones.  The weighted scores are normalised to
        /// probabilities and then distributed across a 50-question paper using
        /// the largest-remainder (Hamilton) method — guaranteeing the total is
        /// exactly 50 with no rounding error.
        ///
        /// Each topic also receives a trend label ("Rising" / "Falling" / "Stable")
        /// derived from a simple OLS linear regression over its year-count series.
        /// </summary>
        /// <param name="cancellationToken">Propagated to all async DB operations.</param>
        /// <returns>
        /// A <see cref="PredictTopicDistributionResult"/> containing the full
        /// per-topic breakdown plus algorithm metadata.
        /// Never throws — all exceptions are returned as <c>Success = false</c>.
        /// </returns>
        Task<PredictTopicDistributionResult> PredictTopicDistributionAsync(
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Agent 2 — Study Planner (Lite-RAG).
        ///
        /// Retrieves <c>SyllabusLimits</c> and <c>PastPaperAnalytics</c> from the database
        /// and injects them into a structured system prompt. The Groq LLM then generates a
        /// bi-weekly generalized study schedule from today until <paramref name="request"/>.TargetExamDate.
        ///
        /// <b>HUMAN-IN-THE-LOOP</b>: The persisted <c>StudyPlan</c> row is always created with
        /// <c>IsApproved = false</c>. An admin must explicitly approve it before students see it.
        /// </summary>
        /// <param name="request">Input containing the exam target date and optional excluded topics.</param>
        /// <param name="cancellationToken">Propagated to all async I/O operations.</param>
        /// <returns>
        /// A <see cref="GenerateStudyPlanResult"/> with the new plan's database ID,
        /// the parsed day entries, and <c>IsApproved = false</c>.
        /// Never throws — all exceptions are caught and returned as <c>Success = false</c>.
        /// </returns>
        Task<GenerateStudyPlanResult> GenerateStudyPlanAsync(
            GenerateStudyPlanRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Three-agent predicted-paper pipeline:
        ///   1. Internally runs <see cref="PredictTopicDistributionAsync"/> to compute the
        ///      weighted topic distribution from the entire Questions table.
        ///   2. Agent 2 (Researcher) — calls the Groq LLM to simulate gathering recent
        ///      real-world tech events / news relevant to the top-N highest-probability
        ///      topics, producing scenario seeds for contextual MCQs.
        ///   3. Agent 3 (Generator) — calls the Groq LLM with a RAG-injected prompt
        ///      containing the exact topic distribution (from step 1), the research
        ///      context (from step 2), and the SyllabusLimits from the database.
        ///      The LLM is strictly instructed to produce exactly 50 MCQs matching the
        ///      predicted distribution, using real-world scenarios as question contexts.
        ///
        /// Output is deterministically validated:
        ///   • Exactly 50 items.
        ///   • Each item: questionNo (1–50), topic, questionText, options (4 items),
        ///     correctOption (1–4), explanation.
        ///   • Topic distribution in the output is cross-checked against the prediction.
        /// </summary>
        /// <param name="request">Optional tuning parameters (research topic count, year cap).</param>
        /// <param name="cancellationToken">Propagated to all async I/O operations.</param>
        /// <returns>
        /// A <see cref="GeneratePaperResult"/> containing the 50 MCQs, the topic
        /// distribution used, and the research context gathered by Agent 2.
        /// Never throws — all exceptions are returned as <c>Success = false</c>.
        /// </returns>
        Task<GeneratePaperResult> GeneratePredictedPaperAsync(
            GeneratePaperRequest request,
            CancellationToken cancellationToken = default);
    }
}
