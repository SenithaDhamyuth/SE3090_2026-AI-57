import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './Layout';
import Dashboard from './Dashboard';
import ExamSessions from './ExamSessions';
import StudentManagement from './StudentManagement';
import StudyPlanManager from './StudyPlanManager';
import AdminLogin from './AdminLogin';

function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  if (!token) {
    return <AdminLogin onLogin={(newToken) => setToken(newToken)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout onLogout={() => {
          localStorage.removeItem('admin_token');
          setToken(null);
        }} />}>
          <Route index element={<Dashboard />} />
          <Route path="exams" element={<ExamSessions />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="ai-plans" element={<StudyPlanManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;