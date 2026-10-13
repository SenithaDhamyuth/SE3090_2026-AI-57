import {
  EmptyState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
} from "./components/ui";
import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  RefreshCw,
  ClipboardList,
  Users,
  ChevronUp,
  ChevronDown,
  Search,
  CheckCircle2,
} from "lucide-react";

const API_BASE =
  (import.meta.env.VITE_API_URL || "https://intelliprep-rhx3.onrender.com") +
  "";

const authFetch = (url, options = {}) => {
  const token = localStorage.getItem("admin_token") || "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
};

// ── Score badge ────────────────────────────────────────────────────────────────
function ScoreBadge({ score, total }) {
  if (total === 0)
    return <span className="text-gray-400 text-[12px] font-semibold">N/A</span>;
  const pct = Math.round((score / total) * 100);
  const color =
    pct >= 75
      ? "bg-green-50 text-green-600"
      : pct >= 50
        ? "bg-orange-50 text-orange-600"
        : "bg-red-50 text-red-600";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${color}`}
    >
      <Trophy size={12} strokeWidth={2.5} />
      {score}/{total} ({pct}%)
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StudentMarks() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("endTime");
  const [sortDir, setSortDir] = useState("desc");

  const fetchMarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/marks`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || `Server error ${res.status}`);
      }
      const data = await res.json();
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.sessions)
          ? data.sessions
          : Array.isArray(data.data)
            ? data.data
            : [];
      setSessions(
        rows.map((item, index) => ({
          ...item,
          sessionId:
            item.sessionId ?? item.SessionId ?? item.id ?? item.Id ?? index,
          sessionGuid: item.sessionGuid ?? item.SessionGuid ?? "",
          studentId: item.studentId ?? item.StudentId ?? "",
          studentName:
            item.studentName ?? item.StudentName ?? "Unknown Student",
          studentEmail:
            item.studentEmail ??
            item.StudentEmail ??
            item.email ??
            item.Email ??
            "",
          title: item.title ?? item.Title ?? "",
          subject: item.subject ?? item.Subject ?? "",
          totalScore: Number(item.totalScore ?? item.TotalScore ?? 0),
          totalQuestions: Number(
            item.totalQuestions ?? item.TotalQuestions ?? 0,
          ),
          durationMinutes: Number(
            item.durationMinutes ?? item.DurationMinutes ?? 0,
          ),
          endTime: item.endTime ?? item.EndTime ?? "",
          originalObjective:
            item.originalObjective ?? item.OriginalObjective ?? "",
        })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarks();
  }, [fetchMarks]);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = sessions
    .filter((s) => {
      const q = search.toLowerCase();
      return (
        String(s.studentName ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.studentEmail ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.subject ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.title ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.studentId ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.sessionGuid ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.originalObjective ?? "")
          .toLowerCase()
          .includes(q)
      );
    })
    .sort((a, b) => {
      let valA = a[sortField] ?? "";
      let valB = b[sortField] ?? "";
      if (sortField === "totalScore") {
        valA = Number(valA);
        valB = Number(valB);
      }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const avgScore =
    sessions.length === 0
      ? 0
      : Math.round(
          sessions.reduce((sum, s) => sum + s.totalScore, 0) / sessions.length,
        );
  const passCount = sessions.filter(
    (s) => s.totalQuestions > 0 && s.totalScore / s.totalQuestions >= 0.5,
  ).length;

  const stats = [
    {
      label: "Total Submissions",
      value: sessions.length,
      icon: ClipboardList,
      color: "text-gray-700",
      bg: "bg-gray-100",
      border: "border-gray-200",
    },
    {
      label: "Unique Students",
      value: new Set(sessions.map((s) => s.studentId)).size,
      icon: Users,
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    {
      label: "Avg Score",
      value: avgScore,
      icon: Trophy,
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Pass Rate (≥50%)",
      value: `${sessions.length ? Math.round((passCount / sessions.length) * 100) : 0}%`,
      icon: CheckCircle2,
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
  ];

  const columns = [
    ["Session", "sessionId"],
    ["Student", "studentName"],
    ["Exam", "title"],
    ["Subject", "subject"],
    ["Score", "totalScore"],
    ["Duration", "durationMinutes"],
    ["Submitted", "endTime"],
  ];

  return (
    <div className="page marks-page">
      <PageHeader
        eyebrow="EVERY RESULT TELLS A STORY"
        title="Student marks"
        description="Find completed submissions, compare scores and follow your students' progress."
      >
        <button
          className="button button-secondary"
          onClick={fetchMarks}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </PageHeader>
      {error && <Notice type="error" text={error} />}
      {!loading && !error && (
        <div className="metric-grid">
          {stats.map((stat) => (
            <Metric
              key={stat.label}
              label={stat.label === "Avg Score" ? "Average points" : stat.label}
              value={stat.value}
              icon={stat.icon}
              accent={stat.label === "Avg Score"}
            />
          ))}
        </div>
      )}
      <section className="surface">
        <div className="table-toolbar">
          <div>
            <h2>Completed submissions</h2>
            <p>Search by student, subject or exam title.</p>
          </div>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Search student marks</span>
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label="Search records"
              type="search"
              placeholder="Find a student or exam…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="field-control pl-10"
            />
          </label>
        </div>
        <div className="marks-sort-toolbar">
          <label htmlFor="marks-sort">Sort by</label>
          <select
            id="marks-sort"
            value={sortField}
            onChange={(event) => {
              setSortField(event.target.value);
              setSortDir("asc");
            }}
            className="field-control"
          >
            {columns.map(([label, field]) => (
              <option key={field} value={field}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="button button-secondary"
            onClick={() =>
              setSortDir((direction) => (direction === "asc" ? "desc" : "asc"))
            }
          >
            {sortDir === "asc" ? (
              <ChevronUp size={15} />
            ) : (
              <ChevronDown size={15} />
            )}
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
        {loading ? (
          <LoadingState label="Loading student marks…" />
        ) : error ? (
          <EmptyState
            title="Results are unavailable"
            description="Use Refresh to try loading student marks again."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={
              search ? "No matching submissions" : "Results will appear here"
            }
            description={
              search
                ? "Try another student name, subject or exam title."
                : "Completed exam submissions will appear here as students finish their assessments."
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table responsive-table marks-table">
              <caption className="sr-only">
                Completed student exam submissions. Column buttons change the
                sort order.
              </caption>
              <thead>
                <tr>
                  {columns.map(([label, field]) => (
                    <th
                      key={field}
                      scope="col"
                      aria-sort={
                        sortField === field
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        className="sort-button"
                        onClick={() => toggleSort(field)}
                      >
                        {label}
                        {sortField === field &&
                          (sortDir === "asc" ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          ))}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((session, index) => (
                  <tr key={session.sessionId ?? index}>
                    <td data-label="Session">
                      <span className="font-mono text-xs text-slate-500">
                        #{session.sessionId}
                      </span>
                    </td>
                    <td data-label="Student">
                      <div className="flex items-center gap-3">
                        <span className="student-initials">
                          {(session.studentName || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <strong className="font-semibold text-sm">
                          {session.studentName || "Unknown student"}
                        </strong>
                      </div>
                    </td>
                    <td data-label="Exam">
                      <span className="font-semibold">
                        {session.title || session.subject || "—"}
                      </span>
                    </td>
                    <td data-label="Subject">{session.subject || "—"}</td>
                    <td data-label="Score">
                      <ScoreBadge
                        score={session.totalScore ?? 0}
                        total={session.totalQuestions ?? 0}
                      />
                    </td>
                    <td data-label="Duration">
                      {session.durationMinutes
                        ? `${session.durationMinutes} min`
                        : "—"}
                    </td>
                    <td data-label="Submitted">
                      <span className="text-xs text-slate-500">
                        {session.endTime || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && sessions.length > 0 && (
          <div className="table-footer">
            <span>
              Showing <strong>{filtered.length}</strong> of{" "}
              <strong>{sessions.length}</strong> submissions
            </span>
            <span>Pass rate is based on a score of at least 50%.</span>
          </div>
        )}
      </section>
    </div>
  );
}
