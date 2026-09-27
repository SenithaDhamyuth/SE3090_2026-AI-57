import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, CalendarDays, CheckCircle2, Clock, AlertCircle,
  RefreshCw, X, Sparkles, User, ShieldCheck,
  ClipboardList, Loader2, Eye, ListChecks,
  BookOpen, ChevronRight, ChevronLeft, Ban,
  Zap, Layers, Network, Database, Code2, Globe, Cpu,
  BarChart3, FlaskConical, Wifi, Monitor, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_BASE = 'http://localhost:5087';

// ── Authenticated fetch ────────────────────────────────────────────────────────
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('admin_token') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// SYLLABUS DATA
// ═══════════════════════════════════════════════════════════════════════════════
const GRADE_12_TOPICS = [
  { id: 'data-rep',       label: 'Data Representation',   icon: Layers },
  { id: 'logic-gates',    label: 'Logic Gates',            icon: Zap },
  { id: 'networking',     label: 'Networking',             icon: Network },
  { id: 'database',       label: 'Database Management',    icon: Database },
  { id: 'programming',    label: 'Programming Concepts',   icon: Code2 },
  { id: 'os',             label: 'Operating Systems',      icon: Monitor },
  { id: 'systems-anal',   label: 'Systems Analysis',       icon: BarChart3 },
  { id: 'data-comms',     label: 'Data Communications',    icon: Wifi },
];

const GRADE_13_TOPICS = [
  { id: 'web-dev',        label: 'Web Development',        icon: Globe },
  { id: 'iot',            label: 'Internet of Things (IoT)', icon: Cpu },
  { id: 'software-eng',   label: 'Software Engineering',   icon: FlaskConical },
  { id: 'ai-basics',      label: 'AI & Expert Systems',    icon: Brain },
  { id: 'cyber',          label: 'Cybersecurity',          icon: ShieldCheck },
  { id: 'proj-mgmt',      label: 'Project Management',     icon: ClipboardList },
  { id: 'multimedia',     label: 'Multimedia Systems',     icon: BookOpen },
  { id: 'cloud',          label: 'Cloud Computing',        icon: Layers },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatusBadge = ({ approved }) =>
  approved ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 size={10} /> Approved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200">
      <Clock size={10} /> Pending Review
    </span>
  );

const PriorityBadge = ({ priority }) => {
  const styles = {
    High:   'bg-red-50 text-red-700 border-red-200',
    Medium: 'bg-orange-50 text-orange-700 border-orange-200',
    Low:    'bg-zinc-50 text-zinc-600 border-zinc-200',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${styles[priority] ?? styles.Low}`}>
      {priority}
    </span>
  );
};

const Alert = ({ type, text, onDismiss }) => {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${styles[type]}`}>
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

// ── Topic checkbox card ────────────────────────────────────────────────────────
function TopicCheckbox({ topic, checked, onChange }) {
  const Icon = topic.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(topic.label)}
      className={`group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
        checked
          ? 'bg-orange-50 border-orange-300 shadow-sm'
          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      {/* Checkbox circle */}
      <span className={`flex-shrink-0 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-orange-500 border-orange-500' : 'border-zinc-300 group-hover:border-zinc-400'
      }`} style={{ width: 18, height: 18 }}>
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Icon */}
      <span className={`flex-shrink-0 transition-colors ${checked ? 'text-orange-500' : 'text-zinc-400'}`}>
        <Icon size={14} />
      </span>

      {/* Label */}
      <span className={`text-[12px] font-medium leading-tight transition-colors ${
        checked ? 'text-orange-800' : 'text-zinc-700'
      }`}>
        {topic.label}
      </span>

      {checked && (
        <span className="ml-auto flex-shrink-0">
          <Ban size={12} className="text-orange-400" />
        </span>
      )}
    </button>
  );
}

// ── Grade section wrapper ─────────────────────────────────────────────────────
function GradeSection({ title, subtitle, topics, excludedTopics, onToggle }) {
  const excludedInGroup = topics.filter(t => excludedTopics.includes(t.label)).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[13px] font-bold text-zinc-800">{title}</p>
          <p className="text-[11px] text-zinc-400">{subtitle}</p>
        </div>
        {excludedInGroup > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200">
            <Ban size={9} /> {excludedInGroup} excluded
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {topics.map(t => (
          <TopicCheckbox
            key={t.id}
            topic={t}
            checked={excludedTopics.includes(t.label)}
            onChange={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN TIMELINE PREVIEW
// Shown in Step 3 after generation succeeds
// ═══════════════════════════════════════════════════════════════════════════════
function PlanTimeline({ days }) {
  const priorityConfig = {
    High:   { dot: 'bg-red-500',    line: 'border-red-200',    badge: 'bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100',    label: '🔥 High Probability' },
    Medium: { dot: 'bg-orange-400', line: 'border-orange-200', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Medium Priority' },
    Low:    { dot: 'bg-zinc-400',   line: 'border-zinc-200',   badge: 'bg-zinc-50 text-zinc-600 border-zinc-200', label: 'Low Priority' },
  };

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gradient-to-b from-orange-200 via-zinc-200 to-transparent" />

      <div className="space-y-3">
        {days.map((d, idx) => {
          const cfg = priorityConfig[d.priority] ?? priorityConfig.Low;
          const isLast = idx === days.length - 1;
          const isHigh = d.priority === 'High';
          
          return (
            <div key={idx} className="flex gap-4 group">
              {/* Timeline dot */}
              <div className="flex-shrink-0 relative z-10 mt-1">
                <div className={`w-[18px] h-[18px] rounded-full border-2 border-white shadow-md flex items-center justify-center ${cfg.dot}`}>
                  <span className="text-[8px] text-white font-bold leading-none">{d.day}</span>
                </div>
              </div>

              {/* Card */}
              <div className={`flex-1 bg-white rounded-xl border shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-3.5 mb-0.5 transition-all duration-150 hover:shadow-md ${
                isLast ? 'border-emerald-200 bg-emerald-50/30' : (isHigh ? 'border-red-200 bg-red-50/10' : 'border-zinc-200')
              }`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5">
                        {d.date}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {isLast && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <CheckCircle2 size={9} /> Exam Day
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] font-bold text-zinc-800 leading-snug">{d.topic}</p>
                    {d.subtopics && (
                      <p className="mt-0.5 text-[11px] text-zinc-500 leading-snug">{d.subtopics}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE PLAN MODAL — 3-step wizard
//   Step 1: Exam date
//   Step 2: Topic exclusion checkboxes (Grade 12 / Grade 13)
//   Step 3: Generated plan preview (timeline)
// ═══════════════════════════════════════════════════════════════════════════════
function GeneratePlanModal({ onClose, onSuccess }) {
  const [step, setStep]                   = useState(1);   // 1 | 2 | 3
  const [form, setForm]                   = useState({ targetExamDate: '' });
  const [excludedTopics, setExcludedTopics] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [alert, setAlert]                 = useState(null);
  const [planResult, setPlanResult]       = useState(null); // { planDays, planId, message }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleTopic = (label) =>
    setExcludedTopics(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    );

  // ── Step 1 → 2 validation ────────────────────────────────────────────────
  const handleStep1Next = e => {
    e.preventDefault();
    setAlert(null);
    if (!form.targetExamDate) {
      setAlert({ type: 'error', text: 'Please select a target exam date.' });
      return;
    }
    setStep(2);
  };

  // ── Step 2 → API → Step 3 ────────────────────────────────────────────────
  const handleGenerate = async () => {
    setAlert(null);
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/generate-plan`, {
        method: 'POST',
        body: JSON.stringify({
          targetExamDate: new Date(form.targetExamDate).toISOString(),
          excludedTopics,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      setPlanResult({
        planId:   data.studyPlanId,
        message:  data.message,
        planDays: data.planDays ?? [],
      });
      setStep(3);
      onSuccess(`General study plan #${data.studyPlanId} generated — ${data.planDays?.length ?? 0} day(s) scheduled.`);
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Step labels ───────────────────────────────────────────────────────────
  const stepLabels = ['Details', 'Exclude Topics', 'Preview'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step !== 3 ? onClose : undefined} />

      <div className={`relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col transition-all duration-300 ${
        step === 3 ? 'max-w-2xl max-h-[90vh]' : 'max-w-xl'
      }`}>

        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-orange-600" />
            <span className="font-bold text-zinc-800 text-[15px]">Generate General Study Plan</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-700 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="px-6 pt-4 pb-0 shrink-0">
          <div className="flex items-center gap-0">
            {stepLabels.map((label, i) => {
              const num = i + 1;
              const done = step > num;
              const active = step === num;
              return (
                <React.Fragment key={num}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      done   ? 'bg-orange-500 text-white' :
                      active ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-400 ring-offset-1' :
                               'bg-zinc-100 text-zinc-400'
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : num}
                    </div>
                    <span className={`text-[10px] font-semibold whitespace-nowrap ${
                      active ? 'text-orange-700' : done ? 'text-orange-500' : 'text-zinc-400'
                    }`}>{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${done ? 'bg-orange-300' : 'bg-zinc-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Alert ── */}
        {alert && (
          <div className="px-6 pt-3 shrink-0">
            <Alert type={alert.type} text={alert.text} onDismiss={() => setAlert(null)} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — Basic details
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="p-6 space-y-5">
            {/* Info banner */}
            <div className="bg-orange-50 border border-orange-200/70 rounded-lg p-3 flex gap-2 text-xs text-orange-800">
              <Brain size={14} className="shrink-0 mt-0.5 text-orange-600" />
              <span>
                The AI retrieves syllabus boundaries and past-paper probabilities from the database,
                then generates a general bi-weekly study template. 
                You can <strong>exclude topics</strong> if you want to skip certain areas.
              </span>
            </div>

            {/* Target exam date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="targetExamDate">
                Target Exam Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarDays size={15} className="text-zinc-400" />
                </div>
                <input
                  type="date"
                  id="targetExamDate"
                  name="targetExamDate"
                  min={minDateStr}
                  required
                  value={form.targetExamDate}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-zinc-900 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm transition-colors active:scale-95"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — Topic exclusion
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="flex flex-col overflow-hidden" style={{ maxHeight: '75vh' }}>
            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Sub-header */}
              <div className="bg-blue-50 border border-blue-200/70 rounded-lg p-3 flex gap-2 text-xs text-blue-800">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-blue-500" />
                <span>
                  Check the topics your student has <strong>already studied</strong>.
                  These will be completely excluded from the generated plan so the AI focuses
                  only on what's left to learn.
                </span>
              </div>

              {/* Grade 12 */}
              <GradeSection
                title="Grade 12 ICT Topics"
                subtitle="Core foundation syllabus"
                topics={GRADE_12_TOPICS}
                excludedTopics={excludedTopics}
                onToggle={toggleTopic}
              />

              {/* Divider */}
              <div className="border-t border-dashed border-zinc-200" />

              {/* Grade 13 */}
              <GradeSection
                title="Grade 13 ICT Topics"
                subtitle="Advanced & applied syllabus"
                topics={GRADE_13_TOPICS}
                excludedTopics={excludedTopics}
                onToggle={toggleTopic}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/60 shrink-0 flex items-center justify-between">
              {/* Excluded pill */}
              <div className="flex items-center gap-2">
                {excludedTopics.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-bold">
                    <Ban size={11} /> {excludedTopics.length} topic{excludedTopics.length !== 1 ? 's' : ''} excluded
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400 italic">No topics excluded — full syllabus included</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep(1); setAlert(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Generating…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Generate Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3 — Plan preview (vertical timeline)
        ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && planResult && (
          <div className="flex flex-col overflow-hidden flex-1">
            {/* Success header */}
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <p className="text-[13px] font-semibold text-emerald-800">
                  Plan #{planResult.planId} generated — {planResult.planDays.length} day schedule
                </p>
              </div>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Awaiting admin approval before the student can view this plan.
              </p>
            </div>

            {/* Summary chips */}
            <div className="px-6 pt-4 pb-2 shrink-0 flex items-center gap-2 flex-wrap">
              {['High', 'Medium', 'Low'].map(p => {
                const count = planResult.planDays.filter(d => d.priority === p).length;
                if (!count) return null;
                const colors = {
                  High:   'bg-red-50 text-red-700 border-red-200',
                  Medium: 'bg-orange-50 text-orange-700 border-orange-200',
                  Low:    'bg-zinc-50 text-zinc-600 border-zinc-200',
                };
                return (
                  <span key={p} className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold ${colors[p]}`}>
                    {p}: {count} day{count !== 1 ? 's' : ''}
                  </span>
                );
              })}
              {excludedTopics.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold">
                  <Ban size={10} /> {excludedTopics.length} topic{excludedTopics.length !== 1 ? 's' : ''} excluded
                </span>
              )}
            </div>

            {/* Scrollable timeline */}
            <div className="overflow-y-auto flex-1 px-6 pb-6 pt-2">
              <PlanTimeline days={planResult.planDays} />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/60 shrink-0 flex justify-end">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                <CheckCircle2 size={14} /> Done
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay — shown during Step 2 → API call */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
            <div className="relative">
              <Loader2 size={40} className="animate-spin text-orange-500" />
              <Brain size={18} className="absolute inset-0 m-auto text-orange-600 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-zinc-800">Generating Study Plan…</p>
              <p className="text-[12px] text-zinc-500 mt-1">
                The AI is analysing syllabus data and past-paper probabilities.<br />
                This may take 10–20 seconds.
              </p>
            </div>
            {excludedTopics.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-semibold">
                <Ban size={11} /> Excluding {excludedTopics.length} topic{excludedTopics.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function PlanDetailModal({ planId, onClose }) {
  const [plan, setPlan]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [view, setView]     = useState('table'); // 'timeline' | 'table'
  const [exporting, setExporting] = useState(false);
  
  const tableRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchPlan = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/aiagent/plans/${planId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.message || `Server error ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setPlan(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPlan();
    return () => { cancelled = true; };
  }, [planId]);

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.text(`General Study Plan Template #${planId}`, 14, 15);
      pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
      pdf.save(`AL_ICT_General_Study_Plan_${planId}.pdf`);
    } catch (err) {
      setError(`PDF Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  let days = [];
  if (plan?.planDetailsJson) {
    try { days = JSON.parse(plan.planDetailsJson); } catch { days = []; }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ListChecks size={17} className="text-orange-600" />
            <span className="font-bold text-zinc-800 text-[15px]">
              Study Plan #{planId} — Schedule
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            {!loading && days.length > 0 && view === 'table' && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Export PDF
              </button>
            )}

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5 ml-2">
              {[['timeline', 'Timeline'], ['table', 'Table']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    view === key ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-all ml-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading schedule…</span>
            </div>
          )}
          {error && <Alert type="error" text={error} />}
          {!loading && !error && days.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-10">No schedule data available.</p>
          )}

          {!loading && days.length > 0 && view === 'timeline' && (
            <PlanTimeline days={days} />
          )}

          {!loading && days.length > 0 && view === 'table' && (
            <div ref={tableRef} className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {['Day', 'Date', 'Topic', 'Sub-topics', 'Priority'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {days.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="w-6 h-6 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-full inline-flex items-center justify-center">
                          {d.day}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-zinc-500 font-mono whitespace-nowrap">{d.date}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-zinc-800 max-w-[160px]">{d.topic}</td>
                      <td className="px-4 py-2.5 text-[11px] text-zinc-500 max-w-[200px] leading-snug">{d.subtopics}</td>
                      <td className="px-4 py-2.5"><PriorityBadge priority={d.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — StudyPlanManager
// ═══════════════════════════════════════════════════════════════════════════════
export default function StudyPlanManager() {
  const [plans, setPlans]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [pageAlert, setPageAlert]       = useState(null);
  const [filter, setFilter]             = useState('all');
  const [approvingId, setApprovingId]   = useState(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [detailPlanId, setDetailPlanId] = useState(null);

  const fetchPlans = useCallback(async (signal) => {
    setLoading(true);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/plans`, { signal });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || `Server responded with ${res.status}`);
      }
      const data = await res.json();
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setPageAlert({ type: 'error', text: `Failed to load plans: ${err.message}` });
        setPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlans(controller.signal);
    return () => controller.abort();
  }, [fetchPlans]);

  const handleApprove = async (planId) => {
    setApprovingId(planId);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/approve-plan/${planId}`, { method: 'PUT' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, isApproved: true, approvedBy: data.approvedBy, approvedAt: data.approvedAt }
            : p
        )
      );
      setPageAlert({ type: 'success', text: `Plan #${planId} approved. The student can now view their schedule.` });
    } catch (err) {
      setPageAlert({ type: 'error', text: err.message });
    } finally {
      setApprovingId(null);
    }
  };

  const filtered      = plans.filter(p => filter === 'pending' ? !p.isApproved : filter === 'approved' ? p.isApproved : true);
  const pendingCount  = plans.filter(p => !p.isApproved).length;
  const approvedCount = plans.filter(p =>  p.isApproved).length;

  const stats = [
    { label: 'Total Plans',    value: plans.length,  icon: ClipboardList, color: 'text-zinc-700',    bg: 'bg-zinc-100',    border: 'border-zinc-200' },
    { label: 'Pending Review', value: pendingCount,   icon: Clock,         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200/60' },
    { label: 'Approved',       value: approvedCount,  icon: CheckCircle2,  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200/60' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">

      {/* ── Modals ── */}
      {showGenModal && (
        <GeneratePlanModal
          onClose={() => setShowGenModal(false)}
          onSuccess={(msg) => {
            setPageAlert({ type: 'success', text: msg });
            fetchPlans();
          }}
        />
      )}
      {detailPlanId && (
        <PlanDetailModal planId={detailPlanId} onClose={() => setDetailPlanId(null)} />
      )}

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            AI Study Plan Manager
            <span className="text-xs text-zinc-400 block font-normal mt-1">
              Human-in-the-loop approval workflow · UC6 Agentic AI
            </span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Generate AI-personalised study plans, review the schedule, and approve before students see them.
          </p>
        </div>
        <button
          onClick={() => setShowGenModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-95"
        >
          <Sparkles size={14} strokeWidth={2.5} />
          Generate Plan
        </button>
      </div>

      {/* ── Page-level alert ── */}
      {pageAlert && (
        <Alert type={pageAlert.type} text={pageAlert.text} onDismiss={() => setPageAlert(null)} />
      )}

      {/* ── Stat ribbon ── */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${s.border}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
              <s.icon size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">{s.label}</p>
              <p className="text-2xl font-bold text-zinc-900 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
            {[
              { key: 'all',      label: 'All Plans' },
              { key: 'pending',  label: `Pending (${pendingCount})` },
              { key: 'approved', label: 'Approved' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  filter === tab.key ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-600">{filtered.length}</span> plan{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => fetchPlans()}
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
            <span className="text-sm">Loading study plans…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Brain size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-[14px] font-semibold text-zinc-400">No plans found</p>
            <p className="text-[12px] text-zinc-300 mt-1">
              {filter === 'pending' ? 'All plans have been approved.' : 'Click "Generate Plan" to create the first AI study plan.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  {['Plan ID', 'Student ID', 'Target Exam Date', 'Created', 'Status', 'Approved By', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(plan => {
                  const isApprovingThis = approvingId === plan.id;
                  return (
                    <tr key={plan.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px] font-semibold text-zinc-700">#{plan.id}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {plan.studentId}
                          </div>
                          <span className="text-[12px] text-zinc-600 font-medium">Student #{plan.studentId}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-zinc-700 font-medium">
                          <CalendarDays size={12} className="text-zinc-400" />
                          {plan.targetExamDate}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-zinc-400 font-medium">{plan.createdAt}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge approved={plan.isApproved} />
                      </td>
                      <td className="px-5 py-3.5">
                        {plan.isApproved ? (
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1">
                              <ShieldCheck size={11} className="text-emerald-600" />
                              {plan.approvedBy ?? 'Admin'}
                            </p>
                            {plan.approvedAt && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{plan.approvedAt}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDetailPlanId(plan.id)}
                            title="View full schedule"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800 text-[11px] font-semibold transition-all"
                          >
                            <Eye size={12} /> View
                          </button>
                          {!plan.isApproved && (
                            <button
                              onClick={() => handleApprove(plan.id)}
                              disabled={isApprovingThis}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                              {isApprovingThis ? (
                                <><Loader2 size={12} className="animate-spin" /> Approving…</>
                              ) : (
                                <><ShieldCheck size={12} /> Review &amp; Approve</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!loading && plans.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
            <p className="text-[11px] text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-zinc-600">{plans.length}</span> plans
            </p>
            {pendingCount > 0 && (
              <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <Clock size={11} />
                {pendingCount} plan{pendingCount !== 1 ? 's' : ''} awaiting your approval
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
