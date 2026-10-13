// Synthetic data for isolated browser tests only. Never imported by the app.
const students = [
  {
    id: 1,
    fullName: "Test Student One",
    email: "student.one@example.invalid",
    college: "Test College",
    phoneNumber: "",
    address: "",
    createdAt: "2026-09-01",
  },
  {
    id: 2,
    fullName: "Test Student Two",
    email: "student.two@example.invalid",
    college: "Test College",
    phoneNumber: "",
    address: "",
    createdAt: "2026-09-02",
  },
  {
    id: 3,
    fullName: "Test Student Three",
    email: "student.three@example.invalid",
    college: "Example College",
    phoneNumber: "",
    address: "",
    createdAt: "2026-09-03",
  },
];
const questions = [
  {
    questionText: "Which device forwards packets between networks?",
    options: ["Router", "Monitor", "Keyboard", "Printer"],
    correctOptionIndex: 0,
    explanation: "Routers forward packets between networks.",
  },
];
const sessions = [
  "Ready",
  "PendingAdminApproval",
  "Pending",
  "InProgress",
  "Completed",
].map((status, i) => ({
  id: i + 1,
  title: [
    "Network fundamentals",
    "Data representation",
    "Python basics",
    "Database concepts",
    "Digital logic",
  ][i],
  subject: "ICT",
  status,
  startTime: "2026-10-0" + (i + 1) + "T09:00:00Z",
  endTime: i === 4 ? "2026-10-05T10:00:00Z" : null,
  durationMinutes: 30,
  questionsReady: i !== 2,
  sessionId: "test-session-" + (i + 1),
  isTimerLocked: i === 3,
  totalScore: i === 4 ? 7 : 0,
  questionsJson: JSON.stringify(questions),
  originalObjective: "Review core ICT concepts",
}));
const days = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  topic: "ICT revision " + (i + 1),
  subtopics: "Review notes and practice questions.",
  priority: i < 3 ? "High" : "Medium",
}));
const plans = [
  {
    id: 10,
    studentId: 0,
    createdAt: "2026-10-01",
    isApproved: false,
    isPublished: false,
    planDetailsJson: JSON.stringify(days),
  },
  {
    id: 11,
    studentId: 0,
    createdAt: "2026-10-02",
    isApproved: true,
    isPublished: false,
    approvedByEmail: "admin@example.invalid",
    planDetailsJson: JSON.stringify(days),
  },
];
const analytics = [
  {
    id: 1,
    topicName: "Networking",
    year: 2025,
    probabilityPercentage: 22,
    generatedByAgent: true,
    createdAt: "2026-10-01",
  },
  {
    id: 2,
    topicName: "Programming",
    year: 2024,
    probabilityPercentage: 16,
    generatedByAgent: true,
    createdAt: "2026-10-01",
  },
  {
    id: 3,
    topicName: "Databases",
    year: 2025,
    probabilityPercentage: 8,
    generatedByAgent: false,
    createdAt: "2026-10-01",
  },
];
const marks = [
  {
    sessionId: 5,
    studentId: 1,
    studentName: "Test Student One",
    studentEmail: "student.one@example.invalid",
    title: "Digital logic",
    subject: "ICT",
    totalScore: 7,
    totalQuestions: 10,
    durationMinutes: 30,
    endTime: "2026-10-05 10:00",
  },
];

module.exports = {
  students,
  sessions,
  plans,
  analytics,
  marks,
  questions,
  days,
};
