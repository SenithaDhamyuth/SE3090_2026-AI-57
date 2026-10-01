import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BarChart2, Plus, Pencil, Trash2, CheckCircle2, AlertCircle,
  RefreshCw, X, BookOpen, Loader2, Bot, User as UserIcon,
  CalendarDays, TrendingUp, Hash, Save, XCircle, Sparkles,
  Zap, FlaskConical, ChevronRight, Eye,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

// ── Auth fetch ────────────────────────────────────────────────────────────────
const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem('admin_token') || '';
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Alert = ({ type, text, onDismiss }) => {
  const style =
    type === 'success' ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
    : type === 'error' ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${style}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 font-medium leading-snug">{text}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ── Probability colour ramp ───────────────────────────────────────────────────
const probColour = (p) => {
  if (p >= 15) return { bar: 'bg-gradient-to-r from-red-500 to-red-400',    text: 'text-red-700',    badge: 'bg-red-50 text-red-700 border-red-200' };
  if (p >= 5)  return { bar: 'bg-gradient-to-r from-orange-400 to-orange-400', text: 'text-orange-700', badge: 'bg-orange-50 text-orange-700 border-orange-200' };
  return              { bar: 'bg-gradient-to-r from-blue-400 to-orange-300',   text: 'text-blue-700',   badge: 'bg-blue-50 text-blue-700 border-blue-200' };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS BAR CHART
// Groups records by TopicName (highest probability per topic shown)
// ═══════════════════════════════════════════════════════════════════════════════
function ProbabilityBarChart({ records }) {
  // Collapse to best probability per topic name
  const byTopic = {};
  records.forEach(r => {
    const key = r.topicName;
    if (!byTopic[key] || r.probabilityPercentage > byTopic[key].prob) {
      byTopic[key] = { topic: key, prob: Number(r.probabilityPercentage), year: r.year };
    }
  });

  const topics = Object.values(byTopic)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 12);   // cap at 12 bars for readability

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">
        No data to display yet.
      </div>
    );
  }

  const maxProb = Math.max(...topics.map(t => t.prob), 1);

  return (
    <div className="space-y-2.5">
      {topics.map((t, i) => {
        const col   = probColour(t.prob);
        const width = `${(t.prob / maxProb) * 100}%`;
        return (
          <div key={i} className="group">
            {/* Label row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-semibold text-zinc-700 truncate max-w-[55%]">{t.topic}</span>
              <div className="flex items-center gap-2">
                {t.year > 0 && (
                  <span className="text-[10px] text-zinc-400 font-mono">{t.year}</span>
                )}
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
                  {t.prob.toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Bar track */}
            <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${col.bar}`}
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
      {Object.keys(byTopic).length > 12 && (
        <p className="text-[11px] text-zinc-400 text-right italic pt-1">
          Showing top 12 topics of {Object.keys(byTopic).length}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI PIE / DONUT — distribution across High / Medium / Low buckets
// ═══════════════════════════════════════════════════════════════════════════════
function BucketDonut({ records }) {
  const high   = records.filter(r => r.probabilityPercentage >= 15).length;
  const medium = records.filter(r => r.probabilityPercentage >= 5 && r.probabilityPercentage < 15).length;
  const low    = records.filter(r => r.probabilityPercentage < 5).length;
  const total  = records.length || 1;

  const buckets = [
    { label: 'High (≥15%)',   count: high,   pct: (high / total) * 100,   color: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700' },
    { label: 'Medium (5–14%)', count: medium, pct: (medium / total) * 100, color: '#fb923c', bg: 'bg-orange-100', text: 'text-orange-700' },
    { label: 'Low (<5%)',    count: low,    pct: (low / total) * 100,    color: '#38bdf8', bg: 'bg-blue-100',    text: 'text-blue-700' },
  ];

  // Build SVG donut segments
  const r = 40, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = buckets.map(b => {
    const len = (b.pct / 100) * circumference;
    const seg = { ...b, dashArray: `${len} ${circumference - len}`, dashOffset: -offset };
    offset += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-6">
      {/* SVG donut */}
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4f4f5" strokeWidth="18" />
        {records.length === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e4e4e7" strokeWidth="18" />
          : segments.map((s, i) => (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.dashOffset}
                strokeLinecap="butt"
              />
            ))
        }
        {/* Centre label */}
        <text x="50" y="55" textAnchor="middle" className="text-xl font-bold" style={{ fontSize: 18, fill: '#18181b', transform: 'rotate(90deg)', transformOrigin: '50px 50px', fontWeight: 700 }}>
          {total === 1 && records.length === 0 ? '0' : records.length}
        </text>
      </svg>

      {/* Legend */}
      <div className="space-y-2 flex-1">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0`} style={{ background: b.color }} />
              <span className="text-[12px] text-zinc-600 font-medium">{b.label}</span>
            </div>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${b.bg} ${b.text}`}>
              {b.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT FORM (inline panel)
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_FORM = { topicName: '', year: new Date().getFullYear(), probabilityPercentage: '' };

function AnalyticForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const isEdit = !!initial;
  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Topic Name */}
        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Topic Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <BookOpen size={15} className="text-zinc-400" />
            </div>
            <input
              ref={firstRef}
              type="text"
              required
              minLength={2}
              maxLength={150}
              value={form.topicName}
              onChange={e => set('topicName', e.target.value)}
              placeholder="e.g. Networking"
              className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Year</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarDays size={15} className="text-zinc-400" />
            </div>
            <input
              type="number"
              min={2000}
              max={2099}
              value={form.year}
              onChange={e => set('year', parseInt(e.target.value, 10) || 0)}
              placeholder="e.g. 2024"
              className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Probability */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Probability % <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <TrendingUp size={15} className="text-zinc-400" />
            </div>
            <input
              type="number"
              required
              min={0}
              max={100}
              step={0.01}
              value={form.probabilityPercentage}
              onChange={e => set('probabilityPercentage', e.target.value)}
              placeholder="0 – 100"
              className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Live probability preview bar */}
      {form.probabilityPercentage !== '' && !isNaN(parseFloat(form.probabilityPercentage)) && (
        <div>
          <p className="text-[11px] text-zinc-400 mb-1">Preview</p>
          <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${probColour(parseFloat(form.probabilityPercentage)).bar}`}
              style={{ width: `${Math.min(parseFloat(form.probabilityPercentage), 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 transition-colors disabled:opacity-50"
        >
          <XCircle size={14} /> Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
            : <><Save size={14} /> {isEdit ? 'Save Changes' : 'Add Record'}</>
          }
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-AGENT STEPPER MODAL — "Generate 2026 Predicted Paper"
// ═══════════════════════════════════════════════════════════════════════════════

const AGENT_STEPS = [
  {
    id:     1,
    icon:   FlaskConical,
    color:  'text-zinc-600',
    bg:     'bg-zinc-50',
    border: 'border-zinc-200',
    ring:   'ring-zinc-400',
    title:  'Agent 1 — Data Analyst',
    desc:   'Analyzing 10+ years of historical exam data patterns…',
    detail: 'Applying exponential-decay weighting across all years. Recent papers carry higher weight.',
    durationMs: 2200,
  },
  {
    id:     2,
    icon:   Zap,
    color:  'text-orange-600',
    bg:     'bg-orange-50',
    border: 'border-orange-200',
    ring:   'ring-orange-400',
    title:  'Agent 2 — Web Researcher',
    desc:   'Fetching current IT events & tech news from Sri Lanka…',
    detail: 'Gathering real-world scenarios to ground MCQ questions in current events.',
    durationMs: 2200,
  },
  {
    id:     3,
    icon:   Sparkles,
    color:  'text-orange-600',
    bg:     'bg-orange-50',
    border: 'border-orange-200',
    ring:   'ring-orange-400',
    title:  'Agent 3 — Paper Generator',
    desc:   'Crafting 50 A/L standard MCQs under syllabus limits…',
    detail: 'Injecting distribution + research context + SyllabusLimits into the LLM. This may take up to 30s.',
    durationMs: null, // waits for real API
  },
];

function GeneratePaperModal({ onClose, onSuccess }) {
  const [activeStep, setActiveStep]   = useState(0); // 0-indexed
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState(null);
  const abortRef                      = useRef(null);

  useEffect(() => {
    let cancelled = false;
    abortRef.current = { cancelled };

    const run = async () => {
      // Steps 0 and 1 are animated delays (Agent 1b runs as part of the API call)
      for (let i = 0; i < 2; i++) {
        setActiveStep(i);
        await new Promise(res => setTimeout(res, AGENT_STEPS[i].durationMs));
        if (cancelled) return;
      }

      // Step 2 — actual API call
      setActiveStep(2);
      try {
        const token = localStorage.getItem('admin_token') || '';
        const res = await fetch(`${API_BASE}/api/aiagent/generate-paper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ researchTopicCount: 3 }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);
        if (!cancelled) {
          setDone(true);
          onSuccess(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeInScale_0.25s_ease-out]">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold leading-tight">Generating 2026 Predicted Paper</h2>
              <p className="text-orange-100 text-[12px] mt-0.5">Multi-Agent AI pipeline running…</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 py-6 space-y-4">
          {AGENT_STEPS.map((step, idx) => {
            const StepIcon  = step.icon;
            const isActive  = activeStep === idx && !done && !error;
            const isComplete= (done && !error) ? true : activeStep > idx && !error;
            const isPending = activeStep < idx && !done && !error;
            const isFailed  = error && activeStep === idx;

            return (
              <div
                key={step.id}
                className={`flex gap-4 p-4 rounded-xl border transition-all duration-500 ${
                  isActive   ? `${step.bg} ${step.border} ring-2 ${step.ring}/30` :
                  isComplete ? 'bg-zinc-50 border-zinc-200' :
                  isFailed   ? 'bg-red-50 border-red-200' :
                               'bg-zinc-50 border-zinc-200 opacity-50'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive   ? step.bg :
                  isComplete ? 'bg-zinc-100' :
                  isFailed   ? 'bg-red-100' :
                               'bg-zinc-100'
                }`}>
                  {isActive && (
                    <Loader2 size={20} className={`animate-spin ${step.color}`} />
                  )}
                  {isComplete && <CheckCircle2 size={20} className="text-zinc-600" />}
                  {isFailed   && <AlertCircle  size={20} className="text-red-600" />}
                  {isPending  && <StepIcon      size={20} className="text-zinc-400" />}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[13px] font-bold ${
                      isActive   ? 'text-zinc-900' :
                      isComplete ? 'text-zinc-800' :
                      isFailed   ? 'text-red-800' :
                                   'text-zinc-500'
                    }`}>
                      {step.title}
                    </p>
                    {isActive && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${step.bg} ${step.color} border ${step.border} animate-pulse`}>
                        RUNNING
                      </span>
                    )}
                    {isComplete && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                        DONE
                      </span>
                    )}
                  </div>
                  <p className={`text-[12px] mt-0.5 leading-snug ${
                    isActive   ? 'text-zinc-600' :
                    isComplete ? 'text-zinc-600' :
                    isFailed   ? 'text-red-600' :
                                 'text-zinc-400'
                  }`}>
                    {isFailed ? `Error: ${error}` : isActive ? step.desc : isComplete ? '✓ Complete' : step.desc}
                  </p>
                  {isActive && (
                    <p className="text-[11px] text-zinc-400 mt-1 italic">{step.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          {error && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          )}
          {done && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-zinc-600 hover:bg-zinc-700 text-white text-sm font-semibold transition-colors"
            >
              View Results ↓
            </button>
          )}
          {!done && !error && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-600 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAPER RESULTS MODAL — displays the 50 generated MCQs
// ═══════════════════════════════════════════════════════════════════════════════
const TOPIC_COLOURS = [
  'bg-zinc-100 text-zinc-800 border-zinc-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-zinc-100 text-zinc-800 border-zinc-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-zinc-100 text-zinc-800 border-zinc-200',
  'bg-zinc-100 text-zinc-800 border-zinc-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-zinc-100 text-zinc-800 border-zinc-200',
];

function PaperResultsModal({ paperData, onClose }) {
  const [revealed, setRevealed] = useState({});
  const [filterTopic, setFilterTopic] = useState('');

  const { questions = [], topicDistribution = [], researchContext = [] } = paperData || {};

  // Build topic → colour map
  const allTopics = [...new Set(questions.map(q => q.topic))];
  const topicColour = Object.fromEntries(
    allTopics.map((t, i) => [t, TOPIC_COLOURS[i % TOPIC_COLOURS.length]])
  );

  const filtered = filterTopic
    ? questions.filter(q => q.topic === filterTopic)
    : questions;

  const toggleReveal = (no) =>
    setRevealed(prev => ({ ...prev, [no]: !prev[no] }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden mb-8">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-[17px] font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-orange-400" />
              2026 Predicted A/L ICT Exam Paper
            </h2>
            <p className="text-slate-400 text-[12px] mt-0.5">
              {questions.length} MCQs · generated by Multi-Agent AI · {new Date().toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Distribution ribbon */}
        {topicDistribution.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] text-slate-500 font-semibold shrink-0">Distribution:</span>
            {topicDistribution.map((d, i) => (
              <button
                key={i}
                onClick={() => setFilterTopic(f => f === d.topicName ? '' : d.topicName)}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                  filterTopic === d.topicName
                    ? 'bg-slate-900 text-white border-slate-900'
                    : topicColour[d.topicName] || 'bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
              >
                {d.topicName} ({d.allocatedQuestions}q)
              </button>
            ))}
            {filterTopic && (
              <button
                onClick={() => setFilterTopic('')}
                className="shrink-0 text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Show all
              </button>
            )}
          </div>
        )}

        {/* Research context strip */}
        {researchContext.length > 0 && (
          <div className="px-6 py-3 bg-orange-50 border-b border-orange-200">
            <p className="text-[11px] font-semibold text-orange-700 mb-1.5 flex items-center gap-1.5">
              <Zap size={11} /> Agent 2 Research Context Used:
            </p>
            <div className="flex flex-wrap gap-2">
              {researchContext.map((ctx, i) => (
                <span key={i} className="text-[11px] bg-orange-100 border border-orange-200 text-orange-800 px-2.5 py-0.5 rounded-full font-medium">
                  {ctx.topic} — {ctx.events?.[0]?.headline?.slice(0, 55)}…
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Questions list */}
        <div className="divide-y divide-zinc-100">
          {filtered.map((q) => {
            const isRevealed = !!revealed[q.questionNo];
            const topicCls = topicColour[q.topic] || 'bg-zinc-100 text-zinc-700 border-zinc-200';
            return (
              <div key={q.questionNo} className="px-6 py-5 hover:bg-zinc-50/60 transition-colors">
                {/* Q header */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[12px] font-bold text-slate-600">
                    {q.questionNo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${topicCls}`}>
                        {q.topic}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-zinc-900 leading-snug">{q.questionText}</p>
                  </div>
                </div>

                {/* Options */}
                <div className="ml-11 grid sm:grid-cols-2 gap-1.5 mb-3">
                  {(q.options || []).map((opt, oi) => {
                    const optNo = oi + 1;
                    const isCorrect = optNo === q.correctOption;
                    return (
                      <div
                        key={oi}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[12px] transition-all ${
                          isRevealed && isCorrect
                            ? 'bg-zinc-50 border-zinc-300 text-zinc-900 font-semibold'
                            : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                          isRevealed && isCorrect
                            ? 'bg-zinc-500 border-zinc-500 text-white'
                            : 'border-zinc-300 text-zinc-500'
                        }`}>
                          {optNo}
                        </span>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation (revealed) */}
                {isRevealed && q.explanation && (
                  <div className="ml-11 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-orange-700 mb-0.5">Explanation</p>
                    <p className="text-[12px] text-orange-900 leading-snug">{q.explanation}</p>
                  </div>
                )}

                {/* Reveal toggle */}
                <div className="ml-11 mt-2">
                  <button
                    onClick={() => toggleReveal(q.questionNo)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      isRevealed
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    <Eye size={11} />
                    {isRevealed ? 'Hide Answer' : 'Reveal Answer'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">
            Showing <strong className="text-zinc-600">{filtered.length}</strong> of{' '}
            <strong className="text-zinc-600">{questions.length}</strong> questions
          </p>
          <button
            onClick={() => setRevealed(
              Object.fromEntries(questions.map(q => [q.questionNo, true]))
            )}
            className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold underline"
          >
            Reveal All Answers
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — PastPaperAnalytics
// ═══════════════════════════════════════════════════════════════════════════════
export default function PastPaperAnalytics() {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pageAlert, setPageAlert] = useState(null);

  // Form state
  const [showAdd, setShowAdd]      = useState(false);
  const [editingId, setEditingId]  = useState(null);   // topicName being edited
  const [saving, setSaving]        = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState(null);

  // Search / filter
  const [search, setSearch]         = useState('');
  const [yearFilter, setYearFilter]  = useState('');

  // ── Generate Paper ─────────────────────────────────────────────────────────
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [paperResult, setPaperResult]             = useState(null);
  const resultsRef                                = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (signal) => {
    setLoading(true);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/analytics`, { signal });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || `Server error ${res.status}`);
      }
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map(item => ({
            id: item.id ?? item.Id ?? null,
            year: item.year ?? item.Year ?? 0,
            topicName: item.topicName ?? item.TopicName ?? '',
            probabilityPercentage: Number(item.probabilityPercentage ?? item.ProbabilityPercentage ?? 0),
          }))
        : [];

      const uniqueByTopic = new Map();
      normalized.forEach(item => {
        if (!item.topicName) return;
        if (!uniqueByTopic.has(item.topicName)) {
          uniqueByTopic.set(item.topicName, item);
        }
      });

      setRecords([...uniqueByTopic.values()]);
    } catch (err) {
      if (err.name !== 'AbortError')
        setPageAlert({ type: 'error', text: `Failed to load records: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchRecords(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchRecords]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async (form) => {
    setSaving(true);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/analytics`, {
        method: 'POST',
        body: JSON.stringify({
          topicName:             form.topicName.trim(),
          year:                  Number(form.year),
          probabilityPercentage: parseFloat(form.probabilityPercentage),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);
      setPageAlert({ type: 'success', text: `Record "${form.topicName}" added successfully.` });
      setShowAdd(false);
      fetchRecords();
    } catch (err) {
      setPageAlert({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdate = async (form) => {
    setSaving(true);
    setPageAlert(null);
    try {
      const recordToUpdate = records.find(r => r.topicName === editingId);
      if (!recordToUpdate || !recordToUpdate.id) {
        throw new Error('This topic cannot be updated from the analytics list because it has no persisted id.');
      }

      const res = await authFetch(`${API_BASE}/api/admin/analytics/${recordToUpdate.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          topicName:             form.topicName.trim(),
          year:                  Number(form.year),
          probabilityPercentage: parseFloat(form.probabilityPercentage),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);
      setPageAlert({ type: 'success', text: 'Record updated successfully.' });
      setEditingId(null);
      fetchRecords();
    } catch (err) {
      setPageAlert({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id, topicName) => {
    if (!window.confirm(`Delete "${topicName}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/analytics/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);
      setPageAlert({ type: 'success', text: `"${topicName}" deleted.` });
      fetchRecords();
    } catch (err) {
      setPageAlert({ type: 'error', text: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const years     = [...new Set(records.map(r => r.year).filter(y => y > 0))].sort((a, b) => b - a);
  const avgProb   = records.length ? (records.reduce((s, r) => s + Number(r.probabilityPercentage), 0) / records.length).toFixed(1) : '—';
  const topRecord = records.reduce((best, r) => (!best || r.probabilityPercentage > best.probabilityPercentage ? r : best), null);

  const filtered = records.filter(r => {
    const matchSearch = !search || r.topicName.toLowerCase().includes(search.toLowerCase());
    const matchYear   = !yearFilter || String(r.year) === yearFilter;
    return matchSearch && matchYear;
  });

  // Record being edited (for pre-filling form)
  const editRecord = records.find(r => r.topicName === editingId) ?? null;
  const editInitial = editRecord
    ? { topicName: editRecord.topicName, year: editRecord.year, probabilityPercentage: editRecord.probabilityPercentage }
    : null;

  return (
    <>
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            Past Paper Analytics
            <span className="text-xs text-zinc-400 block font-normal mt-1">
              Probability weights used by the AI Study Planner (Agent 2 RAG context)
            </span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Manage and visualise topic probability data derived from historical A/L ICT past papers.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Generate Predicted Paper */}
          <button
            onClick={() => { setShowGenerateModal(true); setPaperResult(null); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white text-[13px] font-semibold shadow-md shadow-slate-900/20 transition-all active:scale-95"
          >
            <Sparkles size={15} className="text-orange-400" />
            Generate 2026 Predicted Paper
          </button>

          {/* Add Record */}
          <button
            onClick={() => { setShowAdd(s => !s); setEditingId(null); setPageAlert(null); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-95"
          >
            {showAdd ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Record</>}
          </button>
        </div>
      </div>

      {/* ── Page alert ── */}
      {pageAlert && (
        <Alert type={pageAlert.type} text={pageAlert.text} onDismiss={() => setPageAlert(null)} />
      )}

      {/* ── Stat ribbon ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records',    value: records.length,    icon: Hash,       color: 'text-zinc-700',    bg: 'bg-zinc-100',    border: 'border-zinc-200' },
          { label: 'Avg Probability',  value: avgProb + '%',     icon: TrendingUp, color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200/60' },
          { label: 'Years Covered',    value: years.length || '—', icon: CalendarDays, color: 'text-orange-700',  bg: 'bg-orange-50',     border: 'border-orange-200/60' },
          { label: 'Top Topic',        value: topRecord?.topicName ?? '—', icon: BarChart2, color: 'text-zinc-700', bg: 'bg-zinc-50', border: 'border-zinc-200/60' },
        ].map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${s.border}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
              <s.icon size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-400 font-medium leading-none">{s.label}</p>
              <p className="text-[17px] font-bold text-zinc-900 leading-tight truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Visualisation cards ── */}
      <div className="grid md:grid-cols-5 gap-4">
        {/* Bar chart — takes 3/5 width */}
        <div className="md:col-span-3 bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-orange-600" />
            <h2 className="text-[14px] font-bold text-zinc-800">Topic Probability Chart</h2>
            <span className="ml-auto text-[11px] text-zinc-400">Best probability per topic</span>
          </div>
          {loading
            ? <div className="flex items-center justify-center h-32 gap-2 text-zinc-400"><Loader2 size={16} className="animate-spin" /> <span className="text-sm">Loading…</span></div>
            : <ProbabilityBarChart records={records} />
          }
        </div>

        {/* Donut + legend — takes 2/5 width */}
        <div className="md:col-span-2 bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-orange-600" />
            <h2 className="text-[14px] font-bold text-zinc-800">Distribution</h2>
          </div>
          {loading
            ? <div className="flex items-center justify-center flex-1 gap-2 text-zinc-400"><Loader2 size={16} className="animate-spin" /></div>
            : <BucketDonut records={records} />
          }
          <div className="mt-4 pt-4 border-t border-zinc-100 space-y-1">
            <p className="text-[11px] text-zinc-400 leading-snug">
              <span className="font-semibold text-red-600">High (≥15%)</span> topics are injected first into the AI Study Planner prompt to maximise exam relevance.
            </p>
          </div>
        </div>
      </div>

      {/* ── Add form (collapsible) ── */}
      {showAdd && (
        <div className="bg-white border border-orange-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 bg-orange-50/60 flex items-center gap-2">
            <Plus size={15} className="text-orange-600" />
            <h2 className="text-[14px] font-bold text-zinc-800">Add New Record</h2>
          </div>
          <AnalyticForm
            initial={null}
            onSave={handleCreate}
            onCancel={() => setShowAdd(false)}
            saving={saving}
          />
        </div>
      )}

      {/* ── Data table ── */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search topics…"
                className="pl-3 pr-8 py-1.5 border border-zinc-300 rounded-lg text-[12px] text-zinc-900 outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-colors w-44"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Year filter */}
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="pl-2 pr-6 py-1.5 border border-zinc-300 rounded-lg text-[12px] text-zinc-900 outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white transition-colors"
            >
              <option value="">All Years</option>
              <option value="0">Multi-year (0)</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-600">{filtered.length}</span> record{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => fetchRecords()}
              disabled={loading}
              title="Refresh"
              className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading analytics data…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <BarChart2 size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-[14px] font-semibold text-zinc-400">
              {records.length === 0 ? 'No analytics data yet' : 'No records match your filter'}
            </p>
            <p className="text-[12px] text-zinc-300 mt-1">
              {records.length === 0
                ? 'Add records manually or run the AI Past Paper Analyst.'
                : 'Try clearing the search or year filter.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  {['ID', 'Topic Name', 'Year', 'Probability', 'Probability Bar', 'Source', 'Created', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(rec => {
                  const col        = probColour(rec.probabilityPercentage);
                  const isEditing  = editingId === rec.topicName;
                  const isDeleting = deletingId === rec.id;
                  return (
                    <React.Fragment key={rec.topicName}>
                      <tr className={`transition-colors ${isEditing ? 'bg-orange-50/40' : 'hover:bg-zinc-50/60'}`}>
                        {/* ID */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-[12px] font-semibold text-zinc-500">#{rec.id}</span>
                        </td>

                        {/* Topic */}
                        <td className="px-5 py-3.5">
                          <span className="text-[13px] font-semibold text-zinc-800">{rec.topicName}</span>
                        </td>

                        {/* Year */}
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] font-mono text-zinc-600">
                            {rec.year > 0 ? rec.year : <span className="text-zinc-400 italic">Multi-year</span>}
                          </span>
                        </td>

                        {/* Probability badge */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${col.badge}`}>
                            {Number(rec.probabilityPercentage).toFixed(2)}%
                          </span>
                        </td>

                        {/* Mini bar */}
                        <td className="px-5 py-3.5 w-36">
                          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${col.bar}`}
                              style={{ width: `${Math.min(rec.probabilityPercentage, 100)}%` }}
                            />
                          </div>
                        </td>

                        {/* Source badge */}
                        <td className="px-5 py-3.5">
                          {rec.generatedByAgent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-700 border border-zinc-200 text-[10px] font-semibold">
                              <Bot size={10} /> AI Agent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-600 border border-zinc-200 text-[10px] font-semibold">
                              <UserIcon size={10} /> Manual
                            </span>
                          )}
                        </td>

                        {/* Created */}
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">
                            {new Date(rec.createdAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setEditingId(isEditing ? null : rec.topicName); setShowAdd(false); setPageAlert(null); }}
                              title={isEditing ? 'Cancel edit' : 'Edit'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                                isEditing
                                  ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                  : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              {isEditing ? <><XCircle size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
                            </button>
                            <button
                              onClick={() => handleDelete(rec.id, rec.topicName)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isDeleting
                                ? <><Loader2 size={12} className="animate-spin" /> Deleting…</>
                                : <><Trash2 size={12} /> Delete</>
                              }
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline edit row */}
                      {isEditing && (
                        <tr className="bg-orange-50/30">
                          <td colSpan={8} className="px-2 py-0">
                            <div className="border border-orange-200 rounded-xl my-2 bg-white overflow-hidden">
                              <div className="px-5 py-2.5 border-b border-zinc-100 bg-orange-50/60 flex items-center gap-2">
                                <Pencil size={13} className="text-orange-600" />
                                <span className="text-[13px] font-bold text-zinc-800">Editing: {rec.topicName}</span>
                              </div>
                              <AnalyticForm
                                initial={editInitial}
                                onSave={handleUpdate}
                                onCancel={() => setEditingId(null)}
                                saving={saving}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && records.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
            <p className="text-[11px] text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-zinc-600">{records.length}</span> records
            </p>
            <p className="text-[11px] text-zinc-400 italic">
              Records are injected into the AI Study Planner as RAG context
            </p>
          </div>
        )}
      </div>

      {/* ── Generated Paper result banner ── */}
      {paperResult && !showGenerateModal && (
        <div
          ref={resultsRef}
          className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">
                2026 Predicted Paper Ready!
              </p>
              <p className="text-slate-400 text-[12px]">
                {paperResult.questions?.length ?? 0} MCQs across{' '}
                {paperResult.topicDistribution?.length ?? 0} topics — generated by AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaperResult(null)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[13px] font-semibold transition-colors"
            >
              <Eye size={14} /> View Paper
            </button>
          </div>
        </div>
      )}

    </div>

    {/* ── Modals (outside the page container, in full-screen fixed) ── */}
    {showGenerateModal && (
      <GeneratePaperModal
        onClose={() => {
          setShowGenerateModal(false);
          // Scroll to result banner if we have results
          if (paperResult) {
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
          }
        }}
        onSuccess={(data) => {
          setPaperResult(data);
        }}
      />
    )}

    {/* Paper results viewer (shown on top when there's a result and modal re-opens) */}
    {paperResult && showGenerateModal && (
      <PaperResultsModal
        paperData={paperResult}
        onClose={() => setShowGenerateModal(false)}
      />
    )}
    </>
  );
}
