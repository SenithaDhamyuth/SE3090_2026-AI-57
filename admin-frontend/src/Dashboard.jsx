import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  EmptyState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
} from "./components/ui";

const API_BASE =
  (import.meta.env.VITE_API_URL || "https://intelliprep-rhx3.onrender.com") +
  "";

export default function Dashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [studyPlans, setStudyPlans] = useState({
    totalPlans: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("admin_token");

        const [studentsRes, sessionsRes, plansRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/students`, {
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/assessment/sessions`, {
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
          }),
          fetch(`${API_BASE}/api/aiagent/plans`, {
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!studentsRes.ok)
          throw new Error(
            `Students API responded with ${studentsRes.status} ${studentsRes.statusText}`,
          );
        if (!sessionsRes.ok)
          throw new Error(
            `Sessions API responded with ${sessionsRes.status} ${sessionsRes.statusText}`,
          );
        if (!plansRes.ok)
          throw new Error(
            `Plans API responded with ${plansRes.status} ${plansRes.statusText}`,
          );

        const studentData = await studentsRes.json();
        const sessionData = await sessionsRes.json();
        const planData = await plansRes.json();

        setStudents(Array.isArray(studentData) ? studentData : []);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
        setStudyPlans(planData || { totalPlans: 0, pendingCount: 0 });
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load dashboard data.");
          setStudents([]);
          setSessions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [refreshKey]);

  const totalStudents = students.length;
  const totalSessions = sessions.length;
  const pendingSessions = sessions.filter(
    (s) => s.status === "PendingAdminApproval",
  ).length;
  const totalStudyPlans = studyPlans.totalPlans || 0;
  const pendingStudyPlans = studyPlans.pendingCount || 0;
  const totalPendingApprovals = pendingSessions + pendingStudyPlans;

  /* ── Current date for greeting ── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const recentSessions = [...sessions]
    .sort(
      (a, b) =>
        (Date.parse(b.startTime || b.createdAt) || 0) -
        (Date.parse(a.startTime || a.createdAt) || 0),
    )
    .slice(0, 5);
  const statusLabels = {
    Pending: "Preparing",
    PendingAdminApproval: "Awaiting review",
    Ready: "Available",
    Completed: "Completed",
    InProgress: "In progress",
    Abandoned: "Abandoned",
  };
  const statusClasses = {
    Ready: "status-Ready",
    Completed: "status-Completed",
    InProgress: "status-InProgress",
    Pending: "status-Pending",
    PendingAdminApproval: "status-PendingAdminApproval",
    Abandoned: "status-Abandoned",
  };
  const readyCount = sessions.filter(
    (session) => session.status === "Ready",
  ).length;

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="YOUR TEACHING WORKSPACE"
        title={`${greeting}, Admin`}
        description="A clear view of your students, assessments and next steps."
      >
        <button
          className="button button-secondary"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </PageHeader>

      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Sparkles size={15} /> A little preparation. A lot of possibility.
          </span>
          <h2>
            Make room for
            <br />
            <span>better learning.</span>
          </h2>
          <p>
            Create thoughtful assessments, guide study time, and help your
            students take their next step.
          </p>
          <button
            className="button button-primary"
            onClick={() => navigate("/exams")}
          >
            <Plus size={18} /> Create an exam <ArrowUpRight size={17} />
          </button>
        </div>
        <div
          className="hero-journey"
          aria-label="Create, review and publish your learning materials"
        >
          <span className="journey-orbit orbit-one" aria-hidden="true" />
          <span className="journey-orbit orbit-two" aria-hidden="true" />
          <div className="journey-book" aria-hidden="true">
            <BookOpen size={65} strokeWidth={1.25} />
            <span>Learn. Grow. Repeat.</span>
          </div>
          <div className="journey-note note-create">
            <span>
              <Sparkles size={17} />
            </span>
            <div>
              <strong>Create with purpose</strong>
              <small>Exams & study plans</small>
            </div>
          </div>
          <div className="journey-note note-review">
            <span>
              <ShieldCheck size={17} />
            </span>
            <div>
              <strong>Review with care</strong>
              <small>Ready for your students</small>
            </div>
            <CheckCircle2 size={17} />
          </div>
        </div>
      </section>

      {error ? (
        <Notice type="error" text={`Could not load your overview. ${error}`}>
          <button
            className="text-button"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Try again <ArrowRight size={15} />
          </button>
        </Notice>
      ) : loading ? (
        <div
          className="metric-grid"
          role="status"
          aria-label="Loading overview"
        >
          {[0, 1, 2, 3].map((item) => (
            <div className="metric skeleton-metric" key={item}>
              <span />
              <strong />
              <span />
            </div>
          ))}
        </div>
      ) : (
        <div className="metric-grid">
          <Metric
            label="Registered students"
            value={totalStudents}
            detail="Your learning community"
            icon={GraduationCap}
          />
          <Metric
            label="Exam sessions"
            value={totalSessions}
            detail={`${readyCount} available to students`}
            icon={ClipboardList}
          />
          <Metric
            label="AI study plans"
            value={totalStudyPlans}
            detail="Prepared learning schedules"
            icon={Brain}
          />
          <Metric
            label="Awaiting review"
            value={totalPendingApprovals}
            detail="Exams and study plans"
            icon={ShieldCheck}
            accent={totalPendingApprovals > 0}
          />
        </div>
      )}

      <div className="dashboard-columns">
        <section className="surface recent-sessions">
          <div className="section-heading">
            <div>
              <span className="eyebrow">KEEP THINGS MOVING</span>
              <h2>Recent exam sessions</h2>
            </div>
            <button className="text-button" onClick={() => navigate("/exams")}>
              View all <ArrowUpRight size={16} />
            </button>
          </div>
          {loading ? (
            <LoadingState label="Loading recent sessions…" />
          ) : error ? (
            <EmptyState
              title="Sessions unavailable"
              description="Refresh the overview to try again."
            />
          ) : recentSessions.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Your first exam starts here"
              description="Create an exam session to begin preparing an assessment."
            >
              <button
                className="button button-secondary"
                onClick={() => navigate("/exams")}
              >
                Create an exam <Plus size={16} />
              </button>
            </EmptyState>
          ) : (
            <div className="session-list">
              {recentSessions.map((session, index) => (
                <button
                  key={session.id ?? index}
                  className="session-list-item"
                  onClick={() => navigate("/exams")}
                >
                  <span className="list-icon">
                    <ClipboardList size={20} />
                  </span>
                  <span className="session-list-copy">
                    <strong>
                      {session.title || session.subject || "Exam session"}
                    </strong>
                    <small>
                      {session.subject || "Subject not provided"}
                      {session.id != null ? ` · #${session.id}` : ""}
                    </small>
                  </span>
                  <span
                    className={`status-tag ${statusClasses[session.status] || ""}`}
                  >
                    {statusLabels[session.status] ||
                      session.status ||
                      "Status unavailable"}
                  </span>
                  <ArrowUpRight className="list-arrow" size={17} />
                </button>
              ))}
            </div>
          )}
          <div className="section-footnote">
            <CalendarDays size={14} /> Sorted by the latest available session
            date.
          </div>
        </section>
        <section className="review-panel surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR NEXT STEP</span>
              <h2>Ready for your review</h2>
            </div>
            <span className="review-icon">
              <ShieldCheck size={23} />
            </span>
          </div>
          {loading ? (
            <LoadingState label="Checking review queue…" />
          ) : error ? (
            <p className="panel-description">
              Review counts are currently unavailable.
            </p>
          ) : (
            <>
              <div className="review-total">
                <strong>{totalPendingApprovals}</strong>
                <span>
                  {totalPendingApprovals === 1 ? "item needs" : "items need"}
                  <br />
                  your attention
                </span>
              </div>
              <p className="panel-description">
                {totalPendingApprovals
                  ? "Give generated content a final check before it reaches your students."
                  : "No pending reviews. You can prepare the next learning activity."}
              </p>
              <div className="review-breakdown">
                <span>
                  <ClipboardList size={16} /> Exam sessions{" "}
                  <strong>{pendingSessions}</strong>
                </span>
                <span>
                  <Brain size={16} /> Study plans{" "}
                  <strong>{pendingStudyPlans}</strong>
                </span>
              </div>
            </>
          )}
          <button
            className="button button-primary review-action"
            onClick={() => navigate("/approvals")}
          >
            Open approvals <ArrowRight size={17} />
          </button>
        </section>
      </div>

      <section>
        <div className="section-heading section-heading-plain">
          <div>
            <span className="eyebrow">A SHORTCUT TO YOUR NEXT TASK</span>
            <h2>Quick actions</h2>
          </div>
        </div>
        <div className="quick-actions">
          {[
            {
              icon: UserPlus,
              title: "Grow your classroom",
              text: "Register and manage student accounts.",
              route: "/students",
            },
            {
              icon: Brain,
              title: "Plan the next week",
              text: "Generate, review and publish study plans.",
              route: "/ai-plans",
            },
            {
              icon: BarChart3,
              title: "See the bigger picture",
              text: "Explore patterns in past paper topics.",
              route: "/analytics",
            },
          ].map(({ icon: Icon, title, text, route }) => (
            <button
              className="quick-action"
              key={route}
              onClick={() => navigate(route)}
            >
              <span className="quick-icon">
                <Icon size={23} />
              </span>
              <strong>{title}</strong>
              <p>{text}</p>
              <ArrowUpRight size={18} className="quick-arrow" />
            </button>
          ))}
        </div>
      </section>
      <details className="workflow-guide">
        <summary>
          <BookOpen size={17} />
          <span>New to the workspace?</span> Follow the learning workflow{" "}
          <ArrowRight size={16} />
        </summary>
        <div className="workflow-steps">
          {[
            {
              icon: GraduationCap,
              title: "Onboard your students",
              text: "Add accounts and keep student details up to date.",
            },
            {
              icon: Sparkles,
              title: "Prepare learning materials",
              text: "Generate study plans and exam questions for A/L ICT.",
            },
            {
              icon: CheckCircle2,
              title: "Review, then publish",
              text: "Check generated content before sharing it with students.",
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <div key={title}>
              <span className="step-number">0{index + 1}</span>
              <Icon size={20} />
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
