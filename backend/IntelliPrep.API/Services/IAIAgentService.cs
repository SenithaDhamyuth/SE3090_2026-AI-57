using IntelliPrep.API.DTOs;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Contract for the two-agent AI workflow:
    ///   Agent 1 — Past Paper Analyst  → <see cref="AnalyzePastPapersAsync"/>
    ///   Agent 2 — Study Planner       → <see cref="GenerateStudyPlanAsync"/>
    ///
    /// Both methods are fully self-contained: they call the LLM, deterministically
    /// validate the JSON output, and persist results to the database. The caller
    /// only needs to inspect the returned result object — no internal state leaks out.
    /// </summary>
    public interface IAIAgentService
    {
        /// <summary>
        /// Agent 1 — Past Paper Analyst.
        ///
        /// Sends <paramref name="request.Topics"/> to the Groq LLM instructing it to
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
        /// Agent 2 — Study Planner (Lite-RAG).
        ///
        /// Retrieves <c>SyllabusLimits</c> and <c>PastPaperAnalytics</c> from the database
        /// and injects them into a structured system prompt. The Groq LLM then generates a
        /// day-by-day study schedule from today until <paramref name="request.TargetExamDate"/>.
        ///
        /// <b>HUMAN-IN-THE-LOOP</b>: The persisted <c>StudyPlan</c> row is always created with
        /// <c>IsApproved = false</c>. An admin must explicitly approve it before the student sees it.
        /// </summary>
        /// <param name="request">Input containing the student ID and exam target date.</param>
        /// <param name="cancellationToken">Propagated to all async I/O operations.</param>
        /// <returns>
        /// A <see cref="GenerateStudyPlanResult"/> with the new plan's database ID,
        /// the parsed day entries, and <c>IsApproved = false</c>.
        /// Never throws — all exceptions are caught and returned as <c>Success = false</c>.
        /// </returns>
        Task<GenerateStudyPlanResult> GenerateStudyPlanAsync(
            GenerateStudyPlanRequest request,
            CancellationToken cancellationToken = default);
    }
}
