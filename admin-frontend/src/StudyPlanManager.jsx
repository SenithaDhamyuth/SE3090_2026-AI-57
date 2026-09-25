import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, CalendarDays, CheckCircle2, Clock, AlertCircle,
  RefreshCw, ChevronDown, X, Sparkles, User, ShieldCheck,
  ClipboardList, Loader2, Eye, ListChecks,
} from 'lucide-react';

const API_BASE = 'http://localhost:5087';

// ── Shared authenticated fetch helper ────────────────────────────────────────
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('admin_token') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
};

// ── Status badge component ────────────────────────────────────────────────────
const StatusBadge = ({ approved }) =>
  approved ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 size={10} />
      Approved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200">
      <Clock size={10} />
      Pending Review
    </span>
  );

// ── Priority badge ────────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  const styles = {
    High:   'bg-red-50 text-red-700 border-red-200',
    Medium: 'bg-orange-50 text-orange-700 border-orange-200',
    Low:    'bg-zinc-50 text-zinc-600 border-zinc-200',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${styles[priority] ?? styles.Low}`}>
      {priority}
    </span>
  );
};

// ── Alert banner ──────────────────────────────────────────────────────────────
const Alert = ({ type, text, onDismiss }) => {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${styles[type]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 font-medium leading-snug">{text}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN DETAIL MODAL
// Shows the full PlanDetailsJson schedule in a readable table
// ═══════════════════════════════════════════════════════════════════════════════
function PlanDetailModal({ planId, onClose }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchPlan = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/aiagent/plans/${planId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.message || `Server error ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setPlan(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPlan();
    return () => { cancelled = true; };
  }, [planId]);

  let days = [];
  if (plan?.planDetailsJson) {
    try { days = JSON.parse(plan.planDetailsJson); } catch { days = []; }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ListChecks size={17} className="text-orange-600" />
            <span className="font-bold text-zinc-800 text-[15px]">
              Study Plan #{planId} — Schedule
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading schedule…</span>
            </div>
          )}
          {error && <Alert type="error" text={error} />}
          {!loading && !error && days.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-10">No schedule data available.</p>
          )}
          {!loading && days.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {['Day', 'Date', 'Topic', 'Sub-topics', 'Priority'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {days.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="w-6 h-6 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-full inline-flex items-center justify-center">
                          {d.day}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-zinc-500 font-mono whitespace-nowrap">{d.date}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-zinc-800 max-w-[160px]">{d.topic}</td>
                      <td className="px-4 py-2.5 text-[11px] text-zinc-500 max-w-[200px] leading-snug">{d.subtopics}</td>
                      <td className="px-4 py-2.5"><PriorityBadge priority={d.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE PLAN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function GeneratePlanModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ studentId: '', targetExamDate: '' });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setAlert(null);

    const studentId = parseInt(form.studentId, 10);
    if (!studentId || studentId <= 0) {
      setAlert({ type: 'error', text: 'Please enter a valid Student ID (positive number).' });
      return;
    }
    if (!form.targetExamDate) {
      setAlert({ type: 'error', text: 'Please select a target exam date.' });
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/generate-plan`, {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          targetExamDate: new Date(form.targetExamDate).toISOString(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      onSuccess(`Study plan generated! ${data.planDays?.length ?? 0} day(s) scheduled. Awaiting admin approval.`);
      onClose();
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-orange-600" />
            <span className="font-bold text-zinc-800 text-[15px]">Generate AI Study Plan</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-700 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {alert && <Alert type={alert.type} text={alert.text} onDismiss={() => setAlert(null)} />}

          {/* Info banner */}
          <div className="bg-orange-50 border border-orange-200/70 rounded-lg p-3 flex gap-2 text-xs text-orange-800">
            <Brain size={14} className="shrink-0 mt-0.5 text-orange-600" />
            <span>
              The AI will retrieve syllabus boundaries and past-paper probabilities from the
              database, then generate a personalised daily study schedule.
              The plan will require <strong>your approval</strong> before the student can see it.
            </span>
          </div>

          {/* Student ID */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="studentId">
              Student ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={15} className="text-zinc-400" />
              </div>
              <input
                type="number"
                id="studentId"
                name="studentId"
                min="1"
                required
                value={form.studentId}
                onChange={handleChange}
                placeholder="e.g. 7"
                className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Target exam date */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="targetExamDate">
              Target Exam Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarDays size={15} className="text-zinc-400" />
              </div>
              <input
                type="date"
                id="targetExamDate"
                name="targetExamDate"
                min={minDateStr}
                required
                value={form.targetExamDate}
                onChange={handleChange}
                className="block w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-zinc-900 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Generating…</>
              ) : (
                <><Sparkles size={14} /> Generate Plan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — StudyPlanManager
// ═══════════════════════════════════════════════════════════════════════════════
export default function StudyPlanManager() {
  const [plans, setPlans]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [pageAlert, setPageAlert]       = useState(null);
  const [filter, setFilter]             = useState('all');        // all | pending | approved
  const [approvingId, setApprovingId]   = useState(null);        // planId currently being approved
  const [showGenModal, setShowGenModal] = useState(false);
  const [detailPlanId, setDetailPlanId] = useState(null);        // planId open in detail modal

  // ── Fetch all plans ─────────────────────────────────────────────────────────
  const fetchPlans = useCallback(async (signal) => {
    setLoading(true);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/plans`, { signal });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || `Server responded with ${res.status}`);
      }
      const data = await res.json();
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setPageAlert({ type: 'error', text: `Failed to load plans: ${err.message}` });
        setPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlans(controller.signal);
    return () => controller.abort();
  }, [fetchPlans]);

  // ── Approve a plan ───────────────────────────────────────────────────────────
  const handleApprove = async (planId) => {
    setApprovingId(planId);
    setPageAlert(null);
    try {
      const res = await authFetch(`${API_BASE}/api/aiagent/approve-plan/${planId}`, {
        method: 'PUT',
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `Server error ${res.status}`);
      }

      // Optimistic update — flip isApproved locally without refetching
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, isApproved: true, approvedBy: data.approvedBy, approvedAt: data.approvedAt }
            : p
        )
      );
      setPageAlert({
        type: 'success',
        text: `Plan #${planId} approved. The student can now view their study schedule.`,
      });
    } catch (err) {
      setPageAlert({ type: 'error', text: err.message });
    } finally {
      setApprovingId(null);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const filtered = plans.filter(p => {
    if (filter === 'pending')  return !p.isApproved;
    if (filter === 'approved') return p.isApproved;
    return true;
  });

  const pendingCount  = plans.filter(p => !p.isApproved).length;
  const approvedCount = plans.filter(p =>  p.isApproved).length;

  // ── Stat cards data ──────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Plans',    value: plans.length,  icon: ClipboardList, color: 'text-zinc-700',    bg: 'bg-zinc-100',    border: 'border-zinc-200' },
    { label: 'Pending Review', value: pendingCount,   icon: Clock,         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200/60' },
    { label: 'Approved',       value: approvedCount,  icon: CheckCircle2,  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200/60' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">

      {/* ── Modals ── */}
      {showGenModal && (
        <GeneratePlanModal
          onClose={() => setShowGenModal(false)}
          onSuccess={(msg) => {
            setPageAlert({ type: 'success', text: msg });
            fetchPlans();    // refresh table after generation
          }}
        />
      )}
      {detailPlanId && (
        <PlanDetailModal
          planId={detailPlanId}
          onClose={() => setDetailPlanId(null)}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            AI Study Plan Manager
            <span className="text-xs text-zinc-400 block font-normal mt-1">
              Human-in-the-loop approval workflow · UC6 Agentic AI
            </span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Generate AI-personalised study plans, review the schedule, and approve before students see them.
          </p>
        </div>
        <button
          onClick={() => setShowGenModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-95"
        >
          <Sparkles size={14} strokeWidth={2.5} />
          Generate Plan
        </button>
      </div>

      {/* ── Page-level alert ─────────────────────────────────────────────────── */}
      {pageAlert && (
        <Alert
          type={pageAlert.type}
          text={pageAlert.text}
          onDismiss={() => setPageAlert(null)}
        />
      )}

      {/* ── Stat ribbon ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${s.border}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
              <s.icon size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">{s.label}</p>
              <p className="text-2xl font-bold text-zinc-900 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* Table toolbar */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
            {[
              { key: 'all',      label: 'All Plans' },
              { key: 'pending',  label: `Pending (${pendingCount})` },
              { key: 'approved', label: 'Approved' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                  filter === tab.key
                    ? 'bg-white text-zinc-800 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-600">{filtered.length}</span> plan{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => fetchPlans()}
              disabled={loading}
              title="Refresh"
              className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading study plans…</span>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Brain size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-[14px] font-semibold text-zinc-400">No plans found</p>
            <p className="text-[12px] text-zinc-300 mt-1">
              {filter === 'pending' ? 'All plans have been approved.' : 'Click "Generate Plan" to create the first AI study plan.'}
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  {['Plan ID', 'Student ID', 'Target Exam Date', 'Created', 'Status', 'Approved By', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(plan => {
                  const isApprovingThis = approvingId === plan.id;
                  return (
                    <tr key={plan.id} className="hover:bg-zinc-50/60 transition-colors group">

                      {/* Plan ID */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px] font-semibold text-zinc-700">
                          #{plan.id}
                        </span>
                      </td>

                      {/* Student ID */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {plan.studentId}
                          </div>
                          <span className="text-[12px] text-zinc-600 font-medium">
                            Student #{plan.studentId}
                          </span>
                        </div>
                      </td>

                      {/* Target Exam Date */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-zinc-700 font-medium">
                          <CalendarDays size={12} className="text-zinc-400" />
                          {plan.targetExamDate}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {plan.createdAt}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5">
                        <StatusBadge approved={plan.isApproved} />
                      </td>

                      {/* Approved by */}
                      <td className="px-5 py-3.5">
                        {plan.isApproved ? (
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1">
                              <ShieldCheck size={11} className="text-emerald-600" />
                              {plan.approvedBy ?? 'Admin'}
                            </p>
                            {plan.approvedAt && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{plan.approvedAt}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-[12px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {/* View schedule button */}
                          <button
                            onClick={() => setDetailPlanId(plan.id)}
                            title="View full schedule"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800 text-[11px] font-semibold transition-all"
                          >
                            <Eye size={12} />
                            View
                          </button>

                          {/* Approve button — only for pending plans */}
                          {!plan.isApproved && (
                            <button
                              onClick={() => handleApprove(plan.id)}
                              disabled={isApprovingThis}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                              {isApprovingThis ? (
                                <><Loader2 size={12} className="animate-spin" /> Approving…</>
                              ) : (
                                <><ShieldCheck size={12} /> Review & Approve</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!loading && plans.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
            <p className="text-[11px] text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-zinc-600">{plans.length}</span> plans
            </p>
            {pendingCount > 0 && (
              <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <Clock size={11} />
                {pendingCount} plan{pendingCount !== 1 ? 's' : ''} awaiting your approval
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
