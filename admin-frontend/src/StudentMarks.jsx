import {
  EmptyState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
} from "./components/ui";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trophy,
  RefreshCw,
  ClipboardList,
  Users,
  ChevronUp,
  ChevronDown,
  Search,
  CheckCircle2,
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
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

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns a rounded integer percentage, or null when total is 0. */
function scorePct(score, total) {
  if (!total || total === 0) return null;
  return Math.round((score / total) * 100);
}

/** Strips the trailing " UTC" the backend appends and trims whitespace. */
function formatDate(raw) {
  if (!raw) return "—";
  return raw.replace(" UTC", "").trim();
}

// ── ResultBadge ────────────────────────────────────────────────────────────────
// Colour-coded Pass/Fail pill: emerald for ≥ 50 %, red for < 50 %.

function ResultBadge({ score, total }) {
  const p = scorePct(score, total);
  if (p === null)
    return <span className="text-slate-400 text-xs font-medium">N/A</span>;
  const pass = p >= 50;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
        pass
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-1 ring-red-200"
      }`}
    >
      {pass ? (
        <CheckCircle2 size={11} strokeWidth={2.5} />
      ) : (
        <Trophy size={11} strokeWidth={2.5} />
      )}
      {score}/{total} · {p}% — {pass ? "Pass" : "Fail"}
    </span>
  );
}

// ── StudentAvatar ──────────────────────────────────────────────────────────────

function StudentAvatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex-shrink-0 select-none">
      {initials || "?"}
    </span>
  );
}

// ── ExamGroup ─────────────────────────────────────────────────────────────────
// One accordion card per exam title.
// Header shows aggregated stats; expanded section shows a student result table.

function ExamGroup({ group, isOpen, onToggle }) {
  const { title, subject, sessions } = group;

  // Aggregate pass rate and average score for the header pills
  const passCount = sessions.filter((s) => {
    const p = scorePct(s.totalScore, s.totalQuestions);
    return p !== null && p >= 50;
  }).length;
  const passRate =
    sessions.length > 0 ? Math.round((passCount / sessions.length) * 100) : 0;
  const avgPct =
    sessions.length > 0
      ? Math.round(
          sessions.reduce(
            (acc, s) => acc + (scorePct(s.totalScore, s.totalQuestions) ?? 0),
            0,
          ) / sessions.length,
        )
      : 0;

  const displayTitle = title || subject || "Untitled Exam";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow duration-150 hover:shadow-md">
      {/* ── Accordion header button ── */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left hover:bg-slate-50/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset"
      >
        {/* Exam icon tile */}
        <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
          <BookOpen size={17} className="text-orange-600" strokeWidth={2.1} />
        </span>

        {/* Title + subject */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-[13.5px] leading-snug truncate">
            {displayTitle}
          </p>
          {subject && displayTitle !== subject && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subject}</p>
          )}
        </div>

        {/* Stats pills — visible on sm+ */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold whitespace-nowrap">
            <Users size={10} />
            {sessions.length} result{sessions.length !== 1 ? "s" : ""}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              passRate >= 50
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            <TrendingUp size={10} />
            {passRate}% pass
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-semibold whitespace-nowrap">
            <Trophy size={10} />
            {avgPct}% avg
          </span>
        </div>

        {/* Expand / collapse chevron */}
        <span className="flex-shrink-0 text-slate-400 ml-1">
          {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </span>
      </button>

      {/* ── Expanded student result table ── */}
      {isOpen && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider w-[40%]">
                    Student
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                    Score &amp; Result
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Duration
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((s, idx) => (
                  <tr
                    key={s.sessionId ?? idx}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Student name + email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <StudentAvatar name={s.studentName} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-[13px] leading-tight truncate">
                            {s.studentName || "Unknown Student"}
                          </p>
                          {s.studentEmail && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {s.studentEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Pass/Fail badge */}
                    <td className="px-5 py-3.5">
                      <ResultBadge
                        score={s.totalScore}
                        total={s.totalQuestions}
                      />
                    </td>

                    {/* Duration */}
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-[12px]">
                        <Clock size={12} className="text-slate-400" />
                        {s.durationMinutes ? `${s.durationMinutes} min` : "—"}
                      </span>
                    </td>

                    {/* Submitted date */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11.5px]">
                        <Calendar size={11} className="text-slate-400" />
                        {formatDate(s.endTime)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentMarks() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  // Set of exam-title keys whose accordion panels are currently open
  const [openGroups, setOpenGroups] = useState(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────
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
          sessionId:
            item.sessionId ?? item.SessionId ?? item.id ?? item.Id ?? index,
          sessionGuid: item.sessionGuid ?? item.SessionGuid ?? "",
          studentId: item.studentId ?? item.StudentId ?? "",
          // Backend always sends camelCase studentName — no fallback to "Student #"
          studentName:
            item.studentName ?? item.StudentName ?? "Unknown Student",
          studentEmail:
            item.studentEmail ??
            item.StudentEmail ??
            item.email ??
            item.Email ??
            "",
          title:
            item.title ??
            item.Title ??
            item.examTitle ??
            item.ExamTitle ??
            "",
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

  // ── Group by exam title ────────────────────────────────────────────────────
  // Each unique exam title becomes one accordion card.  Within the card,
  // sessions are sorted newest-first so the most recent attempt is at the top.
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const key = s.title || s.subject || "Untitled Exam";
      if (!map.has(key)) {
        map.set(key, { title: s.title, subject: s.subject, sessions: [] });
      }
      map.get(key).sessions.push(s);
    }
    // Sort sessions within each group newest-first
    for (const g of map.values()) {
      g.sessions.sort((a, b) =>
        (b.endTime || "").localeCompare(a.endTime || ""),
      );
    }
    // Sort groups by number of results (most active exam first)
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.sessions.length - a.sessions.length)
      .map(([key, g]) => ({ key, ...g }));
  }, [sessions]);

  // ── Filter groups by search query ──────────────────────────────────────────
  // • Exam-title match → keep entire group (all students visible)
  // • Student-name/email match → keep only matching student rows in that group
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;

    return groups
      .map((group) => {
        const titleMatch =
          (group.title || "").toLowerCase().includes(q) ||
          (group.subject || "").toLowerCase().includes(q);
        if (titleMatch) return group;

        const matchedSessions = group.sessions.filter(
          (s) =>
            (s.studentName || "").toLowerCase().includes(q) ||
            (s.studentEmail || "").toLowerCase().includes(q),
        );
        return matchedSessions.length > 0
          ? { ...group, sessions: matchedSessions }
          : null;
      })
      .filter(Boolean);
  }, [groups, search]);

  // ── Accordion toggle ───────────────────────────────────────────────────────
  const toggleGroup = useCallback((key) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalSubmissions = sessions.length;
  const uniqueStudents = new Set(
    sessions.map((s) => s.studentId || s.studentName),
  ).size;
  const uniqueExams = groups.length;
  const passCount = sessions.filter((s) => {
    const p = scorePct(s.totalScore, s.totalQuestions);
    return p !== null && p >= 50;
  }).length;
  const overallPassRate = totalSubmissions
    ? Math.round((passCount / totalSubmissions) * 100)
    : 0;

  // Submission count within the current filtered view (for footer)
  const filteredSubmissions = filteredGroups.reduce(
    (n, g) => n + g.sessions.length,
    0,
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page marks-page">
      <PageHeader
        eyebrow="EVERY RESULT TELLS A STORY"
        title="Student marks"
        description="Browse completed exam sessions — expand any row to view every student's result."
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

      {/* ── Metric summary cards ── */}
      {!loading && !error && (
        <div className="metric-grid">
          <Metric
            label="Total submissions"
            value={totalSubmissions}
            icon={ClipboardList}
          />
          <Metric
            label="Unique students"
            value={uniqueStudents}
            icon={Users}
          />
          <Metric label="Unique exams" value={uniqueExams} icon={BookOpen} />
          <Metric
            label="Pass rate (≥50%)"
            value={`${overallPassRate}%`}
            icon={CheckCircle2}
            accent
          />
        </div>
      )}

      {/* ── Accordion section ── */}
      <section className="surface">
        {/* Toolbar: title + search */}
        <div className="table-toolbar">
          <div>
            <h2>Exam sessions</h2>
            <p>Click an exam card to expand and see each student&apos;s result.</p>
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
              placeholder="Find an exam or student…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-control pl-10"
            />
          </label>
        </div>

        {/* Content states */}
        {loading ? (
          <LoadingState label="Loading student marks…" />
        ) : error ? (
          <EmptyState
            title="Results are unavailable"
            description="Use Refresh to try loading student marks again."
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={
              search ? "No matching exams or students" : "No exam results yet"
            }
            description={
              search
                ? "Try a different exam title or student name."
                : "Completed exam submissions will appear here once students finish their assessments."
            }
          />
        ) : (
          <div className="flex flex-col gap-3 pb-1">
            {filteredGroups.map((group) => (
              <ExamGroup
                key={group.key}
                group={group}
                isOpen={openGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
            ))}
          </div>
        )}

        {/* Footer: live counts */}
        {!loading && !error && sessions.length > 0 && (
          <div className="table-footer">
            <span>
              Showing{" "}
              <strong>{filteredGroups.length}</strong> exam
              {filteredGroups.length !== 1 ? "s" : ""},{" "}
              <strong>{filteredSubmissions}</strong> submission
              {filteredSubmissions !== 1 ? "s" : ""}
            </span>
            <span>Pass threshold: 50% or above.</span>
          </div>
        )}
      </section>
    </div>
  );
}
