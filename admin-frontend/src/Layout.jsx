import React, { useState, useCallback } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  Cpu, BarChart3, ShieldCheck, BookOpen, Users,
  ScrollText, LogOut, Bell, Search, ChevronDown,
  Zap, Settings, Menu, X,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   NAVIGATION DEFINITION
   Each route maps to a specific Use Case actor
───────────────────────────────────────────── */
const NAV = [
  {
    group: 'Intelligence Layer',
    groupSi: 'බුද්ධිමත් ස්තරය',
    items: [
      {
        to: '/analytics',
        icon: BarChart3,
        label: 'AI Analytics & Trends',
        labelSi: 'AI විශ්ලේෂණ',
        badge: null,
        uc: 'UC3.6 · UC5.3 · UC5.4',
      },
      {
        to: '/approvals',
        icon: ShieldCheck,
        label: 'Pending AI Approvals',
        labelSi: 'අනුමත කිරීම් රැකෑරූ',
        badge: 7,
        badgeColor: 'bg-orange-500',
        uc: 'UC5.1 · UC6.3',
      },
    ],
  },
  {
    group: 'Content Engine',
    groupSi: 'අන්තර්ගත එන්ජිම',
    items: [
      {
        to: '/questions',
        icon: BookOpen,
        label: 'Question Bank',
        labelSi: 'ප්‍රශ්න බැංකුව',
        badge: null,
        uc: 'UC5.2 · UC5.4',
      },
    ],
  },
  {
    group: 'Administration',
    groupSi: 'පරිපාලනය',
    items: [
      {
        to: '/users',
        icon: Users,
        label: 'User Directory',
        labelSi: 'පරිශීලක නාමාවලිය',
        badge: null,
        uc: 'UC1.4',
      },
      {
        to: '/audit',
        icon: ScrollText,
        label: 'System Audit Log',
        labelSi: 'පද්ධති විගණන ලොගය',
        badge: 3,
        badgeColor: 'bg-red-500',
        uc: 'UC5.6',
      },
    ],
  },
];

/* ─────────────────────────────────────────────
   LAYOUT COMPONENT
───────────────────────────────────────────── */
export default function Layout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleLogout = useCallback(() => navigate('/'), [navigate]);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm shrink-0">
            <Cpu size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[15px] font-extrabold text-zinc-900 tracking-tight">IntelliPrep</span>
            <span className="text-orange-600">.</span>
          </div>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200/60 px-1.5 py-0.5 rounded-md shrink-0">
            v1.0
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-0.5">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-100">
            <Zap size={9} className="text-violet-500" />
            <span className="text-[9px] font-semibold text-violet-600">Multi-Agent AI Platform</span>
          </div>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map(group => (
          <div key={group.group}>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300 px-2 mb-1.5">
              {group.group}
              <span className="block text-[9px] normal-case tracking-normal font-normal text-zinc-200/70 mt-0.5">
                {group.groupSi}
              </span>
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 border-r-2 border-orange-600 font-semibold pr-[10px]'
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        strokeWidth={isActive ? 2.5 : 2}
                        className={isActive ? 'text-orange-600 shrink-0' : 'text-zinc-400 group-hover:text-zinc-600 shrink-0'}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] leading-none block">{item.label}</span>
                        <span className="block text-[9px] font-normal text-zinc-300 mt-0.5 leading-none">{item.labelSi}</span>
                      </div>
                      {item.badge && (
                        <span className={`shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[9px] font-bold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* UC Legend strip */}
      <div className="px-4 py-3 border-t border-zinc-100 shrink-0">
        <div className="px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">Active Use Cases</p>
          <div className="flex flex-wrap gap-1">
            {['UC1.4', 'UC3.6', 'UC5.1', 'UC5.3', 'UC5.4', 'UC5.6', 'UC6.3'].map(uc => (
              <span key={uc} className="text-[9px] font-mono font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                {uc}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* User snippet */}
      <div className="border-t border-zinc-100 p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-zinc-800 truncate">Senitha Admin</p>
            <p className="text-[10px] text-zinc-400 truncate">Super Administrator</p>
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50/60 font-sans antialiased">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex w-[236px] flex-col bg-white border-r border-zinc-200/80 shrink-0 z-20 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-[236px] bg-white h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-100 text-zinc-500"
            >
              <X size={15} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* ── GLOBAL HEADER ── */}
        <header className="sticky top-0 z-10 h-14 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 flex items-center px-4 md:px-6 gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg border border-zinc-200 text-zinc-500"
          >
            <Menu size={15} />
          </button>

          {/* Search */}
          <div className={`flex items-center gap-2 h-8 px-3 rounded-lg border transition-all duration-200 ${searchFocused ? 'border-orange-400 ring-2 ring-orange-500/15 bg-white' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'} w-56 lg:w-72`}>
            <Search size={13} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search across system…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="bg-transparent border-none outline-none text-[13px] w-full text-zinc-700 placeholder-zinc-300"
            />
            <kbd className="hidden sm:inline-flex items-center text-[9px] font-semibold text-zinc-300 bg-zinc-100 border border-zinc-200 px-1 py-0.5 rounded shrink-0">⌘K</kbd>
          </div>

          <div className="flex-1" />

          {/* System Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200/60 bg-emerald-50">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">All Agents Online</span>
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
                  <span className="text-sm font-semibold text-zinc-800">Agent Notifications</span>
                  <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">7 pending</span>
                </div>
                {[
                  { color: 'text-amber-600 bg-amber-50', msg: 'Content Synthesizer drafted 3 new questions', sub: 'Awaiting tutor approval · UC5.1', time: '4m ago' },
                  { color: 'text-violet-600 bg-violet-50', msg: 'PastPaper Trend Agent flagged Chemistry Q14', sub: 'Recurring syllabus gap detected · UC3.6', time: '12m ago' },
                  { color: 'text-red-600 bg-red-50', msg: 'Distractor Analysis: Anomaly in Physics MCQ', sub: '71% failed option D — re-teach flagged · UC5.4', time: '1h ago' },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer border-b border-zinc-50 last:border-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${n.color} shrink-0 mt-0.5`}>
                      <Zap size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-zinc-700 font-medium leading-snug">{n.msg}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{n.sub}</p>
                      <p className="text-[10px] text-zinc-300 mt-0.5">{n.time}</p>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-[11px] font-bold cursor-pointer">
              SA
            </div>
          </div>
        </header>

        {/* ── PAGE OUTLET ── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
