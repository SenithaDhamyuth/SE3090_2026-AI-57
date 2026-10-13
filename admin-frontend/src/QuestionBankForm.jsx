import { Notice, PageHeader } from "./components/ui";
import React, { useState, useRef } from "react";
import { BookOpen, CheckCircle2, Loader2, Save, RotateCcw } from "lucide-react";

const API_BASE =
  (import.meta.env.VITE_API_URL || "https://intelliprep-rhx3.onrender.com") +
  "";

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem("admin_token") || "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
};

// ── Lesson name options (A/L ICT syllabus) ───────────────────────────────────
const LESSON_OPTIONS = [
  "Data Representation",
  "Digital Circuits and Boolean Algebra",
  "Data Communication and Networking",
  "Database Management",
  "Programming (Python)",
  "Systems Analysis and Design (SAD)",
  "Web Development",
  "IoT and Embedded Systems",
  "Computer Organisation and Architecture",
  "Social and Ethical Issues",
  "Operating Systems",
  "Other",
];

const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"];

const EMPTY = {
  year: new Date().getFullYear(),
  paper_type: "MCQ",
  lesson_name: "",
  difficulty_level: "Medium",
  question_text: "",
  option_1: "",
  option_2: "",
  option_3: "",
  option_4: "",
  option_5: "",
  correct_option_no: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function QuestionBankForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const formRef = useRef(null);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleReset = () => {
    setForm(EMPTY);
    setAlert(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    // Basic validation
    if (!form.lesson_name)
      return setAlert({ type: "error", text: "Please select a Lesson Name." });
    if (
      !form.option_1.trim() ||
      !form.option_2.trim() ||
      !form.option_3.trim() ||
      !form.option_4.trim()
    )
      return setAlert({ type: "error", text: "Options 1–4 are required." });

    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/questions`, {
        method: "POST",
        body: JSON.stringify({
          year: Number(form.year),
          paper_type: form.paper_type,
          lesson_name: form.lesson_name,
          difficulty_level: form.difficulty_level,
          question_text: form.question_text.trim(),
          option_1: form.option_1.trim(),
          option_2: form.option_2.trim(),
          option_3: form.option_3.trim(),
          option_4: form.option_4.trim(),
          option_5: form.option_5.trim() || null,
          correct_option_no: Number(form.correct_option_no),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.message || `Server error ${res.status}`);

      setAlert({
        type: "success",
        text: `Question saved! ID: ${data.question_id} — ${data.lesson_name} (${data.year})`,
      });
      // Reset the form but keep year/lesson for fast multi-entry
      setForm((prev) => ({
        ...EMPTY,
        year: prev.year,
        lesson_name: prev.lesson_name,
        difficulty_level: prev.difficulty_level,
      }));
      onSuccess?.();
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { key: "option_1", label: "Option 1" },
    { key: "option_2", label: "Option 2" },
    { key: "option_3", label: "Option 3" },
    { key: "option_4", label: "Option 4" },
    { key: "option_5", label: "Option 5 (optional)" },
  ];

  return (
    <div ref={formRef} className="page question-page">
      <PageHeader
        eyebrow="GOOD QUESTIONS. STRONGER UNDERSTANDING."
        title="Question bank"
        description="Add a carefully prepared question to your A/L ICT resource collection."
      />
      {alert && (
        <Notice
          type={alert.type}
          text={alert.text}
          onDismiss={() => setAlert(null)}
        />
      )}
      <div className="question-builder">
        <form onSubmit={handleSubmit} className="surface" aria-busy={saving}>
          <section className="form-section">
            <div className="form-section-header">
              <span>01</span>
              <div>
                <h2>Set the context</h2>
                <p>Help the question find its place in the syllabus.</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="question-year">
                  Paper year <span aria-hidden="true">*</span>
                </label>
                <input
                  id="question-year"
                  type="number"
                  min={2000}
                  max={2099}
                  required
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  className="field-control"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="question-paper">
                  Paper type
                </label>
                <select
                  id="question-paper"
                  value={form.paper_type}
                  onChange={(e) => set("paper_type", e.target.value)}
                  className="field-control"
                >
                  {["MCQ", "Essay", "Structured"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="question-topic">
                  Lesson / topic <span aria-hidden="true">*</span>
                </label>
                <select
                  id="question-topic"
                  required
                  value={form.lesson_name}
                  onChange={(e) => set("lesson_name", e.target.value)}
                  className="field-control"
                >
                  <option value="">Choose a lesson</option>
                  {LESSON_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="question-difficulty">
                  Difficulty
                </label>
                <select
                  id="question-difficulty"
                  value={form.difficulty_level}
                  onChange={(e) => set("difficulty_level", e.target.value)}
                  className="field-control"
                >
                  {DIFFICULTY_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-header">
              <span>02</span>
              <div>
                <h2>Write your question</h2>
                <p>Keep the wording clear, focused and easy to understand.</p>
              </div>
            </div>
            <label className="field-label" htmlFor="question-text">
              Question text <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="question-text"
              required
              minLength={5}
              rows={5}
              value={form.question_text}
              onChange={(e) => set("question_text", e.target.value)}
              placeholder="What would you like your students to answer?"
              className="field-control resize-y"
            />
          </section>
          <section className="form-section">
            <div className="form-section-header">
              <span>03</span>
              <div>
                <h2>Add the answer options</h2>
                <p>
                  Fill in options 1–4, then select the correct answer. Option 5
                  is optional.
                </p>
              </div>
            </div>
            <fieldset className="space-y-3">
              <legend className="sr-only">
                Answer options and correct answer
              </legend>
              {options.map(({ key, label }, index) => {
                const number = index + 1;
                const isCorrect = Number(form.correct_option_no) === number;
                return (
                  <div
                    key={key}
                    className={`answer-option ${isCorrect ? "answer-option-correct" : ""}`}
                  >
                    <input
                      type="radio"
                      name="correct-answer"
                      value={number}
                      checked={isCorrect}
                      onChange={() => set("correct_option_no", number)}
                      aria-label={`Mark option ${number} as correct`}
                    />
                    <div>
                      <label
                        className="answer-option-label"
                        htmlFor={`answer-${number}`}
                      >
                        {label}
                        {isCorrect && <span>Correct answer</span>}
                      </label>
                      <input
                        id={`answer-${number}`}
                        type="text"
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        required={number <= 4}
                        placeholder={`Enter option ${number}`}
                        className="field-control"
                      />
                    </div>
                  </div>
                );
              })}
            </fieldset>
          </section>
          <div className="builder-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={saving}
              onClick={handleReset}
            >
              <RotateCcw size={16} /> Reset form
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={16} /> Save question
                </>
              )}
            </button>
          </div>
        </form>
        <aside className="builder-note">
          <BookOpen size={26} />
          <h2>A question worth asking.</h2>
          <p>
            A few quick checks help keep your question bank useful for every
            student.
          </p>
          <ul>
            <li>Use a complete, unambiguous question.</li>
            <li>Make the answer options distinct.</li>
            <li>Double-check the selected correct answer.</li>
            <li>Choose the most relevant lesson and difficulty.</li>
          </ul>
          <div className="builder-progress">
            <CheckCircle2 size={17} />
            <span>
              {
                [1, 2, 3, 4].filter((number) => form[`option_${number}`].trim())
                  .length
              }{" "}
              of 4 required options filled
            </span>
          </div>
          <p className="mt-3">
            After saving, your year, lesson and difficulty stay selected for the
            next question.
          </p>
        </aside>
      </div>
    </div>
  );
}
