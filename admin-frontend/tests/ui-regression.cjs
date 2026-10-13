/* Isolated UI regression checks. Uses an externally installed Playwright.
 * Run from the project root with PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE set
 * when those tools are not available at their default locations. No live API
 * is contacted. Fixtures live only in tests/ui-fixtures.cjs.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixtures = require("./ui-fixtures.cjs");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.UI_TEST_PORT || 4317);
const origin = `http://127.0.0.1:${port}`;
const results = [];
let browser;

async function createPage({
  width = 1440,
  height = 1000,
  authenticated = true,
  mode = "data",
} = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = structuredClone(fixtures);
  state.calls = [];
  state.mode = mode;
  state.loginRole = "Admin";
  state.failure = null;
  if (authenticated)
    await page.addInitScript(() =>
      localStorage.setItem("admin_token", "synthetic-ui-test-token"),
    );
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const p = url.pathname;
    if (!p.startsWith("/api/")) {
      if (url.origin !== origin) return route.abort();
      return route.continue();
    }
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    state.calls.push({
      path: p,
      method,
      body,
      authorization: req.headers().authorization,
    });
    const send = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (state.mode === "error" || state.failure === p)
      return send({ message: "Service unavailable for this test." }, 503);
    const empty = state.mode === "empty";
    if (p === "/api/auth/login")
      return send({ role: state.loginRole, token: "synthetic-ui-test-token" });
    if (p === "/api/admin/students") {
      if (method === "POST") {
        const student = { id: 99, ...body, createdAt: "2026-10-10" };
        state.students.push(student);
        return send({ message: "Student account created successfully." }, 201);
      }
      return send(empty ? [] : state.students);
    }
    if (/^\/api\/admin\/students\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      if (method === "PUT")
        state.students = state.students.map((item) =>
          item.id === id ? { ...item, ...body } : item,
        );
      if (method === "DELETE")
        state.students = state.students.filter((item) => item.id !== id);
      return send({ message: "Student updated successfully." });
    }
    if (p === "/api/assessment/sessions")
      return send(empty ? [] : state.sessions);
    if (p === "/api/assessment/request-exam") {
      state.sessions.push({
        ...state.sessions[2],
        id: 90,
        subject: body.subject,
      });
      return send({ examSession: { id: 90 }, agenticPlan: { Steps: [] } });
    }
    if (/\/api\/aiagent\/synthesize-exam\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      state.sessions = state.sessions.map((item) =>
        item.id === id
          ? { ...item, status: "PendingAdminApproval", questionsReady: true }
          : item,
      );
      return send({ questionsCount: 1 });
    }
    if (/\/api\/assessment\/sessions\/\d+\/duration$/.test(p)) {
      const id = Number(p.split("/").at(-2));
      const session = state.sessions.find((item) => item.id === id);
      session.durationMinutes += body.additionalMinutes;
      return send({ durationMinutes: session.durationMinutes });
    }
    if (/^\/api\/assessment\/sessions\/\d+$/.test(p) && method === "DELETE") {
      state.sessions = state.sessions.filter(
        (item) => item.id !== Number(p.split("/").at(-1)),
      );
      return send({});
    }
    if (/\/api\/assessment\/(approve|reject)\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      state.sessions = state.sessions.map((item) =>
        item.id === id
          ? { ...item, status: p.includes("/approve/") ? "Ready" : "Abandoned" }
          : item,
      );
      return send({ message: "Updated." });
    }
    if (p === "/api/aiagent/plans")
      return send({
        totalPlans: empty ? 0 : state.plans.length,
        pendingCount: empty
          ? 0
          : state.plans.filter((item) => !item.isApproved).length,
        plans: empty ? [] : state.plans,
      });
    if (/^\/api\/aiagent\/plans\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      if (method === "DELETE") {
        state.plans = state.plans.filter((item) => item.id !== id);
        return send({});
      }
      return send(state.plans.find((item) => item.id === id));
    }
    if (p === "/api/aiagent/generate-plan")
      return send({
        studyPlanId: 12,
        message: "Generated.",
        planDays: state.days,
      });
    if (/\/api\/aiagent\/approve-plan\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      state.plans = state.plans.map((item) =>
        item.id === id ? { ...item, isApproved: true } : item,
      );
      return send({
        approvedBy: "admin@example.invalid",
        approvedAt: "2026-10-10",
      });
    }
    if (/\/api\/aiagent\/publish-plan\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      state.plans = state.plans.map((item) => ({
        ...item,
        isPublished: item.id === id,
      }));
      return send({});
    }
    if (p === "/api/admin/analytics") {
      if (method === "POST") {
        state.analytics.push({ id: 99, ...body, generatedByAgent: false });
        return send({});
      }
      return send(empty ? [] : state.analytics);
    }
    if (p === "/api/admin/analytics/analyze")
      return send({ records: state.analytics, message: "Analysis complete." });
    if (/^\/api\/admin\/analytics\/\d+$/.test(p)) {
      const id = Number(p.split("/").at(-1));
      if (method === "PUT")
        state.analytics = state.analytics.map((item) =>
          item.id === id ? { ...item, ...body } : item,
        );
      if (method === "DELETE")
        state.analytics = state.analytics.filter((item) => item.id !== id);
      return send({});
    }
    if (p === "/api/aiagent/generate-paper")
      return send({
        questions: [
          {
            questionNo: 1,
            topic: "Networking",
            questionText: state.questions[0].questionText,
            options: ["Router", "Monitor", "Keyboard", "Printer", "Mouse"],
            correctOption: 1,
            explanation: state.questions[0].explanation,
          },
        ],
        topicDistribution: [],
        researchContext: [],
      });
    if (p === "/api/admin/questions")
      return send({
        question_id: 99,
        lesson_name: body.lesson_name,
        year: body.year,
      });
    if (p === "/api/admin/marks") return send(empty ? [] : state.marks);
    return send({ message: "Unmatched test request." }, 404);
  });
  return { page, state, errors };
}
async function visit(page, route) {
  await page.goto(origin + route);
  await page.locator(route === "/login" ? ".login-form" : ".page").waitFor();
  await page.waitForLoadState("networkidle");
}
async function visible(locator) {
  await locator.waitFor({ state: "visible" });
}
async function accessibilityScan(page, name) {
  await page.addScriptTag({
    path: path.join(process.env.AXE_MODULE, "axe.min.js"),
  });
  const report = await page.evaluate(
    async () =>
      await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
  );
  const violations = report.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    nodes: item.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));
  if (violations.length && process.env.UI_TEST_OUTPUT) {
    fs.writeFileSync(
      path.join(process.env.UI_TEST_OUTPUT, `axe-${name}.json`),
      JSON.stringify(violations, null, 2),
    );
  }
  assert.deepEqual(violations, []);
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
function lastCall(state, p, method) {
  return state.calls
    .filter((call) => call.path === p && call.method === method)
    .at(-1);
}
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("Expected UI state was not reached.");
}
async function test(name, fn, options = {}) {
  if (
    process.env.UI_TEST_FILTER &&
    !new RegExp(process.env.UI_TEST_FILTER).test(name)
  )
    return;
  const ctx = await createPage(options);
  try {
    await fn(ctx);
    assert.deepEqual(ctx.errors, []);
    results.push({ name, result: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({
      name,
      result: "FAIL",
      error: error.stack,
      browserErrors: ctx.errors,
    });
    console.log(`FAIL ${name}: ${error.stack}`);
    console.log("Browser errors:", ctx.errors);
    if (process.env.UI_TEST_OUTPUT)
      await ctx.page
        .screenshot({
          path: path.join(
            process.env.UI_TEST_OUTPUT,
            "failure-" +
              name.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 70) +
              ".png",
          ),
          fullPage: true,
          timeout: 3000,
        })
        .catch(() => {});
  } finally {
    await ctx.page.close();
  }
}

async function main() {
  const server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: root,
      env: { ...process.env, VITE_API_URL: origin },
      stdio: "ignore",
    },
  );
  try {
    await until(async () => {
      try {
        return (await fetch(origin)).ok;
      } catch {
        return false;
      }
    });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_EXECUTABLE
        ? { executablePath: process.env.BROWSER_EXECUTABLE }
        : {}),
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-zygote"],
    });

    await test(
      "Authentication guard, login payload, password visibility and logout",
      async ({ page, state }) => {
        await page.goto(origin + "/students");
        await page.waitForURL("**/login");
        await page.getByLabel("Email address").fill("admin@example.invalid");
        await page
          .getByLabel("Password", { exact: true })
          .fill("synthetic-password");
        await page.getByRole("button", { name: "Show password" }).click();
        assert.equal(
          await page
            .getByLabel("Password", { exact: true })
            .getAttribute("type"),
          "text",
        );
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.locator(".dashboard-page").waitFor();
        assert.deepEqual(lastCall(state, "/api/auth/login", "POST").body, {
          email: "admin@example.invalid",
          password: "synthetic-password",
        });
        assert.equal(
          await page.evaluate(() => localStorage.getItem("admin_token")),
          "synthetic-ui-test-token",
        );
        await page.getByRole("button", { name: "Log out" }).click();
        await page.waitForURL("**/login");
        assert.equal(
          await page.evaluate(() => localStorage.getItem("admin_token")),
          null,
        );
      },
      { authenticated: false },
    );

    await test(
      "Non-admin login remains rejected",
      async ({ page, state }) => {
        state.loginRole = "Student";
        await visit(page, "/login");
        await page.getByLabel("Email address").fill("student@example.invalid");
        await page
          .getByLabel("Password", { exact: true })
          .fill("synthetic-password");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await visible(page.getByRole("alert"));
        assert.equal(
          await page.evaluate(() => localStorage.getItem("admin_token")),
          null,
        );
      },
      { authenticated: false },
    );

    await test("Dashboard reflects returned records, refreshes and links to approvals", async ({
      page,
      state,
    }) => {
      await visit(page, "/");
      assert.deepEqual(await page.locator(".metric-value").allTextContents(), [
        "3",
        "5",
        "2",
        "2",
      ]);
      assert.equal(await page.locator(".session-list-item").count(), 5);
      const count = state.calls.length;
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await until(() => state.calls.length >= count + 3);
      await page.getByRole("button", { name: "Open approvals" }).click();
      await page.locator(".approvals-page").waitFor();
    });

    await test("Student creation validates, preserves payload and closes successfully", async ({
      page,
      state,
    }) => {
      await visit(page, "/students");
      await page
        .getByRole("button", { name: "Add student", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      await visible(modal);
      await modal.locator('input[name="fullName"]').fill("Test Added Student");
      await modal.locator('input[name="email"]').fill("added@example.invalid");
      await modal.locator('input[name="initialPassword"]').fill("test!1234");
      await modal.locator('input[name="college"]').fill("Test College");
      await page.locator('button[form="add-student-form"]').click();
      await until(() => !!lastCall(state, "/api/admin/students", "POST"));
      assert.deepEqual(lastCall(state, "/api/admin/students", "POST").body, {
        fullName: "Test Added Student",
        email: "added@example.invalid",
        initialPassword: "test!1234",
        college: "Test College",
      });
      await modal.waitFor({ state: "hidden" });
      await visible(page.getByText("Test Added Student", { exact: true }));
    });

    await test("Student inline editing, search and confirmed deletion", async ({
      page,
      state,
    }) => {
      await visit(page, "/students");
      await page
        .getByRole("button", { name: "Edit Test Student One", exact: true })
        .click();
      await page.getByLabel("Student name").fill("Test Updated Student");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await until(() => !!lastCall(state, "/api/admin/students/1", "PUT"));
      assert.deepEqual(lastCall(state, "/api/admin/students/1", "PUT").body, {
        fullName: "Test Updated Student",
        phoneNumber: "",
        address: "",
        college: "Test College",
      });
      await page.getByLabel("Search students").fill("Updated");
      await until(async () => (await page.locator("tbody tr").count()) === 1);
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Delete Test Updated Student" })
        .click();
      await until(() => !!lastCall(state, "/api/admin/students/1", "DELETE"));
    });

    await test("Exam request, details, questions, QR download and added time", async ({
      page,
      state,
    }) => {
      await visit(page, "/exams");
      await page.getByRole("button", { name: "Request mock exam" }).click();
      let dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Learning objective")
        .fill("Practice network routing");
      await dialog.getByRole("button", { name: "Generate Exam Plan" }).click();
      await until(
        () => !!lastCall(state, "/api/assessment/request-exam", "POST"),
      );
      assert.deepEqual(
        lastCall(state, "/api/assessment/request-exam", "POST").body,
        {
          objective: "Practice network routing",
          targetExam: "A/L",
          subject: "ICT",
        },
      );
      await dialog.waitFor({ state: "hidden" });
      const row = page
        .locator("tbody tr")
        .filter({ hasText: "Network fundamentals" });
      await row.getByRole("button", { name: "Details", exact: true }).click();
      await visible(page.getByRole("dialog"));
      await page.keyboard.press("Escape");
      await row.getByRole("button", { name: "Questions", exact: true }).click();
      await visible(
        page.getByText(fixtures.questions[0].questionText, { exact: true }),
      );
      await page.keyboard.press("Escape");
      await row.getByRole("button", { name: "QR", exact: true }).click();
      await visible(page.getByRole("dialog").locator("canvas"));
      const qrDownload = page.waitForEvent("download");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Download/i })
        .click();
      assert.match((await qrDownload).suggestedFilename(), /\.png$/);
      await page.keyboard.press("Escape");
      await row.getByRole("button", { name: "Time", exact: true }).click();
      await page.getByLabel("Additional minutes").fill("15");
      await page.getByRole("dialog").locator('button[type="submit"]').click();
      await until(
        () => !!lastCall(state, "/api/assessment/sessions/1/duration", "PUT"),
      );
      assert.deepEqual(
        lastCall(state, "/api/assessment/sessions/1/duration", "PUT").body,
        { additionalMinutes: 15 },
      );
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    });

    await test("Exam synthesis, time error feedback and deletion remain available", async ({
      page,
      state,
    }) => {
      await visit(page, "/exams");
      const pending = page
        .locator("tbody tr")
        .filter({ hasText: "Python basics" });
      await pending
        .getByRole("button", { name: "Prepare", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/synthesize-exam/3", "POST"),
      );
      assert.deepEqual(
        lastCall(state, "/api/aiagent/synthesize-exam/3", "POST").body,
        {
          subject: "ICT",
          objective: "Generate ICT MCQ questions on ICT",
          requestedQuestionCount: 5,
        },
      );
      state.failure = "/api/assessment/sessions/1/duration";
      const row = page
        .locator("tbody tr")
        .filter({ hasText: "Network fundamentals" });
      await row.getByRole("button", { name: "Time", exact: true }).click();
      await page.getByRole("dialog").locator('button[type="submit"]').click();
      await visible(page.getByRole("dialog").getByRole("alert"));
      await page.keyboard.press("Escape");
      page.once("dialog", (dialog) => dialog.accept());
      await row
        .getByRole("button", { name: "Delete Network fundamentals" })
        .click();
      await until(
        () => !!lastCall(state, "/api/assessment/sessions/1", "DELETE"),
      );
    });

    await test("Study plan wizard, exclusions and generated preview", async ({
      page,
      state,
    }) => {
      await visit(page, "/ai-plans");
      await page
        .getByRole("button", { name: "Generate plan", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
      const topic = dialog.locator("button[aria-pressed]").first();
      const name = (await topic.innerText()).trim();
      await topic.click();
      assert.equal(await topic.getAttribute("aria-pressed"), "true");
      await dialog
        .getByRole("button", { name: "Generate Plan", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/generate-plan", "POST"),
      );
      assert.deepEqual(
        lastCall(state, "/api/aiagent/generate-plan", "POST").body,
        { excludedTopics: [name] },
      );
      await visible(dialog.getByText("Day 1: ICT revision 1", { exact: true }));
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
    });

    await test("Study plan editing, approval, publishing, PDF export and deletion", async ({
      page,
      state,
    }) => {
      await visit(page, "/ai-plans");
      await page
        .getByRole("button", { name: "Review & Edit", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Topic", { exact: true })
        .first()
        .fill("Updated test topic");
      await dialog
        .getByRole("button", { name: "Approve Plan", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/approve-plan/10", "PUT"),
      );
      assert.equal(
        lastCall(state, "/api/aiagent/approve-plan/10", "PUT").body
          .planDetailsJson[0].topic,
        "Updated test topic",
      );
      await dialog.waitFor({ state: "hidden" });
      const approved = page.locator("tbody tr").filter({ hasText: "#11" });
      await approved
        .getByRole("button", { name: "Publish", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/publish-plan/11", "PUT"),
      );
      await approved.getByRole("button", { name: "View", exact: true }).click();
      dialog = page.getByRole("dialog");
      const download = page.waitForEvent("download", { timeout: 20000 });
      await dialog
        .getByRole("button", { name: "Export PDF", exact: true })
        .click();
      assert.match((await download).suggestedFilename(), /\.pdf$/);
      await page.keyboard.press("Escape");
      page.once("dialog", (item) => item.accept());
      await approved.getByTitle("Delete approved plan").click();
      await until(() => !!lastCall(state, "/api/aiagent/plans/11", "DELETE"));
    });

    await test("Question authoring sends all fields and keeps entry context", async ({
      page,
      state,
    }) => {
      await visit(page, "/question-bank");
      await page
        .getByLabel("Lesson / topic")
        .selectOption("Data Representation");
      await page.getByLabel("Question text").fill("Which value is binary?");
      for (let i = 1; i <= 4; i++)
        await page
          .locator("#answer-" + i)
          .fill(["1010", "ABCD", "29", "58"][i - 1]);
      await page
        .getByRole("radio", { name: "Mark option 1 as correct" })
        .check();
      await page
        .getByRole("button", { name: "Save question", exact: true })
        .click();
      await until(() => !!lastCall(state, "/api/admin/questions", "POST"));
      const call = lastCall(state, "/api/admin/questions", "POST");
      assert.deepEqual(Object.keys(call.body), [
        "year",
        "paper_type",
        "lesson_name",
        "difficulty_level",
        "question_text",
        "option_1",
        "option_2",
        "option_3",
        "option_4",
        "option_5",
        "correct_option_no",
      ]);
      assert.equal(call.body.correct_option_no, 1);
      assert.equal(call.body.option_5, null);
      await until(
        async () =>
          (await page.getByLabel("Question text").inputValue()) === "",
      );
      assert.equal(
        await page.getByLabel("Lesson / topic").inputValue(),
        "Data Representation",
      );
      await visible(page.getByRole("status"));
    });

    await test("Approvals retain question editing, validation and approval contract", async ({
      page,
      state,
    }) => {
      await visit(page, "/approvals");
      await page
        .getByRole("button", { name: "Review Exam Session 2", exact: true })
        .first()
        .click();
      await page.getByLabel("Exam title").fill("");
      await page
        .getByRole("button", { name: "Approve Exam", exact: true })
        .click();
      await visible(page.getByRole("alert"));
      assert.equal(
        lastCall(state, "/api/assessment/approve/2", "PUT"),
        undefined,
      );
      await page.getByLabel("Exam title").fill("Reviewed test exam");
      await page
        .getByLabel("Question text", { exact: true })
        .fill("Which device routes packets?");
      await page
        .getByRole("button", { name: "Approve Exam", exact: true })
        .click();
      await until(() => !!lastCall(state, "/api/assessment/approve/2", "PUT"));
      assert.equal(
        lastCall(state, "/api/assessment/approve/2", "PUT").body.title,
        "Reviewed test exam",
      );
      assert.equal(
        lastCall(state, "/api/assessment/approve/2", "PUT").body
          .editedQuestions[0].questionText,
        "Which device routes packets?",
      );
    });

    await test("Approvals preserve rejection and study-plan approval actions", async ({
      page,
      state,
    }) => {
      await visit(page, "/approvals");
      await page.getByRole("button", { name: "Reject", exact: true }).click();
      await until(() => !!lastCall(state, "/api/assessment/reject/2", "PUT"));
      await page
        .getByRole("button", { name: "Review Study Plan 10", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Approve Study Plan", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/approve-plan/10", "PUT"),
      );
      assert.equal(
        lastCall(state, "/api/aiagent/approve-plan/10", "PUT").body,
        null,
      );
    });

    await test("Analytics creation, editing, analysis and deletion", async ({
      page,
      state,
    }) => {
      await visit(page, "/analytics");
      await page
        .getByRole("button", { name: "Add Record", exact: true })
        .first()
        .click();
      await page.getByLabel("Topic name").fill("Test topic");
      await page.getByLabel("Year", { exact: true }).fill("2025");
      await page.getByLabel("Probability percentage").fill("12.5");
      await page
        .locator("form")
        .getByRole("button", { name: "Add Record", exact: true })
        .click();
      await until(() => !!lastCall(state, "/api/admin/analytics", "POST"));
      assert.deepEqual(lastCall(state, "/api/admin/analytics", "POST").body, {
        topicName: "Test topic",
        year: 2025,
        probabilityPercentage: 12.5,
      });
      const row = page.locator("tbody tr").filter({ hasText: "Test topic" });
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Probability percentage").fill("13");
      await page
        .getByRole("button", { name: "Save Changes", exact: true })
        .click();
      await until(() => !!lastCall(state, "/api/admin/analytics/99", "PUT"));
      await page
        .getByRole("button", { name: "Run AI analysis", exact: true })
        .click();
      await until(
        () => !!lastCall(state, "/api/admin/analytics/analyze", "POST"),
      );
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Delete", exact: true }).click();
      await until(() => !!lastCall(state, "/api/admin/analytics/99", "DELETE"));
    });

    await test("Predicted paper generation and answer reveal", async ({
      page,
      state,
    }) => {
      await visit(page, "/analytics");
      await page
        .getByRole("button", { name: "Generate 2026 Predicted Paper" })
        .click();
      await until(
        () => !!lastCall(state, "/api/aiagent/generate-paper", "POST"),
      );
      assert.deepEqual(
        lastCall(state, "/api/aiagent/generate-paper", "POST").body,
        { researchTopicCount: 3 },
      );
      await visible(
        page.getByRole("dialog", { name: "Predicted paper results" }),
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Show Answer|Reveal Answer/i })
        .first()
        .click();
      await visible(
        page.getByText(fixtures.questions[0].explanation, { exact: true }),
      );
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "View Paper", exact: true })
        .click();
      await visible(
        page.getByRole("dialog", { name: "Predicted paper results" }),
      );
      assert.equal(await page.locator("dialog[open]").count(), 1);
      assert.equal(
        await page
          .getByRole("dialog", { name: "Generate predicted paper" })
          .count(),
        0,
      );
      assert.equal(
        state.calls.filter(
          (call) => call.path === "/api/aiagent/generate-paper",
        ).length,
        1,
      );
    });

    await test("Marks search, keyboard sort and returned score", async ({
      page,
    }) => {
      await visit(page, "/marks");
      await visible(page.getByText("7/10 (70%)", { exact: true }));
      await page.getByLabel("Sort by").selectOption("studentName");
      await page
        .getByRole("button", { name: "Ascending", exact: true })
        .click();
      await visible(
        page.getByRole("button", { name: "Descending", exact: true }),
      );
      await page.getByRole("searchbox").fill("no-such-student");
      await visible(page.getByText("No matching submissions", { exact: true }));
      await page.getByRole("searchbox").fill("");
      await visible(page.getByText("7/10 (70%)", { exact: true }));
    });

    await test(
      "Mobile navigation and dialog focus / Escape / focus restoration",
      async ({ page }) => {
        await visit(page, "/");
        await page.getByRole("button", { name: "Open navigation" }).click();
        const drawer = page.getByRole("dialog");
        await visible(drawer);
        await drawer.getByRole("link", { name: "Manage Students" }).click();
        await page.locator(".students-page").waitFor();
        assert.equal(await page.getByRole("dialog").count(), 0);
        const trigger = page.getByRole("button", {
          name: "Add student",
          exact: true,
        });
        await trigger.click();
        const modal = page.getByRole("dialog");
        await page.keyboard.press("Tab");
        assert.equal(
          await modal.evaluate((element) =>
            element.contains(document.activeElement),
          ),
          true,
          "Tab keeps focus in the dialog",
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await modal.evaluate(
            (element) =>
              element === document.activeElement ||
              element.contains(document.activeElement),
          ),
          true,
          "Shift+Tab keeps focus in the dialog",
        );
        await page.keyboard.press("Escape");
        await modal.waitFor({ state: "hidden" });
        assert.equal(
          await trigger.evaluate(
            (element) => element === document.activeElement,
          ),
          true,
          "Focus returns to Add student",
        );
        await noOverflow(page);
      },
      { width: 390, height: 700 },
    );

    for (const mode of ["empty", "error"])
      await test(
        `${mode} states across all API-backed sections`,
        async ({ page }) => {
          for (const route of [
            "/",
            "/exams",
            "/students",
            "/ai-plans",
            "/analytics",
            "/approvals",
            "/marks",
          ]) {
            await visit(page, route);
            assert.ok((await page.locator(".page").innerText()).length > 50);
            await noOverflow(page);
            if (mode === "error" && route === "/approvals") {
              await visible(
                page.getByText("Review queue unavailable", { exact: true }),
              );
              assert.equal(
                await page
                  .getByText("Your review queue is clear", { exact: true })
                  .count(),
                0,
              );
            }
          }
        },
        { width: 390, mode },
      );

    for (const width of [1440, 1024, 768, 390, 320])
      await test(
        `All pages fit a ${width}px viewport`,
        async ({ page }) => {
          for (const route of [
            "/",
            "/exams",
            "/students",
            "/ai-plans",
            "/analytics",
            "/question-bank",
            "/approvals",
            "/marks",
            "/login",
          ]) {
            await visit(page, route);
            await noOverflow(page);
          }
        },
        { width, height: width === 768 ? 375 : 900 },
      );

    await test("Reduced motion disables decorative entrance animation", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await visit(page, "/");
      assert.equal(
        await page
          .locator(".page-heading")
          .evaluate((element) => getComputedStyle(element).animationDuration),
        "1e-05s",
      );
    });

    if (process.env.AXE_MODULE) {
      for (const route of [
        "/",
        "/exams",
        "/students",
        "/ai-plans",
        "/analytics",
        "/question-bank",
        "/approvals",
        "/marks",
        "/login",
      ])
        await test(`Accessibility scan ${route}`, async ({ page }) => {
          await visit(page, route);
          await accessibilityScan(page, route.slice(1) || "dashboard");
        });

      for (const item of [
        { route: "/students", button: "Add student" },
        { route: "/exams", button: "Request mock exam" },
        { route: "/exams", button: "Time" },
        { route: "/exams", button: "QR" },
        { route: "/exams", button: "Questions" },
        { route: "/ai-plans", button: "Generate plan", wizard: true },
        { route: "/ai-plans", button: "Review & Edit" },
        { route: "/analytics", button: "Add Record", inline: true },
      ])
        await test(
          `Form accessibility and narrow layout: ${item.button}`,
          async ({ page }) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await visit(page, item.route);
            await page
              .getByRole("button", { name: item.button, exact: true })
              .first()
              .click();
            const dialog = item.inline
              ? page.locator("form")
              : page.getByRole("dialog");
            await visible(dialog);
            if (item.wizard) {
              await dialog
                .getByRole("button", { name: "Next", exact: true })
                .click();
              await accessibilityScan(page, "topic-exclusions");
              await dialog
                .getByRole("button", { name: "Generate Plan", exact: true })
                .click();
              await visible(
                dialog.getByText("Day 1: ICT revision 1", { exact: true }),
              );
            }
            assert.equal(
              await dialog.evaluate(
                (element) => element.scrollWidth > element.clientWidth + 1,
              ),
              false,
              "The dialog fits without horizontal clipping",
            );
            await noOverflow(page);
            await accessibilityScan(
              page,
              "dialog-" + item.button.replace(/[^a-zA-Z0-9]+/g, "-"),
            );
          },
          { width: 320, height: 700 },
        );
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    if (process.env.UI_TEST_OUTPUT)
      fs.writeFileSync(
        path.join(process.env.UI_TEST_OUTPUT, "regression-results.json"),
        JSON.stringify(results, null, 2),
      );
  }
  const failed = results.filter((result) => result.result === "FAIL");
  console.log(
    `${results.length - failed.length}/${results.length} checks passed`,
  );
  process.exitCode = failed.length ? 1 : 0;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
