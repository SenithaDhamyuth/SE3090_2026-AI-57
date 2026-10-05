import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, GraduationCap, TrendingUp, Zap } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('admin_token');

        const [studentsRes, sessionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/students`, {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/assessment/sessions`, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
          }),
        ]);

        if (!studentsRes.ok) throw new Error(`Students API responded with ${studentsRes.status} ${studentsRes.statusText}`);
        if (!sessionsRes.ok) throw new Error(`Sessions API responded with ${sessionsRes.status} ${sessionsRes.statusText}`);

        const studentData = await studentsRes.json();
        const sessionData = await sessionsRes.json();

        setStudents(Array.isArray(studentData) ? studentData : []);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
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

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
            Overview
          </h1>
          <p className="text-[13px] text-gray-400 mt-1.5">
            IntelliPrep · A/L ICT Admin Dashboard
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-semibold text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Live Data
        </span>
      </div>

      {loading ? (
        /* ── Loading skeleton ── */
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-100 rounded w-24" />
                  <div className="h-8 bg-gray-100 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* ── Error state ── */
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Activity size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-red-800">Could not load dashboard</p>
              <p className="text-[12px] text-red-500 mt-0.5">No Data Available</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid gap-4 md:grid-cols-2">

            {/* Total Students */}
            <div className="group relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">
                    Total Students
                  </p>
                  <p className="text-[42px] font-bold text-gray-900 leading-none tracking-tight">
                    {totalStudents}
                  </p>
                  <p className="text-[12px] text-gray-400 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} className="text-orange-400" />
                    Registered student accounts
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200 shrink-0">
                  <GraduationCap size={20} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Total Sessions */}
            <div className="group relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">
                    Total Sessions
                  </p>
                  <p className="text-[42px] font-bold text-gray-900 leading-none tracking-tight">
                    {totalSessions}
                  </p>
                  <p className="text-[12px] text-gray-400 mt-2 flex items-center gap-1">
                    <Activity size={12} className="text-gray-400" />
                    Exam sessions created
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-md shadow-gray-200 shrink-0">
                  <Activity size={20} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Empty / Onboarding State ── */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4">
              <BookOpen size={22} className="text-orange-500" />
            </div>
            <p className="text-[16px] font-semibold text-gray-700">No activity data yet</p>
            <p className="text-[13px] text-gray-400 mt-1.5 max-w-sm mx-auto">
              The database is empty for this dashboard view. Create an exam session to get started.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-[13px] font-semibold shadow-sm hover:bg-orange-700 cursor-pointer transition-all duration-150">
              <Zap size={14} />
              Request Mock Exam
            </div>
          </div>
        </>
      )}
    </div>
  );
}
