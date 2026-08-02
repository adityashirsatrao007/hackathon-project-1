import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  FolderKanban,
  CheckCircle2,
  Plus,
  ArrowRight,
  Activity,
  Shield,
  Layers,
  ChevronRight,
  Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFetch } from "@/hooks/useFetch";
import { orgsApi, projectsApi, issuesApi } from "@/services/api/apiHandler";
import { QUERY_KEYS } from "@/utils/constants";
import { formatRelativeTime, formatCount, getInitials, cn } from "@/utils/helpers";
import Loader from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";
import StatusBadge from "@/components/common/StatusBadge";

/* ─── Skeleton shimmer pieces ──────────────────────────────────────────────── */
function Sk({ className }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

function SkeletonStatCard({ colorClass, bgClass, borderClass }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        borderClass,
        bgClass,
      )}
    >
      <Sk className="h-8 w-8 rounded-lg" />
      <div className="space-y-2">
        <Sk className="h-7 w-12" />
        <Sk className="h-3 w-16" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Sk className="h-3.5 w-3.5 rounded-full shrink-0" />
      <Sk className="h-3 flex-1" />
      <Sk className="h-3 w-12 shrink-0" />
    </div>
  );
}

/* ─── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, colorClass, bgClass, borderClass, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200",
        borderClass,
        bgClass,
        onClick && "hover:brightness-125 cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", bgClass, "brightness-150")}>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </div>
      <div>
        <div className="relative h-7 flex items-center">
          {value === null ? (
            <Sk className="h-6 w-12" />
          ) : (
            <p className={cn("text-2xl font-bold tabular-nums leading-none animate-fade-in", colorClass)}>
              {formatCount(value)}
            </p>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 font-medium">{label}</p>
      </div>
    </button>
  );
}

/* ─── Issue Row ────────────────────────────────────────────────────────────── */
function IssueRow({ issue, onClick }) {
  const levelColors = {
    error: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  };
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors group"
    >
      <AlertCircle className={cn("h-3.5 w-3.5 shrink-0", levelColors[issue.level] ?? "text-slate-500")} />
      <span className="flex-1 truncate text-[12px] text-slate-300 group-hover:text-slate-100 transition-colors">
        {issue.title}
      </span>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-[10px] text-slate-600 tabular-nums">{formatRelativeTime(issue.last_seen)}</span>
        <StatusBadge level={issue.level} />
      </div>
    </button>
  );
}

/* ─── Project Card ─────────────────────────────────────────────────────────── */
function ProjectCard({ project, orgId, navigate }) {
  return (
    <button
      onClick={() => navigate(`/orgs/${orgId}/projects/${project.id}`)}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-left hover:border-violet-500/20 hover:bg-violet-500/5 transition-all"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-400">
        <FolderKanban className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slate-200 group-hover:text-violet-300 transition-colors">
          {project.name}
        </p>
        <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">{project.platform}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

/* ─── Org Stats Panel ──────────────────────────────────────────────────────── */
function OrgPanel({ org }) {
  const navigate = useNavigate();

  const { data: projects = [], isLoading: projectsLoading } = useFetch(
    QUERY_KEYS.PROJECTS(org.id),
    () => projectsApi.listProjects(org.id),
  );

  const firstProject = projects[0];

  // Fetch recent open issues — reuse .total for open count (saves 1 extra query)
  const { data: recentIssuesData, isLoading: issuesLoading } = useFetch(
    [...QUERY_KEYS.ISSUES(firstProject?.id, { status: "open", limit: 5 }), "recent"],
    () => issuesApi.listIssues(firstProject.id, { status: "open", limit: 5 }),
    { enabled: !!firstProject },
  );

  // Resolved count only — separate because status differs
  const { data: resolvedData } = useFetch(
    QUERY_KEYS.ISSUES(firstProject?.id, { status: "resolved", limit: 1 }),
    () => issuesApi.listIssues(firstProject.id, { status: "resolved", limit: 1 }),
    { enabled: !!firstProject },
  );

  // Derive from already-fetched data — no extra round-trips
  const openCount = !firstProject ? 0 : (recentIssuesData?.total ?? null);
  const resolvedCount = !firstProject ? 0 : (resolvedData?.total ?? null);
  const recentIssues = recentIssuesData?.issues ?? [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {projectsLoading ? (
          <>
            <SkeletonStatCard bgClass="bg-violet-500/10" borderClass="border-violet-500/15" />
            <SkeletonStatCard bgClass="bg-red-500/10"    borderClass="border-red-500/15" />
            <SkeletonStatCard bgClass="bg-emerald-500/10" borderClass="border-emerald-500/15" />
          </>
        ) : (
          <>
            <StatCard
              label="Projects"
              value={projects.length}
              icon={Layers}
              colorClass="text-violet-400"
              bgClass="bg-violet-500/10"
              borderClass="border-violet-500/15"
              onClick={() => navigate(`/orgs/${org.id}/projects`)}
            />
            <StatCard
              label="Open Issues"
              value={openCount}
              icon={AlertCircle}
              colorClass="text-red-400"
              bgClass="bg-red-500/10"
              borderClass="border-red-500/15"
              onClick={firstProject
                ? () => navigate(`/orgs/${org.id}/projects/${firstProject.id}/issues`)
                : null}
            />
            <StatCard
              label="Resolved"
              value={resolvedCount}
              icon={CheckCircle2}
              colorClass="text-emerald-400"
              bgClass="bg-emerald-500/10"
              borderClass="border-emerald-500/15"
              onClick={firstProject
                ? () => navigate(`/orgs/${org.id}/projects/${firstProject.id}/issues?status=resolved`)
                : null}
            />
          </>
        )}
      </div>

      {/* Two columns: issues + projects */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Issues */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold text-slate-300">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              Recent Issues
            </h3>
            {firstProject && !projectsLoading && (
              <button
                onClick={() => navigate(`/orgs/${org.id}/projects/${firstProject.id}/issues`)}
                className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-violet-400 transition-colors"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="p-2">
            {projectsLoading || (firstProject && !recentIssuesData) ? (
              /* Skeleton rows while loading */
              <div className="py-1 space-y-1">
                {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
              </div>
            ) : recentIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mb-2" />
                <p className="text-[12px] text-slate-600">No open issues</p>
                <p className="text-[10px] text-slate-700 mt-0.5">
                  {firstProject ? "All clear 🎉" : "Create a project to get started"}
                </p>
              </div>
            ) : (
              recentIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onClick={() =>
                    navigate(`/orgs/${org.id}/projects/${firstProject.id}/issues/${issue.id}`)
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold text-slate-300">
              <FolderKanban className="h-3.5 w-3.5 text-violet-400" />
              Projects
            </h3>
            <button
              onClick={() => navigate(`/orgs/${org.id}/projects`)}
              className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-violet-400 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-2 space-y-1.5">
            {projectsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 rounded-xl skeleton" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="h-8 w-8 text-violet-500/20 mb-2" />
                <p className="text-[12px] text-slate-600">No projects yet</p>
                <button
                  onClick={() => navigate(`/orgs/${org.id}/projects`)}
                  className="mt-3 flex items-center gap-1 rounded-lg bg-violet-600/20 px-3 py-1.5 text-[11px] font-medium text-violet-400 hover:bg-violet-600/30 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Create project
                </button>
              </div>
            ) : (
              <>
                {projects.slice(0, 4).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    orgId={org.id}
                    navigate={navigate}
                  />
                ))}
                {projects.length > 4 && (
                  <button
                    onClick={() => navigate(`/orgs/${org.id}/projects`)}
                    className="w-full rounded-lg border border-dashed border-white/[0.06] py-2 text-[11px] text-slate-600 hover:border-white/10 hover:text-slate-500 transition-colors"
                  >
                    +{projects.length - 4} more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, activeOrg, setActiveOrg, userRole, isOwnerOrAdmin } = useAuth();
  const navigate = useNavigate();

  const { data: orgs = [], isLoading: orgsLoading } = useFetch(
    QUERY_KEYS.ORGS,
    () => orgsApi.listMyOrgs(),
  );

  if (!activeOrg && orgs.length > 0 && !orgsLoading) setActiveOrg(orgs[0]);

  const displayOrg = activeOrg || orgs[0];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="animate-fade-in space-y-6 w-full">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-100 leading-tight">
            {greeting()}, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {displayOrg
              ? `Monitoring errors in ${displayOrg.name}`
              : "Create an organization to get started"}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Org pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {orgs.slice(0, 3).map((org) => (
              <button
                key={org.id}
                onClick={() => { setActiveOrg(org); }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  displayOrg?.id === org.id
                    ? "border-violet-500/40 bg-violet-600/15 text-violet-300"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/10",
                )}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600/40 text-[7px] font-bold text-violet-300">
                  {getInitials(org.name).slice(0, 1)}
                </span>
                {org.name}
              </button>
            ))}
          </div>

          {/* User avatar */}
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full border border-white/10" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/25 text-[10px] font-semibold text-violet-300 border border-violet-500/20">
              {getInitials(user?.name || user?.email || "?")}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {orgsLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl skeleton" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <EmptyState
            title="No organizations yet"
            description="Create your first organization to start tracking errors and managing projects."
            action={
              <button
                onClick={() => navigate("/settings")}
                className="rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                Create organization
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_256px] items-start">
          {/* ── Left col ── */}
          <div className="space-y-5 min-w-0">
            {displayOrg && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600/25 text-[9px] font-bold text-violet-300">
                      {getInitials(displayOrg.name).slice(0, 1)}
                    </div>
                    <span className="text-[13px] font-semibold text-slate-200">{displayOrg.name}</span>
                    <span className="text-[11px] text-slate-600">/{displayOrg.slug}</span>
                    {/* Role chip */}
                    {userRole && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                        userRole === "owner"  && "bg-amber-500/10 border-amber-500/20 text-amber-400",
                        userRole === "admin"  && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                        userRole === "member" && "bg-slate-500/10 border-slate-500/20 text-slate-400",
                      )}>
                        {userRole === "owner" && <Crown className="h-2.5 w-2.5" />}
                        {userRole}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/orgs/${displayOrg.id}/projects`)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-violet-400 transition-colors"
                  >
                    All projects <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <OrgPanel org={displayOrg} />
              </>
            )}
          </div>

          {/* ── Right col ── */}
          <div className="space-y-4 shrink-0 xl:sticky xl:top-0">
            {/* Platform status */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Shield className="h-3.5 w-3.5" />
                  System Status
                </h3>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  { label: "API Server", status: "Operational" },
                  { label: "Database", status: "Operational" },
                  { label: "Event Queue", status: "Operational" },
                  { label: "Workers", status: "Running" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{item.label}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Activity className="h-3.5 w-3.5" />
                  Quick Actions
                </h3>
              </div>
              <div className="p-2 space-y-0.5">
                {[
                  {
                    label: "New Project",
                    icon: FolderKanban,
                    onClick: () => navigate(`/orgs/${displayOrg?.id}/projects`),
                    show: true,
                  },
                  {
                    label: "View Issues",
                    icon: AlertCircle,
                    onClick: () => navigate(`/orgs/${displayOrg?.id}/projects`),
                    show: true,
                  },
                  {
                    label: "Manage Team",
                    icon: Shield,
                    onClick: () => navigate("/settings"),
                    show: isOwnerOrAdmin,
                  },
                ]
                  .filter((a) => a.show)
                  .map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 transition-colors group"
                  >
                    <action.icon className="h-3.5 w-3.5 text-slate-700 group-hover:text-violet-400 transition-colors" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SDK Setup */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  SDK Setup
                </h3>
              </div>
              <div className="p-4">
                <pre className="rounded-lg bg-black/40 border border-white/[0.05] p-3 text-[10px] leading-5 text-slate-400 overflow-x-auto font-mono">{`import tracelify

sdk = tracelify.init(
  dsn="<your-dsn>"
)

sdk.capture_exception(err)`}</pre>
                <p className="mt-2.5 text-[10px] text-slate-700">
                  Copy your DSN from{" "}
                  <button
                    onClick={() => navigate(`/orgs/${displayOrg?.id}/projects`)}
                    className="text-violet-600 hover:text-violet-500 transition-colors"
                  >
                    Project → DSN Keys
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
