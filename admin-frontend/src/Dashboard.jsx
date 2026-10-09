import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  ClipboardList,
  Brain,
  ShieldAlert,
  UserPlus,
  FlaskConical,
  BarChart3,
  Users,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';

const API_BASE =
  (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

/* ─────────────────────────── Stat Card ─────────────────────────── */
function StatCard({ label, value, icon: Icon, iconBg, iconColor, badge }) {
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">
          {label}
        </span>
        <span className="text-4xl font-extrabold text-slate-900 mt-1 tabular-nums">
          {value}
        </span>
      </div>

      <div className="relative">
        <div className={`${iconBg} ${iconColor} rounded-xl p-3 transition-transform duration-200 group-hover:scale-110`}>
          <Icon size={22} strokeWidth={2} />
        </div>
        {badge && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 border-2 border-white" />
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Quick Action Button ───────────────────── */
function QuickAction({ icon: Icon, label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-orange-200 group cursor-pointer"
    >
      <div className="shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-3 shadow-md shadow-orange-200 transition-transform duration-200 group-hover:scale-110">
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
          {label}
        </p>
        <p className="text-[12px] text-gray-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight
        size={16}
        className="shrink-0 mt-1 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all duration-200"
      />
    </button>
  );
}

/* ──────────────────────── Workflow Step Card ────────────────────── */
function WorkflowStep({ step, icon: Icon, title, description, accent }) {
  return (
    <div className="relative flex flex-col items-center text-center bg-white rounded-2xl border border-gray-100 p-6 pt-8 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group">
      {/* Step number badge */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md shadow-orange-200">
        Step {step}
      </div>

      {/* Icon */}
      <div className={`${accent} rounded-2xl p-4 mb-4 transition-transform duration-200 group-hover:scale-110`}>
        <Icon size={28} strokeWidth={1.5} />
      </div>

      <h4 className="text-[15px] font-bold text-slate-900">{title}</h4>
      <p className="text-[12px] text-gray-400 mt-2 leading-relaxed max-w-[220px]">
        {description}
      </p>
    </div>
  );
}

/* ──────────────────────────── Skeleton ──────────────────────────── */
function SkeletonCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center animate-pulse"
        >
          <div className="flex-1 space-y-3">
            <div className="h-3 bg-gray-100 rounded w-24" />
            <div className="h-8 bg-gray-100 rounded w-16" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DASHBOARD — MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [studyPlans, setStudyPlans] = useState({ totalPlans: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('admin_token');

        const [studentsRes, sessionsRes, plansRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/students`, {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/assessment/sessions`, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${API_BASE}/api/aiagent/plans`, {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!studentsRes.ok)
          throw new Error(
            `Students API responded with ${studentsRes.status} ${studentsRes.statusText}`
          );
        if (!sessionsRes.ok)
          throw new Error(
            `Sessions API responded with ${sessionsRes.status} ${sessionsRes.statusText}`
          );
        if (!plansRes.ok)
          throw new Error(
            `Plans API responded with ${plansRes.status} ${plansRes.statusText}`
          );

        const studentData = await studentsRes.json();
        const sessionData = await sessionsRes.json();
        const planData = await plansRes.json();

        setStudents(Array.isArray(studentData) ? studentData : []);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
        setStudyPlans(planData || { totalPlans: 0, pendingCount: 0 });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load dashboard data.');
          setStudents([]);
          setSessions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  const totalStudents = students.length;
  const totalSessions = sessions.length;
  const pendingSessions = sessions.filter(s => s.status === 'PendingAdminApproval').length;
  const totalStudyPlans = studyPlans.totalPlans || 0;
  const pendingStudyPlans = studyPlans.pendingCount || 0;
  const totalPendingApprovals = pendingSessions + pendingStudyPlans;

  /* ── Current date for greeting ── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="max-w-[1280px] mx-auto space-y-8 pb-10">
      {/* ══════════════════ Page Header ══════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {greeting}, Admin 👋
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            Here's what's happening with IntelliPrep today.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-semibold text-orange-700 shrink-0 self-start sm:self-auto">
          <Zap size={12} />
          A/L ICT Platform — Live
        </span>
      </div>

      {/* ══════════════════ Stats Row ══════════════════ */}
      {loading ? (
        <SkeletonCards />
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-900">
                Could not load dashboard data
              </p>
              <p className="text-[12px] text-gray-500 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            value={totalStudents}
            icon={GraduationCap}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            label="Exam Sessions"
            value={totalSessions}
            icon={ClipboardList}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <StatCard
            label="AI Study Plans"
            value={totalStudyPlans}
            icon={Brain}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
          />
          <StatCard
            label="Pending Approvals"
            value={totalPendingApprovals}
            icon={ShieldAlert}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
            badge
          />
        </div>
      )}

      {/* ══════════════════ Quick Actions ══════════════════ */}
      <div>
        <h2 className="text-[11px] tracking-wider text-gray-400 font-bold uppercase mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            icon={UserPlus}
            label="Register New Student"
            description="Create a new student account and assign initial access credentials."
            onClick={() => navigate('/students')}
          />
          <QuickAction
            icon={FlaskConical}
            label="Generate AI Mock Exam"
            description="Use AI to synthesize MCQ papers from the A/L ICT syllabus."
            onClick={() => navigate('/exams')}
          />
          <QuickAction
            icon={BarChart3}
            label="View Past Paper Analytics"
            description="Explore topic-wise performance and difficulty distributions."
            onClick={() => navigate('/analytics')}
          />
        </div>
      </div>

      {/* ══════════════════ Workflow Guide ══════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-[11px] tracking-wider text-gray-400 font-bold uppercase">
            System Workflow Guide
          </h2>
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider shrink-0">
            Human-in-the-Loop AI
          </span>
        </div>

        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Connector lines (hidden on mobile) */}
          <div className="hidden sm:block absolute top-1/2 left-[17%] right-[17%] -translate-y-1/2 h-px border-t-2 border-dashed border-orange-200 z-0" />

          <WorkflowStep
            step={1}
            icon={Users}
            title="Onboard Students"
            description="Create student accounts, assign classes, and configure initial access to the platform."
            accent="bg-blue-50 text-blue-500"
          />
          <WorkflowStep
            step={2}
            icon={Sparkles}
            title="AI Synthesis"
            description="AI Agents generate personalized study plans and MCQ assessments within A/L ICT syllabus boundaries."
            accent="bg-violet-50 text-violet-500"
          />
          <WorkflowStep
            step={3}
            icon={CheckCircle2}
            title="Review & Publish"
            description="Admin reviews AI-generated content for accuracy and quality before publishing to the student mobile app."
            accent="bg-emerald-50 text-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
