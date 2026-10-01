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
  if (total === 0) return <span className="text-zinc-400 text-[12px]">N/A</span>;
  const pct = Math.round((score / total) * 100);
  const color =
    pct >= 75 ? 'bg-green-50 text-green-700 border-green-200' :
    pct >= 50 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${color}`}>
      <Trophy size={10} />
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
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
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
    if (sortField !== field) return <ChevronUp size={12} className="text-zinc-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-orange-500" />
      : <ChevronDown size={12} className="text-orange-500" />;
  };

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = sessions
    .filter(s => {
      const q = search.toLowerCase();
      return (
        s.subject?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.sessionGuid?.toLowerCase().includes(q) ||
        s.originalObjective?.toLowerCase().includes(q)
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
    { label: 'Total Submissions', value: sessions.length, icon: ClipboardList, color: 'text-zinc-700',  bg: 'bg-zinc-100',   border: 'border-zinc-200' },
    { label: 'Unique Students',   value: new Set(sessions.map(s => s.studentId)).size, icon: Users, color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
    { label: 'Avg Score',         value: avgScore,         icon: Trophy,      color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
    { label: 'Pass Rate (≥50%)',  value: `${sessions.length ? Math.round((passCount / sessions.length) * 100) : 0}%`, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  ];

  const ColHeader = ({ label, field }) => (
    <th
      onClick={() => toggleSort(field)}
      className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 cursor-pointer select-none hover:text-zinc-600 transition-colors whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            Student Marks
            <span className="text-xs text-zinc-400 block font-normal mt-1">
              All completed exam submissions · Results Dashboard
            </span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            View scores for every student who has submitted an AI-generated exam.
          </p>
        </div>
        <button
          onClick={fetchMarks}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600 text-[13px] font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg border bg-red-50 border-red-200 text-red-800 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Stat ribbon ── */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${s.border}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
                <s.icon size={16} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[20px] font-bold text-zinc-900 leading-none">{s.value}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search student, subject…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors"
            />
          </div>
          <span className="ml-auto text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-600">{filtered.length}</span> of {sessions.length} sessions
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading marks…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Trophy size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-[14px] font-semibold text-zinc-400">No completed exams found</p>
            <p className="text-[12px] text-zinc-300 mt-1">
              {search ? 'Try a different search term.' : 'Students have not submitted any exams yet.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <ColHeader label="Session ID" field="sessionId" />
                  <ColHeader label="Student ID" field="studentId" />
                  <ColHeader label="Subject / Exam" field="subject" />
                  <ColHeader label="Objective" field="originalObjective" />
                  <ColHeader label="Score" field="totalScore" />
                  <ColHeader label="Duration" field="durationMinutes" />
                  <ColHeader label="Submitted" field="endTime" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((s) => (
                  <tr key={s.sessionId} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5">
                        #{s.sessionId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                          {(s.studentId || '?').toString().slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[12px] text-zinc-700 font-medium">{s.studentId || 'Anonymous'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold text-zinc-800">{s.subject || '—'}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="text-[11px] text-zinc-500 truncate block" title={s.originalObjective}>
                        {s.originalObjective || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={s.totalScore} total={s.totalQuestions} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-zinc-500">{s.durationMinutes} min</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-zinc-400 whitespace-nowrap">{s.endTime || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && sessions.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/30">
            <p className="text-[11px] text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-zinc-600">{sessions.length}</span> completed submissions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
