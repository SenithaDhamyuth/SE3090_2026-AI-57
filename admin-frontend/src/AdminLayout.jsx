import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Cpu, Home, ClipboardList, Users, Brain, Menu, X, BarChart2, Database, ShieldCheck, LogOut, Trophy } from 'lucide-react';

const NAV = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/exams', icon: ClipboardList, label: 'Exam Sessions' },
  { to: '/students', icon: Users, label: 'Manage Students' },
  { to: '/ai-plans', icon: Brain, label: 'AI Study Plans' },
  { to: '/analytics', icon: BarChart2, label: 'Past Paper Analytics' },
  { to: '/question-bank', icon: Database, label: 'Question Bank' },
  { to: '/approvals', icon: ShieldCheck, label: 'Pending Approvals', badge: true },
  { to: '/marks', icon: Trophy, label: 'Student Marks' },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login', { replace: true });
  };

  const currentNav = NAV.find(n => n.to === location.pathname) || { label: 'Admin Dashboard' };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Brand ── */}
      <div className="px-5 pt-6 pb-5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200 shrink-0">
            <Cpu size={17} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-gray-900 tracking-tight leading-none">
              IntelliPrep<span className="text-orange-500">.</span>
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Admin Console</p>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                isActive
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Left accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-full" />
                )}
                <item.icon
                  size={15}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600 transition-colors'}
                />
                <span className={`text-[13px] flex-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Sidebar footer ── */}
      <div className="shrink-0 px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-800 truncate">Super Admin</p>
            <p className="text-[10px] text-gray-400 truncate">admin@intelliprep.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans antialiased">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-[240px] flex-col bg-white border-r border-gray-200 shrink-0 sticky top-0 h-screen shadow-sm">
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-[240px] bg-white h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors z-10"
            >
              <X size={14} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-10 h-14 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Menu size={16} />
            </button>
            <div>
              <h1 className="text-[15px] font-bold text-gray-900 tracking-tight leading-none">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Environment badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-semibold text-orange-700">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              A/L ICT Platform
            </span>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition-all duration-150"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
