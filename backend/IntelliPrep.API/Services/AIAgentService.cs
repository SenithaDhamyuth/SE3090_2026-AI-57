using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Production implementation of <see cref="IAIAgentService"/>.
    ///
    /// Architecture summary:
    ///   • Uses the existing named "GroqClient" HttpClient registered in Program.cs.
    ///   • All LLM calls use temperature 0 to maximise determinism.
    ///   • JSON validation is <b>deterministic</b>: every required field is checked;
    ///     hallucinated or missing fields cause the run to fail gracefully.
    ///   • All public methods are "never-throw" — exceptions are caught, logged,
    ///     and returned as <c>Success = false</c> to the controller.
    ///   • Agent 1b is <b>fully deterministic</b> (no LLM): reads the entire Questions
    ///     table, applies exponential-decay year weighting, and allocates exactly 50
    ///     questions via the largest-remainder (Hamilton) method.
    ///   • Lite-RAG: Agent 2 reads <c>SyllabusLimits</c> + <c>PastPaperAnalytics</c>
    ///     from the DB and injects them verbatim into the system prompt.
    ///   • Human-in-the-loop: <c>StudyPlan.IsApproved</c> is always <c>false</c> on creation.
    /// </summary>
    public sealed class AIAgentService : IAIAgentService
    {
        // ── Named HttpClient key — must match the name registered in Program.cs ──
        public const string HttpClientName = "GroqClient";

        // ── Exponential-decay base for year weighting.
        //    A value of 5 means the most recent year has 5× the weight of the oldest.
        //    Override in appsettings.json: "AI:YearDecayBase": 5.0
        private const double DefaultDecayBase = 5.0;

        // ── Target predicted paper size ────────────────────────────────────────
        private const int TargetPaperSize = 50;

        // ── OLS trend threshold — slope must exceed this fraction of the mean
        //    count before a topic is labelled "Rising" or "Falling". ─────────
        private const double TrendSlopeThresholdFraction = 0.05;

        // ── Shared JSON options (used for both serialising requests and
        //    deserialising LLM responses) ────────────────────────────────────────
        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented               = false
        };

        private readonly ApplicationDbContext           _db;
        private readonly IConfiguration                 _configuration;
        private readonly IHttpClientFactory             _httpClientFactory;
        private readonly ILogger<AIAgentService>        _logger;

        private readonly string[] _apiKeys;
        private readonly string _modelName;
        private readonly string _baseUrl;
        private readonly int _timeoutSeconds;

        public AIAgentService(
            ApplicationDbContext        db,
            IConfiguration              configuration,
            IHttpClientFactory          httpClientFactory,
            ILogger<AIAgentService>     logger)
        {
            _db                 = db;
            _configuration      = configuration;
            _httpClientFactory  = httpClientFactory;
            _logger             = logger;

            var groqSettings = _configuration.GetSection("GroqSettings").Get<GroqSettings>() ?? new GroqSettings();

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
            _baseUrl = !string.IsNullOrWhiteSpace(groqSettings.BaseUrl) ? groqSettings.BaseUrl : "https://api.groq.com/openai/v1/chat/completions";
            _timeoutSeconds = groqSettings.TimeoutSeconds > 0 ? groqSettings.TimeoutSeconds : 30;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 1 — Past Paper Analyst
        // ═══════════════════════════════════════════════════════════════════════

        /// <inheritdoc/>
        public async Task<AnalyzePastPapersResult> AnalyzePastPapersAsync(
            AnalyzePastPapersRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "[AIAgent:Agent1] AnalyzePastPapersAsync started — {Count} topics, year={Year}",
                request.Topics.Count, request.Year);

            if (request.Topics.Count == 0)
            {
                return Fail<AnalyzePastPapersResult>("No topics provided. Supply at least one topic string.");
            }

            string rawLlmOutput = string.Empty;

            try
            {
                // ── 1. Build the system prompt ─────────────────────────────────
                var systemPrompt = BuildAgent1SystemPrompt();
                var userMessage  = BuildAgent1UserMessage(request.Topics, request.Year);

                _logger.LogDebug("[AIAgent:Agent1] Calling Groq LLM...");

                // ── 2. Call LLM ────────────────────────────────────────────────
                rawLlmOutput = await CallGroqAsync(
                    systemPrompt,
                    userMessage,
                    cancellationToken);

                _logger.LogDebug("[AIAgent:Agent1] Raw LLM response ({Len} chars) received.", rawLlmOutput.Length);

                // ── 3. Strip markdown fences and validate JSON ─────────────────
                var cleanJson = StripMarkdownFences(rawLlmOutput);
                List<TopicProbabilityDto> probabilities;

                try
                {
                    probabilities = JsonSerializer.Deserialize<List<TopicProbabilityDto>>(cleanJson, _jsonOpts)
                        ?? throw new JsonException("Deserialised to null.");
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning(jsonEx,
                        "[AIAgent:Agent1] LLM returned malformed JSON. Raw output: {Raw}", rawLlmOutput);
                    return new AnalyzePastPapersResult
                    {
                        Success       = false,
                        Message       = $"LLM returned invalid JSON: {jsonEx.Message}",
                        RawLlmOutput  = rawLlmOutput
                    };
                }

                // ── 4. Deterministic structural validation ─────────────────────
                var invalid = probabilities
                    .Where(p => string.IsNullOrWhiteSpace(p.TopicName)
                             || p.ProbabilityPercentage < 0
                             || p.ProbabilityPercentage > 100)
                    .ToList();

                if (invalid.Count > 0)
                {
                    _logger.LogWarning(
                        "[AIAgent:Agent1] {N} records failed validation (empty name or out-of-range probability). Aborting persistence.",
                        invalid.Count);
                    return new AnalyzePastPapersResult
                    {
                        Success      = false,
                        Message      = $"{invalid.Count} LLM-generated records failed validation. No data was saved.",
                        RawLlmOutput = rawLlmOutput,
                        Probabilities = probabilities
                    };
                }

                // ── 5. Map & persist to PastPaperAnalytics table ───────────────
                var sourceQuestionCount = request.SourceQuestionCount
                    ?? await _db.Questions.CountAsync(cancellationToken);
                var entities = probabilities.Select(p => new PastPaperAnalytic
                {
                    TopicName             = p.TopicName.Trim(),
                    ProbabilityPercentage = Math.Round(p.ProbabilityPercentage, 2),
                    Year                  = request.Year,
                    SourceQuestionCount   = sourceQuestionCount,
                    GeneratedByAgent      = true,
                    CreatedAt             = DateTime.UtcNow
                }).ToList();

                var previousAnalytics = await _db.PastPaperAnalytics
                    .Where(a => a.GeneratedByAgent)
                    .ToListAsync(cancellationToken);
                _db.PastPaperAnalytics.RemoveRange(previousAnalytics);
                await _db.PastPaperAnalytics.AddRangeAsync(entities, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:Agent1] ✅ {N} PastPaperAnalytic rows saved to DB.", entities.Count);

                return new AnalyzePastPapersResult
                {
                    Success       = true,
                    Message       = $"Successfully analysed {entities.Count} topics and saved to database.",
                    RowsSaved     = entities.Count,
                    Probabilities = probabilities,
                    RawLlmOutput  = rawLlmOutput
                };
            }
            catch (TaskCanceledException tcEx) when (tcEx.InnerException is TimeoutException
                                                  || tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("[AIAgent:Agent1] LLM request timed out.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = "Groq API request timed out. Check network or increase TimeoutSeconds in appsettings.",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[AIAgent:Agent1] HTTP error calling Groq API.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = $"Groq API HTTP error: {httpEx.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:Agent1] Unexpected error.");
                return new AnalyzePastPapersResult
                {
                    Success = false, Message = $"Unexpected error: {ex.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 1b — Data Analyst  (deterministic — no LLM)
        // ═══════════════════════════════════════════════════════════════════════

        /// <inheritdoc/>
        public async Task<PredictTopicDistributionResult> PredictTopicDistributionAsync(
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "[AIAgent:DataAnalyst] PredictTopicDistributionAsync started — querying entire Questions table.");

            try
            {
                // ── 1. Read the ENTIRE Questions table (no limit) ──────────────
                //       Project only the two columns we need to keep memory lean.
                var rawRows = await _db.Questions
                    .AsNoTracking()
                    .Where(q => !string.IsNullOrEmpty(q.Lesson_Name) && q.Year > 0)
                    .Select(q => new { q.Lesson_Name, q.Year })
                    .ToListAsync(cancellationToken);

                if (rawRows.Count == 0)
                {
                    _logger.LogWarning("[AIAgent:DataAnalyst] Questions table is empty.");
                    return new PredictTopicDistributionResult
                    {
                        Success = false,
                        Message = "The Questions table contains no rows. Add historical questions before running the Data Analyst."
                    };
                }

                _logger.LogInformation(
                    "[AIAgent:DataAnalyst] {N} question rows loaded.", rawRows.Count);

                // ── 2. Group by (Lesson_Name, Year) to get raw counts ──────────
                //       Normalise topic names (trim + title-case first letter) to
                //       avoid duplicate keys caused by leading/trailing whitespace.
                var grouped = rawRows
                    .GroupBy(r => (
                        Topic: r.Lesson_Name.Trim(),
                        Year:  r.Year))
                    .Select(g => (
                        Topic: g.Key.Topic,
                        Year:  g.Key.Year,
                        Count: g.Count()))
                    .ToList();

                var allYears  = grouped.Select(g => g.Year).Distinct().OrderBy(y => y).ToList();
                var allTopics = grouped.Select(g => g.Topic).Distinct().OrderBy(t => t).ToList();

                int minYear = allYears.First();
                int maxYear = allYears.Last();

                // ── 3. Compute per-year exponential-decay weights ──────────────
                //
                //   weight(year) = exp( k × (year − minYear) )
                //   where k = ln(decayBase) / (maxYear − minYear)
                //
                //   This gives:
                //     weight(minYear) = exp(0) = 1.0
                //     weight(maxYear) = exp(ln(decayBase)) = decayBase
                //
                //   All intermediate years receive a smoothly interpolated value.
                //   When only one year exists (minYear == maxYear) all weights = 1.
                double decayBase = _configuration.GetValue<double>("AI:YearDecayBase", DefaultDecayBase);
                double k         = (maxYear > minYear)
                    ? Math.Log(decayBase) / (maxYear - minYear)
                    : 0.0;

                var yearWeights = allYears.ToDictionary(
                    y => y,
                    y => Math.Round(Math.Exp(k * (y - minYear)), 6));

                _logger.LogDebug(
                    "[AIAgent:DataAnalyst] Year weights (decayBase={Base}): {Weights}",
                    decayBase,
                    string.Join(", ", yearWeights.Select(kv => $"{kv.Key}→{kv.Value:F4}")));

                // ── 4. Build topic-level (year → count) lookup ─────────────────
                var topicYearCounts = grouped
                    .GroupBy(g => g.Topic)
                    .ToDictionary(
                        tg => tg.Key,
                        tg => tg.ToDictionary(r => r.Year, r => r.Count));

                // ── 5. Compute weighted scores and trend per topic ──────────────
                var topicScores = new List<(
                    string  Topic,
                    int     TotalRaw,
                    double  WeightedScore,
                    string  Trend,
                    List<YearTopicCount> Breakdown)>();

                foreach (var topic in allTopics)
                {
                    var ycMap      = topicYearCounts[topic];
                    int totalRaw   = ycMap.Values.Sum();
                    double wscore  = 0.0;

                    var breakdown = new List<YearTopicCount>();

                    foreach (var year in allYears)
                    {
                        int    rawCount = ycMap.TryGetValue(year, out var c) ? c : 0;
                        double weight   = yearWeights[year];
                        double contrib  = weight * rawCount;
                        wscore         += contrib;

                        breakdown.Add(new YearTopicCount
                        {
                            Year                 = year,
                            RawCount             = rawCount,
                            YearWeight           = Math.Round(weight, 4),
                            WeightedContribution = Math.Round(contrib, 4)
                        });
                    }

                    string trend = ComputeTrend(
                        allYears, ycMap, TrendSlopeThresholdFraction);

                    topicScores.Add((topic, totalRaw, wscore, trend, breakdown));
                }

                // ── 6. Normalise to probability percentages ────────────────────
                double totalWeightedScore = topicScores.Sum(t => t.WeightedScore);
                if (totalWeightedScore <= 0)
                {
                    return new PredictTopicDistributionResult
                    {
                        Success = false,
                        Message = "All topics produced a zero weighted score — check that the Year column is populated."
                    };
                }

                var withProb = topicScores.Select(t => (
                    t.Topic,
                    t.TotalRaw,
                    t.WeightedScore,
                    Prob: (t.WeightedScore / totalWeightedScore) * 100.0,
                    t.Trend,
                    t.Breakdown
                )).ToList();

                // ── 7. Allocate exactly TargetPaperSize questions ──────────────
                //       Hamilton / largest-remainder method:
                //         a) Give each topic floor(prob/100 * 50) questions.
                //         b) Distribute the remaining seats to topics with the
                //            largest fractional remainders.
                var allocations = AllocateQuestions(withProb, TargetPaperSize);

                // ── 8. Build result DTOs ───────────────────────────────────────
                var distribution = allocations
                    .OrderByDescending(a => a.Allocated)
                    .ThenByDescending(a => a.Prob)
                    .Select(a => new PredictedTopicDistribution
                    {
                        TopicName             = a.Topic,
                        TotalRawCount         = a.TotalRaw,
                        WeightedScore         = Math.Round(a.WeightedScore, 6),
                        WeightedProbabilityPct= Math.Round(a.Prob, 4),
                        AllocatedQuestions    = a.Allocated,
                        Trend                 = a.Trend,
                        YearBreakdown         = a.Breakdown
                    })
                    .ToList();

                int allocatedTotal = distribution.Sum(d => d.AllocatedQuestions);
                _logger.LogInformation(
                    "[AIAgent:DataAnalyst] ✅ Distribution computed — {Topics} topics, " +
                    "{Total} questions allocated (target={Target}), years={Min}–{Max}.",
                    distribution.Count, allocatedTotal, TargetPaperSize, minYear, maxYear);

                return new PredictTopicDistributionResult
                {
                    Success                = true,
                    Message                = $"Predicted distribution across {distribution.Count} topic(s) from " +
                                             $"{rawRows.Count} historical questions ({minYear}–{maxYear}). " +
                                             $"Allocated {allocatedTotal}/{TargetPaperSize} questions.",
                    TotalQuestionsAnalysed = rawRows.Count,
                    YearsAnalysed          = allYears,
                    DecayBase              = decayBase,
                    TargetPaperSize        = TargetPaperSize,
                    Distribution           = distribution
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:DataAnalyst] Unexpected error computing topic distribution.");
                return new PredictTopicDistributionResult
                {
                    Success = false,
                    Message = $"Unexpected error: {ex.Message}"
                };
            }
        }

        // ── Agent 1b private helpers ───────────────────────────────────────────

        /// <summary>
        /// Ordinary Least Squares linear regression over a topic's year-count series.
        /// Returns "Rising" if the slope is significantly positive,
        /// "Falling" if significantly negative, otherwise "Stable".
        /// </summary>
        private static string ComputeTrend(
            List<int>              years,
            Dictionary<int, int>   yearCounts,
            double                 thresholdFraction)
        {
            int n = years.Count;
            if (n < 2) return "Stable";

            // x = year index (0,1,2,...), y = rawCount for that year
            double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (int i = 0; i < n; i++)
            {
                double x = i;
                double y = yearCounts.TryGetValue(years[i], out var c) ? c : 0;
                sumX  += x;
                sumY  += y;
                sumXY += x * y;
                sumX2 += x * x;
            }

            double denom = n * sumX2 - sumX * sumX;
            if (Math.Abs(denom) < 1e-10) return "Stable";

            double slope  = (n * sumXY - sumX * sumY) / denom;
            double meanY  = sumY / n;
            double thresh = meanY > 0 ? Math.Abs(meanY * thresholdFraction) : 0.1;

            return slope > thresh ? "Rising" : slope < -thresh ? "Falling" : "Stable";
        }

        /// <summary>
        /// Hamilton / largest-remainder method for proportional allocation.
        /// Guarantees the allocated counts sum to exactly <paramref name="totalSeats"/>.
        /// </summary>
        private static List<(
            string Topic, int TotalRaw, double WeightedScore,
            double Prob, string Trend, List<YearTopicCount> Breakdown,
            int Allocated)>
        AllocateQuestions(
            List<(string Topic, int TotalRaw, double WeightedScore,
                  double Prob, string Trend, List<YearTopicCount> Breakdown)> items,
            int totalSeats)
        {
            // Step a — floor allocations
            var result = items.Select(item => (
                item.Topic,
                item.TotalRaw,
                item.WeightedScore,
                item.Prob,
                item.Trend,
                item.Breakdown,
                Exact:     (item.Prob / 100.0) * totalSeats,
                Floor:     (int)Math.Floor((item.Prob / 100.0) * totalSeats),
                Remainder: (item.Prob / 100.0) * totalSeats
                           - Math.Floor((item.Prob / 100.0) * totalSeats)
            )).ToList();

            int seated    = result.Sum(r => r.Floor);
            int remaining = totalSeats - seated;

            // Step b — give extra seats to topics with largest remainders
            var ranked = result
                .Select((r, idx) => (r, idx))
                .OrderByDescending(x => x.r.Remainder)
                .ThenByDescending(x => x.r.Prob)
                .ToList();

            var extras = new HashSet<int>(ranked.Take(remaining).Select(x => x.idx));

            return result
                .Select((r, idx) => (
                    r.Topic,
                    r.TotalRaw,
                    r.WeightedScore,
                    r.Prob,
                    r.Trend,
                    r.Breakdown,
                    Allocated: r.Floor + (extras.Contains(idx) ? 1 : 0)))
                .ToList();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 2 — Study Planner (Lite-RAG)
        // ═══════════════════════════════════════════════════════════════════════

        public async Task<GenerateStudyPlanResult> GenerateStudyPlanAsync(
            GenerateStudyPlanRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "[AIAgent:Agent2] GenerateStudyPlanAsync started");

            string rawLlmOutput = string.Empty;

            try
            {
                // ── 1. Lite-RAG: Load context from DB ──────────────────────────
                _logger.LogDebug("[AIAgent:Agent2] Loading SyllabusLimits and dynamic dataset probabilities for RAG context...");

                var syllabusLimits = await _db.SyllabusLimits
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                // Calculate historical probabilities dynamically from Questions table
                var questionCounts = await _db.Questions
                    .AsNoTracking()
                    .GroupBy(q => q.Lesson_Name)
                    .Select(g => new { TopicName = g.Key, Count = g.Count() })
                    .ToListAsync(cancellationToken);

                int totalQuestions = questionCounts.Sum(x => x.Count);

                List<TopicProbabilityDto> topicProbabilities;
                string? noDataFallback = null;

                if (totalQuestions == 0)
                {
                    topicProbabilities = [];
                    noDataFallback = "No historical data available yet. Distribute the remaining syllabus topics evenly across the study plan.";
                    _logger.LogWarning("[AIAgent:Agent2] Questions table is empty — falling back to even distribution.");
                }
                else
                {
                    topicProbabilities = questionCounts
                        .Select(x => new TopicProbabilityDto
                        {
                            TopicName = x.TopicName,
                            ProbabilityPercentage = Math.Round((decimal)x.Count / totalQuestions * 100, 2)
                        })
                        .OrderByDescending(x => x.ProbabilityPercentage)
                        .ToList();
                }

                _logger.LogInformation(
                    "[AIAgent:Agent2] RAG context: {SL} syllabus limits, {PP} dynamic topic probabilities loaded.",
                    syllabusLimits.Count, topicProbabilities.Count);

                // ── 2. Build the massive RAG-injected system prompt ────────────
                var systemPrompt = BuildAgent2SystemPrompt(
                    syllabusLimits, topicProbabilities,
                    request.ExcludedTopics, noDataFallback);
                var userMessage  = BuildAgent2UserMessage();

                _logger.LogDebug("[AIAgent:Agent2] System prompt built ({Len} chars). Calling Groq LLM...", systemPrompt.Length);

                // ── 3. Retry the LLM call up to 3 times if the response is empty ─
                rawLlmOutput = string.Empty;
                for (var attempt = 1; attempt <= 3; attempt++)
                {
                    rawLlmOutput = await CallGroqAsync(
                        systemPrompt,
                        userMessage,
                        cancellationToken,
                        maxTokens: 4096);

                    if (!string.IsNullOrWhiteSpace(rawLlmOutput))
                    {
                        _logger.LogDebug("[AIAgent:Agent2] Raw LLM response ({Len} chars) received on attempt {Attempt}.", rawLlmOutput.Length, attempt);
                        break;
                    }

                    _logger.LogWarning("[AIAgent:Agent2] Attempt {Attempt}/3 returned an empty or whitespace-only response. Retrying...", attempt);
                }

                if (string.IsNullOrWhiteSpace(rawLlmOutput))
                {
                    throw new InvalidOperationException(
                        "The LLM returned an empty or whitespace-only response after 3 attempts. " +
                        "This may indicate a content-filter rejection or a zero-token reply from the model.");
                }

                // ── 4. Bulletproof JSON extraction ──────────────────────────────
                // Ignore any introductory text and capture everything from the first '{' or '[' to the last '}' or ']'.
                var jsonArrayMatch = System.Text.RegularExpressions.Regex.Match(rawLlmOutput, @"(?s)(\{.*\}|\[.*\])");
                var cleanJson = string.Empty;

                if (jsonArrayMatch.Success)
                {
                    cleanJson = jsonArrayMatch.Value.Trim();
                }
                else if (rawLlmOutput.Contains("{") || rawLlmOutput.Contains("["))
                {
                    cleanJson = StripMarkdownFences(rawLlmOutput);
                }
                else
                {
                    cleanJson = StripMarkdownFences(rawLlmOutput);
                }

                List<StudyDayDto>? planDays = null;

                try
                {
                    using var doc = JsonDocument.Parse(cleanJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        // Ideal: direct JSON array
                        planDays = JsonSerializer.Deserialize<List<StudyDayDto>>(cleanJson, _jsonOpts);
                    }
                    else if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    {
                        // Model wrapped in an object — try common key names
                        foreach (var key in new[] { "plan", "days", "studyPlan", "schedule", "study_plan" })
                        {
                            if (doc.RootElement.TryGetProperty(key, out var prop))
                            {
                                planDays = JsonSerializer.Deserialize<List<StudyDayDto>>(prop.GetRawText(), _jsonOpts);
                                break;
                            }
                        }
                    }

                    if (planDays == null) throw new JsonException("Could not extract a study day array from the LLM response.");
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning(jsonEx,
                        "[AIAgent:Agent2] LLM returned malformed JSON. Raw output: {Raw}", rawLlmOutput);
                    return new GenerateStudyPlanResult
                    {
                        Success = false,
                        Message = $"LLM returned invalid JSON: {jsonEx.Message}",
                        RawLlmOutput = rawLlmOutput
                    };
                }

                if (planDays.Count != 7 || !planDays.Select(day => day.Day).Order().SequenceEqual(Enumerable.Range(1, 7)))
                {
                    return new GenerateStudyPlanResult
                    {
                        Success = false,
                        Message = "The generated plan must contain exactly one entry for each day from 1 through 7.",
                        PlanDays = planDays,
                        RawLlmOutput = rawLlmOutput
                    };
                }

                // ── 6. Deterministic field-level validation ────────────────────
                var validPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "High", "Medium", "Low" };
                var invalidDays = planDays
                    .Where(d => d.Day <= 0
                             || string.IsNullOrWhiteSpace(d.Date)
                             || string.IsNullOrWhiteSpace(d.Topic)
                             || !validPriorities.Contains(d.Priority))
                    .ToList();

                if (invalidDays.Count > 0)
                {
                    _logger.LogWarning(
                        "[AIAgent:Agent2] {N} study day entries failed validation. Aborting persistence.",
                        invalidDays.Count);
                    return new GenerateStudyPlanResult
                    {
                        Success      = false,
                        Message      = $"{invalidDays.Count} study days failed validation. No plan was saved.",
                        PlanDays     = planDays,
                        RawLlmOutput = rawLlmOutput
                    };
                }

                // ── 7. Persist StudyPlan with IsApproved = false (HITL) ────────
                var studyPlan = new StudyPlan
                {
                    StudentId      = 0, // 0 indicates a general template
                    PlanDetailsJson = JsonSerializer.Serialize(planDays, _jsonOpts),
                    IsApproved     = false,   // ← HUMAN-IN-THE-LOOP: admin must approve
                    CreatedAt      = DateTime.UtcNow
                };

                await _db.StudyPlans.AddAsync(studyPlan, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:Agent2] ✅ StudyPlan (Id={Id}) saved with IsApproved=false. Awaiting admin approval.",
                    studyPlan.Id);

                return new GenerateStudyPlanResult
                {
                    Success      = true,
                    Message      = $"Study plan generated with {planDays.Count} day(s). Awaiting admin approval (IsApproved=false).",
                    StudyPlanId  = studyPlan.Id,
                    IsApproved   = false,
                    PlanDays     = planDays,
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (TaskCanceledException tcEx) when (tcEx.InnerException is TimeoutException
                                                  || tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("[AIAgent:Agent2] LLM request timed out.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = "Groq API request timed out.",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[AIAgent:Agent2] HTTP error calling Groq API.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = $"Groq API HTTP error: {httpEx.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:Agent2] Unexpected error.");
                return new GenerateStudyPlanResult
                {
                    Success = false, Message = $"Unexpected error: {ex.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Agent 3 — Predicted Paper Generator  (Agents 2 + 3 internally chained)
        // ═══════════════════════════════════════════════════════════════════════

        /// <inheritdoc/>
        public async Task<GeneratePaperResult> GeneratePredictedPaperAsync(
            GeneratePaperRequest request,
            CancellationToken cancellationToken = default)
        {
            int researchCount = Math.Clamp(request.ResearchTopicCount, 1, 10);

            _logger.LogInformation(
                "[AIAgent:PaperGen] GeneratePredictedPaperAsync started — " +
                "researchTopicCount={N}, upToYear={Year}.",
                researchCount, request.UpToYear);

            string rawLlmOutput = string.Empty;

            try
            {
                // ── Step 1: Run Agent 1b (Data Analyst) deterministically ──────
                _logger.LogInformation("[AIAgent:PaperGen] Step 1 — Running Data Analyst (Agent 1b)...");

                var distResult = await PredictTopicDistributionAsync(cancellationToken);
                if (!distResult.Success)
                {
                    return new GeneratePaperResult
                    {
                        Success = false,
                        Message = $"Agent 1b (Data Analyst) failed: {distResult.Message}"
                    };
                }

                var distribution = distResult.Distribution;
                _logger.LogInformation(
                    "[AIAgent:PaperGen] Step 1 complete — {N} topics, {Q} questions allocated.",
                    distribution.Count, distribution.Sum(d => d.AllocatedQuestions));

                // ── Step 2: Run Agent 2 (Web Researcher) via Groq LLM ─────────
                _logger.LogInformation(
                    "[AIAgent:PaperGen] Step 2 — Running Web Researcher (Agent 2) for top {N} topics...",
                    researchCount);

                var topTopics = distribution
                    .OrderByDescending(d => d.AllocatedQuestions)
                    .ThenByDescending(d => d.WeightedProbabilityPct)
                    .Take(researchCount)
                    .Select(d => d.TopicName)
                    .ToList();

                var researchContext = await GatherResearchContextAsync(
                    topTopics, cancellationToken);

                _logger.LogInformation(
                    "[AIAgent:PaperGen] Step 2 complete — research context gathered for {N} topic(s).",
                    researchContext.Count);

                // ── Step 3: Load Syllabus Limits (RAG) ────────────────────────
                _logger.LogDebug("[AIAgent:PaperGen] Step 3 — Loading SyllabusLimits for RAG context...");
                var syllabusLimits = await _db.SyllabusLimits
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                // ── Step 4: Build Agent 3 prompt and call Groq LLM ───────────
                _logger.LogInformation("[AIAgent:PaperGen] Step 4 — Building Agent 3 prompt and calling Groq LLM...");

                var systemPrompt = BuildAgent3SystemPrompt(
                    distribution,
                    researchContext,
                    syllabusLimits,
                    request.ManualTopicRequests);
                var userMessage = BuildAgent3UserMessage(request.ManualTopicRequests, researchContext);

                _logger.LogDebug(
                    "[AIAgent:PaperGen] Agent 3 system prompt is {Len} chars. Calling Groq (maxTokens=5000)...",
                    systemPrompt.Length);

                // Keep the payload safely under the Groq 8000 TPM budget while still generating a full paper.
                rawLlmOutput = await CallGroqAsync(
                    systemPrompt,
                    userMessage,
                    cancellationToken,
                    maxTokens: 5000);

                if (string.IsNullOrWhiteSpace(rawLlmOutput))
                {
                    throw new InvalidOperationException(
                        "Agent 3 (Generator): The LLM returned an empty response. " +
                        "This may indicate a content-filter rejection or token budget exhaustion.");
                }

                _logger.LogDebug(
                    "[AIAgent:PaperGen] Raw LLM response received ({Len} chars).",
                    rawLlmOutput.Length);

                // ── Step 5: Strip markdown fences ────────────────────────────
                var cleanJson = StripMarkdownFences(rawLlmOutput);

                // ── Step 6: Deserialise ───────────────────────────────────────
                List<GeneratedMcqDto> mcqs;
                try
                {
                    mcqs = JsonSerializer.Deserialize<List<GeneratedMcqDto>>(cleanJson, _jsonOpts)
                        ?? throw new JsonException("Deserialised to null.");
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning(jsonEx,
                        "[AIAgent:PaperGen] LLM returned malformed JSON. Raw: {Raw}", rawLlmOutput);
                    return new GeneratePaperResult
                    {
                        Success         = false,
                        Message         = $"Agent 3 returned invalid JSON: {jsonEx.Message}",
                        RawLlmOutput    = rawLlmOutput,
                        TopicDistribution = distribution,
                        ResearchContext = researchContext
                    };
                }

                // ── Step 7: Deterministic structural validation ──────────────
                var (validationOk, validationError) = ValidateMcqOutput(mcqs);
                if (!validationOk)
                {
                    _logger.LogWarning(
                        "[AIAgent:PaperGen] MCQ validation failed: {Err}", validationError);
                    return new GeneratePaperResult
                    {
                        Success           = false,
                        Message           = $"Generated paper failed validation: {validationError}",
                        RawLlmOutput      = rawLlmOutput,
                        TopicDistribution = distribution,
                        ResearchContext   = researchContext,
                        Questions         = mcqs
                    };
                }

                _logger.LogInformation(
                    "[AIAgent:PaperGen] ✅ {N} MCQs generated and validated successfully.", mcqs.Count);

                return new GeneratePaperResult
                {
                    Success           = true,
                    Message           = $"Predicted paper generated with {mcqs.Count} validated MCQs " +
                                        $"across {distribution.Count} topics.",
                    RawLlmOutput      = rawLlmOutput,
                    TopicDistribution = distribution,
                    ResearchContext   = researchContext,
                    Questions         = mcqs
                };
            }
            catch (TaskCanceledException tcEx) when (
                tcEx.InnerException is TimeoutException ||
                tcEx.CancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("[AIAgent:PaperGen] LLM request timed out.");
                return new GeneratePaperResult
                {
                    Success      = false,
                    Message      = "Groq API request timed out during paper generation.",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[AIAgent:PaperGen] HTTP error calling Groq API.");
                return new GeneratePaperResult
                {
                    Success      = false,
                    Message      = $"Groq API HTTP error: {httpEx.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AIAgent:PaperGen] Unexpected error.");
                return new GeneratePaperResult
                {
                    Success      = false,
                    Message      = $"Unexpected error: {ex.Message}",
                    RawLlmOutput = rawLlmOutput
                };
            }
        }

        // ── Agent 2 (Researcher) — private ─────────────────────────────────────

        /// <summary>
        /// Agent 2 — Web Researcher.
        /// Calls the Groq LLM instructing it to act as a tech-news researcher
        /// and return structured JSON with recent real-world events relevant to
        /// each of the supplied A/L ICT topics.  Results are used by Agent 3
        /// as scenario seeds to make MCQ questions contextually grounded.
        ///
        /// Falls back gracefully: if the LLM returns malformed JSON or an error,
        /// returns an empty list so the pipeline can still proceed.
        /// </summary>
        private async Task<List<TopicResearchContext>> GatherResearchContextAsync(
            List<string> topics,
            CancellationToken cancellationToken)
        {
            try
            {
                var systemPrompt = BuildAgent2ResearcherSystemPrompt();
                var userMessage  = BuildAgent2ResearcherUserMessage(topics);

                _logger.LogDebug("[AIAgent:Researcher] Calling Groq LLM for research context...");

                var raw = await CallGroqAsync(
                    systemPrompt,
                    userMessage,
                    cancellationToken,
                    maxTokens: 2048);

                if (string.IsNullOrWhiteSpace(raw))
                {
                    _logger.LogWarning("[AIAgent:Researcher] LLM returned empty response — skipping research.");
                    return BuildFallbackResearchContext(topics);
                }

                var jsonArrayMatch = System.Text.RegularExpressions.Regex.Match(raw, @"\[[\s\S]*\]");
                var clean = jsonArrayMatch.Success ? jsonArrayMatch.Value.Trim() : StripMarkdownFences(raw);

                var result = JsonSerializer.Deserialize<List<TopicResearchContext>>(clean, _jsonOpts);
                if (result is null || result.Count == 0)
                {
                    _logger.LogWarning("[AIAgent:Researcher] Deserialised to null/empty — using fallback.");
                    return BuildFallbackResearchContext(topics);
                }

                _logger.LogDebug(
                    "[AIAgent:Researcher] Research context received for {N} topic(s).", result.Count);
                return result;
            }
            catch (Exception ex)
            {
                // Research failures are non-fatal — paper generation continues without context
                _logger.LogWarning(ex,
                    "[AIAgent:Researcher] Research step failed ({Msg}). Falling back to minimal context.",
                    ex.Message);
                return BuildFallbackResearchContext(topics);
            }
        }

        /// <summary>
        /// Produces a minimal fallback research context when the LLM call fails,
        /// so Agent 3 still has some scenario seeds to work with.
        /// </summary>
        private static List<TopicResearchContext> BuildFallbackResearchContext(List<string> topics)
            => topics.Select(t => new TopicResearchContext
            {
                TopicName    = t,
                RecentEvents = $"Growing adoption of {t} technologies in Sri Lanka. Students should understand practical applications of {t} in the Sri Lankan tech industry.",
                GlobalTrends = $"Increasing global focus on {t} and its broader impact on modern computing."
            }).ToList();

        /// <summary>
        /// Deterministically validates the MCQ list returned by Agent 3.
        /// Returns (true, null) on success or (false, errorMessage) on the first
        /// violation found.
        /// </summary>
        private static (bool Ok, string? Error) ValidateMcqOutput(List<GeneratedMcqDto> mcqs)
        {
            if (mcqs.Count != TargetPaperSize)
                return (false, $"Expected {TargetPaperSize} questions but received {mcqs.Count}.");

            for (int i = 0; i < mcqs.Count; i++)
            {
                var q = mcqs[i];

                if (q.QuestionNo != i + 1)
                    return (false, $"Question at index {i} has questionNo={q.QuestionNo}, expected {i + 1}.");

                if (string.IsNullOrWhiteSpace(q.Topic))
                    return (false, $"Question {q.QuestionNo}: topic is empty.");

                if (string.IsNullOrWhiteSpace(q.QuestionText))
                    return (false, $"Question {q.QuestionNo}: questionText is empty.");

                if (q.Options.Count != 4)
                    return (false, $"Question {q.QuestionNo}: expected 4 options but got {q.Options.Count}.");

                if (q.Options.Any(string.IsNullOrWhiteSpace))
                    return (false, $"Question {q.QuestionNo}: one or more options are empty.");

                if (q.CorrectOption < 1 || q.CorrectOption > 4)
                    return (false, $"Question {q.QuestionNo}: correctOption={q.CorrectOption} is out of range [1,4].");

                if (string.IsNullOrWhiteSpace(q.Explanation))
                    return (false, $"Question {q.QuestionNo}: explanation is empty.");
            }

            return (true, null);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Prompt Builders
        // ═══════════════════════════════════════════════════════════════════════

        private static string BuildAgent1SystemPrompt() =>
            """
            You are an expert A/L ICT Data Analyst specialising in Sri Lanka national examination past papers.
            Your sole task is to analyse the provided list of topics and compute how frequently each topic
            appeared across past A/L ICT examinations, then translate that into an estimated probability
            percentage (0–100) that each topic will appear in the next exam.

            STRICT OUTPUT RULES — violating any rule makes your response useless:
            1. Output ONLY a valid JSON array. No markdown. No code fences (```). No explanations. No preamble.
            2. Every element MUST exactly match this shape:
               {"topicName": "<string>", "probabilityPercentage": <number 0-100>}
            3. ProbabilityPercentage values across all topics MUST sum to approximately 100.
            4. TopicName must be a non-empty string exactly as provided in the input list.
            5. Do NOT add any extra fields. Do NOT wrap the array in an object.

            Example of valid output (for 2 topics):
            [{"topicName":"Networking","probabilityPercentage":30},{"topicName":"Logic Gates","probabilityPercentage":25}]
            """;

        private static string BuildAgent1UserMessage(List<string> topics, int year)
        {
            var sb = new StringBuilder();
            sb.AppendLine(year > 0
                ? $"Analyse the following A/L ICT topics from the {year} past paper:"
                : "Analyse the following A/L ICT topics from aggregated past papers:");
            sb.AppendLine();
            foreach (var topic in topics)
                sb.AppendLine($"- {topic}");
            sb.AppendLine();
            sb.AppendLine("Return ONLY the JSON array as specified. No other text.");
            return sb.ToString();
        }

        private static string BuildAgent2SystemPrompt(
            List<SyllabusLimit> syllabusLimits,
            List<TopicProbabilityDto> analytics,
            List<string> excludedTopics,
            string? noDataFallback = null)
        {
            var sb = new StringBuilder();
            var today = DateTime.UtcNow.Date;

            // ═══════════════════════════════════════════════════════════
            // SECTION 0 — HARD EXCLUSIONS (read first — highest priority)
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 0 — ⚠️  CRITICAL EXCLUSION LIST — READ THIS FIRST");
            sb.AppendLine("════════════════════════════════════════════════════════════════");

            if (excludedTopics.Count == 0)
            {
                sb.AppendLine("  No topics have been excluded by the student.");
                sb.AppendLine("  You may include any syllabus-approved topic in the 7-day plan.");
            }
            else
            {
                sb.AppendLine("CRITICAL: The following topics have been marked as ALREADY STUDIED or EXCLUDED by the student.");
                sb.AppendLine("You MUST NOT include ANY of these topics — not as a main topic, not as a sub-topic, not even a passing mention:");
                sb.AppendLine();
                foreach (var t in excludedTopics)
                    sb.AppendLine($"  ❌  EXCLUDED: {t}");
                sb.AppendLine();
                sb.AppendLine("Violating this constraint renders the entire plan useless. Ignore excluded topics completely.");
                sb.AppendLine("If only 1 or 2 non-excluded topics remain, DO NOT re-introduce excluded topics to fill days.");
                sb.AppendLine("Instead, break the remaining topic(s) into detailed sub-topics and spread them across all 7 days.");
            }
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 1 — ROLE AND CORE RULES
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 1 — ROLE & CORE RULES");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("You are an expert A/L ICT tutor generating a personalised 7-Day Study Master Plan.");
            sb.AppendLine("You MUST generate EXACTLY 7 days of study content (Day 1 to Day 7). No more, no less.");
            sb.AppendLine("Generate a fixed 7-day study plan; do not schedule beyond Day 7.");
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 2 — 7-DAY DISTRIBUTION RULES
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 2 — MANDATORY 7-DAY DISTRIBUTION LOGIC");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("⚠️  CRITICAL: You MUST produce a plan covering ALL 7 days, one entry per day.");
            sb.AppendLine("Follow these rules to distribute content across exactly 7 days:");
            sb.AppendLine();
            sb.AppendLine("  Rule A — Many non-excluded topics available (4+ topics):");
            sb.AppendLine("    Assign one topic per day, prioritising topics by their past-paper weight (highest first).");
            sb.AppendLine("    Revisit the most critical topics on days 6 and 7 as revision sessions.");
            sb.AppendLine();
            sb.AppendLine("  Rule B — Few non-excluded topics available (2-3 topics):");
            sb.AppendLine("    Break each topic into its specific sub-topics and distribute them:");
            sb.AppendLine("    Example: 'Networking' can be split into 'OSI Model' (Day 1), 'IP Addressing' (Day 2),");
            sb.AppendLine("    'TCP/UDP Protocols' (Day 3), 'Routing' (Day 4), 'Network Security' (Day 5),");
            sb.AppendLine("    'Wireless Networking' (Day 6), 'Revision & Practice' (Day 7).");
            sb.AppendLine("    The 'topic' field in each day's JSON MUST be the parent topic name.");
            sb.AppendLine("    The 'subtopics' field MUST contain the specific sub-topic for that day.");
            sb.AppendLine();
            sb.AppendLine("  Rule C — Only 1 non-excluded topic available:");
            sb.AppendLine("    Split that single topic into 7 progressive sub-units, going from foundational to advanced:");
            sb.AppendLine("    Day 1: Core concepts. Day 2: Terminology. Day 3: Applications.");
            sb.AppendLine("    Day 4: Past-paper patterns. Day 5: Edge cases. Day 6: Practice problems. Day 7: Full revision.");
            sb.AppendLine();
            sb.AppendLine("  ⛔  DO NOT assign the same exact sub-topic to more than one day.");
            sb.AppendLine("  ⛔  DO NOT leave any day empty or repeat day numbers.");
            sb.AppendLine("  ⛔  DO NOT add content from excluded topics to fill gaps.");
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 3 — PAST PAPER PRIORITY WEIGHTS (RAG context)
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 3 — PAST PAPER PRIORITY WEIGHTS");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("Use these weights to determine which NON-EXCLUDED topics are most important:");
            sb.AppendLine();

            if (!string.IsNullOrEmpty(noDataFallback))
            {
                sb.AppendLine($"  {noDataFallback}");
            }
            else if (analytics.Count == 0)
            {
                sb.AppendLine("  (No past-paper data found — distribute the non-excluded topics evenly.)");
            }
            else
            {
                foreach (var a in analytics)
                {
                    // Only show non-excluded analytics to avoid the LLM seeing excluded topics at all
                    if (excludedTopics.Any(e => string.Equals(e, a.TopicName, StringComparison.OrdinalIgnoreCase)))
                        continue;
                    sb.AppendLine($"  {a.TopicName}: {a.ProbabilityPercentage:F2}% probability");
                }
            }
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 4 — SYLLABUS BOUNDARIES (RAG)
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 4 — SYLLABUS BOUNDARIES (MANDATORY)");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("Restrict ALL sub-topics to the approved scope below. Never include EXCLUDED sub-topics:");
            sb.AppendLine();

            if (syllabusLimits.Count == 0)
            {
                sb.AppendLine("  (No specific limits found — use the standard A/L ICT syllabus.)");
            }
            else
            {
                foreach (var limit in syllabusLimits)
                {
                    sb.AppendLine($"  ▶ Topic: {limit.TopicName}");
                    sb.AppendLine($"    Allowed   : {limit.AllowedScope}");
                    if (!string.IsNullOrWhiteSpace(limit.ExcludedKeywords))
                        sb.AppendLine($"    EXCLUDED  : {limit.ExcludedKeywords} — DO NOT include these under any circumstances.");
                }
            }
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 5 — SCHEDULE CONSTRAINTS
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 5 — SCHEDULE CONSTRAINTS");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine($"  Start date      : {today:yyyy-MM-dd} (today, Day 1)");
            sb.AppendLine("  Plan length     : EXACTLY 7 days (Day 1 through Day 7 only)");
            sb.AppendLine("  Priority values : MUST be exactly one of: High | Medium | Low");
            sb.AppendLine("    • High   = topic has ≥ 15% past-paper probability");
            sb.AppendLine("    • Medium = topic has 5–14% past-paper probability");
            sb.AppendLine("    • Low    = topic has < 5% past-paper probability or is a revision day");
            sb.AppendLine();

            // ═══════════════════════════════════════════════════════════
            // SECTION 6 — STRICT JSON OUTPUT CONTRACT
            // ═══════════════════════════════════════════════════════════
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 6 — STRICT JSON OUTPUT CONTRACT");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("Output ONLY a single valid JSON array. No markdown, no code fences, no prose, no preamble.");
            sb.AppendLine("Start your response IMMEDIATELY with the opening bracket [.");
            sb.AppendLine();
            sb.AppendLine("The array MUST contain EXACTLY 7 objects — one per study day. Each object must be:");
            sb.AppendLine(@"  {""day"": <int 1-7>, ""date"": ""<YYYY-MM-DD>"", ""topic"": ""<string>"", ""subtopics"": ""<comma-separated string>"", ""priority"": ""High|Medium|Low""}");
            sb.AppendLine();
            sb.AppendLine("Hard rules:");
            sb.AppendLine("  1. The array MUST have EXACTLY 7 elements. Fewer or more = failure.");
            sb.AppendLine("  2. 'day' values MUST run sequentially: 1, 2, 3, 4, 5, 6, 7 (no gaps, no repeats).");
            sb.AppendLine("  3. 'date' MUST be the actual calendar date for that day (Day 1 = today, Day 2 = tomorrow, etc.).");
            sb.AppendLine("  4. 'topic' MUST NOT be any topic from Section 0's exclusion list.");
            sb.AppendLine("  5. 'subtopics' MUST be a non-empty string; each day must cover distinct sub-material.");
            sb.AppendLine("  6. 'priority' MUST be exactly 'High', 'Medium', or 'Low' — nothing else.");
            sb.AppendLine("  7. Do NOT wrap the array in an object. Do NOT add extra fields.");

            return sb.ToString();
        }

        private static string BuildAgent2UserMessage() =>
            $"Generate a 1-Week General Master Plan for the student. " +
            $"Follow ALL rules from the system prompt — especially the EXCLUSION LIST in Section 0 and the 7-day distribution rules in Section 2. " +
            $"The plan MUST cover EXACTLY 7 days (Day 1 to Day 7). " +
            $"If only 1-2 non-excluded topics are available, break them into sub-topics spread across all 7 days — do NOT cram everything into Day 1. " +
            $"Return ONLY the JSON array containing exactly 7 objects. Start immediately with [. No other text.";

        // ── Agent 2 (Researcher) prompt builders ───────────────────────────────

        private static string BuildAgent2ResearcherSystemPrompt() =>
            """
            You are an AI Tech News Researcher specialising in ICT topics relevant to Sri Lanka.
            Your task is to identify recent (2023–2025) real-world events, tech developments, or
            news stories for each A/L ICT topic provided. These events will be used as practical
            scenario seeds to make exam questions contextually grounded and current.

            Focus on events relevant to Sri Lanka where possible, but include global events if
            Sri Lankan ones are scarce (e.g., global cybersecurity incidents, AI milestones, IoT
            deployments in South Asia, networking infrastructure upgrades).

            STRICT OUTPUT RULES:
            1. Output ONLY a valid JSON array. No markdown. No code fences. No preamble.
            2. You must return ONLY a valid JSON array of objects. Each object must have exactly these keys: 'topicName', 'recentEvents', and 'globalTrends'.
            3. "recentEvents" = string describing 2-3 recent tech events relevant to the topic.
            4. "globalTrends" = string describing broader global movements related to this topic.
            5. Do NOT add extra fields. Do NOT wrap the array in an object.

            Example (1 topic):
            [{"topicName":"Networking","recentEvents":"Sri Lanka Telecom completes fibre rollout to 500 rural schools, 2024. Local ISPs upgrade to IPv6.","globalTrends":"Global shift towards software-defined networking and zero-trust architectures."}]
            """;

        private static string BuildAgent2ResearcherUserMessage(List<string> topics)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Research recent real-world tech events for each of the following A/L ICT topics:");
            sb.AppendLine();
            foreach (var t in topics)
                sb.AppendLine($"- {t}");
            sb.AppendLine();
            sb.AppendLine("Return ONLY the JSON array as specified. No other text.");
            return sb.ToString();
        }

        // ── Agent 3 (Generator) prompt builders ───────────────────────────────

        private static string BuildAgent3SystemPrompt(
            List<PredictedTopicDistribution>  distribution,
            List<TopicResearchContext>         researchContext,
            List<SyllabusLimit>               syllabusLimits,
            List<ManualTopicRequest>          manualTopicRequests)
        {
            var sb = new StringBuilder();

            sb.AppendLine(
                "You are an expert Sri Lanka A/L ICT Examination Paper Generator. " +
                "Your task is to generate a BRAND NEW predicted A/L ICT MCQ paper " +
                "containing EXACTLY 50 questions. The paper must mirror the statistical " +
                "pattern of historical A/L ICT papers while incorporating current real-world scenarios.");
            sb.AppendLine();

            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 0 — NON-NEGOTIABLE USER TOPIC REQUIREMENTS");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("CRITICAL RULE: You MUST strictly obey the exact topic distribution and question count provided by the user.");
            sb.AppendLine("If the user requests exactly 4 questions on 'IP Addresses', you MUST generate EXACTLY 4 questions on 'IP Addresses'.");
            sb.AppendLine("Do NOT override the user's requested topics with your own preferred topics or historical weights.");
            sb.AppendLine("Do NOT hallucinate lessons that were not requested.");
            sb.AppendLine("These user topic requests are NON-NEGOTIABLE and take priority over any historical distribution or research context.");
            if (manualTopicRequests.Count == 0)
            {
                sb.AppendLine("  (No manual topic requests were provided by the user. Use the historical distribution only.)");
            }
            else
            {
                foreach (var req in manualTopicRequests)
                {
                    sb.AppendLine($"  - EXACTLY {req.QuestionCount} question(s) on '{req.TopicName}'.");
                }
            }
            sb.AppendLine();

            // ── Section 1: Exact topic distribution (from Agent 1b) ────────────
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 1 — MANDATORY TOPIC DISTRIBUTION (Agent 1 Data Output)");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("You MUST generate EXACTLY the number of questions shown for each topic.");
            sb.AppendLine("DO NOT deviate by even one question. This distribution was calculated");
            sb.AppendLine("by a weighted statistical engine from all historical past papers:");
            sb.AppendLine();
            sb.AppendLine($"  {"Topic",-45} {"Allocated Qs",12}  {"Probability",12}  Trend");
            sb.AppendLine($"  {"─────────────────────────────────────────────",45} {"────────────",12}  {"────────────",12}  ─────");

            int totalAllocated = distribution.Sum(d => d.AllocatedQuestions);
            foreach (var d in distribution.OrderByDescending(x => x.AllocatedQuestions))
            {
                sb.AppendLine(
                    $"  {d.TopicName,-45} {d.AllocatedQuestions,12}  {d.WeightedProbabilityPct,11:F2}%  {d.Trend}");
            }

            sb.AppendLine();
            sb.AppendLine($"  TOTAL: {totalAllocated} questions (must equal 50).");
            sb.AppendLine();

            // ── Section 2: Research context (from Agent 2) ─────────────────────
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 2 — REAL-WORLD SCENARIO SEEDS (Agent 2 Research Output)");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("Use the following current events as practical scenario contexts for");
            sb.AppendLine("MCQs on the relevant topics. Questions should feel grounded in");
            sb.AppendLine("real Sri Lankan and global ICT developments:");
            sb.AppendLine();

            if (researchContext.Count == 0)
            {
                sb.AppendLine("  (No specific research context — use general A/L ICT scenarios.)");
            }
            else
            {
                foreach (var ctx in researchContext)
                {
                    sb.AppendLine($"  ▶ Topic: {ctx.TopicName}");
                    sb.AppendLine($"    Recent Events: {ctx.RecentEvents}");
                    sb.AppendLine($"    Global Trends: {ctx.GlobalTrends}");
                    sb.AppendLine();
                }
            }

            // ── Section 3: Syllabus boundaries (RAG) ──────────────────────────
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 3 — SYLLABUS BOUNDARIES (MANDATORY CONSTRAINTS)");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("ALL questions MUST stay strictly within the following approved scope.");
            sb.AppendLine("NEVER include sub-topics listed as EXCLUDED:");
            sb.AppendLine();

            if (syllabusLimits.Count == 0)
            {
                sb.AppendLine("  (No specific syllabus limits found — use the standard A/L ICT syllabus.)");
            }
            else
            {
                foreach (var lim in syllabusLimits)
                {
                    sb.AppendLine($"  ▶ {lim.TopicName}");
                    sb.AppendLine($"    Allowed : {lim.AllowedScope}");
                    if (!string.IsNullOrWhiteSpace(lim.ExcludedKeywords))
                        sb.AppendLine($"    EXCLUDED: {lim.ExcludedKeywords}");
                    sb.AppendLine();
                }
            }

            // ── Section 4: Output rules ────────────────────────────────────────
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("SECTION 4 — STRICT JSON OUTPUT RULES");
            sb.AppendLine("════════════════════════════════════════════════════════════════");
            sb.AppendLine("Output ONLY a valid JSON array — no preamble, no explanation,");
            sb.AppendLine("no markdown fences (```), no trailing text of any kind.");
            sb.AppendLine();
            sb.AppendLine("The array must contain EXACTLY 50 elements. Each element MUST");
            sb.AppendLine("exactly match this shape (no extra fields, no missing fields):");
            sb.AppendLine();
            sb.AppendLine(
                "{ \"questionNo\": <int 1-50>, " +
                "\"topic\": \"<string — must match a topic from Section 1>\", " +
                "\"questionText\": \"<string — full question>\", " +
                "\"options\": [\"<A>\",\"<B>\",\"<C>\",\"<D>\"], " +
                "\"correctOption\": <int 1-4>, " +
                "\"explanation\": \"<string — one sentence>\" }");
            sb.AppendLine();
            sb.AppendLine("Rules:");
            sb.AppendLine("  1. questionNo MUST run sequentially from 1 to 50 with no gaps.");
            sb.AppendLine("  2. topic MUST exactly match a topic name from Section 1.");
            sb.AppendLine("  3. options MUST be an array of exactly 4 non-empty strings.");
            sb.AppendLine("  4. correctOption MUST be 1, 2, 3, or 4 (1-indexed).");
            sb.AppendLine("  5. explanation MUST be a non-empty string.");
            sb.AppendLine("  6. The count of questions per topic MUST match Section 1 EXACTLY.");
            sb.AppendLine("  7. Do NOT wrap the array in an object. Start with [ and end with ].");

            return sb.ToString();
        }

        private static string BuildAgent3UserMessage(
            List<ManualTopicRequest> manualTopicRequests,
            List<TopicResearchContext> researchContext)
        {
            var sb = new StringBuilder();

            sb.AppendLine("NON-NEGOTIABLE USER REQUIREMENTS:");
            if (manualTopicRequests.Count == 0)
            {
                sb.AppendLine("- No specific topic override was requested by the user. Use the distribution normally.");
            }
            else
            {
                foreach (var req in manualTopicRequests)
                {
                    sb.AppendLine($"- EXACTLY {req.QuestionCount} question(s) on '{req.TopicName}'.");
                }
            }

            sb.AppendLine();
            sb.AppendLine("CRITICAL RULE: You MUST strictly obey the exact topic distribution and question count provided by the user.");
            sb.AppendLine("If the user requests exactly 4 questions on 'IP Addresses', you MUST generate EXACTLY 4 questions on 'IP Addresses'.");
            sb.AppendLine("Do NOT override the user's requested topics with your own preferred topics or historical weights.");
            sb.AppendLine("Do NOT hallucinate lessons that were not requested.");
            sb.AppendLine();
            sb.AppendLine("Background research context (for scenario grounding only, not for overriding the user's explicit topic counts):");
            if (researchContext.Count == 0)
            {
                sb.AppendLine("- No special background research context available.");
            }
            else
            {
                foreach (var ctx in researchContext)
                {
                    sb.AppendLine($"- Topic: {ctx.TopicName} | Recent events: {ctx.RecentEvents} | Global trends: {ctx.GlobalTrends}");
                }
            }

            sb.AppendLine();
            sb.AppendLine("Generate the complete predicted A/L ICT exam paper with EXACTLY 50 MCQs. ");
            sb.AppendLine("Follow the topic distribution in Section 1 precisely, except where the user has explicitly overridden it above.");
            sb.AppendLine("Respect all syllabus boundaries in Section 3.");
            sb.AppendLine("Return ONLY the JSON array — no other text.");

            return sb.ToString();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Groq HTTP Helper
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Sends one chat-completion request to Groq (OpenAI-compatible format)
        /// and returns the raw text content from the first choice.
        /// Throws <see cref="HttpRequestException"/> or <see cref="JsonException"/> on failure.
        /// </summary>
        private async Task<string> CallGroqAsync(
            string systemPrompt,
            string userMessage,
            CancellationToken cancellationToken,
            int maxTokens = 4096)
        {
            // ── 🔍 PRODUCTION TRACE: Log the exact prompts sent to Groq ────────
            _logger.LogInformation(
                "[AIAgent] ═══ GROQ SYSTEM PROMPT ═══\n{SystemPrompt}",
                systemPrompt);
            _logger.LogInformation(
                "[AIAgent] ═══ GROQ USER PROMPT ({Len} chars) ═══\n{UserPrompt}",
                userMessage.Length, userMessage);

            for (int attempt = 0; attempt < _apiKeys.Length; attempt++)
            {
                var selectedKey = _apiKeys[attempt % _apiKeys.Length];
                var requestBody = new GroqChatRequest
                {
                    Model       = _modelName,
                    Temperature = 0f,
                    MaxTokens   = maxTokens,
                    Messages    =
                    [
                        new GroqMessage { Role = "system", Content = systemPrompt },
                        new GroqMessage { Role = "user",   Content = userMessage  }
                    ]
                };

                var bodyJson    = JsonSerializer.Serialize(requestBody, _jsonOpts);
                using var httpContent = new StringContent(bodyJson, Encoding.UTF8, "application/json");
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, string.Empty)
                {
                    Content = httpContent
                };
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", selectedKey);
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var httpClient = _httpClientFactory.CreateClient(HttpClientName);
                
                try
                {
                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    cts.CancelAfter(TimeSpan.FromSeconds(_timeoutSeconds));
                    
                    var httpResponse = await httpClient.SendAsync(httpRequest, cts.Token);
                    var responseBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);

                    if (httpResponse.StatusCode == HttpStatusCode.TooManyRequests)
                    {
                        _logger.LogWarning(
                            "[AIAgent] Rate limit hit for key {KeySuffix}, rotating to next key...",
                            selectedKey.Substring(Math.Max(0, selectedKey.Length - 6)));
                        continue;
                    }

                    if (httpResponse.IsSuccessStatusCode)
                    {
                        var groqResponse = JsonSerializer.Deserialize<GroqChatResponse>(responseBody, _jsonOpts)
                            ?? throw new JsonException("Groq response envelope deserialised to null.");

                        var content = groqResponse.Choices?.FirstOrDefault()?.Message?.Content
                            ?? throw new JsonException("Groq response contained no choices or empty content.");

                        return content;
                    }

                    _logger.LogError(
                        "[AIAgent] Groq API returned HTTP {Status} for key {KeySuffix}: {Body}",
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
                    _logger.LogWarning("[AIAgent] Request timed out, rotating to next key...");
                    continue; // rotate to next key
                }
            }

            throw new HttpRequestException(
                $"Groq API rate limit or timeout exceeded across {_apiKeys.Length} configured keys.");
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Private — Utilities
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Defensively strips leading ``` json ... ``` or ``` ... ``` code fences
        /// that LLMs sometimes add despite being instructed not to.
        /// </summary>
        private static string StripMarkdownFences(string raw)
        {
            var trimmed = raw.Trim();
            if (!trimmed.StartsWith("```")) return trimmed;

            var firstNewline = trimmed.IndexOf('\n');
            var lastFence    = trimmed.LastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline)
                return trimmed[(firstNewline + 1)..lastFence].Trim();

            return trimmed;
        }

        /// <summary>Convenience factory for early-exit failure results.</summary>
        private static T Fail<T>(string message) where T : new()
        {
            // Use pattern matching to set Success=false and Message without reflection overhead
            return typeof(T) switch
            {
                var t when t == typeof(AnalyzePastPapersResult)       => (T)(object)new AnalyzePastPapersResult
                    { Success = false, Message = message },
                var t when t == typeof(PredictTopicDistributionResult) => (T)(object)new PredictTopicDistributionResult
                    { Success = false, Message = message },
                var t when t == typeof(GenerateStudyPlanResult)       => (T)(object)new GenerateStudyPlanResult
                    { Success = false, Message = message },
                var t when t == typeof(GeneratePaperResult)           => (T)(object)new GeneratePaperResult
                    { Success = false, Message = message },
                _ => new T()
            };
        }
    }
}
