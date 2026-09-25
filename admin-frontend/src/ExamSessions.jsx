import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ClipboardList, Play, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, Zap, BookOpen, Trophy, ChevronRight, Loader2,
  FlaskConical, X, Send, Sparkles, CheckCheck, Brain, Eye,
  Download, Trash2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5087/api/assessment';

const STATUS_META = {
  Pending:    { color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   icon: Clock,         label: 'Pending'     },
  Ready:      { color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-200',  icon: CheckCheck,    label: 'Ready'       },
  InProgress: { color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200',    icon: Play,          label: 'In Progress' },
  Completed:  { color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: CheckCircle2,  label: 'Completed'   },
  Abandoned:  { color: 'text-red-500',     bg: 'bg-red-50',      border: 'border-red-200',     icon: AlertTriangle, label: 'Abandoned'   },
};

const A_L_ICT_TOPICS = [
  'ICT',
  'Networking',
  'Logic Gates',
  'Data Structures',
  'Data Representation',
  'Systems Analysis',
  'Web Development',
  'Python Programming',
  'Database',
  'Operating Systems',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META['Pending'];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.color} ${m.bg} ${m.border}`}>
      <Icon size={10} strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  const accentMap = {
    orange: 'from-orange-500 to-orange-600',
    blue:   'from-blue-500 to-blue-600',
    emerald:'from-emerald-500 to-emerald-600',
    violet: 'from-violet-500 to-violet-600',
  };
  return (
    <div className="bg-white rounded-xl border border-zinc-200/80 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className="text-[22px] font-bold text-zinc-900 leading-none mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Self-Dismissing Toast ─────────────────────────────────────────────────────
function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 min-w-[280px] max-w-[360px] px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            animate-[slideUp_0.25s_ease-out]
            ${t.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-800'
              : t.type === 'error'
                ? 'bg-white border-red-200 text-red-800'
                : 'bg-white border-zinc-200 text-zinc-800'
            }`}
        >
          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center
            ${t.type === 'success' ? 'bg-emerald-100' : t.type === 'error' ? 'bg-red-100' : 'bg-zinc-100'}`}>
            {t.type === 'success'
              ? <CheckCircle2 size={12} className="text-emerald-600" strokeWidth={2.5} />
              : t.type === 'error'
                ? <AlertTriangle size={12} className="text-red-500" strokeWidth={2.5} />
                : <Brain size={12} className="text-zinc-500" strokeWidth={2.5} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
            {t.body && <p className="text-[11px] opacity-70 mt-0.5 leading-snug">{t.body}</p>}
          </div>
          <button
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

function SessionQrCard({ session }) {
  const qrRef = useRef(null);

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `session-${session.id || session.sessionId}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-2">
      <div ref={qrRef} className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        <QRCodeCanvas
          size={150}
          value={String(session.sessionId || session.id || '')}
          bgColor="#ffffff"
          fgColor="#111827"
        />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-700 hover:text-violet-800 transition-colors"
      >
        <Download size={10} strokeWidth={2.5} />
        Download
      </button>
    </div>
  );
}

// ── View Questions Modal ──────────────────────────────────────────────────────
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function ViewQuestionsModal({ session, onClose }) {
  // Safe parse — the string may be "[]" or a JSON array
  let questions = [];
  try {
    const parsed = JSON.parse(session.questionsJson || '[]');
    questions = Array.isArray(parsed) ? parsed : [];
  } catch {
    questions = [];
  }

  // Trap Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Eye size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">Generated Questions</p>
              <p className="text-[10px] text-white/70">
                Session #{session.id} · {session.subject || 'ICT'} · {questions.length} MCQ{questions.length !== 1 ? 's' : ''} · Agent 2 — Content Synthesizer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                <Brain size={20} className="text-violet-400" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-700">No questions available</p>
              <p className="text-[12px] text-zinc-400 text-center">
                This session has no stored questions yet.<br />
                Run the Content Synthesizer to generate them.
              </p>
            </div>
          ) : (
            questions.map((q, qi) => (
              <div
                key={qi}
                className="rounded-xl border border-zinc-200 overflow-hidden"
              >
                {/* Question header bar */}
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {qi + 1}
                  </span>
                  <p className="text-[13px] font-bold text-zinc-900 leading-snug">
                    {q.questionText || '(No question text)'}
                  </p>
                </div>

                {/* Options */}
                <div className="px-4 py-3 space-y-1.5">
                  {(q.options || []).map((opt, oi) => {
                    const isCorrect = oi === q.correctOptionIndex;
                    return (
                      <div
                        key={oi}
                        className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-[12px] leading-snug transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-zinc-100 text-zinc-600'
                        }`}
                      >
                        {/* Option letter badge */}
                        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                          isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          {OPTION_LETTERS[oi] ?? oi + 1}
                        </span>
                        <span className={isCorrect ? 'font-semibold' : ''}>{opt}</span>
                        {isCorrect && (
                          <CheckCircle2
                            size={13}
                            className="ml-auto shrink-0 text-emerald-500 mt-0.5"
                            strokeWidth={2.5}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-blue-500 mt-0.5 leading-tight">
                      Explanation
                    </span>
                    <p className="text-[11px] text-blue-700 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <span className="text-[10px] text-zinc-400">
            Generated by Groq LLM · {questions[0]?.generatedBy ?? 'ContentSynthesizerService'}
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 active:scale-[0.98] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Synthesize Button ─────────────────────────────────────────────────────────
function SynthesizeButton({ session, onSynthesize, onView }) {
  const [subject, setSubject] = useState(session.subject || 'ICT');
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isReady = session.status === 'Ready';

  if (isReady) {
    return (
      <button
        onClick={() => onView(session)}
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 active:scale-95 transition-all"
      >
        <Eye size={10} strokeWidth={2.5} />
        View Questions
      </button>
    );
  }

  if (session.status !== 'Pending') {
    return <span className="text-[10px] text-zinc-300">—</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        {/* Subject picker toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          className="h-6 px-2 rounded-l-md border border-r-0 border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-medium hover:bg-violet-100 transition-colors"
        >
          {subject.length > 8 ? subject.slice(0, 8) + '…' : subject} ▾
        </button>
        {/* Synthesize trigger */}
        <button
          onClick={() => { setOpen(false); onSynthesize(session.id, subject); }}
          className="h-6 px-2.5 rounded-r-md bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-1"
        >
          <Sparkles size={9} strokeWidth={2.5} />
          Run Synthesizer
        </button>
      </div>

      {/* Subject dropdown */}
      {open && (
        <div className="absolute z-30 right-0 top-7 w-44 bg-white rounded-lg border border-zinc-200 shadow-xl py-1">
          <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
            Select Topic
          </p>
          {A_L_ICT_TOPICS.map(t => (
            <button
              key={t}
              onClick={() => { setSubject(t); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-violet-50 hover:text-violet-700 transition-colors
                ${subject === t ? 'text-violet-700 font-semibold bg-violet-50/60' : 'text-zinc-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Request Exam Modal ────────────────────────────────────────────────────────
function RequestExamModal({ onClose, onSuccess }) {
  const [objective, setObjective] = useState('');
  const [targetExam, setTargetExam] = useState('A/L');
  const [subject, setSubject]       = useState(A_L_ICT_TOPICS[0]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [planResult, setPlanResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!objective.trim()) { setError('Please enter a learning objective.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/request-exam`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ objective, targetExam, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setPlanResult(data);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">Request Custom Mock Exam</p>
              <p className="text-[10px] text-white/70">Planning Coordinator Agent · Agentic AI Workflow</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          {!planResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Learning Objective
                </label>
                <textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="e.g. A/L ICT – Data Structures & Algorithms Mock Exam with focus on time complexity"
                  rows={3}
                  className="w-full text-[13px] text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 resize-none placeholder-zinc-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Target Exam
                  </label>
                  <select
                    value={targetExam}
                    onChange={e => setTargetExam(e.target.value)}
                    className="w-full text-[13px] text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-orange-400 bg-white"
                  >
                    <option>A/L</option>
                    <option>O/L</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full text-[13px] text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-orange-400 bg-white"
                  >
                    {A_L_ICT_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <p className="text-[12px] text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-orange-600 text-white text-[13px] font-semibold hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} strokeWidth={2.5} />}
                {loading ? 'Generating Plan…' : 'Generate Exam Plan'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <p className="text-[12px] text-emerald-700 font-medium">
                  Plan generated! Session ID: {planResult.examSession?.id}
                </p>
              </div>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Agent Steps</p>
              {planResult.agenticPlan?.Steps?.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                    {step.StepNumber}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-700">{step.AgentName}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{step.Task}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={onClose}
                className="w-full h-9 rounded-lg bg-zinc-100 text-zinc-600 text-[13px] font-medium hover:bg-zinc-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ExamSessions Page ────────────────────────────────────────────────────
export default function ExamSessions() {
  const [sessions, setSessions]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [modalOpen, setModalOpen]             = useState(false);
  const [filter, setFilter]                   = useState('All');
  const [synthesizingIds, setSynthesizingIds] = useState(new Set());
  const [deletingIds, setDeletingIds]         = useState(new Set());
  const [toasts, setToasts]                   = useState([]);
  const [viewSession, setViewSession]         = useState(null); // session to show in ViewQuestionsModal

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const addToast = useCallback((type, title, body) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, body }]);
    // Auto-dismiss after 5 s
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Content Synthesizer handler ─────────────────────────────────────────────
  const handleSynthesize = useCallback(async (sessionId, subject) => {
    // Guard: don't double-fire
    if (synthesizingIds.has(sessionId)) return;

    setSynthesizingIds(prev => new Set([...prev, sessionId]));

    addToast('info', 'Synthesizer Running…', `Calling Groq LLM for "${subject}" questions. This may take 10–20 s.`);

    try {
      const url = `${API_BASE}/synthesize/${sessionId}?subject=${encodeURIComponent(subject)}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      addToast(
        'success',
        'Questions Synthesized Successfully!',
        `${data.questionsCount ?? data.questions?.length ?? '5'} MCQs generated for "${subject}" · Session #${sessionId} is now Ready.`,
      );

      // Optimistically update this row's status in local state
      setSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, status: 'Ready', questionsReady: true } : s),
      );

      // Full refresh after a beat to sync any server-side changes
      setTimeout(fetchSessions, 800);

    } catch (err) {
      addToast(
        'error',
        'Synthesis Failed',
        err.message || 'An unexpected error occurred. Check the backend logs.',
      );
    } finally {
      setSynthesizingIds(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }, [synthesizingIds, addToast, fetchSessions]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    const confirmed = window.confirm('Delete this exam session? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingIds(prev => new Set([...prev, sessionId]));

    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Delete failed (${res.status})`);
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      addToast('success', 'Session Deleted', `Session #${sessionId} was removed successfully.`);
    } catch (err) {
      addToast('error', 'Delete Failed', err.message || 'Unable to delete the session.');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }, [addToast]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const total     = sessions.length;
  const ready     = sessions.filter(s => s.status === 'Ready').length;
  const completed = sessions.filter(s => s.status === 'Completed').length;
  const avgScore  = completed
    ? Math.round(sessions.filter(s => s.status === 'Completed').reduce((a, s) => a + s.totalScore, 0) / completed)
    : 0;

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = filter === 'All' ? sessions : sessions.filter(s => s.status === filter);

  // ── Table column headers ────────────────────────────────────────────────────
  const TABLE_HEADERS = ['ID', 'Session GUID', 'Subject', 'Status', 'Questions', 'Timer', 'Score', 'Started', 'Ended', 'QR', 'Actions'];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm">
              <ClipboardList size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight leading-none">
                Exam Sessions
              </h1>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                විභාග සැසි · Member 1 &amp; 2 · UC3.1–3.3 · UC5.2
              </p>
            </div>
          </div>
          <p className="text-[12px] text-zinc-500 mt-2 ml-0.5">
            Monitor sessions, trigger the Content Synthesizer Agent (Member 2) to generate Groq-powered MCQs.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-[12px] font-medium hover:border-zinc-300 hover:bg-zinc-50 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} strokeWidth={2.5} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-orange-600 text-white text-[12px] font-semibold hover:bg-orange-700 active:scale-[0.98] shadow-sm transition-all"
          >
            <Zap size={12} strokeWidth={2.5} />
            Request Mock Exam
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} label="Total Sessions" value={total}           accent="orange"  sub="all time" />
        <StatCard icon={Brain}         label="Ready (Agent 2)" value={ready}           accent="violet"  sub="questions synthesized" />
        <StatCard icon={CheckCircle2}  label="Completed"        value={completed}       accent="emerald" sub="submitted" />
        <StatCard icon={Trophy}        label="Avg Score"         value={`${avgScore}pts`} accent="blue"    sub="completed sessions" />
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-lg w-fit border border-zinc-200/60 flex-wrap">
        {['All', 'Pending', 'Ready', 'InProgress', 'Completed', 'Abandoned'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              filter === tab
                ? 'bg-white text-orange-700 shadow-sm border border-orange-200/60'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab === 'InProgress' ? 'In Progress' : tab}
            {tab !== 'All' && (
              <span className="ml-1.5 text-[10px] font-semibold opacity-70">
                {sessions.filter(s => s.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Data Table ── */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {/* Table toolbar */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-orange-600" />
            <span className="text-[13px] font-semibold text-zinc-800">Assessment Sessions</span>
            <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              {filtered.length} records
            </span>
          </div>
          {/* Agent 2 legend chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100">
            <Sparkles size={10} className="text-violet-600" />
            <span className="text-[10px] font-semibold text-violet-700">
              Agent 2 — Content Synthesizer
            </span>
          </div>
        </div>

        {loading && !error ? (
          <div className="flex items-center justify-center py-16 gap-2 text-zinc-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading sessions…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <BookOpen size={20} className="text-orange-400" />
            </div>
            <p className="text-[14px] font-semibold text-zinc-700">No sessions found</p>
            <p className="text-[12px] text-zinc-400">
              {error
                ? 'The database is empty or the backend is unavailable.'
                : 'Use "Request Mock Exam" to create the first session.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100">
                  {TABLE_HEADERS.map(h => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 px-4 py-2.5 first:pl-5 last:pr-5 whitespace-nowrap"
                    >
                      {h === 'Actions' ? (
                        <span className="flex items-center gap-1">
                          <Sparkles size={9} className="text-violet-500" />
                          {h}
                        </span>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((s, i) => {
                  const isSynth = synthesizingIds.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${
                        isSynth
                          ? 'bg-violet-50/40'
                          : i % 2 === 0 ? 'hover:bg-orange-50/20' : 'bg-zinc-50/30 hover:bg-orange-50/20'
                      }`}
                    >
                      {/* ID */}
                      <td className="px-5 py-3">
                        <span className="text-[12px] font-bold text-zinc-900">#{s.id}</span>
                      </td>

                      {/* Session GUID */}
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[100px] block">
                          {(s.sessionId || '').slice(0, 12)}…
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-zinc-700 font-medium">{s.subject || '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Questions Ready */}
                      <td className="px-4 py-3">
                        {s.questionsReady
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600">
                              <CheckCheck size={10} strokeWidth={2.5} /> Ready
                            </span>
                          : <span className="text-[10px] text-zinc-300">—</span>
                        }
                      </td>

                      {/* Timer Locked */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.isTimerLocked ? 'text-orange-600' : 'text-zinc-400'}`}>
                          {s.isTimerLocked
                            ? <><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Locked</>
                            : '—'
                          }
                        </span>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3">
                        <span className={`text-[13px] font-bold ${s.totalScore > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                          {s.totalScore > 0 ? `${s.totalScore} pts` : '—'}
                        </span>
                      </td>

                      {/* Started */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-zinc-500">{fmtDate(s.startTime)}</span>
                      </td>

                      {/* Ended */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-zinc-500">{fmtDate(s.endTime)}</span>
                      </td>

                      {/* QR Code */}
                      <td className="px-4 py-3">
                        <SessionQrCard session={s} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex flex-col items-start gap-2">
                          {isSynth ? (
                            /* Per-row loading state while Groq is processing */
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-600">
                              <Loader2 size={11} className="animate-spin" strokeWidth={2.5} />
                              Synthesizing…
                            </span>
                          ) : (
                            <SynthesizeButton
                              session={s}
                              onSynthesize={handleSynthesize}
                              onView={setViewSession}
                            />
                          )}

                          <button
                            type="button"
                            disabled={deletingIds.has(s.id)}
                            onClick={() => handleDeleteSession(s.id)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-red-200 bg-red-50 text-[10px] font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {deletingIds.has(s.id) ? <Loader2 size={10} className="animate-spin" strokeWidth={2.5} /> : <Trash2 size={10} strokeWidth={2.5} />}
                            {deletingIds.has(s.id) ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AI Workflow Legend ── */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-orange-600" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Agentic AI Workflow — Planning Coordinator &amp; Content Synthesizer
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { step: '1', name: 'Content Synthesizer', desc: 'Reads ICT Excel dataset → few-shot Groq prompt → 5 new MCQs', agent: '2' },
            { step: '2', name: 'Validation Agent',    desc: 'Validates distractor quality & Bloom\'s taxonomy',            agent: '3' },
            { step: '3', name: 'Tutor Approval',      desc: 'Human-in-the-loop review gate (async wait)',                  agent: '4' },
            { step: '4', name: 'Finalizer Agent',     desc: 'Assembles ExamSession & notifies student',                    agent: '5' },
          ].map(a => (
            <div key={a.step} className="bg-white/70 border border-orange-100 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">{a.step}</span>
                <span className="text-[10px] font-semibold text-zinc-700">{a.name}</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-snug">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Request Exam Modal ── */}
      {modalOpen && (
        <RequestExamModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); setTimeout(fetchSessions, 500); }}
        />
      )}

      {/* ── View Questions Modal ── */}
      {viewSession && (
        <ViewQuestionsModal
          session={viewSession}
          onClose={() => setViewSession(null)}
        />
      )}

      {/* ── Toast Notifications ── */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
