import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Play, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, Zap, BookOpen, Trophy, ChevronRight, Loader2,
  FlaskConical, X, Send,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5087/api/assessment';

const STATUS_META = {
  Pending:    { color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200', icon: Clock,          label: 'Pending'     },
  InProgress: { color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200',  icon: Play,           label: 'In Progress' },
  Completed:  { color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200',icon: CheckCircle2,  label: 'Completed'   },
  Abandoned:  { color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200',   icon: AlertTriangle,  label: 'Abandoned'   },
};

const A_L_ICT_TOPICS = [
  'Networking',
  'Python Programming',
  'Logic Gates',
  'Data Representation',
  'Systems Analysis',
  'Web Development',
];

// ── Helpers ───────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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

// ── Stat Card ──────────────────────────────────────────────────────
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

// ── Request Exam Modal ──────────────────────────────────────────────
function RequestExamModal({ onClose, onSuccess }) {
  const [objective, setObjective]     = useState('');
  const [targetExam, setTargetExam]   = useState('A/L');
  const [subject, setSubject]         = useState(A_L_ICT_TOPICS[0]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [planResult, setPlanResult]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!objective.trim()) { setError('Please enter a learning objective.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/request-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, targetExam, subject }),
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
                    {A_L_ICT_TOPICS.map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
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
                <p className="text-[12px] text-emerald-700 font-medium">Plan generated! Session ID: {planResult.examSession?.id}</p>
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
              <button onClick={onClose} className="w-full h-9 rounded-lg bg-zinc-100 text-zinc-600 text-[13px] font-medium hover:bg-zinc-200 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ExamSessions Page ─────────────────────────────────────────
export default function ExamSessions() {
  const [sessions, setSessions]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [filter, setFilter]           = useState('All');

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

  // ── Stats ──────────────────────────────────────────────────────
  const total      = sessions.length;
  const active     = sessions.filter(s => s.status === 'InProgress').length;
  const completed  = sessions.filter(s => s.status === 'Completed').length;
  const avgScore   = completed
    ? Math.round(sessions.filter(s => s.status === 'Completed').reduce((a, s) => a + s.totalScore, 0) / completed)
    : 0;

  // ── Filtered rows ──────────────────────────────────────────────
  const filtered = filter === 'All' ? sessions : sessions.filter(s => s.status === filter);

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
              <p className="text-[10px] text-zinc-400 mt-0.5">විභාග සැසි · Member 1 · UC3.1 · UC3.2 · UC3.3</p>
            </div>
          </div>
          <p className="text-[12px] text-zinc-500 mt-2 ml-0.5">
            Monitor active and completed student assessment sessions. Trigger custom AI-planned mock exams.
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
        <StatCard icon={ClipboardList} label="Total Sessions" value={total}    accent="orange"  sub="all time" />
        <StatCard icon={Play}          label="Active Now"      value={active}   accent="blue"    sub="in progress" />
        <StatCard icon={CheckCircle2}  label="Completed"       value={completed} accent="emerald" sub="submitted" />
        <StatCard icon={Trophy}        label="Avg Score"       value={`${avgScore}pts`} accent="violet" sub="completed sessions" />
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-lg w-fit border border-zinc-200/60">
        {['All', 'Pending', 'InProgress', 'Completed', 'Abandoned'].map(tab => (
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
        {/* Table Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-orange-600" />
            <span className="text-[13px] font-semibold text-zinc-800">Assessment Sessions</span>
            <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              {filtered.length} records
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
            <p className="text-[14px] font-semibold text-zinc-700">No Data Available</p>
            <p className="text-[12px] text-zinc-400">
              {error
                ? 'The database is empty or the backend is unavailable.'
                : 'No exam sessions are currently stored for A/L ICT.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100">
                  {['ID', 'Session GUID', 'Subject', 'Status', 'Timer Locked', 'Score', 'Started', 'Ended', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 px-4 py-2.5 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-orange-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-50/30'}`}
                  >
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-bold text-zinc-900">#{s.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[100px] block">
                        {(s.sessionId || '').slice(0, 12)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-zinc-700 font-medium">{s.subject || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${s.isTimerLocked ? 'text-orange-600' : 'text-zinc-400'}`}>
                        {s.isTimerLocked
                          ? <><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Locked</>
                          : '—'
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[13px] font-bold ${s.totalScore > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                        {s.totalScore > 0 ? `${s.totalScore} pts` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-zinc-500">{fmtDate(s.startTime)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-zinc-500">{fmtDate(s.endTime)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-orange-50 text-zinc-300 hover:text-orange-600 transition-all">
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AI Workflow Legend ── */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-orange-600" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Agentic AI Workflow — Planning Coordinator</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { step: '1', name: 'Content Synthesizer', desc: 'Retrieves & curates questions from the Question Bank' },
            { step: '2', name: 'Validation Agent',    desc: 'Validates distractor quality & Bloom\'s taxonomy' },
            { step: '3', name: 'Tutor Approval',      desc: 'Human-in-the-loop review gate (async wait)' },
            { step: '4', name: 'Finalizer Agent',     desc: 'Assembles ExamSession & notifies student' },
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

      {modalOpen && (
        <RequestExamModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); setTimeout(fetchSessions, 500); }}
        />
      )}
    </div>
  );
}
