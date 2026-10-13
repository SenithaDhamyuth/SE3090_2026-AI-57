import React, { lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AdminLayout from "./AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
const Dashboard = lazy(() => import("./Dashboard"));
const ExamSessions = lazy(() => import("./ExamSessions"));
const StudentManagement = lazy(() => import("./StudentManagement"));
const StudyPlanManager = lazy(() => import("./StudyPlanManager"));
const PastPaperAnalytics = lazy(() => import("./PastPaperAnalytics"));
const QuestionBankForm = lazy(() => import("./QuestionBankForm"));
import AdminLogin from "./AdminLogin";
const PendingApprovals = lazy(() => import("./PendingApprovals"));
const StudentMarks = lazy(() => import("./StudentMarks"));

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="exams" element={<ExamSessions />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="ai-plans" element={<StudyPlanManager />} />
          <Route path="analytics" element={<PastPaperAnalytics />} />
          <Route path="question-bank" element={<QuestionBankForm />} />
          <Route path="approvals" element={<PendingApprovals />} />
          <Route path="marks" element={<StudentMarks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
