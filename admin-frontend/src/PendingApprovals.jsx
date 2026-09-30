import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, Eye, Brain,
  Clock, AlertTriangle, ChevronDown, Search, Sparkles, RefreshCw, Loader2, X, MessageSquare
} from 'lucide-react';

const EXAM_API = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '/api/assessment';
const AIAGENT_API = (import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com') + '/api/aiagent';
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 min-w-[280px] max-w-[360px] px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            animate-[slideUp_0.25s_ease-out]
            ${t.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-800'
              : t.type === 'error'
                ? 'bg-white border-red-200 text-red-800'
                : 'bg-white border-zinc-200 text-zinc-800'
            }`}
        >
          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center
            ${t.type === 'success' ? 'bg-emerald-100' : t.type === 'error' ? 'bg-red-100' : 'bg-zinc-100'}`}>
            {t.type === 'success'
              ? <CheckCircle2 size={12} className="text-emerald-600" strokeWidth={2.5} />
              : t.type === 'error'
                ? <AlertTriangle size={12} className="text-red-500" strokeWidth={2.5} />
                : <Brain size={12} className="text-zinc-500" strokeWidth={2.5} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
            {t.body && <p className="text-[11px] opacity-70 mt-0.5 leading-snug">{t.body}</p>}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-zinc-100 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ApprovalCard({ item, onApprove, onReject, processingIds }) {
  const [expanded, setExpanded] = useState(false);
  const isExam = item.type === 'Exam Session';
  const isProcessing = processingIds.has(item.uniqueId);

  // Parse details
  let details = [];
  try {
    details = JSON.parse(isExam ? (item.questionsJson || '[]') : (item.planDetailsJson || '[]'));
  } catch (e) {
    details = [];
  }

  return (
    <div className={`bg-white border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all border-zinc-200/80 hover:border-zinc-300 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Type Icon */}
        <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border ${
          isExam ? 'bg-violet-50 border-violet-100 text-violet-600' : 'bg-blue-50 border-blue-100 text-blue-600'
        }`}>
          {isExam ? <Sparkles size={20} /> : <Brain size={20} />}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="font-mono text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">ID: {item.id}</span>
            <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
              isExam ? 'text-violet-600 bg-violet-50 border-violet-100' : 'text-blue-600 bg-blue-50 border-blue-100'
            }`}>
              {item.type}
            </span>
            <span className="ml-auto text-[10px] text-zinc-400 font-medium">
              {new Date(isExam ? item.startTime : item.createdAt).toLocaleString()}
            </span>
          </div>

          <h3 className="text-[14px] font-semibold text-zinc-900 leading-snug mb-1.5">
            {isExam ? `Subject: ${item.subject}` : `Student ID: ${item.studentId}`}
          </h3>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 border border-orange-100">
              <Clock size={11} className="text-orange-500 shrink-0" />
              <span className="text-[10px] text-orange-700 font-medium">Pending Admin Approval</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/40 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
            {isExam ? 'Generated Questions' : 'Generated Study Plan'}
          </p>
          
          {isExam ? (
            <div className="space-y-4">
              {Array.isArray(details) && details.length > 0 ? details.map((q, i) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-[13px] text-zinc-800 leading-relaxed font-medium mb-3">
                    <span className="text-violet-600 mr-2">{i + 1}.</span>{q.questionText}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt, oi) => {
                      const isCorrect = oi === q.correctOptionIndex;
                      return (
                        <div key={oi} className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                          isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-zinc-100 bg-zinc-50 text-zinc-600'
                        }`}>
                          <span className="font-bold mr-2">{OPTION_LETTERS[oi]}.</span>{opt}
                          {isCorrect && <span className="ml-1.5 text-[9px] text-emerald-600 font-bold">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )) : <p className="text-[12px] text-zinc-500">No questions found in JSON.</p>}
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-4 py-2 text-[11px] font-bold text-zinc-500">Day</th>
                    <th className="px-4 py-2 text-[11px] font-bold text-zinc-500">Topic</th>
                    <th className="px-4 py-2 text-[11px] font-bold text-zinc-500">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {Array.isArray(details) && details.length > 0 ? details.map((day, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-[12px] text-zinc-700">{day.day}</td>
                      <td className="px-4 py-2 text-[12px] text-zinc-700 font-medium">{day.topic}</td>
                      <td className="px-4 py-2 text-[12px]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          day.priority === 'High' ? 'bg-red-50 text-red-600' :
                          day.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>{day.priority}</span>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="3" className="px-4 py-2 text-[12px] text-zinc-500">No plan details found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between gap-3">
        <button onClick={() => setExpanded(!expanded)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-700 transition-colors">
          <Eye size={13} /> {expanded ? 'Collapse' : 'Preview Content'}
        </button>
        <div className="flex items-center gap-2">
          {isExam ? (
            <button
              onClick={() => onReject(item)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-[12px] font-semibold transition-all"
            >
              <XCircle size={13} /> Reject
            </button>
          ) : (
            <div className="group relative">
              <button disabled className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-400 text-[12px] font-semibold opacity-50 cursor-not-allowed">
                <XCircle size={13} /> Reject
              </button>
              <div className="absolute bottom-full mb-2 hidden group-hover:block w-max max-w-xs bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg">
                Use Study Plan Manager to delete study plans.
              </div>
            </div>
          )}
          
          <button
            onClick={() => onApprove(item)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold shadow-sm transition-all active:scale-95"
          >
            <CheckCircle2 size={13} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingApprovals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);
  const [processingIds, setProcessingIds] = useState(new Set());

  const addToast = useCallback((type, title, body) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, body }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [examsRes, plansRes] = await Promise.all([
        fetch(`${EXAM_API}/sessions`),
        fetch(`${AIAGENT_API}/plans`)
      ]);

      const examsData = examsRes.ok ? await examsRes.json() : [];
      const plansData = plansRes.ok ? await plansRes.json() : [];

      const pendingExams = (Array.isArray(examsData) ? examsData : []).filter(e => e.status === 'PendingAdminApproval').map(e => ({
        ...e,
        type: 'Exam Session',
        uniqueId: `exam-${e.id}`
      }));

      const pendingPlans = (Array.isArray(plansData) ? plansData : []).filter(p => p.isApproved === false).map(p => ({
        ...p,
        type: 'Study Plan',
        uniqueId: `plan-${p.id}`
      }));

      setItems([...pendingExams, ...pendingPlans].sort((a, b) => {
        const dateA = new Date(a.type === 'Exam Session' ? a.startTime : a.createdAt);
        const dateB = new Date(b.type === 'Exam Session' ? b.startTime : b.createdAt);
        return dateB - dateA;
      }));
    } catch (err) {
      addToast('error', 'Failed to load pending items', err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (item) => {
    setProcessingIds(prev => new Set(prev).add(item.uniqueId));
    try {
      const url = item.type === 'Exam Session' 
        ? `${EXAM_API}/approve/${item.id}`
        : `${AIAGENT_API}/approve-plan/${item.id}`;
      
      const res = await fetch(url, { method: 'PUT' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || data.message || 'Approval failed');

      setItems(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
      addToast('success', 'Approved Successfully', `${item.type} #${item.id} is now approved.`);
    } catch (err) {
      addToast('error', 'Approval Failed', err.message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(item.uniqueId);
        return next;
      });
    }
  };

  const handleReject = async (item) => {
    if (item.type !== 'Exam Session') return; // Should be disabled in UI anyway

    setProcessingIds(prev => new Set(prev).add(item.uniqueId));
    try {
      const res = await fetch(`${EXAM_API}/reject/${item.id}`, { method: 'PUT' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || data.message || 'Rejection failed');

      setItems(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
      addToast('success', 'Rejected', `Exam Session #${item.id} has been marked as abandoned.`);
    } catch (err) {
      addToast('error', 'Rejection Failed', err.message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(item.uniqueId);
        return next;
      });
    }
  };

  const visibleItems = items.filter(item => {
    const matchStatus = filter === 'All' || item.type === filter;
    const searchTarget = (item.type === 'Exam Session' ? item.subject : `student ${item.studentId}`) || '';
    const matchSearch = !search || searchTarget.toLowerCase().includes(search.toLowerCase()) || item.id.toString().includes(search);
    return matchStatus && matchSearch;
  });

  const pendingCount = items.length;
  const examCount = items.filter(i => i.type === 'Exam Session').length;
  const planCount = items.filter(i => i.type === 'Study Plan').length;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none flex items-center gap-2">
            <ShieldCheck className="text-orange-600" size={24} />
            Pending Approvals
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Review and approve AI-generated exams and study plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-[12px] font-medium hover:border-zinc-300 hover:bg-zinc-50 transition-all">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200/60">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
            </span>
            <span className="text-[11px] font-bold text-orange-700">{pendingCount} Awaiting Review</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <div><p className="text-[10px] text-zinc-500 font-medium">Total Pending</p><p className="text-2xl font-bold text-orange-700">{pendingCount}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-violet-200 bg-violet-50">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <div><p className="text-[10px] text-zinc-500 font-medium">Exam Sessions</p><p className="text-2xl font-bold text-violet-700">{examCount}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <div><p className="text-[10px] text-zinc-500 font-medium">Study Plans</p><p className="text-2xl font-bold text-blue-700">{planCount}</p></div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-zinc-200/80 rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/15 w-64">
          <Search size={13} className="text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ID, subject, or student..."
            className="bg-transparent outline-none text-[12px] text-zinc-700 w-full placeholder-zinc-300"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-zinc-100 pl-3">
          {['All', 'Exam Session', 'Study Plan'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === s ? 'bg-orange-600 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {s}s
            </button>
          ))}
        </div>
        
        <p className="ml-auto text-[11px] text-zinc-400">
          Showing <span className="font-semibold text-zinc-600">{visibleItems.length}</span> items
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <span className="text-[13px]">Loading pending approvals...</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 bg-white border border-zinc-200/80 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={22} strokeWidth={2} />
            </div>
            <p className="text-[13px] font-semibold text-zinc-700">All items reviewed — queue is clear!</p>
            <p className="text-[11px] text-zinc-400">There are no pending items matching your filters.</p>
          </div>
        ) : (
          visibleItems.map(item => (
            <ApprovalCard key={item.uniqueId} item={item} onApprove={handleApprove} onReject={handleReject} processingIds={processingIds} />
          ))
        )}
      </div>
    </div>
  );
}
