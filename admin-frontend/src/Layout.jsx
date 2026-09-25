import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Cpu, Home, ClipboardList, Users, Brain, Menu, X } from 'lucide-react';

const NAV = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/exams', icon: ClipboardList, label: 'Exam Sessions' },
  { to: '/students', icon: Users, label: 'Manage Students' },
  { to: '/ai-plans', icon: Brain, label: 'AI Study Plans' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
                isActive ? 'bg-orange-50 text-orange-700 font-semibold border-r-2 border-orange-600' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
              }`
            }
          >
            <item.icon size={15} strokeWidth={2} />
            <span className="text-[13px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50/60 font-sans antialiased">
      <aside className="hidden md:flex w-[220px] flex-col bg-white border-r border-zinc-200/80 shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-[220px] bg-white h-full shadow-2xl">
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

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="sticky top-0 z-10 h-14 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 flex items-center px-4 md:px-6 gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg border border-zinc-200 text-zinc-500"
          >
            <Menu size={15} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2.5 pr-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-[11px] font-bold">
              SA
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
