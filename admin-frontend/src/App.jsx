import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login              from './Login';
import Layout             from './Layout';
import AnalyticsDashboard from './AnalyticsDashboard';
import PendingApprovals   from './PendingApprovals';
import UserManagement     from './UserManagement';
import AuditLog           from './AuditLog';

/* ─────────────────────────────────────────────
   PLACEHOLDER stubs for routes not yet built
   (Question Bank — full build in next sprint)
───────────────────────────────────────────── */
function PlaceholderPage({ title, titleSi, uc, description }) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
          <span className="text-2xl">🚧</span>
        </div>
        <div className="text-center">
          <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight">{title}</h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">{titleSi}</p>
          {uc && (
            <span className="inline-block mt-2 text-[10px] font-mono font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded">
              {uc}
            </span>
          )}
          <p className="text-[13px] text-zinc-400 mt-3 max-w-md">{description}</p>
        </div>
        <div className="px-4 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[12px] text-zinc-500 font-medium">
          Full implementation scheduled for Sprint 2
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   APP ROUTER
───────────────────────────────────────────── */
function App() {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/" element={<Login />} />

        {/* Protected admin shell — Layout wraps all dashboard routes */}
        <Route path="/" element={<Layout />}>

          {/* Redirect /dashboard → /analytics (legacy compat) */}
          <Route path="dashboard" element={<Navigate to="/analytics" replace />} />

          {/* ── Intelligence Layer ── */}
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="approvals" element={<PendingApprovals />} />

          {/* ── Content Engine ── */}
          <Route
            path="questions"
            element={
              <PlaceholderPage
                title="Question Bank & Distractor Analysis"
                titleSi="ප්‍රශ්න බැංකුව · UC5.2 · UC5.4"
                uc="UC5.2 · UC5.4"
                description="Browse, seed, and manage the full MCQ inventory. View AI-generated distractor analysis per question item. Filter by subject, topic, difficulty, and approval status."
              />
            }
          />

          {/* ── Administration ── */}
          <Route path="users" element={<UserManagement />} />
          <Route path="audit" element={<AuditLog />} />

          {/* Catch-all redirect to analytics */}
          <Route path="*" element={<Navigate to="/analytics" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;