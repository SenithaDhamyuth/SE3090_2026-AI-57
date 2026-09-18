import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, BookOpen, Settings,
  LogOut, Bell, Search, ChevronRight, TrendingUp,
  TrendingDown, Activity, Zap, Shield, Clock, Lock,
  Unlock, Eye, RotateCcw, Plus, X, CheckCircle2,
  AlertTriangle, ChevronLeft, ChevronDown, Filter,
  Database, BarChart3, Hash, Target, Cpu, Layers,
  GraduationCap, Timer, RefreshCw, ArrowUpRight,
  ArrowDownRight, Dot, Radio, SlidersHorizontal,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   API CONFIG
───────────────────────────────────────────── */
const API_BASE = 'http://localhost:5087';

const LIVE_SESSIONS = [
  { id: 'SES-4421', student: 'Kavindu Perera',     exam: 'A/L ICT',      elapsed: '00:34:12', remaining: '01:25:48', status: 'running' },
  { id: 'SES-4422', student: 'Nethmi Jayasinghe',  exam: 'A/L ICT',      elapsed: '00:58:03', remaining: '01:01:57', status: 'locked'  },
  { id: 'SES-4423', student: 'Dulith Fernando',    exam: 'A/L Maths',    elapsed: '00:12:45', remaining: '01:47:15', status: 'running' },
  { id: 'SES-4424', student: 'Thilina Madushanka', exam: 'A/L Biology',  elapsed: '01:05:30', remaining: '00:54:30', status: 'locked'  },
  { id: 'SES-4425', student: 'Sachini Bandara',    exam: 'A/L ICT',      elapsed: '00:22:18', remaining: '01:37:42', status: 'running' },
];

const NAV_GROUPS = [
  {
    label: 'Overview',
    labelSi: 'දළ විශ්ලේෂණය',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',       labelSi: 'පාලක පැනලය',    key: 'dashboard' },
      { icon: BarChart3,       label: 'Analytics',       labelSi: 'විශ්ලේෂණ',       key: 'analytics'  },
    ],
  },
  {
    label: 'Assessment Engine',
    labelSi: 'ඇගයීම් එන්ජිම',
    items: [
      { icon: BookOpen,   label: 'Question Bank',   labelSi: 'ප්‍රශ්න බැංකුව',   key: 'qbank'    },
      { icon: FileText,   label: 'Exam Sessions',   labelSi: 'විභාග සැසි',        key: 'sessions' },
    ],
  },
  {
    label: 'Students',
    labelSi: 'සිසුන්',
    items: [
      { icon: GraduationCap, label: 'Student Directory', labelSi: 'සිසු නාමාවලිය', key: 'students' },
    ],
  },
  {
    label: 'System',
    labelSi: 'පද්ධතිය',
    items: [
      { icon: Settings, label: 'System Settings', labelSi: 'පද්ධති සැකසුම්', key: 'settings' },
    ],
  },
];

/* ─────────────────────────────────────────────
   SPARKLINE (inline SVG mini chart)
───────────────────────────────────────────── */
function Sparkline({ data, color = '#EA580C', height = 28, width = 72 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${pts} ${width},${height}`}
        fill={color}
        fillOpacity="0.08"
        stroke="none"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   METRIC CARD
───────────────────────────────────────────── */
function MetricCard({ icon: Icon, label, labelSi, value, delta, deltaDir, sub, live, sparkData, accent = false }) {
  return (
    <div className={`group relative bg-white border border-zinc-200/80 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-200 overflow-hidden`}>
      {accent && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/60 to-transparent pointer-events-none" />
      )}
      <div className="flex items-start justify-between mb-3">
        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${accent ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
          <Icon size={17} strokeWidth={2} />
        </div>
        {live && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Live
          </span>
        )}
      </div>

      <div className="space-y-0.5 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
          <span className="block text-[10px] normal-case tracking-normal font-normal text-zinc-300 mt-0.5">{labelSi}</span>
        </p>
        <p className="text-3xl font-bold text-zinc-900 tracking-tight leading-none">{value}</p>
        {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
      </div>

      <div className="flex items-end justify-between">
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${deltaDir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
            {deltaDir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {delta} this week
          </span>
        )}
        {sparkData && (
          <div className="ml-auto">
            <Sparkline data={sparkData} color={accent ? '#EA580C' : '#6366F1'} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    'Active':      'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200/60',
    'Completed':   'bg-zinc-100 text-zinc-600 border-zinc-200/60',
    'Pending':     'bg-amber-50 text-amber-700 border-amber-200/60',
    'Not Started': 'bg-zinc-50 text-zinc-400 border-zinc-200/40',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold tracking-wide ${map[status] || 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────
   QUICK ADD QUESTION DRAWER
───────────────────────────────────────────── */
function QuickAddDrawer({ open, onClose }) {
  const [form, setForm] = useState({ text: '', subject: 'ICT', difficulty: 'Medium', answer: 'A' });
  const subjects = ['ICT', 'Physics', 'Maths', 'Biology', 'Chemistry'];
  const difficulties = ['Easy', 'Medium', 'Hard'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">Seed Question</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">ප්‍රශ්නය එකතු කරන්න</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Question Text</label>
            <textarea
              rows={3}
              value={form.text}
              onChange={e => setForm({ ...form, text: e.target.value })}
              placeholder="Enter MCQ question..."
              className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder-zinc-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all bg-white"
              >
                {subjects.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={e => setForm({ ...form, difficulty: e.target.value })}
                className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all bg-white"
              >
                {difficulties.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Correct Answer</label>
            <div className="flex gap-2">
              {['A', 'B', 'C', 'D'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setForm({ ...form, answer: opt })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    form.answer === opt
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button className="flex-1 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors shadow-sm">
            Seed Question
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LIVE SESSION CARD
───────────────────────────────────────────── */
function LiveSessionCard({ session }) {
  const isLocked = session.status === 'locked';
  return (
    <div className={`px-4 py-3 border rounded-lg transition-all ${isLocked ? 'border-amber-200/70 bg-amber-50/50' : 'border-zinc-200/80 bg-white hover:border-zinc-300'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isLocked
            ? <Lock size={11} className="text-amber-600" strokeWidth={2.5} />
            : <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
          }
          <span className="text-[10px] font-mono font-semibold text-zinc-400">{session.id}</span>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${isLocked ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100'}`}>
          {isLocked ? 'Locked' : 'Running'}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-zinc-800 truncate">{session.student}</p>
      <p className="text-[11px] text-zinc-400">{session.exam}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-zinc-400">Elapsed <span className="font-mono text-zinc-600">{session.elapsed}</span></span>
        <span className="text-[10px] text-zinc-400">Left <span className="font-mono text-orange-600 font-semibold">{session.remaining}</span></span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('All Students');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Live student data from C# backend ──
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── API fetch on mount ──
  useEffect(() => {
    const controller = new AbortController();
    const fetchStudents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/StudentProfile/all`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`Server responded with ${res.status} ${res.statusText}`);
        const data = await res.json();
        setStudents(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to fetch student profiles.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
    return () => controller.abort();
  }, []);

  const handleLogout = useCallback(() => navigate('/'), [navigate]);

  const TABS = ['All Students', 'In-Progress Exams', 'Completed'];

  // Tab filtering — gracefully handles both real API data and any optional session fields
  const filteredStudents = students.filter(s => {
    if (activeTab === 'In-Progress Exams') return s.sessionStatus === 'In Progress';
    if (activeTab === 'Completed') return s.sessionStatus === 'Completed';
    return true;
  });

  const ROWS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ROWS_PER_PAGE));
  const pageStudents = filteredStudents.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="min-h-screen flex bg-zinc-50/60 font-sans antialiased">

      {/* ───── SIDEBAR ───── */}
      <aside className="hidden md:flex w-[228px] flex-col bg-white border-r border-zinc-200/80 shrink-0 z-20">

        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm">
              <Cpu size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-[15px] font-extrabold text-zinc-900 tracking-tight">IntelliPrep</span>
              <span className="text-orange-600">.</span>
            </div>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200/60 px-1.5 py-0.5 rounded-md">
              v1.0
            </span>
          </div>
          <p className="text-[10px] text-zinc-300 mt-1.5 tracking-wide">MVP · Admin Console</p>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300 px-2 mb-1.5">
                {group.label}
                <span className="block text-[9px] normal-case tracking-normal font-normal text-zinc-200/70">{group.labelSi}</span>
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveNav(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group relative
                        ${active
                          ? 'bg-orange-50 text-orange-700 border-r-2 border-orange-600 font-semibold'
                          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 font-medium'
                        }`}
                    >
                      <item.icon size={15} strokeWidth={active ? 2.5 : 2} className={active ? 'text-orange-600' : 'text-zinc-400 group-hover:text-zinc-600'} />
                      <div className="min-w-0">
                        <span className="text-[13px] leading-none">{item.label}</span>
                        <span className="block text-[9px] font-normal text-zinc-300 mt-0.5 leading-none">{item.labelSi}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User snippet */}
        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-zinc-800 truncate">Senitha Admin</p>
              <p className="text-[10px] text-zinc-400 truncate">senitha@intelliprep.lk</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 text-zinc-300"
            >
              <LogOut size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      {/* ───── MAIN AREA ───── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* ───── HEADER ───── */}
        <header className="sticky top-0 z-10 h-14 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 flex items-center px-6 gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

          {/* Search */}
          <div className={`flex items-center gap-2 h-8 px-3 rounded-lg border transition-all duration-200 ${searchFocused ? 'border-orange-400 ring-2 ring-orange-500/15 bg-white' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'} w-64`}>
            <Search size={13} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search students, exams…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="bg-transparent border-none outline-none text-[13px] w-full text-zinc-700 placeholder-zinc-300"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-semibold text-zinc-300 bg-zinc-100 border border-zinc-200 px-1 py-0.5 rounded shrink-0">
              ⌘K
            </kbd>
          </div>

          <div className="flex-1" />

          {/* System Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200/60 bg-emerald-50">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">All Engines Online</span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(p => !p)}
              className={`relative p-2 rounded-lg border transition-all ${notifOpen ? 'border-orange-200 bg-orange-50 text-orange-600' : 'border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 bg-white'}`}
            >
              <Bell size={15} strokeWidth={2} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full ring-1 ring-white" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-10 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-800">Notifications</span>
                  <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">3 new</span>
                </div>
                {[
                  { icon: Lock,     color: 'text-amber-600 bg-amber-50', msg: 'Session SES-4422 auto-locked', time: '2m ago' },
                  { icon: Users,    color: 'text-blue-600 bg-blue-50',   msg: 'New student STU008 registered', time: '14m ago' },
                  { icon: Database, color: 'text-violet-600 bg-violet-50', msg: 'Question bank seeded: 12 new MCQs', time: '1h ago' },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer border-b border-zinc-50 last:border-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${n.color} shrink-0 mt-0.5`}>
                      <n.icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-zinc-700 font-medium leading-snug">{n.msg}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Profile */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-zinc-100">
            <div className="text-right hidden lg:block">
              <p className="text-[12px] font-semibold text-zinc-800 leading-none">Senitha Admin</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Super Administrator</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-[11px] font-bold">
              SA
            </div>
          </div>
        </header>

        {/* ───── SCROLLABLE CONTENT ───── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

            {/* Page Title */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
                  Dashboard
                  <span className="text-xs text-zinc-400 block font-normal mt-1">පාලක පැනලය</span>
                </h1>
                <p className="text-[13px] text-zinc-400 mt-2">
                  Thursday, September 10 · System snapshot at <span className="font-mono text-zinc-500">22:57 IST</span>
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-95"
              >
                <Plus size={14} strokeWidth={2.5} />
                Seed Question
              </button>
            </div>

            {/* ── METRIC RIBBON ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                icon={GraduationCap}
                label="Total Students"
                labelSi="සිසුන් ගණන"
                value={isLoading ? '—' : students.length.toString()}
                delta="+7"
                deltaDir="up"
                sub={isLoading ? 'Loading profiles…' : `${students.length} registered profile${students.length !== 1 ? 's' : ''}`}
                sparkData={[88, 92, 95, 98, 104, 109, 118, students.length || 0]}
                accent
              />
              <MetricCard
                icon={Activity}
                label="Active Exam Sessions"
                labelSi="සක්‍රීය විභාග සැසි"
                value="12"
                delta="+3"
                deltaDir="up"
                sub="5 currently in-progress"
                live
                sparkData={[6, 8, 7, 10, 9, 11, 10, 12]}
              />
              <MetricCard
                icon={Database}
                label="Question Bank"
                labelSi="ප්‍රශ්න බැංකුව"
                value="968"
                sub="MCQs seeded across 5 subjects"
                sparkData={[820, 840, 860, 890, 910, 935, 952, 968]}
              />
              <MetricCard
                icon={Target}
                label="Platform Pass Rate"
                labelSi="සමත් අනුපාතය"
                value="76.4%"
                delta="+2.1%"
                deltaDir="up"
                sub="vs. 74.3% last week"
                sparkData={[68, 70, 71, 73, 72, 74, 75, 76]}
                accent
              />
            </div>

            {/* ── SPLIT SECTION ── */}
            <div className="grid grid-cols-3 gap-4">

              {/* ─── DATA TABLE (2/3) ─── */}
              <div className="col-span-3 xl:col-span-2 bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

                {/* Table Header */}
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight">
                      Students & Sessions
                      <span className="text-[10px] text-zinc-400 block font-normal mt-0.5">සිසු හා විභාග සැසි</span>
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors">
                      <SlidersHorizontal size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setIsLoading(true);
                        setError(null);
                        fetch(`${API_BASE}/api/StudentProfile/all`)
                          .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
                          .then(data => { setStudents(data); setCurrentPage(1); setIsLoading(false); })
                          .catch(err => { setError(err.message); setIsLoading(false); });
                      }}
                      title="Refresh student list"
                      className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-0 px-5 border-b border-zinc-100 bg-zinc-50/50">
                  {TABS.map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                      className={`relative px-3 py-3 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                        activeTab === tab
                          ? 'text-orange-700 border-orange-600'
                          : 'text-zinc-400 border-transparent hover:text-zinc-600'
                      }`}
                    >
                      {tab}
                      {tab === 'In-Progress Exams' && (
                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold">
                          {students.filter(s => s.sessionStatus === 'In Progress').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        {['Student ID', 'Target Exam', 'Preferred Subject', 'Points', 'Actions'].map(col => (
                          <th key={col} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50/80">

                      {/* ── LOADING STATE: skeleton rows ── */}
                      {isLoading && Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                        <tr key={`skel-${i}`} className="animate-pulse">
                          <td className="px-5 py-4">
                            <div className="h-5 w-16 bg-zinc-100 rounded-md" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-4 w-28 bg-zinc-100 rounded-md" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-4 w-20 bg-zinc-100 rounded-md" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-4 w-12 bg-zinc-100 rounded-md" />
                          </td>
                          <td className="px-5 py-4">
                            <div className="h-6 w-24 bg-zinc-100 rounded-md" />
                          </td>
                        </tr>
                      ))}

                      {/* ── ERROR STATE ── */}
                      {!isLoading && error && (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center">
                            <div className="inline-flex flex-col items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-400">
                                <AlertTriangle size={18} strokeWidth={1.5} />
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-zinc-700">Failed to load students</p>
                                <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">{error}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setIsLoading(true);
                                  setError(null);
                                  fetch(`${API_BASE}/api/StudentProfile/all`)
                                    .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
                                    .then(data => { setStudents(data); setIsLoading(false); })
                                    .catch(err => { setError(err.message); setIsLoading(false); });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                              >
                                <RefreshCw size={11} />
                                Retry
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── EMPTY STATE ── */}
                      {!isLoading && !error && pageStudents.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center">
                            <div className="inline-flex flex-col items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-300">
                                <GraduationCap size={20} strokeWidth={1.5} />
                              </div>
                              <p className="text-[12px] text-zinc-400 font-medium">No students found</p>
                              <p className="text-[11px] text-zinc-300">සිසුන් කිසිවෙකු සොයා ගත නොහැකි විය</p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── DATA ROWS: mapped from C# StudentProfile entity ── */}
                      {!isLoading && !error && pageStudents.map((student, idx) => {
                        // Derive initials from userId for the avatar
                        const initials = (student.userId || '??').slice(0, 2).toUpperCase();
                        // Cycle through subtle gradient palettes for variety
                        const avatarColors = [
                          'from-orange-400 to-orange-600',
                          'from-blue-400 to-blue-600',
                          'from-violet-400 to-violet-600',
                          'from-emerald-400 to-emerald-600',
                          'from-rose-400 to-rose-600',
                        ];
                        const palette = avatarColors[idx % avatarColors.length];
                        return (
                          <tr key={student.userId || idx} className="hover:bg-zinc-50/70 transition-colors group">

                            {/* Student ID */}
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                                {student.userId}
                              </span>
                            </td>

                            {/* Target Exam */}
                            <td className="px-5 py-3.5">
                              <span className="text-[12px] font-medium text-zinc-700">{student.targetExam ?? '—'}</span>
                            </td>

                            {/* Preferred Subject */}
                            <td className="px-5 py-3.5">
                              {student.preferredSubject ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-semibold text-orange-700">
                                  {student.preferredSubject}
                                </span>
                              ) : (
                                <span className="text-zinc-300 text-[12px]">—</span>
                              )}
                            </td>

                            {/* Total Points */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1">
                                <Zap size={11} className="text-orange-400 shrink-0" />
                                <span className="text-[13px] font-semibold text-zinc-800">
                                  {(student.totalPoints ?? 0).toLocaleString()}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white text-[11px] font-semibold text-zinc-600 hover:text-zinc-800 transition-all">
                                  <Eye size={11} />
                                  Inspect
                                </button>
                                <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 hover:border-amber-300 bg-white text-[11px] font-semibold text-zinc-600 hover:text-amber-700 transition-all">
                                  <RotateCcw size={11} />
                                  Reset
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
                <div className="px-5 py-3.5 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                  <p className="text-[11px] text-zinc-400">
                    Showing <span className="font-semibold text-zinc-600">{pageStudents.length}</span> of <span className="font-semibold text-zinc-600">{filteredStudents.length}</span> records
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 rounded-md text-[11px] font-semibold transition-all ${
                          currentPage === i + 1
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'border border-zinc-200 text-zinc-500 hover:border-zinc-300'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── RIGHT PANEL (1/3) ─── */}
              <div className="col-span-3 xl:col-span-1 flex flex-col gap-4">

                {/* Live Session Monitor */}
                <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex-1">
                  <div className="px-4 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight">Live Sessions</h2>
                      <p className="text-[10px] text-zinc-400 mt-0.5">සජීවී සැසි · Real-time</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600">{LIVE_SESSIONS.filter(s => s.status === 'running').length} running</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                    {LIVE_SESSIONS.map(session => (
                      <LiveSessionCard key={session.id} session={session} />
                    ))}
                  </div>
                </div>

                {/* Quick Question Trigger */}
                <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                      <Layers size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-900">Question Bank</p>
                      <p className="text-[10px] text-zinc-400">ප්‍රශ්න බැංකුව</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'ICT',       count: 312 },
                      { label: 'Physics',   count: 198 },
                      { label: 'Maths',     count: 224 },
                      { label: 'Biology',   count: 234 },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-50 rounded-lg p-2.5">
                        <p className="text-[10px] text-zinc-400 font-medium">{s.label}</p>
                        <p className="text-[15px] font-bold text-zinc-800">{s.count}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-[12px] font-semibold transition-all shadow-sm"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    Add Seed Question
                  </button>
                </div>

                {/* System Health */}
                <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">
                    System Health
                    <span className="block text-[9px] normal-case tracking-normal font-normal text-zinc-300 mt-0.5">පද්ධති සෞඛ්‍යය</span>
                  </p>
                  {[
                    { label: 'API Gateway',      status: 'Operational', ok: true  },
                    { label: 'Question Engine',   status: 'Operational', ok: true  },
                    { label: 'Timer Service',     status: 'Degraded',    ok: false },
                    { label: 'DB Cluster',        status: 'Operational', ok: true  },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="text-[12px] text-zinc-600 font-medium">{item.label}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${item.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Quick Add Drawer */}
      <QuickAddDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}