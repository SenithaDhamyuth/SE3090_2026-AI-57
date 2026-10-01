import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import AdminLayout from './AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from './Dashboard';
import ExamSessions from './ExamSessions';
import StudentManagement from './StudentManagement';
import StudyPlanManager from './StudyPlanManager';
import PastPaperAnalytics from './PastPaperAnalytics';
import QuestionBankForm from './QuestionBankForm';
import AdminLogin from './AdminLogin';
import PendingApprovals from './PendingApprovals';
import StudentMarks from './StudentMarks';

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