import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardList,
  Database,
  Home,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Brand, ModalFrame, LoadingState } from "./components/ui";

const NAV = [
  { to: "/", icon: Home, label: "Overview", group: "Workspace" },
  {
    to: "/exams",
    icon: ClipboardList,
    label: "Exam Sessions",
    group: "Workspace",
  },
  { to: "/ai-plans", icon: Brain, label: "AI Study Plans", group: "Workspace" },
  {
    to: "/analytics",
    icon: BarChart3,
    label: "Past Paper Analytics",
    group: "Workspace",
  },
  {
    to: "/students",
    icon: Users,
    label: "Manage Students",
    group: "Management",
  },
  {
    to: "/question-bank",
    icon: Database,
    label: "Question Bank",
    group: "Management",
  },
  {
    to: "/approvals",
    icon: ShieldCheck,
    label: "Pending Approvals",
    group: "Management",
  },
  { to: "/marks", icon: Trophy, label: "Student Marks", group: "Management" },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="sidebar-content">
      <div className="sidebar-brand">
        <Brand />
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {["Workspace", "Management"].map((group) => (
          <div key={group} className="nav-group">
            <p className="nav-caption">{group}</p>
            {NAV.filter((item) => item.group === group).map(
              ({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "nav-active" : ""}`
                  }
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight
                    size={14}
                    className="nav-arrow"
                    aria-hidden="true"
                  />
                </NavLink>
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <BookOpen size={22} aria-hidden="true" />
          <strong>Better learning starts here.</strong>
          <p>Your space to prepare, review and support every student.</p>
          <NavLink to="/question-bank" onClick={onNavigate}>
            Build your question bank <ArrowUpRight size={15} />
          </NavLink>
        </div>
        <div className="workspace-identity">
          <span className="admin-avatar">
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>Admin workspace</strong>
            <small>A/L ICT · IntelliPrep</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentNav =
    NAV.find((item) => item.to === location.pathname) || NAV[0];
  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate("/login", { replace: true });
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <ModalFrame
          label="Navigation menu"
          onClose={() => setMobileOpen(false)}
          className="mobile-sidebar"
        >
          <button
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </ModalFrame>
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu-toggle"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              <span>{currentNav.group}</span>
              <ChevronRight size={14} aria-hidden="true" />
              <strong>{currentNav.label}</strong>
            </div>
          </div>
          <div className="topbar-end">
            <span className="platform-label">
              <BookOpen size={15} /> A/L ICT Platform
            </span>
            <button
              className="logout-button"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut size={17} />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          <Suspense fallback={<LoadingState label="Opening this section…" />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            IntelliPrep <span aria-hidden="true">/</span> Learning, thoughtfully
            managed.
          </span>
          <span>A/L ICT Admin</span>
        </footer>
      </div>
    </div>
  );
}
