import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, ChevronLeft, ChevronRight,
  SlidersHorizontal, RefreshCw, UserCheck, UserX,
  GraduationCap, BookOpen, Shield, Eye, Edit2,
  MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Plus, ChevronDown, Zap,
} from 'lucide-react';

const API_BASE = 'http://localhost:5087';

/* ─────────────────────────────────────────────
   DATA — UC1.4 User Management
   Real data is fetched from the backend StudentProfile API.
───────────────────────────────────────────── */
const ROLES = ['All Roles', 'Student', 'Tutor', 'Admin'];
const STATUSES = ['All Status', 'Active', 'Inactive', 'Suspended'];

const ROLE_STYLE = {
  Admin:   { badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: Shield },
  Tutor:   { badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: BookOpen },
  Student: { badge: 'bg-blue-50 text-blue-700 border-blue-200',       icon: GraduationCap },
};

const STATUS_STYLE = {
  Active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inactive:  'bg-zinc-100 text-zinc-500 border-zinc-200',
  Suspended: 'bg-red-50 text-red-600 border-red-200',
};

const AVATAR_COLORS = [
  'from-orange-400 to-orange-600', 'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600', 'from-emerald-400 to-emerald-600',
  'from-rose-400 to-rose-600',     'from-cyan-400 to-cyan-600',
];

/* ─────────────────────────────────────────────
   USER MANAGEMENT PAGE — UC1.4
───────────────────────────────────────────── */
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const ROWS_PER_PAGE = 8;

  useEffect(() => {
    const controller = new AbortController();
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/StudentProfile/all`, { signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`Server responded with ${res.status} ${res.statusText}`);
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load student profiles.');
          setUsers([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    return () => controller.abort();
  }, []);

  const normalizedUsers = users.map((user, index) => ({
    id: user.userId || `STU-${index + 1}`,
    name: user.userId || `Student ${index + 1}`,
    email: `${(user.userId || `student${index + 1}`).toLowerCase()}@intelliprep.lk`,
    role: 'Student',
    status: 'Active',
    subject: user.preferredSubject || 'A/L ICT',
    joined: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : '—',
    sessions: 0,
    score: user.totalPoints || 0,
    lastActive: user.createdAt ? 'just now' : '—',
  }));

  const filtered = normalizedUsers.filter(u => {
    const matchRole = roleFilter === 'All Roles' || u.role === roleFilter;
    const matchStatus = statusFilter === 'All Status' || u.status === statusFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search, roleFilter, statusFilter]);

  const stats = {
    total: normalizedUsers.length,
    students: normalizedUsers.filter(u => u.role === 'Student').length,
    tutors: 0,
    active: normalizedUsers.filter(u => u.status === 'Active').length,
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            User Directory
            <span className="text-xs text-zinc-400 block font-normal mt-1">පරිශීලක නාමාවලිය</span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Manage platform users, roles, and access permissions · <span className="font-mono text-zinc-500">UC1.4</span>
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-95">
          <Plus size={14} strokeWidth={2.5} />
          Invite User
        </button>
      </div>

      {/* Stat ribbon */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Users',     value: stats.total,    icon: Users,          color: 'text-zinc-700', bg: 'bg-zinc-100', border: 'border-zinc-200' },
          { label: 'Students',        value: stats.students, icon: GraduationCap,  color: 'text-blue-700', bg: 'bg-blue-50',  border: 'border-blue-200/60' },
          { label: 'Tutors',          value: stats.tutors,   icon: BookOpen,       color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200/60' },
          { label: 'Active Now',      value: stats.active,   icon: UserCheck,      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200/60' },
        ].map((s, i) => (
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

      {/* Table card */}
      {loading ? (
        <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 text-center text-zinc-500">Loading users…</div>
      ) : error ? (
        <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 text-center text-zinc-500">No Data Available</div>
      ) : (
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* Table toolbar */}
        <div className="px-5 py-4 border-b border-zinc-100 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className={`flex items-center gap-2 h-8 px-3 rounded-lg border transition-all duration-200 ${searchFocused ? 'border-orange-400 ring-2 ring-orange-500/15 bg-white' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'} w-60`}>
            <Search size={13} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search users…"
              className="bg-transparent outline-none text-[12px] text-zinc-700 w-full placeholder-zinc-300"
            />
          </div>

          {/* Role filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="appearance-none text-[12px] font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-400 cursor-pointer"
            >
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none text-[12px] font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-400 cursor-pointer"
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>

          <button className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors">
            <RefreshCw size={13} />
          </button>

          <span className="ml-auto text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-600">{filtered.length}</span> users found
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                {['User', 'Role', 'Subject / Domain', 'Sessions', 'Points', 'Status', 'Last Active', 'Actions'].map(col => (
                  <th key={col} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paged.map((user, idx) => {
                const roleStyle = ROLE_STYLE[user.role] || {};
                const RoleIcon  = roleStyle.icon || Users;
                const palette   = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initials  = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                return (
                  <tr key={user.id} className="hover:bg-zinc-50/60 transition-colors group">
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${palette} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-zinc-800 leading-none truncate">{user.name}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${roleStyle.badge}`}>
                        <RoleIcon size={10} />
                        {user.role}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] text-zinc-600 font-medium">{user.subject}</span>
                    </td>

                    {/* Sessions */}
                    <td className="px-5 py-3.5">
                      {user.role === 'Student' ? (
                        <span className="text-[13px] font-semibold text-zinc-700">{user.sessions}</span>
                      ) : (
                        <span className="text-zinc-300 text-[12px]">—</span>
                      )}
                    </td>

                    {/* Points */}
                    <td className="px-5 py-3.5">
                      {user.role === 'Student' && user.score > 0 ? (
                        <div className="flex items-center gap-1">
                          <Zap size={11} className="text-orange-400" />
                          <span className="text-[13px] font-semibold text-zinc-800">{user.score.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-[12px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[user.status]}`}>
                        {user.status}
                      </span>
                    </td>

                    {/* Last active */}
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] text-zinc-400 font-medium">{user.lastActive}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="View Profile" className="p-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-400 hover:text-zinc-700 transition-all">
                          <Eye size={12} />
                        </button>
                        <button title="Edit User" className="p-1.5 rounded-md border border-zinc-200 hover:border-orange-300 bg-white text-zinc-400 hover:text-orange-600 transition-all">
                          <Edit2 size={12} />
                        </button>
                        <button title="More Actions" className="p-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-400 hover:text-zinc-700 transition-all">
                          <MoreHorizontal size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">
            Showing <span className="font-semibold text-zinc-600">{(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-zinc-600">{filtered.length}</span> users
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded-md text-[11px] font-semibold transition-all ${
                  safePage === i + 1 ? 'bg-orange-600 text-white shadow-sm' : 'border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
