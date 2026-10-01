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
    <>
      <div className="px-5 pt-6 pb-5 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-sm shrink-0">
            <Cpu size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <span className="text-[15px] font-extrabold text-zinc-900 tracking-tight">IntelliPrep</span>
            <span className="text-orange-600">.</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-2">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive 
                  ? 'bg-orange-50 text-orange-700 font-semibold border-r-2 border-orange-600' 
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
              }`
            }
          >
            <item.icon size={15} strokeWidth={2} />
            <span className="text-[13px] flex-1">{item.label}</span>
            {item.badge && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50 font-sans antialiased">
      <aside className="hidden md:flex w-[220px] flex-col bg-white border-r border-zinc-200 shrink-0 sticky top-0 h-screen shadow-sm">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-[220px] bg-white h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
            >
              <X size={15} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="sticky top-0 z-10 h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-lg font-bold text-zinc-800 tracking-tight">{currentNav.label}</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
