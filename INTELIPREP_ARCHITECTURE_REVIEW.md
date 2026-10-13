# IntelliPrep Architecture Review — Viva Preparation

**Scope:** ASP.NET Core backend, admin Question Bank flow, and Flutter student-app tests.  
**Repository root:** `SE3090_2026-AI-57`

## 1. AI agent count and roles

### Short answer

The code uses **five numbered agent slots** (`1a`, `1b`, `2`, `3`, `4`), but **not all five are LLM/AI agents**:

- **Three numbered roles call an LLM:** Agent 1a, Agent 2, and Agent 3.
- **Two numbered components are deterministic:** Agent 1b (statistical calculation) and Agent 4 (validation/retry/persistence).
- The naming is not fully consistent: Agent 2 is called the *Study Planner* in one flow and the *Web Researcher* in another; Agent 3 has two implementations/entry points.

| Label / name | Service and method | Role in the pipeline |
|---|---|---|
| **Agent 1a — Past Paper Analyst** | `backend/IntelliPrep.API/Services/AIAgentService.cs` — `AnalyzePastPapersAsync` | Sends topic names and a year to Groq, parses and validates its returned probability JSON, then saves rows in `PastPaperAnalytics`. This is an LLM estimate, not the deterministic weighting engine. |
| **Agent 1b — Data Analyst** *(deterministic, not an LLM agent)* | `backend/IntelliPrep.API/Services/AIAgentService.cs` — `PredictTopicDistributionAsync` | Reads actual `Questions` rows, groups by topic/year, applies exponential decay to year counts, normalizes weighted scores to probabilities, computes trends, and allocates a 50-question paper using Hamilton's largest-remainder method. |
| **Agent 2 — Study Planner** | `backend/IntelliPrep.API/Services/AIAgentService.cs` — `GenerateStudyPlanAsync` | Reads syllabus limits and derives topic frequencies from `Questions`, injects that context into a Groq prompt, and generates a draft study plan. The plan is created pending admin approval. |
| **Agent 2 — Web Researcher** *(same label reused in the predicted-paper flow)* | `backend/IntelliPrep.API/Services/AIAgentService.cs` — `GatherResearchContextAsync` and its prompt builders | Uses Groq to generate recent-events/scenario context for selected topics for the predicted-paper generator. It is called by `GeneratePredictedPaperAsync`; this implementation prompts the LLM but does not perform a separate web search. |
| **Agent 3 — Predicted Paper Generator** | `backend/IntelliPrep.API/Services/AIAgentService.cs` — `GeneratePredictedPaperAsync` | Chains Agent 1b's distribution, Agent 2's research context, and DB syllabus limits into a prompt for a 50-question MCQ paper. |
| **Agent 3 — Exam Synthesizer** | `backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs` — `SynthesizeAsync` | Generates the requested number of MCQs, using syllabus limits and few-shot examples. Its output is passed to Agent 4. |
| **Agent 4 — Validation Agent** *(deterministic, not an LLM agent)* | `backend/IntelliPrep.API/Services/ValidationAgentService.cs` — `ValidateAndPersistAsync` | Checks exact count, five options, valid/non-empty correct answer index, and nonblank question text. On failure it retries Agent 3 up to two additional times; on success it persists to the exam session. |

The main numbered predicted-paper chain is **Agent 1b → Agent 2 Researcher → Agent 3**. A separate exam-synthesis endpoint uses **Agent 3 → Agent 4**. These routes are exposed in `backend/IntelliPrep.API/Controllers/AIAgentController.cs`.

There are also unnumbered/legacy LLM services: `backend/IntelliPrep.API/Services/PlanningCoordinatorService.cs` generates a workflow plan, and `backend/IntelliPrep.API/Services/ContentSynthesizerService.cs` generates questions for assessment sessions. Therefore, “exactly how many AI agents” depends on whether you mean numbered roles, LLM-calling roles, or all AI-related services. The numbered-slot/LLM distinction above reflects the implementation most accurately.

## 2. Past Paper Analytics probabilities: mocked or dataset-derived?

**The analytics UI is not using a hard-coded/mock probability fixture, but its Agent 1 percentages are LLM-generated estimates—not a deterministic calculation over each question row.** The database supplies the topic names (and question count for cache invalidation); the Agent 1 prompt then sends topic names and year to Groq. It does not send per-topic historical counts or all question records to that LLM call.

Relevant flow:

1. `backend/IntelliPrep.API/Controllers/PastPaperAnalyticsController.cs` — `RunAnalysis` (`POST /api/admin/analytics/analyze`) counts `Questions`, returns cached rows when their `SourceQuestionCount` matches, otherwise selects distinct non-empty `Lesson_Name` values and calls `AnalyzePastPapersAsync`.
2. `backend/IntelliPrep.API/Services/AIAgentService.cs` — `AnalyzePastPapersAsync` calls Groq with the topic list and year, then persists its validated response in `PastPaperAnalytics`.
3. `backend/IntelliPrep.API/Services/AIAgentService.cs` — `BuildAgent1UserMessage` formats only the topic names and year for the prompt.

For a genuinely dataset-calculated probability, use **Agent 1b** at `backend/IntelliPrep.API/Services/AIAgentService.cs` — `PredictTopicDistributionAsync` (exposed by `GET /api/aiagent/predict-distribution`). It loads actual topic/year values from `Questions`, then performs LINQ grouping and weighting in application memory:

```csharp
var rawRows = await _db.Questions
    .AsNoTracking()
    .Where(q => !string.IsNullOrEmpty(q.Lesson_Name) && q.Year > 0)
    .Select(q => new { q.Lesson_Name, q.Year })
    .ToListAsync(cancellationToken);

var grouped = rawRows
    .GroupBy(r => (Topic: r.Lesson_Name.Trim(), Year: r.Year))
    .Select(g => (Topic: g.Key.Topic, Year: g.Key.Year, Count: g.Count()))
    .ToList();
```

It computes each year weight as `exp(k * (year - minYear))`, accumulates `WeightedScore = yearWeight * rawCount`, then calculates:

```csharp
Prob: (t.WeightedScore / totalWeightedScore) * 100.0
```

So **the Past Paper Analytics endpoint's Agent 1 output is an LLM estimate informed by DB-derived topic names; Agent 1b is the deterministic, actual-row-based probability calculation.** The code above fetches rows with EF Core; the subsequent topic/year aggregation and probability formula are LINQ/C# calculations rather than one SQL `GROUP BY` probability query.

## 3. Exam generation: historical questions and syllabus limits

**Yes, Agent 3 loads and injects both into its prompt, with important qualifications.** The implementation is `backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs`.

`SynthesizeAsync` first calls `FetchSyllabusLimitsToolAsync(input.Subject)`, then `LoadSeedQuestionsAsync(input.Subject)`, and passes both into `BuildGroundedPrompt(...)`.

Syllabus retrieval prefers exact topic matches, then partial matches, then all configured limits:

```csharp
var all = await _context.SyllabusLimits.AsNoTracking().ToListAsync();

var exact = all
    .Where(s => s.TopicName.Equals(subject, StringComparison.OrdinalIgnoreCase))
    .ToList();
if (exact.Count > 0) return exact;

var partial = all
    .Where(s => s.TopicName.Contains(subject, StringComparison.OrdinalIgnoreCase)
             || subject.Contains(s.TopicName, StringComparison.OrdinalIgnoreCase))
    .ToList();
return partial.Count > 0 ? partial : all;
```

Historical database examples are fetched by `ReadFromDatabaseAsync`:

```csharp
var rows = await _context.Questions
    .Where(q => EF.Functions.ILike(q.Lesson_Name, $"%{subject}%"))
    .OrderBy(q => q.Year)
    .Take(MaxSeedRows)
    .ToListAsync();
```

The returned rows are mapped to seed-question fields. `BuildGroundedPrompt` writes syllabus `AllowedScope` and `ExcludedKeywords` in **Section 2 — SYLLABUS BOUNDARIES**, and writes the seed question text/options/answer in **Section 3 — HISTORICAL EXAMPLES**. It tells the model the examples are format/difficulty references and to create new questions.

**Qualifications for the viva:**

- Seed source priority is **Excel → PostgreSQL `Questions` → built-in examples**. If Excel has matching rows, database questions are not fetched for that generation. Thus new admin-entered questions are used as seed examples only when the Excel source is absent or has no matching rows.
- Syllabus limits are injected as prompt instructions; this is **not a hard semantic enforcement mechanism**. If fetching limits throws, the tool logs a warning and returns an empty list. The prompt then says to use the standard syllabus.
- Agent 4 does not validate syllabus compliance. Its deterministic checks cover question count, option count, answer index/value, and nonblank question text.

## 4. Question Bank UI and PostgreSQL writes

**Yes: submitting the Admin Question Bank form posts to a role-protected backend endpoint that inserts into the EF `Questions` table.** The relevant paths are:

- UI: `admin-frontend/src/QuestionBankForm.jsx` — `handleSubmit` sends `POST {API_BASE}/api/admin/questions` and includes the stored admin token in its authenticated fetch.
- Backend: `backend/IntelliPrep.API/Controllers/QuestionBankController.cs` — `QuestionBankController.Create` (`[HttpPost]`).
- Persistence model: `backend/IntelliPrep.API/Data/ApplicationDbContext.cs` — `DbSet<Question> Questions`.
- PostgreSQL provider: `backend/IntelliPrep.API/Program.cs` — `UseNpgsql(connectionString)`.

The controller has `[Authorize(Roles = "Admin")]`, validates the request model, builds a `Question`, calls `_db.Questions.AddAsync(...)`, and commits with `_db.SaveChangesAsync(ct)`. The same `Questions` table is read by Agent 1b and by the DB seed loader in `ExamSynthesizerAgent`.

This writes to the PostgreSQL database configured by `ConnectionStrings:DefaultConnection`; whether that is the live/hosted database depends on the deployed connection-string configuration. Also, while the endpoint is Admin-role protected and has request validation, the AI seed loader may prefer matching Excel rows over these new DB rows as described above.

## 5. Testing architecture

### Backend — xUnit

Test project: `backend/IntelliPrep.Tests/` (`net8.0`, xUnit).

| Test file | What it tests |
|---|---|
| `backend/IntelliPrep.Tests/ValidationAgentTests.cs` | Pure deterministic `ValidationAgentService.RunDeterministicChecks` behavior: valid output, wrong question count, wrong option count, invalid correct-option index, and blank question text. |
| `backend/IntelliPrep.Tests/AgentRetryPolicyTests.cs` | Confirms the `MaxRetries` constant is two, plus empty-list count failure and valid single-question success. It does not exercise the full LLM retry loop. |
| `backend/IntelliPrep.Tests/AuthDtoValidationTests.cs` | Data-annotation validation for registration/login and admin student-creation DTOs; also tests camel-case JSON binding for Flutter login and React student-creation payloads. |

### Flutter — `flutter_test`

Test directory: `student_app/test/`.

| Test file | What it tests |
|---|---|
| `student_app/test/api_constants_test.dart` | Email normalization: whitespace/case normalization while preserving local-part punctuation. |
| `student_app/test/auth_flows_test.dart` | API endpoint construction, login form and 401 diagnostic handling, forgot-password OTP request/verification success and error states. HTTP is stubbed; no live network is required. |
| `student_app/test/widget_test.dart` | Top-level app renders and shows the branded splash/loading state without crashing. |
| `student_app/test/ui_redesign_test.dart` | UI regression coverage for dashboard success/failure states, narrow screens/large text/keyboard, exam navigation and offline answer caching, review states, and legacy cached questions without answer metadata. |

**Coverage boundary:** the committed test inventory has unit/widget tests, but no visible integration test proving the live PostgreSQL Question Bank write, analytics query end-to-end, generated exam JSON contract against Groq, or the full Agent 4 retry/persist orchestration.
