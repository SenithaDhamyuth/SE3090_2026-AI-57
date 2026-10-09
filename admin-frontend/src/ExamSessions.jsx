import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ClipboardList, Play, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, Zap, BookOpen, Trophy, Loader2,
  X, Send, Sparkles, CheckCheck, Brain, Eye, Download, Trash2,
  QrCode, CalendarDays, Timer, UserRound, Target, Search, ShieldCheck,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const API_ROOT = import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com';
const API_BASE = `${API_ROOT}/api/assessment`;

function adminHeaders(extra = {}) {
  const token = localStorage.getItem('admin_token');
  if (!token) throw new Error('Your admin session has expired. Please sign in again.');
  return {
    Accept: 'application/json',
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

const STATUS_META = {
  Pending:    { color: 'text-orange-600',   bg: 'bg-orange-50',    border: 'border-orange-200',   icon: Clock,         label: 'Pending'     },
  PendingAdminApproval: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Clock, label: 'Pending Approval' },
  Ready:      { color: 'text-emerald-700',  bg: 'bg-emerald-50',   border: 'border-emerald-200',  icon: CheckCheck,    label: 'Ready'       },
  InProgress: { color: 'text-blue-700',     bg: 'bg-blue-50',      border: 'border-blue-200',     icon: Play,          label: 'In Progress' },
  Completed:  { color: 'text-violet-700',   bg: 'bg-violet-50',    border: 'border-violet-200',   icon: CheckCircle2,  label: 'Completed'   },
  Abandoned:  { color: 'text-rose-700',     bg: 'bg-rose-50',      border: 'border-rose-200',     icon: AlertTriangle, label: 'Abandoned'   },
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
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META['Pending'];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${m.color} ${m.bg} ${m.border}`}>
      <Icon size={13} strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  const accentMap = {
    orange: 'from-orange-500 to-orange-600',
    zinc:   'from-slate-500 to-slate-700',
    emerald: 'from-emerald-500 to-teal-600',
    violet: 'from-violet-500 to-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl border border-zinc-200/80 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 leading-none mt-1">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
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
              ? 'bg-white border-zinc-200 text-zinc-800'
              : t.type === 'error'
                ? 'bg-white border-zinc-200 text-zinc-800'
                : 'bg-white border-zinc-200 text-zinc-800'
            }`}
        >
          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center
            ${t.type === 'success' ? 'bg-zinc-100' : t.type === 'error' ? 'bg-zinc-100' : 'bg-zinc-100'}`}>
            {t.type === 'success'
              ? <CheckCircle2 size={12} className="text-zinc-600" strokeWidth={2.5} />
              : t.type === 'error'
                ? <AlertTriangle size={12} className="text-zinc-500" strokeWidth={2.5} />
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

function SessionQrModal({ session, onClose }) {
  const qrRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `session-${session.id || session.sessionId}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close QR code"
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-qr-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <QrCode size={23} />
              </span>
              <div>
                <h2 id="session-qr-title" className="text-lg font-bold">Exam access QR</h2>
                <p className="mt-1 text-sm text-white/80">Session #{session.id}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-white/90 transition hover:bg-white/15 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="mx-auto flex w-fit flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div ref={qrRef} className="rounded-xl bg-white p-3 shadow-sm">
              <QRCodeCanvas
                size={210}
                value={String(session.sessionId || '')}
                bgColor="#ffffff"
                fgColor="#111827"
                level="H"
              />
            </div>
            <div className="text-center">
              <p className="max-w-[250px] truncate text-sm font-semibold text-slate-800">{session.title || session.subject || 'Exam session'}</p>
              <p className="mt-1 text-xs text-slate-500">Scan with the student app to join</p>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-xs leading-relaxed text-amber-900">This QR code grants access to the exam. Share it only with the intended student.</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Close
            </button>
            <button type="button" onClick={handleDownload} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700">
              <Download size={16} />
              Download QR
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SessionDetailItem({ icon: Icon, label, value, accent = 'text-slate-500' }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon size={15} className={accent} />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{value || '—'}</p>
    </div>
  );
}

function SessionDetailsModal({ session, onClose }) {
  const [mark, setMark] = useState(null);
  const [loading, setLoading] = useState(session.status === 'Completed');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session.status !== 'Completed') return undefined;
    const controller = new AbortController();

    const fetchMark = async () => {
      try {
        const response = await fetch(
          `${API_ROOT}/api/admin/marks?sessionId=${encodeURIComponent(session.id)}`,
          { headers: adminHeaders(), signal: controller.signal },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || 'Unable to load this exam result.');
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.sessions)
            ? data.sessions
            : [];
        setMark(rows[0] || null);
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') setError(fetchError.message || 'Unable to load this exam result.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchMark();
    return () => controller.abort();
  }, [session.id, session.status]);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const score = mark?.totalScore ?? session.totalScore ?? 0;
  const total = mark?.totalQuestions ?? 0;
  const scorePercent = total > 0 ? Math.round((score / total) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close session details" className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="session-details-title" className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><ClipboardList size={22} /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Exam session · #{session.id}</p>
                <h2 id="session-details-title" className="mt-1 truncate text-xl font-bold">{session.title || session.subject || 'Exam session'}</h2>
                <p className="mt-1 text-sm text-white/80">{session.subject || 'Subject not specified'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-white/90 transition hover:bg-white/15 hover:text-white"><X size={20} /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SessionDetailItem icon={CheckCircle2} label="Session status" value={STATUS_META[session.status]?.label || session.status} accent="text-emerald-600" />
            <SessionDetailItem icon={BookOpen} label="Questions" value={session.questionsReady ? 'Questions prepared' : 'Not prepared'} accent="text-orange-600" />
            <SessionDetailItem icon={CalendarDays} label="Started" value={fmtDate(session.startTime)} accent="text-blue-600" />
            <SessionDetailItem icon={CalendarDays} label="Ended" value={fmtDate(session.endTime)} accent="text-violet-600" />
            <SessionDetailItem icon={Timer} label="Duration" value={session.durationMinutes ? `${session.durationMinutes} minutes` : 'Not set'} accent="text-cyan-700" />
            <SessionDetailItem icon={ShieldCheck} label="Timer security" value={session.isTimerLocked ? 'Timer locked' : 'Not locked'} accent="text-amber-600" />
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-950">Student result</p>
                <p className="mt-1 text-xs text-emerald-800/75">
                  {session.status === 'Completed' ? 'Submitted exam score and student details' : 'Marks appear here after the exam is submitted'}
                </p>
              </div>
              {loading && <Loader2 size={20} className="animate-spin text-emerald-700" />}
            </div>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {!loading && !error && session.status === 'Completed' && mark && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SessionDetailItem icon={UserRound} label="Student" value={mark.studentName || mark.StudentName} accent="text-emerald-700" />
                <SessionDetailItem icon={Trophy} label="Score" value={total > 0 ? `${score} / ${total} · ${scorePercent}%` : `${score} points`} accent="text-amber-600" />
                <SessionDetailItem icon={Target} label="Student ID" value={mark.studentId || mark.studentProfileId || '—'} accent="text-indigo-600" />
                <SessionDetailItem icon={CalendarDays} label="Submitted" value={fmtDate(mark.endTime || session.endTime)} accent="text-violet-600" />
              </div>
            )}
            {!loading && !error && session.status === 'Completed' && !mark && (
              <p className="mt-4 rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-emerald-900">The exam is complete, but no student mark record is available for this session.</p>
            )}
            {session.status !== 'Completed' && (
              <p className="mt-4 rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-emerald-900">No marks have been submitted for this session yet.</p>
            )}
          </div>

          {session.originalObjective && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Learning objective</p>
              <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{session.originalObjective}</p>
            </div>
          )}
          {session.sessionId && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Session reference</p>
              <p className="mt-2 break-all rounded-2xl border border-slate-100 bg-slate-50 p-4 font-mono text-xs text-slate-600">{session.sessionId}</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Done</button>
        </div>
      </section>
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
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-5 py-4 flex items-center justify-between shrink-0">
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
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Brain size={20} className="text-orange-400" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-700">No questions available</p>
              <p className="text-[12px] text-zinc-400 text-center">
                This session has no stozinc questions yet.<br />
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
                  <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
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
                            ? 'bg-zinc-50 border-zinc-300 text-zinc-800'
                            : 'bg-white border-zinc-100 text-zinc-600'
                        }`}
                      >
                        {/* Option letter badge */}
                        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                          isCorrect
                            ? 'bg-zinc-500 text-white'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          {OPTION_LETTERS[oi] ?? oi + 1}
                        </span>
                        <span className={isCorrect ? 'font-semibold' : ''}>{opt}</span>
                        {isCorrect && (
                          <CheckCircle2
                            size={13}
                            className="ml-auto shrink-0 text-zinc-500 mt-0.5"
                            strokeWidth={2.5}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100 flex items-start gap-2">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5 leading-tight">
                      Explanation
                    </span>
                    <p className="text-[11px] text-zinc-700 leading-relaxed">{q.explanation}</p>
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
            className="h-8 px-4 rounded-lg bg-orange-600 text-white text-[12px] font-semibold hover:bg-orange-700 active:scale-[0.98] transition-all"
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
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-orange-600 text-white text-[10px] font-bold hover:bg-orange-700 active:scale-95 transition-all"
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
          className="h-6 px-2 rounded-l-md border border-r-0 border-orange-200 bg-orange-50 text-orange-700 text-[10px] font-medium hover:bg-orange-100 transition-colors"
        >
          {subject.length > 8 ? subject.slice(0, 8) + '…' : subject} ▾
        </button>
        {/* Synthesize trigger */}
        <button
          onClick={() => { setOpen(false); onSynthesize(session.id, subject); }}
          className="h-6 px-2.5 rounded-r-md bg-orange-600 text-white text-[10px] font-bold hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-1"
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
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-orange-50 hover:text-orange-700 transition-colors
                ${subject === t ? 'text-orange-700 font-semibold bg-orange-50/60' : 'text-zinc-600'}`}
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
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
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
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                  <AlertTriangle size={13} className="text-zinc-500 shrink-0" />
                  <p className="text-[12px] text-zinc-600">{error}</p>
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
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <CheckCircle2 size={14} className="text-zinc-500 shrink-0" />
                <p className="text-[12px] text-zinc-700 font-medium">
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
  const [qrSession, setQrSession]             = useState(null);
  const [detailsSession, setDetailsSession]   = useState(null);
  const [searchQuery, setSearchQuery]         = useState('');

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
    try {
      const res  = await fetch(`${API_BASE}/sessions`, { headers: adminHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Content Synthesizer handler ─────────────────────────────────────────────
  const handleSynthesize = useCallback(async (sessionId, subject) => {
    // Guard: don't double-fire
    if (synthesizingIds.has(sessionId)) return;

    setSynthesizingIds(prev => new Set([...prev, sessionId]));

    addToast('info', 'Synthesizer Running…', `Calling Groq LLM for "${subject}" questions. This may take 10–20 s.`);

    try {
      const url = `${API_ROOT}/api/aiagent/synthesize-exam/${sessionId}`;
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject,
          objective: `Generate ICT MCQ questions on ${subject}`,
          requestedQuestionCount: 5,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      addToast(
        'success',
        'Synthesis Complete — Awaiting Review',
        `Agent 4 validated ${data.questionsCount ?? '5'} MCQs. Session #${sessionId} is now Pending Admin Approval.`,
      );

      // Optimistically update this row's status in local state
      setSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, status: 'PendingAdminApproval', questionsReady: true } : s),
      );

      // Full refresh after a beat to sync any server-side changes
      setTimeout(fetchSessions, 800);

    } catch (err) {
      addToast(
        'error',
        'Synthesis Failed',
        err.message || 'An unexpected error occurzinc. Check the backend logs.',
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
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
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

  // ── Filtezinc rows ───────────────────────────────────────────────────────────
  const filteredSessions = sessions
    .filter(session => filter === 'All' || session.status === filter)
    .filter(session => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return [
        session.title,
        session.subject,
        session.status,
        session.originalObjective,
        session.studentId,
        session.id,
      ].some(value => String(value ?? '').toLowerCase().includes(query));
    });

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 sm:px-6 lg:py-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm">
              <ClipboardList size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight leading-none sm:text-3xl">
                Exam Sessions
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                විභාග සැසි · Member 1 &amp; 2 · UC3.1–3.3 · UC5.2
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-600 mt-3 ml-0.5">
            Review exam activity, check student results, and securely manage assessment sessions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 h-11 px-4 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} strokeWidth={2.5} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-bold hover:from-orange-600 hover:to-rose-600 active:scale-[0.98] shadow-md shadow-orange-200 transition-all"
          >
            <Zap size={16} strokeWidth={2.5} />
            Request Mock Exam
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} label="Total Sessions" value={total}           accent="orange"  sub="all time" />
        <StatCard icon={Brain}         label="Ready (Agent 2)" value={ready}           accent="orange"  sub="questions synthesized" />
        <StatCard icon={CheckCircle2}  label="Completed"        value={completed}       accent="zinc" sub="submitted" />
        <StatCard icon={Trophy}        label="Avg Score"         value={`${avgScore}pts`} accent="zinc"    sub="completed sessions" />
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex w-full flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 sm:w-fit">
        {['All', 'Pending', 'PendingAdminApproval', 'Ready', 'InProgress', 'Completed', 'Abandoned'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
              filter === tab
                ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-200'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            {tab === 'InProgress' ? 'In Progress' : tab === 'PendingAdminApproval' ? 'Pending Approval' : tab}
            {tab !== 'All' && (
              <span className="ml-1.5 text-[10px] font-semibold opacity-70">
                {sessions.filter(s => s.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Session cards ── */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assessment sessions</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'} shown
            </p>
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search exams, subjects, or session ID"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
        </div>

        {loading && !error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-slate-500 shadow-sm">
            <Loader2 size={30} className="animate-spin text-orange-500" />
            <p className="text-sm font-medium">Loading exam sessions…</p>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle size={28} className="mx-auto text-red-500" />
            <p className="mt-3 text-base font-semibold text-red-900">Could not load exam sessions</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button type="button" onClick={handleRefresh} className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">
              Try again
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <BookOpen size={26} />
            </span>
            <p className="mt-4 text-lg font-bold text-slate-800">
              {sessions.length ? 'No matching sessions' : 'No exam sessions yet'}
            </p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              {sessions.length ? 'Try another search term or status filter.' : 'Request a mock exam to create your first assessment session.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredSessions.map(session => {
              const isSynthesizing = synthesizingIds.has(session.id);
              const canViewQr = session.status === 'Ready' && session.questionsReady && Boolean(session.sessionId);
              const scoreExists = session.status === 'Completed';
              return (
                <article
                  key={session.id}
                  className={`group overflow-visible rounded-3xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                    isSynthesizing ? 'border-orange-300 ring-4 ring-orange-100' : 'border-slate-200'
                  }`}
                >
                  <div className="rounded-t-3xl bg-gradient-to-r from-slate-50 via-white to-orange-50/70 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                        session.status === 'Completed' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' :
                        session.status === 'Ready' ? 'bg-gradient-to-br from-orange-400 to-rose-500 text-white' :
                        'bg-gradient-to-br from-indigo-400 to-violet-500 text-white'
                      }`}>
                        {session.status === 'Completed' ? <Trophy size={25} /> : session.status === 'Ready' ? <CheckCheck size={25} /> : <ClipboardList size={25} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900 sm:text-xl">
                            {session.title || session.subject || 'Exam session'}
                          </h3>
                          <StatusBadge status={session.status} />
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-slate-600">
                          {session.subject || 'Subject not specified'}
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="font-mono text-xs text-slate-500">Session #{session.id}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 px-5 pt-5 sm:grid-cols-4 sm:px-6">
                    <div className="rounded-2xl bg-sky-50 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-sky-700"><BookOpen size={15} /> Questions</div>
                      <p className="mt-2 text-base font-bold text-sky-950">{session.questionsReady ? 'Ready' : 'Preparing'}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700"><Timer size={15} /> Timer</div>
                      <p className="mt-2 text-base font-bold text-amber-950">{session.isTimerLocked ? 'Running' : 'Not started'}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><Trophy size={15} /> Result</div>
                      <p className="mt-2 text-base font-bold text-emerald-950">{scoreExists ? `${session.totalScore} pts` : 'Pending'}</p>
                    </div>
                    <div className="rounded-2xl bg-violet-50 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-700"><CalendarDays size={15} /> Started</div>
                      <p className="mt-2 truncate text-sm font-bold text-violet-950">{fmtDate(session.startTime)}</p>
                    </div>
                  </div>

                  <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 sm:mx-6">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    <span className="font-semibold text-slate-700">Ended</span>
                    <span className="truncate">{fmtDate(session.endTime)}</span>
                    {session.durationMinutes > 0 && (
                      <>
                        <span className="ml-auto text-slate-300">·</span>
                        <span className="shrink-0">{session.durationMinutes} min</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-5 sm:p-6">
                    <button
                      type="button"
                      onClick={() => setDetailsSession(session)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
                    >
                      <Eye size={17} />
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrSession(session)}
                      disabled={!canViewQr}
                      title={canViewQr ? 'Open exam access QR' : 'QR is available after questions are ready'}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <QrCode size={17} />
                      View QR
                    </button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {isSynthesizing ? (
                        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-50 px-3 text-sm font-semibold text-orange-700">
                          <Loader2 size={16} className="animate-spin" /> Generating questions…
                        </span>
                      ) : (
                        <SynthesizeButton session={session} onSynthesize={handleSynthesize} onView={setViewSession} />
                      )}
                      <button
                        type="button"
                        disabled={deletingIds.has(session.id)}
                        onClick={() => handleDeleteSession(session.id)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingIds.has(session.id) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        {deletingIds.has(session.id) ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── AI Workflow Legend ── */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-50 border border-orange-200/60 rounded-xl p-4">
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

      {qrSession && (
        <SessionQrModal
          session={qrSession}
          onClose={() => setQrSession(null)}
        />
      )}

      {detailsSession && (
        <SessionDetailsModal
          session={detailsSession}
          onClose={() => setDetailsSession(null)}
        />
      )}

      {/* ── Toast Notifications ── */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
