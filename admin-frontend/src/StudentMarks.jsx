import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy, RefreshCw, ClipboardList, Users, Loader2,
  ChevronUp, ChevronDown, Search, AlertCircle, CheckCircle2,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '';

const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('admin_token') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
};

// ── Score badge ────────────────────────────────────────────────────────────────
function ScoreBadge({ score, total }) {
  if (total === 0) return <span className="text-gray-400 text-[12px] font-semibold">N/A</span>;
  const pct = Math.round((score / total) * 100);
  const color =
    pct >= 75 ? 'bg-green-50 text-green-600' :
    pct >= 50 ? 'bg-orange-50 text-orange-600' :
                'bg-red-50 text-red-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${color}`}>
      <Trophy size={12} strokeWidth={2.5} />
      {score}/{total} ({pct}%)
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StudentMarks() {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [sortField, setSortField] = useState('endTime');
  const [sortDir, setSortDir]     = useState('desc');

  const fetchMarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/marks`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || `Server error ${res.status}`);
      }
      const data = await res.json();
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.sessions)
          ? data.sessions
          : Array.isArray(data.data)
            ? data.data
            : [];
      setSessions(rows.map((item, index) => ({
        ...item,
        sessionId: item.sessionId ?? item.SessionId ?? item.id ?? item.Id ?? index,
        sessionGuid: item.sessionGuid ?? item.SessionGuid ?? '',
        studentId: item.studentId ?? item.StudentId ?? '',
        studentName: item.studentName ?? item.StudentName ?? 'Unknown Student',
        studentEmail: item.studentEmail ?? item.StudentEmail ?? item.email ?? item.Email ?? '',
        title: item.title ?? item.Title ?? '',
        subject: item.subject ?? item.Subject ?? '',
        totalScore: Number(item.totalScore ?? item.TotalScore ?? 0),
        totalQuestions: Number(item.totalQuestions ?? item.TotalQuestions ?? 0),
        durationMinutes: Number(item.durationMinutes ?? item.DurationMinutes ?? 0),
        endTime: item.endTime ?? item.EndTime ?? '',
        originalObjective: item.originalObjective ?? item.OriginalObjective ?? '',
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={12} className="text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-orange-500" />
      : <ChevronDown size={12} className="text-orange-500" />;
  };

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = sessions
    .filter(s => {
      const q = search.toLowerCase();
      return (
        String(s.studentName ?? '').toLowerCase().includes(q) ||
        String(s.studentEmail ?? '').toLowerCase().includes(q) ||
        String(s.subject ?? '').toLowerCase().includes(q) ||
        String(s.title ?? '').toLowerCase().includes(q) ||
        String(s.studentId ?? '').toLowerCase().includes(q) ||
        String(s.sessionGuid ?? '').toLowerCase().includes(q) ||
        String(s.originalObjective ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (sortField === 'totalScore') { valA = Number(valA); valB = Number(valB); }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const avgScore = sessions.length === 0 ? 0 :
    Math.round(sessions.reduce((sum, s) => sum + s.totalScore, 0) / sessions.length);
  const passCount = sessions.filter(s => s.totalQuestions > 0 && s.totalScore / s.totalQuestions >= 0.5).length;

  const stats = [
    { label: 'Total Submissions', value: sessions.length, icon: ClipboardList, color: 'text-gray-700',  bg: 'bg-gray-100',   border: 'border-gray-200' },
    { label: 'Unique Students',   value: new Set(sessions.map(s => s.studentId)).size, icon: Users, color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
    { label: 'Avg Score',         value: avgScore,         icon: Trophy,      color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
    { label: 'Pass Rate (≥50%)',  value: `${sessions.length ? Math.round((passCount / sessions.length) * 100) : 0}%`, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  ];

  const ColHeader = ({ label, field }) => (
    <th
      onClick={() => toggleSort(field)}
      className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1.5">
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div className="max-w-[1200px] mx-auto p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-[calc(100vh-3.5rem)]">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Marks</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            All completed exam submissions · Results Dashboard<br/>
            View scores for every student who has submitted an AI-generated exam.
          </p>
        </div>
        <button
          onClick={fetchMarks}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm text-gray-700 text-[13px] font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border bg-red-50 border-red-100 text-red-800 text-sm shadow-sm">
          <AlertCircle size={18} className="shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Stat ribbon ── */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-[10px] tracking-wider text-gray-400 font-semibold uppercase">{s.label}</span>
                <span className="text-4xl font-bold text-gray-900 mt-2">{s.value}</span>
              </div>
              <div className={`rounded-full p-2.5 ${
                i === 0 ? 'bg-gray-50 text-gray-600' :
                i === 1 ? 'bg-orange-50 text-orange-600' :
                'bg-green-50 text-green-600'
              }`}>
                <s.icon size={20} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden pb-4">
        {/* Toolbar */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search student name, subject..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 transition-all bg-gray-50/50"
            />
          </div>
          <span className="ml-auto text-[13px] text-gray-500">
            <span className="font-bold text-gray-900">{filtered.length}</span> of {sessions.length} sessions
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <span className="text-[14px] font-medium">Loading marks...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="bg-orange-50 text-orange-500 rounded-2xl p-4 mb-4">
               <Trophy size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No completed exams found</h3>
            <p className="text-[13px] text-gray-500 mt-1 max-w-xs">
              {search ? 'Try a different search term.' : 'Students have not submitted any exams yet.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto px-8 pt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('sessionId')} className="py-3 pr-4 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5"># <SortIcon field="sessionId" /></span>
                  </th>
                  <th onClick={() => toggleSort('studentName')} className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Student <SortIcon field="studentName" /></span>
                  </th>
                  <th onClick={() => toggleSort('title')} className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Exam Title <SortIcon field="title" /></span>
                  </th>
                  <th onClick={() => toggleSort('subject')} className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Subject <SortIcon field="subject" /></span>
                  </th>
                  <th onClick={() => toggleSort('totalScore')} className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Score <SortIcon field="totalScore" /></span>
                  </th>
                  <th onClick={() => toggleSort('durationMinutes')} className="px-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Duration <SortIcon field="durationMinutes" /></span>
                  </th>
                  <th onClick={() => toggleSort('endTime')} className="pl-4 py-3 text-[10px] tracking-wider text-gray-400 uppercase font-semibold border-b border-gray-100 cursor-pointer select-none whitespace-nowrap">
                    <span className="flex items-center gap-1.5">Submitted <SortIcon field="endTime" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s, index) => (
                  <tr key={s.sessionId ?? index} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-5 pr-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 text-[11px] font-mono font-semibold text-gray-500 border border-gray-100">
                        #{s.sessionId}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                          {(s.studentName || 'Unknown Student').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-gray-900 leading-none">{s.studentName || 'Unknown Student'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <span className="text-[13px] font-bold text-gray-900">
                        {s.title || s.subject || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <span className="text-[13px] text-gray-500">{s.subject || '—'}</span>
                    </td>
                    <td className="px-4 py-5">
                      <ScoreBadge score={s.totalScore ?? 0} total={s.totalQuestions ?? 0} />
                    </td>
                    <td className="px-4 py-5">
                      <span className="text-[13px] text-gray-500">{s.durationMinutes ? `${s.durationMinutes} min` : '—'}</span>
                    </td>
                    <td className="pl-4 py-5">
                      <span className="text-[12px] text-gray-400 whitespace-nowrap">{s.endTime || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && sessions.length > 0 && (
          <div className="px-8 mt-2 pt-4">
            <p className="text-[12px] text-gray-400">
              Showing <span className="font-bold text-gray-900">{filtered.length}</span> of{' '}
              <span className="font-bold text-gray-900">{sessions.length}</span> completed submissions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
