# A/L ICT Master Dataset

Place the Excel file `2011-2025_ICT_Master_Dataset_Complete.xlsx` in this directory.

## Expected Sheet: `2015_2025_ICT_Master_Dataset_CL`

| Column | Description |
|---|---|
| Question_ID | Unique ID e.g. 2015_P1_Q1 |
| Year | 2015 – 2025 |
| Lesson_Name | Topic / subject e.g. "Logic Gates" |
| Difficulty_Level | Easy / Medium / Hard |
| Question_Text | Full question text |
| Option_1 … Option_5 | MCQ choices |
| Correct_Answer | Letter answer e.g. A |
| Correct_Option_No | Numeric index 1–5 |

The ContentSynthesizerService reads 3–5 matching rows for the requested topic to build
the few-shot prompt sent to the Groq LLM. If this file is absent or no matching rows
are found, it falls back to the Questions table in PostgreSQL, then to built-in seed data.
