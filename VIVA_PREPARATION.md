# IntelliPrep — Complete Viva Preparation Guide

**Prepared:** 12 October 2026  
**Purpose:** A source-grounded guide for explaining the four members' contributions, the full-stack architecture, the AI workflows, security, data flow, tests, deployment, and known gaps.

> **Use this as a map, not as a substitute for reading the code.** The responsibility descriptions below come from the team allocation supplied for the viva. The file references and implementation notes were checked against the repository. Where the allocation and current implementation do not exactly match, the discrepancy is called out rather than presented as completed functionality.

## 1. Project in one minute

IntelliPrep is an A/L ICT exam-preparation platform with three main user-facing pieces:

1. A **React admin portal** for student management, exam/session administration, question-bank management, study-plan review, analytics, and student marks.
2. An **ASP.NET Core 8 Web API** using Entity Framework Core and PostgreSQL. It handles authentication, data access, exam lifecycle endpoints, admin workflows, and calls to Groq for AI-supported tasks.
3. A **Flutter student app** for login, dashboard/progress, QR-based exam access, timed exams, cached exam data, profile management, and answer review.

The AI functionality is not one autonomous agent swarm. It is a set of backend services with explicit request/response contracts. Controllers and services orchestrate the calls, store structured results, and—in important workflows—require an administrator to review or approve AI-generated output before students can use it.

### Architecture at a glance

```text
React Admin Portal ───────┐
                          ├── HTTPS / JSON ── ASP.NET Core API ── EF Core ── PostgreSQL
Flutter Student App ──────┘                         │
                                                   ├── Groq API (configured LLM calls)
                                                   ├── SMTP (password verification/notifications)
                                                   └── Excel dataset → Question records

Admin exam path:
ExamSessions UI → request-exam → PlanningCoordinatorService
               → synthesize-exam → ExamSynthesizerAgent (Agent 3)
               → ValidationAgentService (Agent 4) → human approval → Ready/QR

Student path:
Login/JWT → QR/session access → timer → submit → own-results → review/progress
```

## 2. Team contribution map

The table reflects the allocation provided by the team. A student may be asked about shared integration files even if another member implemented them.

| Member | Allocated responsibility | Main code areas to study |
|---|---|---|
| **1. PERERA K.S.D. (IT24102735)** | Architecture, student management, initial database setup, CI/CD, Planning Coordinator orchestration | `admin-frontend/src/StudentManagement.jsx`; `backend/IntelliPrep.API/Controllers/StudentManagementController.cs`; `backend/IntelliPrep.API/Services/PlanningCoordinatorService.cs`; `backend/IntelliPrep.API/Controllers/AssessmentController.cs`; `backend/IntelliPrep.API/Program.cs`; `backend/IntelliPrep.API/Data/ApplicationDbContext.cs`; `.github/workflows/ci.yml` |
| **2. MUTHUMALI R.M.P.V. (IT24103114)** | Study-plan management, Agent 2, dashboard/marks statistics, mobile review UI | `admin-frontend/src/StudyPlanManager.jsx`; `admin-frontend/src/StudentMarks.jsx`; `admin-frontend/src/Dashboard.jsx`; `backend/IntelliPrep.API/Services/AIAgentService.cs`; `backend/IntelliPrep.API/Services/IAIAgentService.cs`; `backend/IntelliPrep.API/Controllers/AIAgentController.cs`; `backend/IntelliPrep.API/Models/StudyPlan.cs`; `student_app/lib/screens/exam_review_screen.dart` |
| **3. Nawanjana W.M.S (IT24103074)** | Exam Synthesizer, dataset/seeding, exam sessions, core mobile exam interfaces | `admin-frontend/src/ExamSessions.jsx`; `admin-frontend/src/PendingApprovals.jsx`; `backend/IntelliPrep.API/Controllers/AssessmentController.cs`; `backend/IntelliPrep.API/Controllers/ExamSessionController.cs`; `backend/IntelliPrep.API/Services/ContentSynthesizerService.cs`; `backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs`; `backend/IntelliPrep.API/Data/DatabaseSeeder.cs`; `backend/IntelliPrep.API/Models/ExamSession.cs`; `student_app/lib/screens/exam_timer_screen.dart`; `student_app/lib/screens/qr_scanner_screen.dart` |
| **4. KENAN K.L.D.M. (IT24102194)** | JWT authentication, Agent 4 validation, past-paper analytics, question bank | `admin-frontend/src/Login.jsx`; `admin-frontend/src/AdminLogin.jsx`; `admin-frontend/src/QuestionBankForm.jsx`; `admin-frontend/src/UserManagement.jsx`; `admin-frontend/src/PastPaperAnalytics.jsx`; `backend/IntelliPrep.API/Controllers/AuthController.cs`; `backend/IntelliPrep.API/DTOs/AuthDTOs.cs`; `backend/IntelliPrep.API/Services/ValidationAgentService.cs`; `backend/IntelliPrep.API/Controllers/PastPaperAnalyticsController.cs`; `backend/IntelliPrep.API/Controllers/QuestionBankController.cs`; `backend/IntelliPrep.Tests/ValidationAgentTests.cs` |

### Shared files everyone should know

- [API startup, JWT, CORS, dependency injection, and middleware](backend/IntelliPrep.API/Program.cs)
- [EF Core context and entity sets](backend/IntelliPrep.API/Data/ApplicationDbContext.cs)
- [Student and exam APIs, including results and submission](backend/IntelliPrep.API/Controllers/StudentController.cs)
- [AI endpoint orchestration](backend/IntelliPrep.API/Controllers/AIAgentController.cs)
- [Assessment lifecycle and admin approvals](backend/IntelliPrep.API/Controllers/AssessmentController.cs)
- [Flutter startup and saved-token routing](student_app/lib/main.dart)
- [Flutter home, dashboard, progress, and API calls](student_app/lib/screens/home_screen.dart)
- [Flutter API URL configuration](student_app/lib/api_constants.dart)
- [Current deployment environment-variable guide](backend/README.md)
- [CI jobs](.github/workflows/ci.yml)

## 3. Member-by-member viva notes

## Member 1 — Architecture, Student Management, CI/CD, Planning Coordinator

### What the student-management feature does

The React student directory lists student users and supports creating, editing, and deleting student accounts. The React modal posts JSON to `POST /api/admin/students`. The backend validates the request, normalizes the email, checks for duplicates, hashes the initial password with BCrypt, assigns the `Student` role, and saves the user through EF Core.

The source to follow is:

- [StudentManagement.jsx](admin-frontend/src/StudentManagement.jsx)
- [StudentManagementController.cs](backend/IntelliPrep.API/Controllers/StudentManagementController.cs)
- [User.cs](backend/IntelliPrep.API/Models/User.cs)
- [ApplicationDbContext.cs](backend/IntelliPrep.API/Data/ApplicationDbContext.cs)
- [AuthDtoValidationTests.cs](backend/IntelliPrep.Tests/AuthDtoValidationTests.cs)

The student-management endpoint is protected with `[Authorize(Roles = "Admin")]`. The initial password is not stored as plaintext; it is converted to `PasswordHash`.

### Architecture and CI/CD explanation

`Program.cs` configures the PostgreSQL provider, JWT bearer authentication, authorization, controllers/JSON options, CORS, Swagger, dependency injection for the AI and mail services, and the HTTP request pipeline. The database access pattern is controller/service → `ApplicationDbContext` → EF Core → PostgreSQL.

The GitHub Actions workflow has **two jobs**:

1. `backend`: checks out code, installs .NET 8, restores, builds the solution in Release, then runs xUnit tests.
2. `flutter`: checks out code, installs stable Flutter 3.x, fetches packages, and runs Flutter tests.

The current `ci.yml` does **not** include a React build/lint job, deployment job, or a live PostgreSQL integration-test service. Do not claim those jobs exist.

### Planning Coordinator — what it really does

`PlanningCoordinatorService.GenerateExamPlanAsync` sends an objective to Groq and expects a JSON plan describing queued work for a content synthesizer, a validator, and human tutor approval. It parses/validates the response and has a deterministic fallback when the provider call fails.

It is called by `AssessmentController.RequestExam`, which creates an `ExamSession` scaffold and returns the generated plan. **The JSON plan is not itself a runtime workflow engine that dispatches every listed step.** Actual exam synthesis and validation happen through separately invoked API endpoints/services (including `AIAgentController` → Agent 3 → Agent 4).

### Suggested viva answer

> “The Planning Coordinator accepts the exam objective and asks Groq for a structured workflow plan. The API validates or falls back from that response, creates the session scaffold, and exposes the plan to the admin UI. The actual question-generation workflow is orchestrated by separate API calls and services, so the Coordinator’s JSON is a plan artifact—not a background queue that executes the other agents automatically.”

### Likely questions

**How does CI work?**  
Explain the backend and Flutter jobs, their restore/build/test sequence, and that they run on pushes and pull requests. Be precise that React and deployment are not currently jobs in this workflow.

**How is an admin-created student stored?**  
React sends the DTO-shaped JSON; the controller validates it, lowercases/trims email, checks duplicates, BCrypt-hashes the password, sets role `Student`, and persists through EF Core.

**How should exposed API keys be handled?**  
Revoke/rotate the exposed key immediately at its provider, update deployment secrets, remove it from the current source, and purge it from Git history if it was committed. Also inspect forks, CI logs/artifacts, and other copies; then monitor provider usage. A secret added to a later commit is still present in earlier Git history. The repository’s Render config guide documents environment-based secrets in [backend/README.md](backend/README.md). Only say this incident was fully remediated if you can show the rotation and history-cleanup evidence.

## Member 2 — Study Plans, Dashboard/Marks, Agent 2, Mobile Review

### Study-plan lifecycle

The study-plan manager sends a request to `POST /api/aiagent/generate-plan`. The Study Planner service loads syllabus limits and historical question-topic counts from PostgreSQL, includes this material in its prompt, requests a seven-day JSON schedule, parses and validates the response, and persists it as a `StudyPlan`.

The plan is not immediately student-visible. An administrator reviews/edits and approves it via `PUT /api/aiagent/approve-plan/{planId}`, then publishes it via `PUT /api/aiagent/publish-plan/{planId}`. The student app calls `GET /api/student/my-plan` and sees an approved, published plan. The API also permits a general plan with `StudentId == 0` to be returned to any student if it is the latest eligible plan.

Read:

- [StudyPlanManager.jsx](admin-frontend/src/StudyPlanManager.jsx)
- [AIAgentController.cs](backend/IntelliPrep.API/Controllers/AIAgentController.cs)
- [AIAgentService.cs](backend/IntelliPrep.API/Services/AIAgentService.cs)
- [IAIAgentService.cs](backend/IntelliPrep.API/Services/IAIAgentService.cs)
- [StudyPlan.cs](backend/IntelliPrep.API/Models/StudyPlan.cs)
- [StudentController.cs](backend/IntelliPrep.API/Controllers/StudentController.cs)
- [home_screen.dart](student_app/lib/screens/home_screen.dart)

### Dashboard and marks

The admin dashboard reads data from student, assessment-session, and study-plan APIs. The student marks page reads `GET /api/admin/marks`. Its API response includes session/exam title, subject, score, question-count-derived max score, duration, submission time, student name/email, and profile-image URL. The current marks page displays the student's initials; the API profile image is not currently wired into that table UI.

The student's progress tab calls `GET /api/student/my-results`; the review screen decodes questions and answers and renders correct/incorrect/unanswered states and explanations.

### Mobile review

The review screen is the presentation layer for a submitted or cached attempt. It does not generate the answer key; question JSON must already contain correct-answer metadata. The exam execution screen stores exam/answer state and can cache exam records locally. Newer cache records preserve `correctOptionIndex`; older records without it should show that correctness is unavailable instead of guessing an answer.

Read:

- [StudentMarks.jsx](admin-frontend/src/StudentMarks.jsx)
- [Dashboard.jsx](admin-frontend/src/Dashboard.jsx)
- [exam_review_screen.dart](student_app/lib/screens/exam_review_screen.dart)
- [home_screen.dart](student_app/lib/screens/home_screen.dart)
- [exam_timer_screen.dart](student_app/lib/screens/exam_timer_screen.dart)
- [ui_redesign_test.dart](student_app/test/ui_redesign_test.dart)

### Likely questions

**How do you constrain an LLM to output JSON?**  
Use explicit system instructions and a strict schema, request JSON-only output, strip code fences/wrappers where appropriate, deserialize into typed DTOs, and validate the structure and semantics before persistence. Prompt instructions alone are not a correctness guarantee.

**How is a study plan approved?**  
The generated plan is stored unapproved, the admin can review/update it, approval records admin and time, and publication makes it visible to the student API. This is human-in-the-loop control.

**How are dashboard statistics calculated?**  
Identify the actual endpoint and query for the card/table being discussed. Do not call a periodic page fetch “real-time” unless it uses a real-time transport such as SignalR or a subscription; the checked React dashboard uses HTTP API fetches.

## Member 3 — Exam Synthesis, Dataset, Sessions, Core Mobile Exam

### Dataset ingestion

`DatabaseSeeder.SeedQuestionsAsync` first checks whether the `Questions` table already has data and skips import if it does. Otherwise it searches expected paths for the Excel workbook, opens the expected worksheet (or first worksheet), maps columns by header names, rejects blank/duplicate question IDs, parses year/options/correct answer/image metadata, and bulk-saves valid rows. If the file is missing, it inserts built-in fallback questions.

Relevant files:

- [DatabaseSeeder.cs](backend/IntelliPrep.API/Data/DatabaseSeeder.cs)
- [Question.cs](backend/IntelliPrep.API/Models/Question.cs)
- [ExamSynthesizerAgent.cs](backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs)
- [dataset README](backend/IntelliPrep.API/Data/Datasets/README.md)

The workbook filename is `2011-2025_ICT_Master_Dataset_Complete.xlsx`, while the seeder targets worksheet `2015_2025_ICT_Master_Dataset_CL`. Verify the actual workbook contents before claiming a precise number of years or rows; a filename alone is not evidence that every year is present.

### Exam session and mobile exam features

An exam session stores identifiers, subject/title, status, duration, timer lock/start/end times, question JSON, answer JSON, score, and optional objective fields. The admin UI requests and prepares exams, QR access becomes available after approval, and the Flutter app scans the code, loads questions, displays the timer, stores selected answers, submits, then routes to review.

The main references:

- [ExamSessions.jsx](admin-frontend/src/ExamSessions.jsx)
- [PendingApprovals.jsx](admin-frontend/src/PendingApprovals.jsx)
- [AssessmentController.cs](backend/IntelliPrep.API/Controllers/AssessmentController.cs)
- [ExamSessionController.cs](backend/IntelliPrep.API/Controllers/ExamSessionController.cs)
- [ExamSession.cs](backend/IntelliPrep.API/Models/ExamSession.cs)
- [ContentSynthesizerService.cs](backend/IntelliPrep.API/Services/ContentSynthesizerService.cs)
- [ExamSynthesizerAgent.cs](backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs)
- [qr_scanner_screen.dart](student_app/lib/screens/qr_scanner_screen.dart)
- [exam_timer_screen.dart](student_app/lib/screens/exam_timer_screen.dart)
- [exam_review_screen.dart](student_app/lib/screens/exam_review_screen.dart)

There are two synthesis implementations:

1. The newer `ExamSynthesizerAgent` uses syllabus constraints and seed questions and is called through the Agent 3 → Agent 4 pipeline.
2. The older `ContentSynthesizerService` has a separate endpoint on `AssessmentController`.

Be ready to identify which UI button and endpoint use which path; do not describe them as one implementation.

### Likely questions

**How does the timer prevent two starts?**  
Describe the status/timer-lock checks and state transition used by the specific timer endpoint. The current code has both Assessment and Student timer APIs; know which endpoint the Flutter `ExamTimerScreen` calls.

**How is the dataset cleaned?**  
The seeder relies on header mapping, trims cell text, skips blank IDs/text and duplicate IDs, and parses numeric year/correct-option fields. It can fall back to built-in rows if the workbook cannot be located.

**How does the Flutter app handle API latency?**  
Describe the actual async request/loading state in `ExamTimerScreen` and the QR flow. Avoid claiming that this screen uses `FutureBuilder` unless a specific `FutureBuilder` is present in the code path being discussed.

## Member 4 — Authentication, Validation Agent, Analytics, Question Bank

### Authentication and authorization

`AuthController` normalizes email before database lookup, verifies BCrypt hashes, and issues a signed JWT containing identity and role claims. `Program.cs` validates issuer, audience, lifetime, and signing key. Admin and student controllers/endpoints use role authorization attributes to limit access.

Read:

- [AuthController.cs](backend/IntelliPrep.API/Controllers/AuthController.cs)
- [AuthDTOs.cs](backend/IntelliPrep.API/DTOs/AuthDTOs.cs)
- [User.cs](backend/IntelliPrep.API/Models/User.cs)
- [Program.cs](backend/IntelliPrep.API/Program.cs)
- [Login.jsx](admin-frontend/src/Login.jsx)
- [AdminLogin.jsx](admin-frontend/src/AdminLogin.jsx)
- [login_screen.dart](student_app/lib/screens/login_screen.dart)
- [auth_flows_test.dart](student_app/test/auth_flows_test.dart)

The Flutter app currently stores the token in `SharedPreferences`, and the admin frontend stores its token in `localStorage`. These are convenient persistence mechanisms but are not encrypted vaults. For stronger production storage, consider OS secure storage on mobile and an HttpOnly, Secure, SameSite cookie strategy for a browser app.

### Agent 4 validation

`ValidationAgentService` invokes Agent 3, then deterministically checks the output. It verifies the exact requested number of questions, exactly five options per question, a valid/non-empty correct option index, and non-empty question text. If validation fails, it passes the error summary back to Agent 3 for correction. `MaxRetries = 2` means **up to three total synthesis attempts**: the first attempt plus two retries. Failed output is not persisted. Successful output is saved to `ExamSession.QuestionsJson` with status `PendingAdminApproval`.

Read:

- [ValidationAgentService.cs](backend/IntelliPrep.API/Services/ValidationAgentService.cs)
- [ExamSynthesizerAgent.cs](backend/IntelliPrep.API/Services/ExamSynthesizerAgent.cs)
- [AIAgentController.cs](backend/IntelliPrep.API/Controllers/AIAgentController.cs)
- [ValidationAgentTests.cs](backend/IntelliPrep.Tests/ValidationAgentTests.cs)
- [AgentRetryPolicyTests.cs](backend/IntelliPrep.Tests/AgentRetryPolicyTests.cs)

### Analytics and question bank

The past-paper analytics controller supports viewing and managing analytics rows and triggering an analysis run. The question-bank controller exposes admin CRUD-style endpoints over question records. The frontend pages are `PastPaperAnalytics.jsx` and `QuestionBankForm.jsx`.

Read:

- [PastPaperAnalytics.jsx](admin-frontend/src/PastPaperAnalytics.jsx)
- [PastPaperAnalyticsController.cs](backend/IntelliPrep.API/Controllers/PastPaperAnalyticsController.cs)
- [PastPaperAnalytic.cs](backend/IntelliPrep.API/Models/PastPaperAnalytic.cs)
- [QuestionBankForm.jsx](admin-frontend/src/QuestionBankForm.jsx)
- [QuestionBankController.cs](backend/IntelliPrep.API/Controllers/QuestionBankController.cs)
- [ValidationAgentTests.cs](backend/IntelliPrep.Tests/ValidationAgentTests.cs)

### Likely questions

**Why not show “email not found” separately from “wrong password”?**  
Returning one generic 401 response makes it harder to enumerate registered accounts. Server logs can record a safe diagnostic reference without logging a password or exposing account existence to an unauthenticated caller.

**How does BCrypt help?**  
It stores a salted, computationally expensive password hash rather than the password itself. During login, the supplied password is verified against the stored hash; it is not decrypted.

**How do you avoid an infinite Agent 3 retry loop?**  
The maximum is two retries after the initial call, so there are at most three synthesis attempts. The service returns a failure without persisting after exhaustion.

## 4. AI agents: clarify the naming and the real connections

The repository uses agent labels in more than one workflow. State the exact class/method and endpoint when discussing an agent.

| Code/service name | What it actually does | Connection |
|---|---|---|
| **PlanningCoordinatorService** | Calls Groq to return a JSON workflow plan for an objective, with a fallback plan on provider/JSON failure. | Called from `AssessmentController.RequestExam`; it returns a plan artifact and session scaffold. It does not automatically dispatch every step in the plan. |
| **AIAgentService Agent 1 / 1a** | Past-paper analyst that asks the LLM for topic probabilities, parses/validates them, then replaces agent-generated analytics rows. | Called from `POST /api/aiagent/analyze-papers`. |
| **AIAgentService Agent 1b** | Deterministic data analyst that groups the `Questions` table by topic/year, applies recency weighting, allocates a 50-question distribution, and labels trends. | Called by `GET /api/aiagent/predict-distribution` and internally by predicted-paper generation. |
| **AIAgentService Agent 2 — Study Planner** | Builds a seven-day study plan using database syllabus limits and question-topic frequencies as context, then validates the returned plan structure. | Called by `POST /api/aiagent/generate-plan`; persisted plan then requires admin approval/publication. |
| **AIAgentService research step** | Calls Groq to produce structured recent-event/trend context. Despite the “Web Researcher” label, the inspected method calls the LLM; it does not itself call a web-search API. | Internally used by predicted-paper generation; fallback context allows the pipeline to continue. |
| **AIAgentService predicted-paper generator** | Uses distribution + research context + syllabus constraints to request/validate a predicted 50-question paper. | `POST /api/aiagent/generate-paper`; this is a separate path and not the persisted ExamSession Agent 3 → Agent 4 path. |
| **ExamSynthesizerAgent — Agent 3** | Uses `SyllabusLimits` and Excel/DB/built-in seed examples to create MCQs through Groq. | Called by `ValidationAgentService`; does not persist the final session itself. |
| **ValidationAgentService — Agent 4** | Deterministic structure/content checks, bounded regeneration loop, then writes only passing output to the session. | Calls Agent 3 and is triggered by `POST /api/aiagent/synthesize-exam/{sessionId}`. |

### Exam generation flow to draw on a whiteboard

```text
Admin ExamSessions page
  └─ POST /api/assessment/request-exam (Admin)
       ├─ PlanningCoordinatorService → Groq JSON workflow-plan artifact
       └─ creates ExamSession scaffold (Pending)

Admin triggers synthesis
  └─ POST /api/aiagent/synthesize-exam/{sessionId} (Admin)
       └─ AIAgentController
            └─ ValidationAgentService (up to 3 attempts total)
                 └─ ExamSynthesizerAgent (Agent 3)
                      ├─ FetchSyllabusLimits from PostgreSQL
                      ├─ Seed questions from Excel → DB → built-in fallback
                      └─ Groq generates question JSON
                 ├─ deterministic count/options/answer-index/text checks
                 └─ pass: persist QuestionsJson; set PendingAdminApproval

Admin reviews/edits
  └─ PUT /api/assessment/approve/{sessionId} (Admin)
       └─ optional edited questions/title; status becomes Ready

Student
  └─ scan QR → load/start/timer → answer → submit
       └─ GET /api/student/my-results → progress/review
```

### Predicted-paper flow is different

```text
POST /api/aiagent/generate-paper
  ├─ Agent 1b deterministic historical topic distribution
  ├─ Groq research-context step for top topics (fallback on failure)
  ├─ database syllabus limits injected into the generator prompt
  └─ generated MCQs parsed and validated, returned as a result
```

Do not say the predicted-paper endpoint automatically creates a ready QR exam session; it returns a predicted-paper result through a separate AI service path.

## 5. Database and API facts worth memorizing

### Main EF Core sets

`ApplicationDbContext` exposes `Users`, `PasswordResetTokens`, `ExamSessions`, `StudentProfiles`, `Questions`, `SyllabusLimits`, `PastPaperAnalytics`, and `StudyPlans`.

Main entities:

- [User.cs](backend/IntelliPrep.API/Models/User.cs): identity, email, password hash, role, profile/contact fields.
- [StudentProfile.cs](backend/IntelliPrep.API/Models/StudentProfile.cs): student preferences and total points; its `UserId` is a string.
- [ExamSession.cs](backend/IntelliPrep.API/Models/ExamSession.cs): exam lifecycle state, question/answer JSON, timer and score.
- [Question.cs](backend/IntelliPrep.API/Models/Question.cs): historical question data and answer/options.
- [StudyPlan.cs](backend/IntelliPrep.API/Models/StudyPlan.cs): schedule JSON plus approval/publication metadata.
- [PastPaperAnalytic.cs](backend/IntelliPrep.API/Models/PastPaperAnalytic.cs): topic/year probabilities and provenance.
- [ApplicationDbContext.cs](backend/IntelliPrep.API/Data/ApplicationDbContext.cs)
- [Migrations/](backend/IntelliPrep.API/Migrations/)

### Important API routes

| Route | Purpose | Access as implemented |
|---|---|---|
| `POST /api/auth/login` | Student/admin credential login and JWT issue | Public |
| `POST /api/admin/students` and related CRUD | Admin student directory | Admin role |
| `POST /api/assessment/request-exam` | Create exam scaffold / planning result | Admin role |
| `POST /api/aiagent/synthesize-exam/{id}` | Agent 3 → Agent 4 synthesis | Admin role (controller-level authorization) |
| `PUT /api/assessment/approve/{id}` / `reject/{id}` | Human exam approval | Admin role |
| `GET /api/admin/marks` | All completed submissions for marks dashboard | Admin role |
| `POST /api/aiagent/generate-plan` | Generate seven-day plan | Admin role (controller-level authorization) |
| `PUT /api/aiagent/approve-plan/{id}` / `publish-plan/{id}` | Study-plan review and release | Admin role (controller-level authorization) |
| `GET /api/student/my-plan` / `my-results` | Student-specific plan/results | Student role |
| `GET /api/student/papers/join/{accessCode}` | Load an exam identified by QR access code | QR/access-code flow; no JWT attribute on the inspected action |
| `POST /api/student/submit` | Submit mobile exam answers/result | Student role in the current controller |

Always check controller/action attributes before saying that “all endpoints require JWT.” Access policy is endpoint-specific.

## 6. Security, reliability, and honest caveats

These are useful viva discussion points. Explain them as known implementation constraints or follow-up work, not as features already solved.

1. **Exam ownership and old endpoint overlap:** The current student results endpoint filters by the authenticated user ID through `ExamSession.StudentId` and the matching `StudentProfile.UserId`. The Flutter submit route is the authorized `POST /api/student/submit`. There is also a legacy `POST /api/assessment/submit` path that accepts session ID/score without an equivalent student ownership check in the inspected action. Review and secure or retire duplicate legacy routes before claiming every submission path is protected.
2. **Server-side score integrity:** The student submission DTO contains a client-supplied score, and the inspected student submit action stores that score. For a high-stakes exam, the server should calculate/verify the score from trusted answer-key data rather than trust the mobile client.
3. **QR code as bearer access:** The QR join/start flow uses a session access code and some actions do not require a JWT. Anyone who obtains the code may be able to access the session. Treat codes as secrets, limit their lifetime/use, and enforce server-side ownership/session rules as appropriate.
4. **User/profile relation:** `StudentProfile.UserId` is a string, and `ExamSession` has `StudentProfileId` plus a legacy string `StudentId`; the inspected model has no `ExamSession.User` navigation property. Admin marks enriches names/images using explicit lookups rather than `.Include(s => s.User)`. A normalized FK/navigation relationship would make ownership and joins less ambiguous.
5. **Marks image display:** The marks API includes `profileImageUrl`; the current Student Marks table renders initials instead of using that URL.
6. **Study-plan broad fallback:** `GET /api/student/my-plan` accepts a published general template (`StudentId == 0`) as a fallback. Explain that intentional shared-plan behavior if asked; it is different from strictly personal plans.
7. **Token storage:** Flutter `SharedPreferences` and browser `localStorage` are not encrypted secret stores. Production hardening should use platform-protected mobile storage and an appropriate browser cookie strategy.
8. **Migrations at startup:** `Program.cs` contains a commented-out `Database.MigrateAsync()` call. Do not claim the API automatically applies migrations at every startup. Confirm how the deployment database is migrated before release.
9. **Mail configuration:** SMTP settings selected in `appsettings.json` are blank. Password verification email needs deployment environment variables such as `EmailSettings__SmtpUser`, `EmailSettings__SmtpPassword`, and `EmailSettings__FromEmail`. Never commit or paste real credentials.
10. **AI output:** LLM output is probabilistic and can be malformed or factually wrong. JSON parsing and deterministic structure checks improve reliability but do not prove factual correctness; human review remains important.
11. **PII-safe logging:** Never log passwords, access tokens, raw reset codes, or full sensitive payloads. Use correlation IDs and redacted diagnostic metadata.

### If asked whether API keys were committed

Answer with the incident process, not an unsupported claim:

> “A committed secret is considered compromised even if the repository later removes it. We revoke and rotate it at the provider, move the replacement to deployment secrets, remove it from Git history, check forks/logs/artifacts, and monitor usage. We do not place the replacement in source or chat.”

If the examiner asks whether it happened in this project, cite verifiable provider/audit/history evidence; do not infer that cleanup occurred merely because `appsettings.json` currently has blank values.

## 7. Likely cross-project viva questions with model answers

### How do the three clients communicate?

React and Flutter send HTTPS JSON requests to the ASP.NET Core API. Controllers bind request JSON into DTOs, validate authorization and input, call services/EF Core, and return JSON status/results. The Flutter app sends a bearer token on protected requests; the admin frontend includes its admin token for protected API calls.

### How does the API know the logged-in user?

After successful credential validation, the API creates a signed JWT with identity/role claims. JWT bearer middleware validates signing key, issuer, audience, and expiry. `[Authorize]` enforces authentication; `[Authorize(Roles = "Admin")]` or `Student` enforces role. The API extracts the user ID from `ClaimTypes.NameIdentifier` for owner-scoped operations.

### How is a password verified?

The API loads the user using normalized email and passes the supplied password plus stored BCrypt hash to `BCrypt.Verify`. Password hashes are one-way salted verifiers, not encrypted passwords. Both missing users and wrong passwords should have a generic response.

### What does human-in-the-loop mean here?

AI-generated plans/questions are not released immediately. The API saves them in a pending state. An administrator reviews or edits them, approves, and in the study-plan flow publishes the approved plan. This adds a human quality gate before student access.

### Why use both an LLM and deterministic validation?

The LLM is good at generating contextual content, but output can violate a schema or constraints. Deterministic code can reliably check counts, options, answer indices, and required text; bounded retries request corrections. The LLM cannot override the final validation rules.

### How does the app cope with LLM/API failure?

Explain the specific service: Planning Coordinator can return a deterministic fallback plan; the exam synthesizer has seed/fallback paths; Agent 4 fails without persisting invalid output after its retry limit; the predicted-paper research context can fall back. These are different fallbacks, not one global failure policy.

### What is Lite-RAG in this project?

It means retrieving relevant structured context from the project database (such as syllabus constraints and topic frequencies) and inserting it into the LLM prompt. It is not a vector database or embedding-based semantic search in the described Study Planner path.

### How is the timer secured?

Describe the exact endpoint used by the mobile app and its state checks/locking behavior. Also acknowledge that the codebase contains legacy overlapping timer/submission endpoints and that all routes must receive consistent authorization/ownership checks before calling the overall system secure.

### How would you test student result isolation?

Create two students with distinct JWT subject IDs, submit one result per user, call `GET /api/student/my-results` with each token, and assert each response contains only that user's rows. Also test missing/invalid claims, missing profiles, legacy sessions, and attempts to submit another user's session. These integration tests should use a disposable test database or repository test doubles, not production data.

## 8. Tests currently present and how to run them

### Backend

Existing xUnit tests cover:

- DTO validation and React/Flutter camelCase JSON binding.
- Agent 4 deterministic checks: count, number of options, correct-answer index, and blank question text.
- Agent retry-policy limit.

From `backend`:

```powershell
dotnet test IntelliPrep.sln
```

The repository does not currently show a dedicated integration test for student result isolation or admin marks projection. Those would be valuable additions.

### Flutter

Tests cover API URL/email normalization, login diagnostics and auth-flow UI, OTP error handling, responsive UI states, exam submission/review, and legacy offline-cache answer behavior.

From `student_app`:

```powershell
flutter pub get
flutter test
flutter analyze
```

### React

From `admin-frontend`:

```powershell
npm ci
npm run lint
npm run build
```

The React project currently has no dedicated test script in `package.json`. The current GitHub Actions workflow also does not run these frontend commands.

## 9. Local development and deployment facts

- Backend target framework: .NET 8; database provider: Npgsql/EF Core; API keys and connection values should be environment secrets.
- Flutter dependencies and platform setup are under `student_app`; `API_BASE_URL` can override the default API host at compile time.
- React uses Vite; `VITE_API_URL` selects the backend origin during the frontend build.
- Render deployment uses environment variables such as `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `GroqSettings__ApiKeys__0`, and `PasswordReset__HashKey`. The complete list is in [backend/README.md](backend/README.md).
- Never include real database passwords, JWT signing keys, Groq keys, SMTP credentials, reset-hash keys, or student data in the viva slides, source control, screenshots, or public recordings.
- Check health at `/health`; inspect the deployed OpenAPI JSON/Swagger to confirm which API build is running.

## 10. Final preparation checklist for each member

- [ ] Be able to open every file listed under your contribution and point to the key method.
- [ ] Explain one normal request flow from UI → HTTP endpoint → DTO/controller → service → database/provider → response.
- [ ] Draw the student/admin roles and state which endpoints enforce each role.
- [ ] Explain one failure path and what the UI/API returns.
- [ ] Know the exact test that supports each reliability claim.
- [ ] Distinguish code implemented from planned or allocated responsibilities.
- [ ] Be candid about the duplicated exam flows, client-trusted score, QR bearer access, migration handling, and token-storage limitations.
- [ ] Never show deployment secrets or real student records during the viva.

**Strong viva practice:** each member should explain their assigned feature in 2–3 minutes, then answer one integration question about how their feature hands data to the next layer/member.
