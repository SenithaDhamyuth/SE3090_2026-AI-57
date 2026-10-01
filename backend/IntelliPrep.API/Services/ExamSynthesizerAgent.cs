using System.Net.Http.Headers;
using ClosedXML.Excel;
using IntelliPrep.API.Data;
using IntelliPrep.API.DTOs;
using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// Agent 3 — ExamSynthesizerAgent  (UC5.2 · UC5.4)
    ///
    /// Responsibilities:
    ///   1. Accept a strict <see cref="SynthesizerInput"/> contract (Objective + TopicDistribution).
    ///   2. Invoke the built-in "FetchSyllabusLimits" Tool to ground the prompt with DB constraints.
    ///   3. Load few-shot seed questions (Excel → DB → built-in fallback).
    ///   4. Build and send a deterministic LLM prompt demanding EXACTLY the requested MCQ count.
    ///   5. Return a strict <see cref="SynthesizerOutput"/> JSON contract for Agent 4 to validate.
    ///
    /// This service does NOT persist to the DB itself — persistence is Agent 4's responsibility
    /// after it passes deterministic validation.
    /// </summary>
    public class ExamSynthesizerAgent
    {
        // ── Excel dataset constants ────────────────────────────────────────────
        private const string SheetName = "2015_2025_ICT_Master_Dataset_CL";

        private const int ColLessonName      = 4;
        private const int ColDifficultyLevel = 5;
        private const int ColQuestionText    = 6;
        private const int ColOption1         = 7;
        private const int ColOption2         = 8;
        private const int ColOption3         = 9;
        private const int ColOption4         = 10;
        private const int ColOption5         = 11;
        private const int ColCorrectAnswer   = 12;

        private const int MaxSeedRows = 5;

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            WriteIndented          = true,
            PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        private readonly IHttpClientFactory                 _httpClientFactory;
        private readonly IConfiguration                    _configuration;
        private readonly ILogger<ExamSynthesizerAgent>     _logger;
        private readonly ApplicationDbContext              _context;
        private readonly IWebHostEnvironment               _env;
        private readonly string[]                          _apiKeys;
        private readonly string                            _modelName;
        private readonly int                               _timeoutSeconds;

        public ExamSynthesizerAgent(
            IHttpClientFactory              httpClientFactory,
            IConfiguration                 configuration,
            ILogger<ExamSynthesizerAgent>  logger,
            ApplicationDbContext           context,
            IWebHostEnvironment            env)
        {
            _httpClientFactory = httpClientFactory;
            _configuration     = configuration;
            _logger            = logger;
            _context           = context;
            _env               = env;

            var groqSettings = _configuration.GetSection("GroqSettings").Get<GroqSettings>() ?? new GroqSettings();

            _apiKeys = groqSettings.ApiKeys?
                           .Where(k => !string.IsNullOrWhiteSpace(k))
                           .Distinct(StringComparer.Ordinal)
                           .ToArray() ?? [];

            if (_apiKeys.Length == 0)
                throw new InvalidOperationException("No Groq API keys configured. Add GroqSettings:ApiKeys array.");

            var configuredModel = _configuration["GroqSettings:Model"];
            if (string.IsNullOrWhiteSpace(configuredModel))
                throw new InvalidOperationException("Groq Model is not configured.");

            _modelName      = configuredModel;
            _timeoutSeconds = groqSettings.TimeoutSeconds > 0 ? groqSettings.TimeoutSeconds : 30;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Public entry point — strict input/output contracts
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Synthesizes exactly <see cref="SynthesizerInput.RequestedQuestionCount"/> MCQs
        /// grounded by the syllabus "Tool" and few-shot seed questions.
        ///
        /// Returns a <see cref="SynthesizerOutput"/> ready for Agent 4 to validate.
        /// This method never persists — Agent 4 handles persistence after validation.
        /// </summary>
        public async Task<SynthesizerOutput> SynthesizeAsync(SynthesizerInput input)
        {
            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] Starting synthesis | Subject '{Subject}' | Count {Count} | Objective: '{Obj}'",
                input.Subject, input.RequestedQuestionCount, input.Objective);

            // ── Tool: Fetch syllabus limits from DB ──────────────────────────
            var syllabusLimits = await FetchSyllabusLimitsToolAsync(input.Subject);

            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] Tool 'FetchSyllabusLimits' returned {Count} constraint(s) for subject '{Subject}'.",
                syllabusLimits.Count, input.Subject);

            // ── Step 1: Load few-shot seed questions ─────────────────────────
            var seedQuestions = await LoadSeedQuestionsAsync(input.Subject);

            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] Loaded {Count} seed question(s) from source: {Source}.",
                seedQuestions.Count,
                seedQuestions.Count > 0 ? seedQuestions[0].Source : "none");

            // ── Step 2: Build grounded prompt ────────────────────────────────
            // ── Step 3: Call Groq LLM — with BATCHING for large counts ───────
            const int batchSize = 10;
            var totalCount = input.RequestedQuestionCount;
            var allQuestions = new List<SynthesizedMcqItem>();

            if (totalCount <= batchSize)
            {
                // Small request — single call
                var prompt  = BuildGroundedPrompt(input, seedQuestions, syllabusLimits);
                var rawJson = await CallGroqForMcqsAsync(prompt, input.Subject, totalCount);
                allQuestions.AddRange(ParseMcqJson(rawJson, input.Subject));
            }
            else
            {
                const int maxRetries = 3;
                var batches = (int)Math.Ceiling((double)totalCount / batchSize);
                _logger.LogInformation(
                    "[Agent3:ExamSynthesizer] Large count {Total} → {Batches} parallel batch(es) of max {Size}.",
                    totalCount, batches, batchSize);

                // Build list of chunk sizes
                var chunkSizes = new List<int>();
                int rem = totalCount;
                for (int b = 0; b < batches; b++)
                {
                    int chunk = Math.Min(rem, batchSize);
                    chunkSizes.Add(chunk);
                    rem -= chunk;
                }

                // Run all chunks in parallel, each with up to maxRetries attempts
                var batchTasks = chunkSizes.Select(async (chunkSize, bIdx) =>
                {
                    var batchInput = new SynthesizerInput
                    {
                        Subject                = input.Subject,
                        Objective              = input.Objective,
                        RequestedQuestionCount = chunkSize,
                        TopicDistribution      = input.TopicDistribution,
                    };
                    var prompt = BuildGroundedPrompt(batchInput, seedQuestions, syllabusLimits);

                    for (int attempt = 1; attempt <= maxRetries; attempt++)
                    {
                        try
                        {
                            _logger.LogInformation(
                                "[Agent3:ExamSynthesizer] Batch {Idx} attempt {Attempt}/{Max} — {Count} question(s).",
                                bIdx + 1, attempt, maxRetries, chunkSize);

                            var rawJson = await CallGroqForMcqsAsync(prompt, input.Subject, chunkSize);
                            var parsed  = ParseMcqJson(rawJson, input.Subject);

                            if (parsed.Count == 0 && attempt < maxRetries)
                            {
                                _logger.LogWarning(
                                    "[Agent3:ExamSynthesizer] Batch {Idx} attempt {Attempt} returned 0 questions — retrying.",
                                    bIdx + 1, attempt);
                                await Task.Delay(800 * attempt);
                                continue;
                            }

                            _logger.LogInformation(
                                "[Agent3:ExamSynthesizer] Batch {Idx} attempt {Attempt} succeeded: {Count} question(s).",
                                bIdx + 1, attempt, parsed.Count);
                            return parsed;
                        }
                        catch (Exception ex) when (attempt < maxRetries)
                        {
                            _logger.LogWarning(ex,
                                "[Agent3:ExamSynthesizer] Batch {Idx} attempt {Attempt} threw — retrying.",
                                bIdx + 1, attempt);
                            await Task.Delay(800 * attempt);
                        }
                    }

                    _logger.LogError(
                        "[Agent3:ExamSynthesizer] Batch {Idx} FAILED after {Max} attempts. Returning empty.",
                        bIdx + 1, maxRetries);
                    return new List<SynthesizedMcqItem>();
                });

                var batchResults = await Task.WhenAll(batchTasks);
                foreach (var batchQuestions in batchResults)
                    allQuestions.AddRange(batchQuestions);

                _logger.LogInformation(
                    "[Agent3:ExamSynthesizer] All {Batches} batch(es) complete. Total questions: {Total}.",
                    batches, allQuestions.Count);
            }

            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] Aggregated {Total} MCQ(s) across all batch(es).", allQuestions.Count);

            // ── Step 4: Parse to output contract ────────────────────────────
            var aggregatedJson = System.Text.Json.JsonSerializer.Serialize(allQuestions, _jsonOpts);
            return new SynthesizerOutput
            {
                Subject               = input.Subject,
                Objective             = input.Objective,
                RequestedQuestionCount = input.RequestedQuestionCount,
                TopicDistribution     = input.TopicDistribution,
                RawLlmJson            = aggregatedJson,
                Questions             = allQuestions
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // TOOL: FetchSyllabusLimits — grounds the prompt with DB constraints
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Agent 3's built-in "Tool" that fetches approved/excluded scope for
        /// <paramref name="subject"/> from <c>SyllabusLimits</c> in the database.
        ///
        /// This method is called BEFORE the LLM prompt is built, ensuring the
        /// generated questions are always bounded by the admin-configured syllabus.
        /// </summary>
        public async Task<List<SyllabusLimit>> FetchSyllabusLimitsToolAsync(string subject)
        {
            try
            {
                var all = await _context.SyllabusLimits.AsNoTracking().ToListAsync();

                // Prefer exact match, fall back to partial match, then return all
                var exact = all
                    .Where(s => s.TopicName.Equals(subject, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (exact.Count > 0) return exact;

                var partial = all
                    .Where(s => s.TopicName.Contains(subject, StringComparison.OrdinalIgnoreCase)
                             || subject.Contains(s.TopicName, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                return partial.Count > 0 ? partial : all;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Agent3:ExamSynthesizer] FetchSyllabusLimits Tool failed — proceeding without constraints.");
                return [];
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 1: Seed question loading (Excel → DB → built-in)
        // ─────────────────────────────────────────────────────────────────────

        private async Task<List<SynthesizerSeedQuestion>> LoadSeedQuestionsAsync(string subject)
        {
            var excelPath = GetExcelPath();
            if (File.Exists(excelPath))
            {
                var excelRows = ReadFromExcel(excelPath, subject);
                if (excelRows.Count > 0) return excelRows;
                _logger.LogWarning("[Agent3:ExamSynthesizer] Excel exists but no rows found for '{Subject}'. Falling back to DB.", subject);
            }
            else
            {
                _logger.LogWarning("[Agent3:ExamSynthesizer] Excel file not found at '{Path}'. Falling back to DB.", excelPath);
            }

            var dbRows = await ReadFromDatabaseAsync(subject);
            if (dbRows.Count > 0) return dbRows;

            _logger.LogWarning("[Agent3:ExamSynthesizer] No DB seed rows for '{Subject}'. Using built-in seed.", subject);
            return GetBuiltInSeed(subject);
        }

        private string GetExcelPath() => Path.Combine(
            _env.ContentRootPath, "Data", "Datasets",
            "2011-2025_ICT_Master_Dataset_Complete.xlsx");

        private List<SynthesizerSeedQuestion> ReadFromExcel(string filePath, string subject)
        {
            var results = new List<SynthesizerSeedQuestion>();
            try
            {
                using var workbook = new XLWorkbook(filePath);
                if (!workbook.TryGetWorksheet(SheetName, out var sheet))
                {
                    _logger.LogWarning("[Agent3:ExamSynthesizer] Sheet '{Sheet}' not found in workbook.", SheetName);
                    return results;
                }

                var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;
                for (var r = 2; r <= lastRow && results.Count < MaxSeedRows; r++)
                {
                    var lessonName = sheet.Cell(r, ColLessonName).GetString().Trim();
                    if (!lessonName.Contains(subject, StringComparison.OrdinalIgnoreCase)) continue;

                    var q = new SynthesizerSeedQuestion
                    {
                        Source          = "Excel",
                        QuestionText    = sheet.Cell(r, ColQuestionText).GetString().Trim(),
                        Option1         = sheet.Cell(r, ColOption1).GetString().Trim(),
                        Option2         = sheet.Cell(r, ColOption2).GetString().Trim(),
                        Option3         = sheet.Cell(r, ColOption3).GetString().Trim(),
                        Option4         = sheet.Cell(r, ColOption4).GetString().Trim(),
                        Option5         = sheet.Cell(r, ColOption5).GetString().Trim(),
                        CorrectAnswer   = sheet.Cell(r, ColCorrectAnswer).GetString().Trim(),
                        DifficultyLevel = sheet.Cell(r, ColDifficultyLevel).GetString().Trim(),
                        LessonName      = lessonName,
                    };
                    if (!string.IsNullOrWhiteSpace(q.QuestionText)) results.Add(q);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Agent3:ExamSynthesizer] Failed to read Excel at '{Path}'.", filePath);
            }
            return results;
        }

        private async Task<List<SynthesizerSeedQuestion>> ReadFromDatabaseAsync(string subject)
        {
            var rows = await _context.Questions
                .Where(q => EF.Functions.ILike(q.Lesson_Name, $"%{subject}%"))
                .OrderBy(q => q.Year)
                .Take(MaxSeedRows)
                .ToListAsync();

            return rows.Select(q => new SynthesizerSeedQuestion
            {
                Source          = "Database",
                QuestionText    = q.Question_Text,
                Option1         = q.Option_1,
                Option2         = q.Option_2,
                Option3         = q.Option_3,
                Option4         = q.Option_4,
                Option5         = q.Option_5,
                CorrectAnswer   = q.Correct_Answer,
                DifficultyLevel = q.Difficulty_Level,
                LessonName      = q.Lesson_Name,
            }).ToList();
        }

        private static List<SynthesizerSeedQuestion> GetBuiltInSeed(string subject)
        {
            var allSeeds = new List<SynthesizerSeedQuestion>
            {
                new() { Source = "Seed", LessonName = "Logic Gates", DifficultyLevel = "Medium",
                    QuestionText = "Which logic gate produces a HIGH output only when ALL inputs are HIGH?",
                    Option1 = "OR", Option2 = "AND", Option3 = "NAND", Option4 = "NOR", Option5 = "XOR",
                    CorrectAnswer = "B" },
                new() { Source = "Seed", LessonName = "Networking", DifficultyLevel = "Medium",
                    QuestionText = "Which protocol operates at the Transport layer of the OSI model?",
                    Option1 = "HTTP", Option2 = "IP", Option3 = "TCP", Option4 = "Ethernet", Option5 = "ARP",
                    CorrectAnswer = "C" },
                new() { Source = "Seed", LessonName = "Data Structures", DifficultyLevel = "Easy",
                    QuestionText = "Which data structure operates on LIFO principle?",
                    Option1 = "Queue", Option2 = "Stack", Option3 = "Array", Option4 = "Tree", Option5 = "Graph",
                    CorrectAnswer = "B" },
                new() { Source = "Seed", LessonName = "Database", DifficultyLevel = "Medium",
                    QuestionText = "Which SQL command removes all rows without logging individual deletions?",
                    Option1 = "DELETE", Option2 = "DROP", Option3 = "TRUNCATE", Option4 = "REMOVE", Option5 = "CLEAR",
                    CorrectAnswer = "C" },
            };

            var matched = allSeeds
                .Where(s => s.LessonName.Contains(subject, StringComparison.OrdinalIgnoreCase))
                .ToList();

            return matched.Count > 0
                ? matched.Take(MaxSeedRows).ToList()
                : allSeeds.Take(3).ToList();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 2: Build grounded prompt (seeds + syllabus tool output)
        // ─────────────────────────────────────────────────────────────────────

        private static string BuildGroundedPrompt(
            SynthesizerInput              input,
            List<SynthesizerSeedQuestion> seeds,
            List<SyllabusLimit>           syllabusLimits)
        {
            var sb = new StringBuilder();

            // ── Section 0: Objective ──────────────────────────────────────────
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("SECTION 0 — GENERATION OBJECTIVE");
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine($"Subject : {input.Subject}");
            sb.AppendLine($"Objective: {(string.IsNullOrWhiteSpace(input.Objective) ? "(none — generate balanced A/L ICT questions)" : input.Objective)}");
            sb.AppendLine($"You MUST generate EXACTLY {input.RequestedQuestionCount} questions. No more, no less.");
            sb.AppendLine();

            // ── Section 1: Topic Distribution (input contract) ────────────────
            if (input.TopicDistribution.Count > 0)
            {
                sb.AppendLine("════════════════════════════════════════════════");
                sb.AppendLine("SECTION 1 — MANDATORY TOPIC DISTRIBUTION");
                sb.AppendLine("════════════════════════════════════════════════");
                sb.AppendLine("Distribute the questions EXACTLY as shown (total must equal the count above):");
                foreach (var (topic, count) in input.TopicDistribution)
                    sb.AppendLine($"  • {topic}: {count} question(s)");
                sb.AppendLine();
            }

            // ── Section 2: Syllabus Limits (Tool output) ──────────────────────
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("SECTION 2 — SYLLABUS BOUNDARIES [Tool: FetchSyllabusLimits]");
            sb.AppendLine("════════════════════════════════════════════════");
            if (syllabusLimits.Count == 0)
            {
                sb.AppendLine("  (No specific limits found — use the standard A/L ICT syllabus.)");
            }
            else
            {
                foreach (var limit in syllabusLimits)
                {
                    sb.AppendLine($"  ▶ Topic: {limit.TopicName}");
                    sb.AppendLine($"    Allowed : {limit.AllowedScope}");
                    if (!string.IsNullOrWhiteSpace(limit.ExcludedKeywords))
                        sb.AppendLine($"    EXCLUDED: {limit.ExcludedKeywords}  — NEVER include these.");
                }
            }
            sb.AppendLine();

            // ── Section 3: Few-shot seed examples ─────────────────────────────
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("SECTION 3 — HISTORICAL EXAMPLES (Few-shot Seeds)");
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("Use ONLY as format/difficulty reference. Generate entirely NEW questions:");
            sb.AppendLine();
            for (var i = 0; i < seeds.Count; i++)
            {
                var s = seeds[i];
                sb.AppendLine($"Example {i + 1} [{s.DifficultyLevel}]:");
                sb.AppendLine($"  Q: {s.QuestionText}");
                sb.AppendLine($"  A: {s.Option1}  B: {s.Option2}  C: {s.Option3}  D: {s.Option4}");
                if (!string.IsNullOrWhiteSpace(s.Option5))
                    sb.AppendLine($"  E: {s.Option5}");
                sb.AppendLine($"  Correct: {s.CorrectAnswer}");
                sb.AppendLine();
            }

            // ── Section 4: Strict output rules ───────────────────────────────
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("SECTION 4 — STRICT JSON OUTPUT CONTRACT");
            sb.AppendLine("════════════════════════════════════════════════");
            sb.AppendLine("Output ONLY a valid JSON array. No markdown, no prose, no code fences.");
            sb.AppendLine($"The array MUST contain EXACTLY {input.RequestedQuestionCount} elements.");
            sb.AppendLine("Each element MUST exactly match this shape:");
            sb.AppendLine(@"  { ""questionText"": ""..."", ""options"": [""A"",""B"",""C"",""D"",""E""], ""correctOptionIndex"": 0, ""explanation"": ""..."" }");
            sb.AppendLine("Rules:");
            sb.AppendLine("  1. options MUST be an array of EXACTLY 5 non-empty strings.");
            sb.AppendLine("  2. correctOptionIndex is zero-based (0 = A, 4 = E).");
            sb.AppendLine("  3. The value at options[correctOptionIndex] MUST be the correct answer.");
            sb.AppendLine("  4. explanation MUST be a non-empty string.");
            sb.AppendLine($"  5. The array MUST contain EXACTLY {input.RequestedQuestionCount} elements — no more, no less.");

            return sb.ToString();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: Groq LLM call
        // ─────────────────────────────────────────────────────────────────────

        private async Task<string> CallGroqForMcqsAsync(string userPrompt, string subject, int requestedCount)
        {
            var systemPrompt =
                "You are Agent 3 — the A/L ICT Exam Synthesizer for IntelliPrep, a Sri Lanka A/L exam preparation platform. " +
                "Your ONLY task is to generate brand-new, original MCQ questions that DIRECTLY address the user's specific objective. " +
                "⚠️  CRITICAL: Read the MANDATORY OBJECTIVE at the top of the user message first and treat it as your #1 constraint. " +
                "You MUST output ONLY a valid JSON array — no markdown, no text before or after the JSON. " +
                "Every question must be educationally accurate for the A/L ICT Sri Lanka curriculum. " +
                $"CRITICAL: You MUST generate EXACTLY {requestedCount} questions. " +
                $"Each question MUST have EXACTLY 5 options. " +
                $"The correctOptionIndex MUST be a valid zero-based index (0–4) into the options array. " +
                $"Outputting anything other than exactly {requestedCount} elements in the array will cause a system failure.";

            // ── 🔍 PRODUCTION TRACE: Log exact prompts for Render debugging ───
            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] ═══ GROQ SYSTEM PROMPT ═══\n{SystemPrompt}",
                systemPrompt);
            _logger.LogInformation(
                "[Agent3:ExamSynthesizer] ═══ GROQ USER PROMPT ({Len} chars) ═══\n{UserPrompt}",
                userPrompt.Length, userPrompt);

            for (int attempt = 0; attempt < _apiKeys.Length; attempt++)
            {
                var selectedKey = _apiKeys[attempt % _apiKeys.Length];
                var requestDto = new SynthesizerGroqRequest
                {
                    Model       = _modelName,
                    Temperature = 0.7f,
                    MaxTokens   = 4000,
                    Messages    =
                    [
                        new SynthesizerGroqMessage { Role = "system", Content = systemPrompt },
                        new SynthesizerGroqMessage { Role = "user",   Content = userPrompt   },
                    ]
                };

                var body    = JsonSerializer.Serialize(requestDto, _jsonOpts);
                using var content = new StringContent(body, Encoding.UTF8, "application/json");
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
                {
                    Content = content
                };
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", selectedKey);
                httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var httpClient = _httpClientFactory.CreateClient(PlanningCoordinatorService.HttpClientName);

                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(_timeoutSeconds));
                    var response     = await httpClient.SendAsync(httpRequest, cts.Token);
                    var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                        response.StatusCode == System.Net.HttpStatusCode.TooManyRequests ||
                        response.StatusCode == System.Net.HttpStatusCode.RequestEntityTooLarge)
                    {
                        _logger.LogWarning(
                            "[Agent3:ExamSynthesizer] HTTP {Status} on key ...{Suffix} — rotating.",
                            response.StatusCode,
                            selectedKey[Math.Max(0, selectedKey.Length - 6)..]);
                        continue;
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogError(
                            "[Agent3:ExamSynthesizer] Groq returned HTTP {Status}: {Body}",
                            (int)response.StatusCode, responseBody);
                        return BuildFallbackJsonString(subject, requestedCount);
                    }

                    var groqResp = JsonSerializer.Deserialize<SynthesizerGroqResponse>(
                        responseBody,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    return groqResp?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;
                }
                catch (Exception ex) when (ex is TaskCanceledException || ex is TimeoutException)
                {
                    _logger.LogWarning("[Agent3:ExamSynthesizer] Groq call timed out — rotating key.");
                    continue;
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogWarning(ex, "[Agent3:ExamSynthesizer] Groq HTTP error.");
                    return BuildFallbackJsonString(subject, requestedCount);
                }
            }

            _logger.LogWarning("[Agent3:ExamSynthesizer] All API keys exhausted — returning fallback JSON.");
            return BuildFallbackJsonString(subject, requestedCount);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 4: Parse raw JSON → List<SynthesizedMcqItem>
        // ─────────────────────────────────────────────────────────────────────

        private List<SynthesizedMcqItem> ParseMcqJson(string rawText, string subject)
        {
            if (string.IsNullOrWhiteSpace(rawText))
            {
                _logger.LogWarning("[Agent3:ExamSynthesizer] Empty LLM response — using fallback.");
                return GetFallbackMcqs(subject);
            }

            // Strip markdown fences defensively
            var trimmed = rawText.Trim();
            if (trimmed.StartsWith("```"))
            {
                var firstNl   = trimmed.IndexOf('\n');
                var lastFence = trimmed.LastIndexOf("```");
                if (firstNl > 0 && lastFence > firstNl)
                    trimmed = trimmed[(firstNl + 1)..lastFence].Trim();
            }

            // Find the first '[' to handle leading prose
            var arrayStart = trimmed.IndexOf('[');
            if (arrayStart > 0) trimmed = trimmed[arrayStart..];

            try
            {
                var mcqs = JsonSerializer.Deserialize<List<SynthesizedMcqItem>>(
                    trimmed,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (mcqs == null || mcqs.Count == 0)
                {
                    _logger.LogWarning("[Agent3:ExamSynthesizer] LLM returned empty array — using fallback.");
                    return GetFallbackMcqs(subject);
                }

                // Sanitise each MCQ
                foreach (var mcq in mcqs)
                {
                    mcq.CorrectOptionIndex = Math.Clamp(mcq.CorrectOptionIndex, 0,
                        mcq.Options?.Count > 0 ? mcq.Options.Count - 1 : 0);

                    if (string.IsNullOrWhiteSpace(mcq.Explanation))
                        mcq.Explanation = "See A/L ICT syllabus for reference.";
                }

                _logger.LogInformation(
                    "[Agent3:ExamSynthesizer] Parsed {Count} MCQ(s) from LLM output.", mcqs.Count);

                return mcqs;
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "[Agent3:ExamSynthesizer] Failed to parse LLM JSON — using fallback.");
                return GetFallbackMcqs(subject);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Fallback helpers
        // ─────────────────────────────────────────────────────────────────────

        private static string BuildFallbackJsonString(string subject, int count)
        {
            var fallback = GetFallbackMcqs(subject).Take(count).ToList();
            return JsonSerializer.Serialize(fallback, new JsonSerializerOptions { WriteIndented = false });
        }

        private static List<SynthesizedMcqItem> GetFallbackMcqs(string subject) =>
        [
            new()
            {
                QuestionText       = $"[Fallback] In {subject}, which of the following best describes a binary digit?",
                Options            = ["A unit of data storage", "A single 0 or 1", "A byte", "A register", "A processor cycle"],
                CorrectOptionIndex = 1,
                Explanation        = "A binary digit (bit) is the smallest unit of data, represented as 0 or 1."
            },
            new()
            {
                QuestionText       = $"[Fallback] Which of the following is a key feature of {subject}?",
                Options            = ["Analog signals only", "Digital representation", "Optical transmission only", "Quantum states", "None of the above"],
                CorrectOptionIndex = 1,
                Explanation        = "Digital representation is a foundational concept in ICT."
            },
            new()
            {
                QuestionText       = $"[Fallback] In {subject}, what does CPU stand for?",
                Options            = ["Central Processing Unit", "Core Power Unit", "Control Processing Unit", "Computed Processing Utility", "Central Power Utility"],
                CorrectOptionIndex = 0,
                Explanation        = "CPU stands for Central Processing Unit, the primary component that executes instructions."
            },
        ];
    }
}
