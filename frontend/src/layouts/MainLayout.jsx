import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  ChevronLeft,
  ChevronRight,
  Zap,
  Book,
  Crown,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFetch } from "@/hooks/useFetch";
import { orgsApi } from "@/services/api/apiHandler";
import { QUERY_KEYS } from "@/utils/constants";
import { cn, getInitials } from "@/utils/helpers";

export default function MainLayout() {
  const { user, activeOrg, setActiveOrg, logout, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnDashboard = location.pathname === "/dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { data: orgs = [] } = useFetch(QUERY_KEYS.ORGS, () => orgsApi.listMyOrgs());

  // Auto-select first org
  useEffect(() => {
    if (!activeOrg && orgs.length > 0) setActiveOrg(orgs[0]);
  }, [orgs, activeOrg, setActiveOrg]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOrgOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdown when sidebar collapses
  useEffect(() => {
    if (collapsed) setOrgOpen(false);
  }, [collapsed]);

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
    ...(activeOrg
      ? [{ label: "Projects", icon: FolderKanban, to: `/orgs/${activeOrg.id}/projects` }]
      : []),
    { label: "Docs", icon: Book, to: "/docs" },
    { label: "Settings", icon: Settings, to: "/settings" },
  ];

  return (
    <div className="flex h-screen bg-[#09090f] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "relative flex flex-col border-r border-white/[0.06] bg-[#0c0c14] transition-[width] duration-200 ease-in-out shrink-0 overflow-hidden",
          collapsed ? "w-[56px]" : "w-[212px]",
        )}
      >
        {/* ── Logo + toggle ── */}
        <div className="flex h-[52px] items-center gap-2 border-b border-white/[0.06] px-3 shrink-0">
          <button
            onClick={() => navigate(isOnDashboard ? "/" : "/dashboard")}
            title={isOnDashboard ? "Go to Landing Page" : "Go to Dashboard"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </button>
          {!collapsed && (
            <button
              onClick={() => navigate(isOnDashboard ? "/" : "/dashboard")}
              className="text-[13px] font-semibold tracking-wide text-slate-100 flex-1 text-left hover:text-violet-300 transition-colors"
            >
              Tracelify
            </button>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-white/[0.06] hover:text-slate-400 transition-colors",
              collapsed && "ml-auto mr-auto",
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* ── Org switcher ── */}
        <div className="px-2 pt-2 shrink-0" ref={dropdownRef}>
          {collapsed ? (
            /* Collapsed: just avatar */
            <button
              onClick={() => { setCollapsed(false); setOrgOpen(true); }}
              title={activeOrg?.name ?? "Select org"}
              className="flex h-8 w-8 mx-auto items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-600/40 text-[9px] font-bold text-violet-300">
                {activeOrg ? getInitials(activeOrg.name).slice(0, 1) : "?"}
              </span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setOrgOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.05] transition-colors"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-600/40 text-[9px] font-bold text-violet-300">
                  {activeOrg ? getInitials(activeOrg.name).slice(0, 1) : "?"}
                </span>
                <span className="flex-1 truncate text-[12px] font-medium text-slate-300">
                  {activeOrg?.name ?? "Select org"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-slate-600 transition-transform duration-150 shrink-0",
                    orgOpen && "rotate-180",
                  )}
                />
              </button>

              {orgOpen && orgs.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.08] bg-[#12121e] shadow-2xl">
                  <div className="py-1">
                    {orgs.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          setActiveOrg(org);
                          setOrgOpen(false);
                          navigate("/dashboard");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-[11px] transition-colors",
                          activeOrg?.id === org.id
                            ? "bg-violet-600/10 text-violet-300"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                        )}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-violet-600/30 text-[8px] font-bold text-violet-300">
                          {getInitials(org.name).slice(0, 1)}
                        </span>
                        <span className="truncate font-medium">{org.name}</span>
                        {activeOrg?.id === org.id && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.06]">
                    <button
                      onClick={() => { setOrgOpen(false); navigate("/settings"); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:text-slate-400 hover:bg-white/[0.03] transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      New organization
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Nav links ── */}
        <nav className="flex-1 space-y-0.5 px-2 pt-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-md px-2 py-2 text-[12px] font-medium transition-all duration-150",
                  collapsed ? "justify-center" : "gap-2.5",
                  isActive
                    ? "bg-violet-600/15 text-violet-300"
                    : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300",
                )
              }
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* ── User section ── */}
        <div className="border-t border-white/[0.06] p-2 shrink-0">
          {collapsed ? (
            /* Collapsed: avatar only, click to logout */
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-8 w-8 mx-auto items-center justify-center rounded-md hover:bg-red-500/10 transition-colors group"
            >
              <UserAvatar user={user} size={24} />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <UserAvatar user={user} size={24} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-300 leading-tight">
                  {user?.name || user?.email}
                </p>
                {/* Role badge */}
                {userRole && (
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[9px] font-semibold capitalize leading-tight",
                    userRole === "owner"  && "text-amber-400",
                    userRole === "admin"  && "text-blue-400",
                    userRole === "member" && "text-slate-500",
                  )}>
                    {userRole === "owner"  && <Crown      className="h-2 w-2" />}
                    {userRole === "admin"  && <ShieldCheck className="h-2 w-2" />}
                    {userRole === "member" && <UserCheck   className="h-2 w-2" />}
                    {userRole}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="ml-auto p-1 text-slate-700 hover:text-red-400 transition-colors rounded shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="min-h-full px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ─── User Avatar (handles Google picture + CORS + fallback) ──────────────── */
function UserAvatar({ user, size = 24 }) {
  const [imgError, setImgError] = useState(false);
  const px = `${size}px`;

  if (user?.picture && !imgError) {
    return (
      <img
        src={user.picture}
        alt={user?.name ?? "avatar"}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{ width: px, height: px }}
        className="shrink-0 rounded-full object-cover border border-white/10"
      />
    );
  }

  return (
    <div
      style={{ width: px, height: px, fontSize: Math.round(size * 0.38) + "px" }}
      className="flex shrink-0 items-center justify-center rounded-full bg-violet-600/30 font-semibold text-violet-300 border border-violet-500/20"
    >
      {getInitials(user?.name || user?.email || "?")}
    </div>
  );
}
