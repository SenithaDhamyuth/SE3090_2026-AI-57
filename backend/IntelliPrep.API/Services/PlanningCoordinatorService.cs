using System.Text.Json;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// PlanningCoordinatorService — simulates a multi-agent AI orchestration loop.
    ///
    /// In the full agentic architecture, this coordinator would fan out to specialist
    /// sub-agents (Content Synthesizer, Validator, Tutor Approval Agent, Finalizer)
    /// via the Groq inference layer. For the MVP scaffold we return a deterministic
    /// structured plan so the rest of the system (frontend, DB, controller) can be
    /// built and tested end-to-end without live LLM dependency.
    /// </summary>
    public class PlanningCoordinatorService
    {
        private readonly ILogger<PlanningCoordinatorService> _logger;

        public PlanningCoordinatorService(ILogger<PlanningCoordinatorService> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Generates a structured 4-step exam plan for the given learning objective.
        /// Returns a JSON string containing the agentic workflow plan.
        /// </summary>
        /// <param name="objective">High-level exam objective, e.g. "A/L ICT – Data Structures Mock"</param>
        /// <returns>Serialised JSON plan with delegated agent steps.</returns>
        public async Task<string> GenerateExamPlanAsync(string objective)
        {
            _logger.LogInformation("[PlanningCoordinator] Initiating agentic workflow for objective: {Objective}", objective);

            // Simulate async orchestration latency (replace with real Groq call in Sprint 2)
            await Task.Delay(120);

            var plan = new AgenticExamPlan
            {
                PlanId      = Guid.NewGuid().ToString("N")[..12].ToUpper(),
                Objective   = objective,
                GeneratedAt = DateTime.UtcNow,
                Status      = "Planned",
                Steps       =
                [
                    new AgentStep
                    {
                        StepNumber  = 1,
                        AgentName   = "ContentSynthesizer",
                        Task        = "Retrieve relevant questions from the Question Bank matching the objective, difficulty distribution (30% Easy / 40% Medium / 30% Hard), and syllabus alignment.",
                        OutputArtifact = "question_pool.json",
                        EstimatedMs = 800,
                        Status      = "Queued"
                    },
                    new AgentStep
                    {
                        StepNumber  = 2,
                        AgentName   = "ValidationAgent",
                        Task        = "Validate retrieved questions for distractor quality, duplication, and Bloom's taxonomy coverage. Flag any anomalies.",
                        OutputArtifact = "validation_report.json",
                        EstimatedMs = 400,
                        Status      = "Queued"
                    },
                    new AgentStep
                    {
                        StepNumber  = 3,
                        AgentName   = "TutorApprovalAgent",
                        Task        = "Route the validated question set to the assigned tutor for review. Block finalization until approval token is received.",
                        OutputArtifact = "approval_token.json",
                        EstimatedMs = 0, // Human-in-the-loop — async wait
                        Status      = "AwaitingHuman"
                    },
                    new AgentStep
                    {
                        StepNumber  = 4,
                        AgentName   = "FinalizationAgent",
                        Task        = "Assemble the approved question set into a timed ExamSession record, set status to 'Pending', and notify the student.",
                        OutputArtifact = "exam_session.json",
                        EstimatedMs = 200,
                        Status      = "Queued"
                    }
                ]
            };

            _logger.LogInformation("[PlanningCoordinator] Plan {PlanId} generated with {StepCount} delegated steps.", plan.PlanId, plan.Steps.Count);

            return JsonSerializer.Serialize(plan, new JsonSerializerOptions { WriteIndented = true });
        }
    }

    // ── Internal DTOs for the plan structure ─────────────────────────────────

    public sealed class AgenticExamPlan
    {
        public string      PlanId      { get; set; } = string.Empty;
        public string      Objective   { get; set; } = string.Empty;
        public DateTime    GeneratedAt { get; set; }
        public string      Status      { get; set; } = "Planned";
        public List<AgentStep> Steps   { get; set; } = [];
    }

    public sealed class AgentStep
    {
        public int    StepNumber      { get; set; }
        public string AgentName       { get; set; } = string.Empty;
        public string Task            { get; set; } = string.Empty;
        public string OutputArtifact  { get; set; } = string.Empty;
        public int    EstimatedMs     { get; set; }
        public string Status          { get; set; } = "Queued";
    }
}
