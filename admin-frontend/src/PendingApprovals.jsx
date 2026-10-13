import { EmptyState, Metric, Notice, PageHeader } from "./components/ui";
import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Brain,
  Clock,
  AlertTriangle,
  ChevronDown,
  Search,
  Sparkles,
  RefreshCw,
  Loader2,
  X,
  Trash2,
  Plus,
} from "lucide-react";

const EXAM_API =
  (import.meta.env.VITE_API_URL || "https://intelliprep-rhx3.onrender.com") +
  "/api/assessment";
const AIAGENT_API =
  (import.meta.env.VITE_API_URL || "https://intelliprep-rhx3.onrender.com") +
  "/api/aiagent";
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="toast-stack fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 min-w-[280px] max-w-[400px] px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            ${
              t.type === "success"
                ? "bg-white border-green-200 text-green-800"
                : t.type === "error"
                  ? "bg-white border-red-200 text-red-800"
                  : "bg-white border-zinc-200 text-zinc-800"
            }`}
        >
          <div
            className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center
            ${t.type === "success" ? "bg-green-100" : t.type === "error" ? "bg-red-100" : "bg-zinc-100"}`}
          >
            {t.type === "success" ? (
              <CheckCircle2
                size={12}
                className="text-green-600"
                strokeWidth={2.5}
              />
            ) : t.type === "error" ? (
              <AlertTriangle
                size={12}
                className="text-red-500"
                strokeWidth={2.5}
              />
            ) : (
              <Brain size={12} className="text-zinc-500" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{t.title}</p>
            {t.body && (
              <p className="text-xs opacity-70 mt-0.5 leading-snug">{t.body}</p>
            )}
          </div>
          <button
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-zinc-100 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Inline Question Editor ───────────────────────────────────────────────────
// Always-on: no read-only mode. Every expanded exam card renders editors directly.
function QuestionEditor({ question, index, total, onChange, onDelete }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      {/* Question header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-xs font-semibold text-orange-700">
            Question {index + 1} of {total}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded-lg transition-all"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Question Text */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Question Text
          </label>
          <textarea
            aria-label="Question text"
            value={question.questionText}
            onChange={(e) => onChange(index, "questionText", e.target.value)}
            rows={3}
            className="w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all placeholder-zinc-300"
            placeholder="Enter the question text here…"
          />
        </div>

        {/* Options A–E */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Answer Options
          </label>
          <div className="space-y-2">
            {(question.options || []).map((opt, oi) => {
              const isCorrect = question.correctOptionIndex === oi;
              return (
                <div
                  key={oi}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                    isCorrect
                      ? "border-orange-300 bg-orange-50"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  {/* Letter badge */}
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect
                        ? "bg-orange-500 text-white"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {OPTION_LETTERS[oi]}
                  </span>

                  {/* Option text input */}
                  <input
                    aria-label="Answer option"
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...question.options];
                      next[oi] = e.target.value;
                      onChange(index, "options", next);
                    }}
                    className="flex-1 bg-transparent outline-none text-sm text-zinc-800 placeholder-zinc-300"
                    placeholder={`Option ${OPTION_LETTERS[oi]}`}
                  />

                  {/* Correct badge */}
                  {isCorrect && (
                    <span className="shrink-0 text-xs font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                      ✓ Correct
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Correct Answer Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0">
            Correct Answer:
          </label>
          <select
            aria-label="Correct answer"
            value={question.correctOptionIndex}
            onChange={(e) =>
              onChange(index, "correctOptionIndex", Number(e.target.value))
            }
            className="text-[12px] border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-800 font-semibold outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
          >
            {(question.options || []).map((opt, oi) => (
              <option key={oi} value={oi}>
                {OPTION_LETTERS[oi]}.{" "}
                {opt
                  ? `${opt.slice(0, 40)}${opt.length > 40 ? "…" : ""}`
                  : `Option ${OPTION_LETTERS[oi]}`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Card ─────────────────────────────────────────────────────────────
function ApprovalCard({ item, onApprove, onReject, processingIds }) {
  const [expanded, setExpanded] = useState(false);
  const [questions, setQuestions] = useState(null); // null = not yet initialised
  const [examTitle, setExamTitle] = useState("");
  const [validationError, setValidationError] = useState(null); // admin-assigned exam title

  const isExam = item.type === "Exam Session";
  const isProcessing = processingIds.has(item.uniqueId);

  // Parse the raw questions from the item JSON
  const parseQuestions = useCallback(() => {
    try {
      const raw = JSON.parse(isExam ? item.questionsJson || "[]" : "[]");
      return (Array.isArray(raw) ? raw : []).map((q) => ({
        questionText: q.questionText ?? "",
        options:
          Array.isArray(q.options) && q.options.length >= 4
            ? q.options.slice(0, 5)
            : ["", "", "", "", ""],
        correctOptionIndex:
          typeof q.correctOptionIndex === "number" ? q.correctOptionIndex : 0,
        explanation: q.explanation ?? "",
      }));
    } catch {
      return [];
    }
  }, [isExam, item.questionsJson]);

  // Initialise questions state and title when expanded for the first time
  const handleToggle = () => {
    if (!expanded && isExam && questions === null) {
      setQuestions(parseQuestions());
      // Default title = OriginalObjective or Subject
      setExamTitle(item.originalObjective || item.subject || "");
    }
    setExpanded((prev) => !prev);
  };

  const handleQuestionChange = (idx, field, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const handleDeleteQuestion = (idx) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        options: ["", "", "", "", ""],
        correctOptionIndex: 0,
        explanation: "",
      },
    ]);
  };

  const validate = () => {
    if (!examTitle.trim())
      return "Please provide an Exam Title before approving.";
    if (!questions || questions.length === 0)
      return "No questions to approve. Add at least one question.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return `Q${i + 1}: Question text is empty.`;
      const filledOptions = (q.options || []).filter((o) => o.trim());
      if (filledOptions.length < 2)
        return `Q${i + 1}: At least 2 options must be filled.`;
      if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length)
        return `Q${i + 1}: Invalid correct answer selected.`;
      if (!q.options[q.correctOptionIndex]?.trim())
        return `Q${i + 1}: The selected correct answer option is empty.`;
    }
    return null;
  };

  const handleApproveClick = () => {
    if (isExam) {
      const err = validate();
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      onApprove(item, questions, examTitle.trim());
    } else {
      onApprove(item, null, null);
    }
  };

  // Study plan details (non-exam)
  let planDetails = [];
  if (!isExam) {
    try {
      planDetails = JSON.parse(item.planDetailsJson || "[]");
    } catch {
      planDetails = [];
    }
  }

  return (
    <div
      className={`approval-card bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
        isProcessing
          ? "opacity-50 pointer-events-none"
          : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      {/* ── Card Header ── */}
      <div className="px-5 py-4 flex items-start gap-4">
        <div
          className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border ${
            isExam
              ? "bg-zinc-50 border-zinc-100 text-zinc-600"
              : "bg-orange-50 border-orange-100 text-orange-600"
          }`}
        >
          {isExam ? <Sparkles size={20} /> : <Brain size={20} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="font-mono text-xs font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              ID: {item.id}
            </span>
            <span
              className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded border ${
                isExam
                  ? "text-zinc-600 bg-zinc-50 border-zinc-100"
                  : "text-orange-600 bg-orange-50 border-orange-100"
              }`}
            >
              {item.type}
            </span>
            <span className="ml-auto text-xs text-zinc-400 font-medium">
              {new Date(
                isExam ? item.startTime : item.createdAt,
              ).toLocaleString()}
            </span>
          </div>

          <h3 className="text-[14px] font-semibold text-zinc-900 leading-snug mb-1.5">
            {isExam
              ? `Subject: ${item.subject}`
              : `Student ID: ${item.studentId}`}
          </h3>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 border border-orange-100 w-fit">
            <Clock size={11} className="text-orange-500 shrink-0" />
            <span className="text-xs text-orange-700 font-medium">
              Pending Admin Approval
            </span>
          </div>
        </div>

        <button
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Collapse ${item.type} ${item.id}`
              : `Review ${item.type} ${item.id}`
          }
          onClick={handleToggle}
          className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* ── Expanded Content ── */}
      {expanded && (
        <div className="border-t border-zinc-100">
          {isExam ? (
            /* ════ EXAM: Always-on inline question editor ════ */
            <div className="px-5 py-5 space-y-4">
              {validationError && (
                <Notice
                  type="error"
                  text={validationError}
                  onDismiss={() => setValidationError(null)}
                />
              )}
              {/* Exam Title input — visible when expanded */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <label className="block text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">
                  📋 Exam Title <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Exam title"
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. Logic Gates — Batch 3 (Set by admin)"
                  className="w-full px-3 py-2 text-sm font-semibold text-zinc-800 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white transition-all"
                />
                <p className="text-xs text-orange-500 mt-1.5 font-medium">
                  This title will be visible to students in the app and in the
                  Admin Marks dashboard.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {questions
                    ? `${questions.length} Question${questions.length !== 1 ? "s" : ""} — Edit directly below`
                    : "Loading…"}
                </p>
                {questions && (
                  <span className="text-xs text-orange-600 font-semibold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    All fields editable
                  </span>
                )}
              </div>

              {/* Question editors */}
              {questions && questions.length === 0 && (
                <div className="text-center py-6 text-zinc-400 text-sm bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  No questions yet. Click <strong>"+ Add Question"</strong>{" "}
                  below to start.
                </div>
              )}

              {questions &&
                questions.map((q, i) => (
                  <QuestionEditor
                    key={i}
                    question={q}
                    index={i}
                    total={questions.length}
                    onChange={handleQuestionChange}
                    onDelete={handleDeleteQuestion}
                  />
                ))}

              {/* Add question button */}
              {questions && (
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-200 rounded-xl py-3.5 text-[12px] font-bold text-orange-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                >
                  <Plus size={14} /> Add Question
                </button>
              )}

              {/* ── Action Buttons (large, prominent) ── */}
              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  disabled={isProcessing}
                  onClick={() => onReject(item)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-50 border-2 border-red-200 hover:bg-red-100 hover:border-red-400 text-red-700 font-bold text-[14px] transition-all active:scale-[0.98]"
                >
                  <XCircle size={18} /> Reject &amp; Delete
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleApproveClick}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[14px] shadow-md shadow-orange-200 transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 size={18} /> Approve Exam
                </button>
              </div>
            </div>
          ) : (
            /* ════ STUDY PLAN: Read-only table ════ */
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Generated Study Plan
              </p>
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-4 py-2.5 text-xs font-bold text-zinc-500">
                        Day
                      </th>
                      <th className="px-4 py-2.5 text-xs font-bold text-zinc-500">
                        Topic
                      </th>
                      <th className="px-4 py-2.5 text-xs font-bold text-zinc-500">
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {Array.isArray(planDetails) && planDetails.length > 0 ? (
                      planDetails.map((day, i) => (
                        <tr
                          key={i}
                          className="hover:bg-zinc-50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[12px] text-zinc-600">
                            {day.day}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-zinc-800 font-medium">
                            {day.topic}
                          </td>
                          <td className="px-4 py-2.5 text-[12px]">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                day.priority === "High"
                                  ? "bg-red-50 text-red-600 border border-red-100"
                                  : day.priority === "Medium"
                                    ? "bg-orange-50 text-orange-600 border border-orange-100"
                                    : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {day.priority}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-3 text-[12px] text-zinc-400 text-center"
                        >
                          No plan details found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Study plan approve button */}
              <div className="pt-1">
                <button
                  disabled={isProcessing}
                  onClick={() => onApprove(item, null)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[14px] shadow-md shadow-orange-200 transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 size={18} /> Approve Study Plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Collapsed footer (exam only — shows quick action buttons) ── */}
      {!expanded && (
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/40 flex flex-wrap items-center justify-between gap-3">
          <button
            aria-expanded={expanded}
            onClick={handleToggle}
            className="text-[12px] font-semibold text-zinc-500 hover:text-orange-600 transition-colors"
          >
            ▶ Expand to Review &amp; Edit
          </button>
          {isExam && (
            <div className="flex items-center gap-2">
              <button
                disabled={isProcessing}
                onClick={() => onReject(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-all"
              >
                <XCircle size={12} /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PendingApprovals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState([]);
  const [processingIds, setProcessingIds] = useState(new Set());

  const addToast = useCallback((type, title, body) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, body }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      5000,
    );
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const h = { Authorization: `Bearer ${token}` };

      const [examsRes, plansRes] = await Promise.all([
        fetch(`${EXAM_API}/sessions`, { headers: h }),
        fetch(`${AIAGENT_API}/plans`, { headers: h }),
      ]);

      if (!examsRes.ok || !plansRes.ok)
        throw new Error(
          "Could not load the complete review queue. Please refresh to try again.",
        );
      const examsData = examsRes.ok ? await examsRes.json() : [];
      const plansRaw = plansRes.ok ? await plansRes.json() : {};
      const plansData = Array.isArray(plansRaw)
        ? plansRaw
        : (plansRaw.plans ?? []);

      const pendingExams = (Array.isArray(examsData) ? examsData : [])
        .filter((e) => e.status === "PendingAdminApproval")
        .map((e) => ({ ...e, type: "Exam Session", uniqueId: `exam-${e.id}` }));

      const pendingPlans = (Array.isArray(plansData) ? plansData : [])
        .filter((p) => p.isApproved === false)
        .map((p) => ({ ...p, type: "Study Plan", uniqueId: `plan-${p.id}` }));

      setItems(
        [...pendingExams, ...pendingPlans].sort(
          (a, b) =>
            new Date(b.type === "Exam Session" ? b.startTime : b.createdAt) -
            new Date(a.type === "Exam Session" ? a.startTime : a.createdAt),
        ),
      );
    } catch (err) {
      setLoadError(err.message || "Could not load pending items.");
      addToast("error", "Failed to load pending items", err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (item, editedQuestions, examTitle) => {
    setProcessingIds((prev) => new Set(prev).add(item.uniqueId));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const isExam = item.type === "Exam Session";
      const url = isExam
        ? `${EXAM_API}/approve/${item.id}`
        : `${AIAGENT_API}/approve-plan/${item.id}`;

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(isExam && {
          body: JSON.stringify({
            editedQuestions: editedQuestions ?? [],
            title: examTitle ?? "",
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || data.message || "Approval failed");

      setItems((prev) => prev.filter((i) => i.uniqueId !== item.uniqueId));
      addToast(
        "success",
        "Approved Successfully",
        isExam
          ? `Exam #${item.id} "${examTitle || item.subject}" approved with ${editedQuestions?.length ?? 0} questions.`
          : `Study Plan #${item.id} is now approved.`,
      );
    } catch (err) {
      addToast("error", "Approval Failed", err.message);
    } finally {
      setProcessingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.uniqueId);
        return n;
      });
    }
  };

  const handleReject = async (item) => {
    if (item.type !== "Exam Session") return;
    setProcessingIds((prev) => new Set(prev).add(item.uniqueId));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${EXAM_API}/reject/${item.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || data.message || "Rejection failed");
      setItems((prev) => prev.filter((i) => i.uniqueId !== item.uniqueId));
      addToast(
        "success",
        "Rejected",
        `Exam Session #${item.id} has been marked as abandoned.`,
      );
    } catch (err) {
      addToast("error", "Rejection Failed", err.message);
    } finally {
      setProcessingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.uniqueId);
        return n;
      });
    }
  };

  const visibleItems = items.filter((item) => {
    const matchType = filter === "All" || item.type === filter;
    const searchTarget =
      (item.type === "Exam Session"
        ? item.subject
        : `student ${item.studentId}`) || "";
    const matchSearch =
      !search ||
      searchTarget.toLowerCase().includes(search.toLowerCase()) ||
      String(item.id).includes(search);
    return matchType && matchSearch;
  });

  const pendingCount = items.length;
  const examCount = items.filter((i) => i.type === "Exam Session").length;
  const planCount = items.filter((i) => i.type === "Study Plan").length;

  return (
    <div className="page approvals-page">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        eyebrow="THE HUMAN TOUCH MATTERS"
        title="Pending approvals"
        description="Take a closer look. Review and refine AI-generated content before students use it."
      >
        <button
          className="button button-secondary"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </PageHeader>
      {loadError && <Notice type="error" text={loadError} />}
      <div className="metric-grid metric-grid-three">
        <Metric
          label="Awaiting review"
          value={loading || loadError ? "—" : pendingCount}
          detail="Your full review queue"
          icon={ShieldCheck}
          accent
        />
        <Metric
          label="Exam sessions"
          value={loading || loadError ? "—" : examCount}
          detail="Questions ready for a final check"
          icon={Sparkles}
        />
        <Metric
          label="Study plans"
          value={loading || loadError ? "—" : planCount}
          detail="Learning schedules to review"
          icon={Brain}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="surface table-toolbar approval-toolbar">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/20 w-full sm:w-80 transition-all">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search approvals"
            placeholder="Search by ID, subject, or student…"
            className="bg-transparent outline-none text-sm text-gray-900 w-full placeholder-gray-400"
          />
        </div>
        <div
          className="filter-group"
          role="group"
          aria-label="Filter approvals"
        >
          {["All", "Exam Session", "Study Plan"].map((s) => (
            <button
              key={s}
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className="transition-colors"
            >
              {s === "All" ? "All items" : `${s}s`}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-gray-500 pr-2">
          Showing{" "}
          <span className="font-bold text-gray-900">{visibleItems.length}</span>{" "}
          items
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <span className="text-[14px] font-bold text-gray-500">
              Loading pending approvals...
            </span>
          </div>
        ) : loadError ? (
          <EmptyState
            icon={ShieldCheck}
            title="Review queue unavailable"
            description="Refresh to load pending items. No approval actions have been taken."
          />
        ) : visibleItems.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-5">
              <ShieldCheck size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {pendingCount
                ? "No matching items"
                : "Your review queue is clear"}
            </h3>
            <p className="text-[14px] text-gray-500 mt-2 max-w-sm">
              There are no items matching your current filters.
            </p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <ApprovalCard
              key={item.uniqueId}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              processingIds={processingIds}
            />
          ))
        )}
      </div>
    </div>
  );
}
