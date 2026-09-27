using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// PlanningCoordinatorService — UC6.1 Groq LLM-powered multi-agent orchestrator.
    ///
    /// Calls the Groq Chat Completions API (OpenAI-compatible) with a structured
    /// system prompt that instructs the LLM to act as a Planning Coordinator and
    /// break the student's objective into a 3-agent JSON workflow plan.
    ///
    /// Fallback (UC6.4): If the LLM is unreachable, times out, or returns malformed
    /// JSON, a deterministic safe plan is returned instead of propagating the error.
    /// </summary>
    public class PlanningCoordinatorService
    {
        /// <summary>Named HttpClient key used for registration in Program.cs.</summary>
        public const string HttpClientName = "GroqClient";

        // ── Agent system prompt ───────────────────────────────────────────────
        private const string SystemPrompt =
            "You are the Planning Coordinator Agent for an A/L ICT educational platform. " +
            "The student will give you an objective (e.g., 'I want a 20 question paper on Networking'). " +
            "You must break this down into a structured JSON workflow plan involving 3 other agents: " +
            "ContentSynthesizer, ValidationAgent, and TutorApprovalAgent. " +
            "Output ONLY valid JSON, no markdown, no explanation, no code fences. " +
            "The JSON must match this schema exactly:\n" +
            "{\n" +
            "  \"PlanId\": \"<12-char uppercase id>\",\n" +
            "  \"Objective\": \"<student's objective>\",\n" +
            "  \"GeneratedAt\": \"<ISO 8601 UTC>\",\n" +
            "  \"Status\": \"Planned\",\n" +
            "  \"Source\": \"GroqLLM\",\n" +
            "  \"Steps\": [\n" +
            "    { \"StepNumber\": 1, \"AgentName\": \"ContentSynthesizer\", \"Task\": \"<specific task>\", \"OutputArtifact\": \"question_pool.json\", \"EstimatedMs\": <number>, \"Status\": \"Queued\" },\n" +
            "    { \"StepNumber\": 2, \"AgentName\": \"ValidationAgent\",    \"Task\": \"<specific task>\", \"OutputArtifact\": \"validation_report.json\", \"EstimatedMs\": <number>, \"Status\": \"Queued\" },\n" +
            "    { \"StepNumber\": 3, \"AgentName\": \"TutorApprovalAgent\",  \"Task\": \"<specific task>\", \"OutputArtifact\": \"approval_token.json\",    \"EstimatedMs\": 0, \"Status\": \"AwaitingHuman\" }\n" +
            "  ]\n" +
            "}";

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            WriteIndented        = true,
            PropertyNamingPolicy = null, // preserve PascalCase
        };

        private readonly IHttpClientFactory                    _httpClientFactory;
        private readonly IConfiguration                        _configuration;
        private readonly ILogger<PlanningCoordinatorService>   _logger;
        private readonly string[]                              _apiKeys;
        private readonly string                                _modelName;
        private readonly int                                   _timeoutSeconds;

        public PlanningCoordinatorService(
            IHttpClientFactory                   httpClientFactory,
            IConfiguration                       configuration,
            ILogger<PlanningCoordinatorService>  logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration     = configuration;
            _logger            = logger;

            var groqSettings = _configuration.GetSection("GroqSettings").Get<Models.GroqSettings>() ?? new Models.GroqSettings();

            _apiKeys = groqSettings.ApiKeys?.Where(k => !string.IsNullOrWhiteSpace(k)).Distinct(StringComparer.Ordinal).ToArray() ?? [];
            if (_apiKeys.Length == 0)
            {
                throw new InvalidOperationException("No Groq API keys configured. Add GroqSettings:ApiKeys array.");
            }

            var configuredModel = _configuration["GroqSettings:Model"];
            if (string.IsNullOrWhiteSpace(configuredModel))
            {
                throw new InvalidOperationException("Groq Model is not configured.");
            }

            _modelName = configuredModel;
            _timeoutSeconds = groqSettings.TimeoutSeconds > 0 ? groqSettings.TimeoutSeconds : 30;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Calls the Groq LLM to generate a 3-step agent workflow plan for the
        /// given student <paramref name="objective"/>.
        ///
        /// Returns a clean JSON string (either LLM-generated or fallback).
        /// Never throws — all exceptions are caught and logged (UC6.4).
        /// </summary>
        public async Task<string> GenerateExamPlanAsync(string objective)
        {
            _logger.LogInformation(
                "[PlanningCoordinator] UC6.1 — invoking Groq for objective: {Objective}", objective);

            try
            {
                var rawLlmJson = await CallGroqApiAsync(objective, CancellationToken.None);
                var cleanJson  = ExtractAndValidateJson(rawLlmJson, objective);

                _logger.LogInformation(
                    "[PlanningCoordinator] Groq plan received and validated successfully.");

                return cleanJson;
            }
            catch (TaskCanceledException tcEx) when (tcEx.InnerException is TimeoutException || tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "[PlanningCoordinator] UC6.4 — Groq request timed out. Returning fallback plan.");
                return BuildFallbackPlan(objective, "Groq API timed out");
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogWarning(httpEx,
                    "[PlanningCoordinator] UC6.4 — Groq HTTP error ({Status}). Returning fallback plan.",
                    httpEx.StatusCode);
                return BuildFallbackPlan(objective, $"Groq HTTP error: {httpEx.Message}");
            }
            catch (JsonException jsonEx)
            {
                _logger.LogWarning(jsonEx,
                    "[PlanningCoordinator] UC6.4 — LLM returned non-JSON response. Returning fallback plan.");
                return BuildFallbackPlan(objective, "LLM returned malformed JSON");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "[PlanningCoordinator] UC6.4 — Unexpected error. Returning fallback plan.");
                return BuildFallbackPlan(objective, ex.Message);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Private: Groq HTTP call
        // ─────────────────────────────────────────────────────────────────────

        private async Task<string> CallGroqApiAsync(string objective, CancellationToken cancellationToken)
        {
            for (int attempt = 0; attempt < _apiKeys.Length; attempt++)
            {
                var selectedKey = _apiKeys[attempt % _apiKeys.Length];
                var requestBody = new GroqChatRequest
                {
                    Model       = _modelName,
                    Temperature = 0.2f,   // Low temp for deterministic JSON output
                    MaxTokens   = 1024,
                    Messages    =
                    [
                        new GroqMessage { Role = "system", Content = SystemPrompt },
                        new GroqMessage { Role = "user",   Content = objective     },
                    ]
                };

                var json    = JsonSerializer.Serialize(requestBody, _jsonOpts);
                using var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
                {
                    Content = httpContent
                };
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", selectedKey);
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var httpClient = _httpClientFactory.CreateClient(HttpClientName);

                _logger.LogDebug(
                    "[PlanningCoordinator] POST to Groq | model={Model} | objective length={Len}",
                    _modelName, objective.Length);

                try
                {
                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    cts.CancelAfter(TimeSpan.FromSeconds(_timeoutSeconds));
                    
                    var httpResponse = await httpClient.SendAsync(httpRequest, cts.Token);
                    var responseBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (httpResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                        httpResponse.StatusCode == System.Net.HttpStatusCode.TooManyRequests ||
                        httpResponse.StatusCode == System.Net.HttpStatusCode.RequestEntityTooLarge)
                    {
                        _logger.LogWarning(
                            "[PlanningCoordinator] Hit {Status} for key {KeySuffix}, rotating to next key...",
                            httpResponse.StatusCode,
                            selectedKey.Substring(Math.Max(0, selectedKey.Length - 6)));
                        continue;
                    }

                    if (httpResponse.IsSuccessStatusCode)
                    {
                        var groqResponse = JsonSerializer.Deserialize<GroqChatResponse>(
                            responseBody,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                            ?? throw new JsonException("Groq response deserialized to null.");

                        var llmContent = groqResponse.Choices?.FirstOrDefault()?.Message?.Content
                            ?? throw new JsonException("Groq response contained no choices.");

                        _logger.LogDebug(
                            "[PlanningCoordinator] Raw LLM content received ({Len} chars).", llmContent.Length);

                        return llmContent;
                    }

                    _logger.LogError(
                        "[PlanningCoordinator] Groq API returned HTTP {Status} for key {KeySuffix}: {Body}",
                        (int)httpResponse.StatusCode,
                        selectedKey.Substring(Math.Max(0, selectedKey.Length - 6)),
                        responseBody);

                    throw new HttpRequestException(
                        $"Groq API error {(int)httpResponse.StatusCode}: {responseBody}",
                        null,
                        httpResponse.StatusCode);
                }
                catch (Exception ex) when (ex is TaskCanceledException || ex is TimeoutException)
                {
                    _logger.LogWarning("[PlanningCoordinator] Request timed out, rotating to next key...");
                    continue; // rotate to next key
                }
            }

            throw new HttpRequestException(
                $"Groq API rate limit, auth, or timeout exceeded across {_apiKeys.Length} configured keys.");
        }

        // ─────────────────────────────────────────────────────────────────────
        // Private: JSON extraction & validation
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Strips any markdown code fences the LLM may have added despite the prompt,
        /// then validates the JSON can be parsed. Adds server-side metadata fields
        /// (PlanId, GeneratedAt, Source) if the LLM omitted them.
        /// </summary>
        private string ExtractAndValidateJson(string raw, string objective)
        {
            // Strip ```json … ``` or ``` … ``` fences (defensive — LLMs sometimes ignore instructions)
            var trimmed = raw.Trim();
            if (trimmed.StartsWith("```"))
            {
                var firstNewline  = trimmed.IndexOf('\n');
                var lastFence     = trimmed.LastIndexOf("```");
                if (firstNewline > 0 && lastFence > firstNewline)
                    trimmed = trimmed[(firstNewline + 1)..lastFence].Trim();
            }

            // Validate it is parseable JSON
            using var doc = JsonDocument.Parse(trimmed);
            var root = doc.RootElement;

            // Re-serialise through a mutable dictionary so we can inject/overwrite metadata
            var plan = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(trimmed)
                ?? throw new JsonException("Could not deserialize LLM plan into dictionary.");

            // Ensure server-controlled fields are present and correct
            if (!plan.ContainsKey("PlanId") || plan["PlanId"].GetString() is null or "")
            {
                plan["PlanId"] = JsonDocument.Parse(
                    $"\"{Guid.NewGuid():N}"[..12].ToUpper() + "\"").RootElement;
            }

            plan["GeneratedAt"] = JsonDocument.Parse(
                $"\"{DateTime.UtcNow:O}\"").RootElement;

            plan["Source"] = JsonDocument.Parse("\"GroqLLM\"").RootElement;

            if (!plan.ContainsKey("Objective"))
                plan["Objective"] = JsonDocument.Parse(
                    $"\"{JsonEncodedText.Encode(objective)}\"").RootElement;

            return JsonSerializer.Serialize(plan, _jsonOpts);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Private: UC6.4 fallback plan builder
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Builds a deterministic fallback plan whenever the Groq call fails.
        /// The <paramref name="reason"/> is embedded so the admin dashboard can
        /// surface why the fallback was triggered.
        /// </summary>
        private string BuildFallbackPlan(string objective, string reason)
        {
            var plan = new AgenticExamPlan
            {
                PlanId      = Guid.NewGuid().ToString("N")[..12].ToUpper(),
                Objective   = objective,
                GeneratedAt = DateTime.UtcNow,
                Status      = "Planned",
                Source      = "Fallback",
                FallbackReason = reason,
                Steps       =
                [
                    new AgentStep
                    {
                        StepNumber     = 1,
                        AgentName      = "ContentSynthesizer",
                        Task           = $"Retrieve questions from the Question Bank that match the objective: \"{objective}\". Apply standard difficulty distribution (30% Easy / 40% Medium / 30% Hard).",
                        OutputArtifact = "question_pool.json",
                        EstimatedMs    = 800,
                        Status         = "Queued"
                    },
                    new AgentStep
                    {
                        StepNumber     = 2,
                        AgentName      = "ValidationAgent",
                        Task           = "Validate retrieved questions for distractor quality, Bloom's taxonomy coverage, and duplicate detection. Flag anomalies for tutor review.",
                        OutputArtifact = "validation_report.json",
                        EstimatedMs    = 400,
                        Status         = "Queued"
                    },
                    new AgentStep
                    {
                        StepNumber     = 3,
                        AgentName      = "TutorApprovalAgent",
                        Task           = "Route the validated question set to the assigned tutor. Block exam finalisation until the tutor issues an approval token.",
                        OutputArtifact = "approval_token.json",
                        EstimatedMs    = 0,
                        Status         = "AwaitingHuman"
                    }
                ]
            };

            _logger.LogWarning(
                "[PlanningCoordinator] Fallback plan {PlanId} issued. Reason: {Reason}",
                plan.PlanId, reason);

            return JsonSerializer.Serialize(plan, _jsonOpts);
        }
    }

    // ── Domain models (plan structure) ────────────────────────────────────────

    public sealed class AgenticExamPlan
    {
        public string           PlanId         { get; set; } = string.Empty;
        public string           Objective      { get; set; } = string.Empty;
        public DateTime         GeneratedAt    { get; set; }
        public string           Status         { get; set; } = "Planned";
        public string           Source         { get; set; } = "Unknown";
        public string?          FallbackReason { get; set; }
        public List<AgentStep>  Steps          { get; set; } = [];
    }

    public sealed class AgentStep
    {
        public int    StepNumber     { get; set; }
        public string AgentName      { get; set; } = string.Empty;
        public string Task           { get; set; } = string.Empty;
        public string OutputArtifact { get; set; } = string.Empty;
        public int    EstimatedMs    { get; set; }
        public string Status         { get; set; } = "Queued";
    }

    // ── Groq API request/response DTOs ───────────────────────────────────────
    // Using System.Text.Json.Serialization attributes for snake_case mapping.

    internal sealed class GroqChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("messages")]
        public List<GroqMessage> Messages { get; set; } = [];

        [JsonPropertyName("temperature")]
        public float Temperature { get; set; } = 0.2f;

        [JsonPropertyName("max_tokens")]
        public int MaxTokens { get; set; } = 1024;

        [JsonPropertyName("response_format")]
        public object? ResponseFormat { get; set; }

        [JsonPropertyName("stream")]
        public bool Stream { get; set; } = false;
    }

    internal sealed class GroqMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    internal sealed class GroqChatResponse
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("choices")]
        public List<GroqChoice>? Choices { get; set; }

        [JsonPropertyName("usage")]
        public GroqUsage? Usage { get; set; }
    }

    internal sealed class GroqChoice
    {
        [JsonPropertyName("message")]
        public GroqMessage? Message { get; set; }

        [JsonPropertyName("finish_reason")]
        public string? FinishReason { get; set; }
    }

    internal sealed class GroqUsage
    {
        [JsonPropertyName("prompt_tokens")]
        public int PromptTokens { get; set; }

        [JsonPropertyName("completion_tokens")]
        public int CompletionTokens { get; set; }

        [JsonPropertyName("total_tokens")]
        public int TotalTokens { get; set; }
    }
}
