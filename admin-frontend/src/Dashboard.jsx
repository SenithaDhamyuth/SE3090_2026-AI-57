import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, GraduationCap } from 'lucide-react';

const API_BASE = 'http://localhost:5087';

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

        const [studentsRes, sessionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/StudentProfile/all`, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
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
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-zinc-500 mt-2">A/L ICT Member 1 overview</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500 text-sm">Loading dashboard…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700 text-sm">No Data Available</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <GraduationCap size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total Students</p>
                <p className="text-[30px] font-bold text-zinc-900">{totalStudents}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total Sessions</p>
                <p className="text-[30px] font-bold text-zinc-900">{totalSessions}</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
              <BookOpen size={20} />
            </div>
            <p className="text-[16px] font-semibold text-zinc-700">No Data Available</p>
            <p className="text-[12px] text-zinc-500 mt-2">The database is empty for this Member 1 A/L ICT dashboard.</p>
          </div>
        </div>
      )}
    </div>
  );
}