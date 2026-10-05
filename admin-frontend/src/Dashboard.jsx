import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, GraduationCap } from 'lucide-react';

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
    <div className="max-w-[1200px] mx-auto p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-[calc(100vh-3.5rem)]">

      {/* ── Page Header ── */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-[13px] text-gray-500 mt-1">
          IntelliPrep · A/L ICT Admin Dashboard
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center animate-pulse">
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-8 bg-gray-100 rounded w-16" />
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Could not load dashboard</p>
              <p className="text-[12px] text-gray-500 mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid gap-6 md:grid-cols-2">

            {/* Total Students */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start transition-shadow hover:shadow-md">
              <div className="flex flex-col">
                <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">
                  Total Students
                </span>
                <span className="text-4xl font-bold text-gray-900 mt-2">
                  {totalStudents}
                </span>
              </div>
              <div className="bg-orange-50 text-orange-600 rounded-full p-2.5">
                <GraduationCap size={20} />
              </div>
            </div>

            {/* Total Sessions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start transition-shadow hover:shadow-md">
              <div className="flex flex-col">
                <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">
                  Total Sessions
                </span>
                <span className="text-4xl font-bold text-gray-900 mt-2">
                  {totalSessions}
                </span>
              </div>
              <div className="bg-gray-50 text-gray-600 rounded-full p-2.5">
                <Activity size={20} />
              </div>
            </div>
          </div>

          {/* ── Empty State ── */}
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm mt-8">
            <div className="bg-orange-50 text-orange-500 rounded-2xl p-4 mb-4">
              <BookOpen size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No activity data yet</h3>
            <p className="text-[13px] text-gray-500 mt-1 text-center max-w-xs">
              The database is empty for this dashboard view. Create an exam session to get started.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
