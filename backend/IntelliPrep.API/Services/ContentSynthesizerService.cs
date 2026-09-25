using ClosedXML.Excel;
using IntelliPrep.API.Data;
using IntelliPrep.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IntelliPrep.API.Services
{
    /// <summary>
    /// ContentSynthesizerService — Member 2 · UC5.2 · UC5.4
    ///
    /// Pipeline:
    ///   1. Read 3–5 historical A/L ICT questions for the requested subject
    ///      → Source priority: Excel dataset → PostgreSQL Questions table → built-in seed data
    ///   2. Build a few-shot prompt from those examples
    ///   3. Send to Groq LLM (llama3-70b-8192) to generate 5 NEW MCQs
    ///   4. Parse and validate the LLM JSON output
    ///   5. Persist to ExamSession.QuestionsJson and flip Status → "Ready"
    /// </summary>
    public class ContentSynthesizerService
    {
        // ── Excel constants ───────────────────────────────────────────────────
        private const string SheetName = "2015_2025_ICT_Master_Dataset_CL";

        // Column indices (1-based) in the master sheet
        private const int ColQuestionId      = 1;
        private const int ColYear            = 2;
        private const int ColPaperType       = 3;
        private const int ColLessonName      = 4;
        private const int ColDifficultyLevel = 5;
        private const int ColQuestionText    = 6;
        private const int ColOption1         = 7;
        private const int ColOption2         = 8;
        private const int ColOption3         = 9;
        private const int ColOption4         = 10;
        private const int ColOption5         = 11;
        private const int ColCorrectAnswer   = 12;
        private const int ColCorrectOptionNo = 13;

        private const int MaxSeedRows    = 5;   // maximum historical examples to send to LLM
        private const int TargetNewCount = 5;   // number of new questions to generate

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            WriteIndented            = true,
            PropertyNamingPolicy     = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition   = JsonIgnoreCondition.WhenWritingNull,
        };

        private readonly IHttpClientFactory                   _httpClientFactory;
        private readonly IConfiguration                       _configuration;
        private readonly ILogger<ContentSynthesizerService>   _logger;
        private readonly ApplicationDbContext                 _context;
        private readonly IWebHostEnvironment                  _env;

        public ContentSynthesizerService(
            IHttpClientFactory                  httpClientFactory,
            IConfiguration                      configuration,
            ILogger<ContentSynthesizerService>  logger,
            ApplicationDbContext                context,
            IWebHostEnvironment                 env)
        {
            _httpClientFactory = httpClientFactory;
            _configuration     = configuration;
            _logger            = logger;
            _context           = context;
            _env               = env;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Public entry point
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Synthesizes <c>session.RequestedQuestionCount</c> new MCQs for the topic in
        /// <c>session.Subject</c>, grounded in <c>session.OriginalObjective</c>.
        /// Uses historical questions as few-shot examples, then persists results to the session.
        /// Returns the generated question list on success.
        /// </summary>
        public async Task<List<GeneratedMcq>> SynthesizeAndPersistAsync(
            int    sessionId,
            string subject)          // kept for back-compat; overridden by DB values when present
        {
            // ── Load session to read dynamic fields ───────────────────────────
            var session = await _context.ExamSessions.FindAsync(sessionId)
                ?? throw new KeyNotFoundException($"ExamSession {sessionId} not found.");

            // Prefer DB-stored subject over the parameter (ensures consistency)
            var effectiveSubject   = !string.IsNullOrWhiteSpace(session.Subject)
                ? session.Subject
                : (!string.IsNullOrWhiteSpace(subject) ? subject : "ICT");

            var objective          = session.OriginalObjective ?? string.Empty;
            var requestedCount     = session.RequestedQuestionCount > 0
                ? session.RequestedQuestionCount
                : 5;

            _logger.LogInformation(
                "[ContentSynthesizer] Starting synthesis | Session {SessionId} | Subject '{Subject}' | Count {Count} | Objective: '{Obj}'",
                sessionId, effectiveSubject, requestedCount, objective);

            // ── Step 1: Load historical seed questions ─────────────────────
            var seedQuestions = await LoadSeedQuestionsAsync(effectiveSubject);

            _logger.LogInformation(
                "[ContentSynthesizer] Loaded {Count} seed questions from source: {Source}",
                seedQuestions.Count,
                seedQuestions.Count > 0 ? seedQuestions[0].Source : "none");

            // ── Step 2: Build few-shot prompt (now fully dynamic) ──────────
            var prompt = BuildPrompt(effectiveSubject, seedQuestions, requestedCount, objective);

            // ── Step 3: Call Groq LLM ──────────────────────────────────────
            var generatedMcqs = await CallGroqForMcqsAsync(prompt, effectiveSubject, requestedCount);

            // ── Step 4: Persist to ExamSession ────────────────────────────
            await PersistToSessionAsync(sessionId, generatedMcqs);

            _logger.LogInformation(
                "[ContentSynthesizer] Successfully synthesized {Count} questions for session {SessionId}.",
                generatedMcqs.Count, sessionId);

            return generatedMcqs;

        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 1: Seed question loading (Excel → DB → built-in)
        // ─────────────────────────────────────────────────────────────────────

        private async Task<List<SeedQuestion>> LoadSeedQuestionsAsync(string subject)
        {
            // Try Excel first
            var excelPath = GetExcelPath();
            if (File.Exists(excelPath))
            {
                var excelRows = ReadFromExcel(excelPath, subject);
                if (excelRows.Count > 0)
                {
                    _logger.LogDebug("[ContentSynthesizer] Using Excel seed data ({Count} rows).", excelRows.Count);
                    return excelRows;
                }
                _logger.LogWarning("[ContentSynthesizer] Excel exists but has no rows for subject '{Subject}'. Falling back to DB.", subject);
            }
            else
            {
                _logger.LogWarning("[ContentSynthesizer] Excel file not found at '{Path}'. Falling back to DB.", excelPath);
            }

            // Try PostgreSQL Questions table
            var dbRows = await ReadFromDatabaseAsync(subject);
            if (dbRows.Count > 0)
            {
                _logger.LogDebug("[ContentSynthesizer] Using DB seed data ({Count} rows).", dbRows.Count);
                return dbRows;
            }

            // Final fallback: built-in seed data
            _logger.LogWarning("[ContentSynthesizer] No DB rows for subject '{Subject}'. Using built-in seed data.", subject);
            return GetBuiltInSeed(subject);
        }

        // ── Excel reader ──────────────────────────────────────────────────────

        private string GetExcelPath()
        {
            // Tries: (1) Data/Datasets/ inside content root, (2) cwd
            var contentRootPath = Path.Combine(
                _env.ContentRootPath,
                "Data", "Datasets",
                "2011-2025_ICT_Master_Dataset_Complete.xlsx");

            return contentRootPath;
        }

        private List<SeedQuestion> ReadFromExcel(string filePath, string subject)
        {
            var results = new List<SeedQuestion>();

            try
            {
                using var workbook = new XLWorkbook(filePath);

                if (!workbook.TryGetWorksheet(SheetName, out var sheet))
                {
                    _logger.LogWarning("[ContentSynthesizer] Sheet '{Sheet}' not found in workbook.", SheetName);
                    return results;
                }

                // Row 1 is the header; data starts at row 2
                var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;

                for (var r = 2; r <= lastRow && results.Count < MaxSeedRows; r++)
                {
                    var lessonName = sheet.Cell(r, ColLessonName).GetString().Trim();

                    // Case-insensitive partial match on lesson name
                    if (!lessonName.Contains(subject, StringComparison.OrdinalIgnoreCase))
                        continue;

                    var q = new SeedQuestion
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

                    if (!string.IsNullOrWhiteSpace(q.QuestionText))
                        results.Add(q);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ContentSynthesizer] Failed to read Excel file at '{Path}'.", filePath);
            }

            return results;
        }

        // ── DB reader ─────────────────────────────────────────────────────────

        private async Task<List<SeedQuestion>> ReadFromDatabaseAsync(string subject)
        {
            var rows = await _context.Questions
                .Where(q => EF.Functions.ILike(q.Lesson_Name, $"%{subject}%"))
                .OrderBy(q => q.Year)
                .Take(MaxSeedRows)
                .ToListAsync();

            return rows.Select(q => new SeedQuestion
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

        // ── Built-in seed fallback (A/L ICT — covers common topics) ──────────

        private static List<SeedQuestion> GetBuiltInSeed(string subject)
        {
            // These cover the most common A/L ICT lesson names.
            // Used only when both Excel and DB are unavailable for the requested topic.
            var allSeeds = new List<SeedQuestion>
            {
                new() { Source = "Seed", LessonName = "Logic Gates", DifficultyLevel = "Medium",
                    QuestionText = "Which logic gate produces a HIGH output only when ALL inputs are HIGH?",
                    Option1 = "OR", Option2 = "AND", Option3 = "NAND", Option4 = "NOR", Option5 = "XOR",
                    CorrectAnswer = "B" },

                new() { Source = "Seed", LessonName = "Logic Gates", DifficultyLevel = "Easy",
                    QuestionText = "What is the output of a NOT gate when the input is 0?",
                    Option1 = "0", Option2 = "1", Option3 = "Undefined", Option4 = "HIGH Z", Option5 = "None",
                    CorrectAnswer = "B" },

                new() { Source = "Seed", LessonName = "Networking", DifficultyLevel = "Medium",
                    QuestionText = "Which protocol operates at the Transport layer of the OSI model?",
                    Option1 = "HTTP", Option2 = "IP", Option3 = "TCP", Option4 = "Ethernet", Option5 = "ARP",
                    CorrectAnswer = "C" },

                new() { Source = "Seed", LessonName = "Networking", DifficultyLevel = "Hard",
                    QuestionText = "What is the maximum segment size (MSS) negotiated during TCP's three-way handshake used for?",
                    Option1 = "Setting connection timeout", Option2 = "Avoiding IP fragmentation",
                    Option3 = "Encrypting the payload", Option4 = "Determining DNS TTL", Option5 = "Flow control only",
                    CorrectAnswer = "B" },

                new() { Source = "Seed", LessonName = "Data Structures", DifficultyLevel = "Easy",
                    QuestionText = "Which data structure operates on LIFO principle?",
                    Option1 = "Queue", Option2 = "Stack", Option3 = "Array", Option4 = "Tree", Option5 = "Graph",
                    CorrectAnswer = "B" },

                new() { Source = "Seed", LessonName = "Database", DifficultyLevel = "Medium",
                    QuestionText = "Which SQL command is used to remove all rows from a table without logging individual row deletions?",
                    Option1 = "DELETE", Option2 = "DROP", Option3 = "TRUNCATE", Option4 = "REMOVE", Option5 = "CLEAR",
                    CorrectAnswer = "C" },
            };

            // Best-effort match; if no match return first 3 as generic ICT examples
            var matched = allSeeds
                .Where(s => s.LessonName.Contains(subject, StringComparison.OrdinalIgnoreCase))
                .ToList();

            return matched.Count > 0
                ? matched.Take(MaxSeedRows).ToList()
                : allSeeds.Take(3).ToList();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 2: Build few-shot prompt
        // ─────────────────────────────────────────────────────────────────────

        private static string BuildPrompt(
            string            subject,
            List<SeedQuestion> seeds,
            int               requestedCount,
            string            originalObjective)
        {
            var sb = new StringBuilder();

            sb.AppendLine($"Here are some historical A/L ICT past paper questions for the topic \"{subject}\":");
            sb.AppendLine();

            for (var i = 0; i < seeds.Count; i++)
            {
                var s = seeds[i];
                sb.AppendLine($"Example {i + 1} [{s.DifficultyLevel}]:");
                sb.AppendLine($"  Q: {s.QuestionText}");
                sb.AppendLine($"  A: {s.Option1}");
                sb.AppendLine($"  B: {s.Option2}");
                sb.AppendLine($"  C: {s.Option3}");
                sb.AppendLine($"  D: {s.Option4}");
                if (!string.IsNullOrWhiteSpace(s.Option5))
                    sb.AppendLine($"  E: {s.Option5}");
                sb.AppendLine($"  Correct: {s.CorrectAnswer}");
                sb.AppendLine();
            }

            sb.AppendLine($"Using these examples as a baseline in terms of format, style, and difficulty distribution,");
            sb.AppendLine($"generate exactly {requestedCount} ENTIRELY NEW multiple-choice questions for the topic \"{subject}\".");

            // Inject the user's original objective so the LLM focuses on their specific intent
            if (!string.IsNullOrWhiteSpace(originalObjective))
            {
                sb.AppendLine($"The questions MUST focus SPECIFICALLY on this user request: '{originalObjective}'.");
                sb.AppendLine($"Do not write generic {subject} questions — directly address the user's stated focus area.");
            }

            sb.AppendLine($"Each question must have exactly 5 options.");
            sb.AppendLine($"Output ONLY a strict JSON array. No markdown, no explanation, no prose outside the JSON.");
            sb.AppendLine($"Each element must have exactly these fields:");
            sb.AppendLine(@"  { ""questionText"": ""..."", ""options"": [""A"",""B"",""C"",""D"",""E""], ""correctOptionIndex"": 0, ""explanation"": ""..."" }");
            sb.AppendLine($"correctOptionIndex is zero-based (0 = first option, 4 = fifth option).");
            sb.AppendLine($"You MUST output exactly {requestedCount} elements in the JSON array — no more, no less.");

            return sb.ToString();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: Groq LLM call
        // ─────────────────────────────────────────────────────────────────────

        private async Task<List<GeneratedMcq>> CallGroqForMcqsAsync(
            string userPrompt,
            string subject,
            int    requestedCount)
        {
            var systemPrompt =
                "You are the A/L ICT Content Synthesizer agent for IntelliPrep, a Sri Lanka A/L exam preparation platform. " +
                "Your only job is to generate new, original MCQ questions based on historical past paper examples. " +
                "You MUST output ONLY a valid JSON array. No markdown code fences, no text before or after the JSON. " +
                "Every question must be educationally accurate for the A/L ICT Sri Lanka curriculum. " +
                $"CRITICAL INSTRUCTION: You MUST generate EXACTLY {requestedCount} entirely new questions. " +
                $"Do not merely match the number of examples provided. " +
                $"If you output less than {requestedCount} questions, the system will crash. " +
                $"I repeat, output EXACTLY {requestedCount} questions in the JSON array.";

            var model     = _configuration["Groq:Model"] ?? "llama3-70b-8192";
            var requestDto = new SynthesizerGroqRequest
            {
                Model       = model,
                Temperature = 0.7f,   // slightly higher temp for creative question variety
                MaxTokens   = 3000,
                Messages    =
                [
                    new SynthesizerGroqMessage { Role = "system", Content = systemPrompt },
                    new SynthesizerGroqMessage { Role = "user",   Content = userPrompt   },
                ]
            };

            var body    = JsonSerializer.Serialize(requestDto, _jsonOpts);
            var content = new StringContent(body, Encoding.UTF8, "application/json");

            var httpClient = _httpClientFactory.CreateClient(PlanningCoordinatorService.HttpClientName);

            try
            {
                var response     = await httpClient.PostAsync(string.Empty, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError(
                        "[ContentSynthesizer] Groq returned {Status}: {Body}",
                        (int)response.StatusCode, responseBody);
                    return GetFallbackMcqs(subject);
                }

                var groqResp = JsonSerializer.Deserialize<SynthesizerGroqResponse>(
                    responseBody,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                var rawText = groqResp?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;

                _logger.LogDebug(
                    "[ContentSynthesizer] Raw LLM output ({Len} chars).", rawText.Length);

                return ParseMcqJson(rawText, subject);
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("[ContentSynthesizer] Groq call timed out. Using fallback MCQs.");
                return GetFallbackMcqs(subject);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "[ContentSynthesizer] Groq HTTP error. Using fallback MCQs.");
                return GetFallbackMcqs(subject);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 3b: LLM JSON parsing + validation
        // ─────────────────────────────────────────────────────────────────────

        private List<GeneratedMcq> ParseMcqJson(string rawText, string subject)
        {
            if (string.IsNullOrWhiteSpace(rawText))
            {
                _logger.LogWarning("[ContentSynthesizer] Empty LLM response. Using fallback MCQs.");
                return GetFallbackMcqs(subject);
            }

            // Strip markdown fences defensively
            var trimmed = rawText.Trim();
            if (trimmed.StartsWith("```"))
            {
                var firstNl  = trimmed.IndexOf('\n');
                var lastFence = trimmed.LastIndexOf("```");
                if (firstNl > 0 && lastFence > firstNl)
                    trimmed = trimmed[(firstNl + 1)..lastFence].Trim();
            }

            // Find the first '[' to handle any leading prose
            var arrayStart = trimmed.IndexOf('[');
            if (arrayStart > 0)
                trimmed = trimmed[arrayStart..];

            try
            {
                var mcqs = JsonSerializer.Deserialize<List<GeneratedMcq>>(
                    trimmed,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (mcqs == null || mcqs.Count == 0)
                {
                    _logger.LogWarning("[ContentSynthesizer] LLM returned empty array. Using fallback.");
                    return GetFallbackMcqs(subject);
                }

                // Validate and sanitise each MCQ
                var valid = new List<GeneratedMcq>();
                foreach (var mcq in mcqs)
                {
                    if (string.IsNullOrWhiteSpace(mcq.QuestionText)) continue;
                    if (mcq.Options == null || mcq.Options.Count < 2)  continue;

                    // Clamp correctOptionIndex to valid range
                    mcq.CorrectOptionIndex = Math.Clamp(mcq.CorrectOptionIndex, 0, mcq.Options.Count - 1);

                    // Ensure explanation is present
                    if (string.IsNullOrWhiteSpace(mcq.Explanation))
                        mcq.Explanation = "See A/L ICT syllabus for reference.";

                    valid.Add(mcq);
                }

                _logger.LogInformation(
                    "[ContentSynthesizer] Parsed {Valid}/{Total} valid MCQs from LLM output.",
                    valid.Count, mcqs.Count);

                return valid.Count > 0 ? valid : GetFallbackMcqs(subject);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "[ContentSynthesizer] Failed to parse LLM JSON. Using fallback MCQs.");
                return GetFallbackMcqs(subject);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 4: Persist to ExamSession
        // ─────────────────────────────────────────────────────────────────────

        private async Task PersistToSessionAsync(int sessionId, List<GeneratedMcq> mcqs)
        {
            var session = await _context.ExamSessions.FindAsync(sessionId)
                ?? throw new KeyNotFoundException($"ExamSession {sessionId} not found.");

            session.QuestionsJson = JsonSerializer.Serialize(mcqs, _jsonOpts);
            session.Status        = "Ready"; // Signal that questions are ready for the student

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "[ContentSynthesizer] Session {Id} updated: Status=Ready, {Count} questions stored.",
                sessionId, mcqs.Count);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Fallback MCQs — returned when LLM is unavailable
        // ─────────────────────────────────────────────────────────────────────

        private static List<GeneratedMcq> GetFallbackMcqs(string subject) =>
        [
            new()
            {
                QuestionText       = $"[Fallback] In the context of {subject}, which of the following best describes a binary digit?",
                Options            = ["A unit of data storage", "A single 0 or 1", "A byte", "A register", "A processor cycle"],
                CorrectOptionIndex = 1,
                Explanation        = "A binary digit (bit) is the smallest unit of data, represented as 0 or 1."
            },
            new()
            {
                QuestionText       = $"[Fallback] Which of the following is a key feature of {subject}?",
                Options            = ["Analog signals only", "Digital representation", "Optical transmission only", "Quantum states", "None of the above"],
                CorrectOptionIndex = 1,
                Explanation        = "Digital representation is a foundational concept in ICT, allowing data to be encoded as binary values."
            },
            new()
            {
                QuestionText       = $"[Fallback] In {subject}, what does CPU stand for?",
                Options            = ["Central Processing Unit", "Core Power Unit", "Control Processing Unit", "Computed Processing Utility", "Central Power Utility"],
                CorrectOptionIndex = 0,
                Explanation        = "CPU stands for Central Processing Unit, the primary component that executes instructions in a computer."
            },
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Domain models
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// A fully generated MCQ question ready to be stored and served to students.
    /// </summary>
    public sealed class GeneratedMcq
    {
        [JsonPropertyName("questionText")]
        public string QuestionText { get; set; } = string.Empty;

        [JsonPropertyName("options")]
        public List<string> Options { get; set; } = [];

        /// <summary>Zero-based index into <see cref="Options"/>.</summary>
        [JsonPropertyName("correctOptionIndex")]
        public int CorrectOptionIndex { get; set; }

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        /// <summary>Populated after generation — marks provenance.</summary>
        [JsonPropertyName("generatedBy")]
        public string GeneratedBy { get; set; } = "GroqLLM";
    }

    // ── Internal seed/staging model ───────────────────────────────────────────

    internal sealed class SeedQuestion
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

    // ── Groq request/response DTOs (scoped to synthesizer) ───────────────────

    internal sealed class SynthesizerGroqRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("messages")]
        public List<SynthesizerGroqMessage> Messages { get; set; } = [];

        [JsonPropertyName("temperature")]
        public float Temperature { get; set; } = 0.7f;

        [JsonPropertyName("max_tokens")]
        public int MaxTokens { get; set; } = 2048;

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
}
