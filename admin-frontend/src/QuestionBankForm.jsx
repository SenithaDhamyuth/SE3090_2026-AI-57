import React, { useState, useRef } from 'react';
import {
  BookOpen, Hash, ListChecks, CheckCircle2, AlertCircle,
  Loader2, X, Save, RotateCcw, ChevronDown,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem('admin_token') || '';
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  });
};

// ── Lesson name options (A/L ICT syllabus) ───────────────────────────────────
const LESSON_OPTIONS = [
  'Data Representation',
  'Digital Circuits and Boolean Algebra',
  'Data Communication and Networking',
  'Database Management',
  'Programming (Python)',
  'Systems Analysis and Design (SAD)',
  'Web Development',
  'IoT and Embedded Systems',
  'Computer Organisation and Architecture',
  'Social and Ethical Issues',
  'Operating Systems',
  'Other',
];

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

const EMPTY = {
  year: new Date().getFullYear(),
  paper_type: 'MCQ',
  lesson_name: '',
  difficulty_level: 'Medium',
  question_text: '',
  option_1: '', option_2: '', option_3: '', option_4: '', option_5: '',
  correct_option_no: 1,
};

// ── Small alert ───────────────────────────────────────────────────────────────
function InlineAlert({ type, text, onDismiss }) {
  const styles = {
    success: 'bg-zinc-50 border-zinc-200 text-zinc-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${styles[type]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 font-medium leading-snug">{text}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'block w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 ' +
  'placeholder-zinc-400 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function QuestionBankForm({ onSuccess }) {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert]   = useState(null);
  const formRef             = useRef(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleReset = () => {
    setForm(EMPTY);
    setAlert(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    // Basic validation
    if (!form.lesson_name) return setAlert({ type: 'error', text: 'Please select a Lesson Name.' });
    if (!form.option_1.trim() || !form.option_2.trim() || !form.option_3.trim() || !form.option_4.trim())
      return setAlert({ type: 'error', text: 'Options 1–4 are required.' });

    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/questions`, {
        method: 'POST',
        body: JSON.stringify({
          year:             Number(form.year),
          paper_type:       form.paper_type,
          lesson_name:      form.lesson_name,
          difficulty_level: form.difficulty_level,
          question_text:    form.question_text.trim(),
          option_1:         form.option_1.trim(),
          option_2:         form.option_2.trim(),
          option_3:         form.option_3.trim(),
          option_4:         form.option_4.trim(),
          option_5:         form.option_5.trim() || null,
          correct_option_no: Number(form.correct_option_no),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`);

      setAlert({
        type: 'success',
        text: `Question saved! ID: ${data.question_id} — ${data.lesson_name} (${data.year})`,
      });
      // Reset the form but keep year/lesson for fast multi-entry
      setForm(prev => ({ ...EMPTY, year: prev.year, lesson_name: prev.lesson_name, difficulty_level: prev.difficulty_level }));
      onSuccess?.();
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { key: 'option_1', label: 'Option 1' },
    { key: 'option_2', label: 'Option 2' },
    { key: 'option_3', label: 'Option 3' },
    { key: 'option_4', label: 'Option 4' },
    { key: 'option_5', label: 'Option 5 (optional)' },
  ];

  return (
    <div ref={formRef} className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-zinc-100 bg-gradient-to-r from-orange-50 to-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-orange-600" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-zinc-900">Add Question to Bank</h2>
          <p className="text-[12px] text-zinc-400 leading-none mt-0.5">
            MCQs are sourced by the AI Data Analyst to predict exam patterns
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {alert && (
          <InlineAlert type={alert.type} text={alert.text} onDismiss={() => setAlert(null)} />
        )}

        {/* ── Row 1: Year, Paper Type, Lesson, Difficulty ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Year" required>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="number"
                min={2000} max={2099}
                required
                value={form.year}
                onChange={e => set('year', e.target.value)}
                className={`${inputCls} pl-8`}
              />
            </div>
          </Field>

          <Field label="Paper Type">
            <div className="relative">
              <select
                value={form.paper_type}
                onChange={e => set('paper_type', e.target.value)}
                className={`${inputCls} pr-8 appearance-none`}
              >
                {['MCQ', 'Essay', 'Structured'].map(v => <option key={v}>{v}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </Field>

          <Field label="Lesson / Topic" required>
            <div className="relative">
              <select
                required
                value={form.lesson_name}
                onChange={e => set('lesson_name', e.target.value)}
                className={`${inputCls} pr-8 appearance-none`}
              >
                <option value="">— Select lesson —</option>
                {LESSON_OPTIONS.map(l => <option key={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </Field>

          <Field label="Difficulty">
            <div className="relative">
              <select
                value={form.difficulty_level}
                onChange={e => set('difficulty_level', e.target.value)}
                className={`${inputCls} pr-8 appearance-none`}
              >
                {DIFFICULTY_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        {/* ── Row 2: Question Text ── */}
        <Field label="Question Text" required>
          <textarea
            required
            minLength={5}
            rows={3}
            value={form.question_text}
            onChange={e => set('question_text', e.target.value)}
            placeholder="Enter the full question here…"
            className={`${inputCls} resize-none`}
          />
        </Field>

        {/* ── Row 3: Options grid ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={15} className="text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700">Answer Options</span>
            <span className="text-[11px] text-zinc-400 ml-1">(Options 1–4 required)</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {options.map(({ key, label }, idx) => {
              const optNo  = idx + 1;
              const isCorrect = Number(form.correct_option_no) === optNo;
              return (
                <div
                  key={key}
                  className={`relative rounded-lg border transition-colors ${
                    isCorrect ? 'border-zinc-400 bg-zinc-50/40' : 'border-zinc-200 bg-white'
                  }`}
                >
                  {/* Correct-answer radio pill */}
                  <button
                    type="button"
                    onClick={() => set('correct_option_no', optNo)}
                    title={`Mark as correct answer`}
                    className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isCorrect
                        ? 'border-zinc-500 bg-zinc-500'
                        : 'border-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {isCorrect && <span className="w-2 h-2 rounded-full bg-white block" />}
                  </button>

                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    required={optNo <= 4}
                    placeholder={`${label}…`}
                    className="block w-full pl-10 pr-3 py-2.5 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
                  />

                  {/* Label badge */}
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isCorrect ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {optNo}{isCorrect ? ' ✓' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-400 mt-2 flex items-center gap-1">
            <CheckCircle2 size={11} className="text-zinc-500" />
            Click the circle next to an option to mark it as the correct answer.
            Currently: <strong className="text-zinc-700">Option {form.correct_option_no}</strong>
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
          >
            <RotateCcw size={14} /> Reset Form
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Question</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
