import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, User, Hash, Layers, AlertCircle, CheckCircle2,
  EyeOff, ChevronDown, ChevronUp, Tag, Monitor, Cpu, Globe,
  GitBranch, Package, Terminal, Footprints, Copy, Check,
  Activity, Shield, Info, Radio,
} from "lucide-react";
import { issuesApi } from "@/services/api/apiHandler";
import { useFetch } from "@/hooks/useFetch";
import { QUERY_KEYS } from "@/utils/constants";
import { formatDate, formatRelativeTime, copyToClipboard, cn } from "@/utils/helpers";
import Loader from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";

/* ─── Level badge ─────────────────────────────────────────────────────────── */
const LEVEL_STYLES = {
  error:   { badge: "bg-red-500/15 text-red-400 border-red-500/20",   dot: "bg-red-500",   icon: AlertCircle  },
  warning: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/20", dot: "bg-amber-500", icon: Info },
  info:    { badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",  dot: "bg-blue-500",  icon: Info  },
};
const STATUS_STYLES = {
  open:     { badge: "bg-red-500/10 text-red-400 border-red-500/15",       icon: Radio, label: "Open" },
  resolved: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15", icon: CheckCircle2, label: "Resolved" },
  ignored:  { badge: "bg-slate-700/50 text-slate-400 border-slate-600/30",  icon: EyeOff, label: "Ignored" },
};

function LevelBadge({ level }) {
  const s = LEVEL_STYLES[level] ?? LEVEL_STYLES.error;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider", s.badge)}>
      <Icon className="h-3 w-3" />{level}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", s.badge)}>
      <Icon className="h-3 w-3" />{s.label}
    </span>
  );
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, colorClass = "text-violet-400", bgClass = "bg-violet-500/10" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bgClass)}>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
        <p className={cn("text-[18px] font-bold tabular-nums leading-tight mt-0.5", colorClass)}>{value}</p>
      </div>
    </div>
  );
}

/* ─── Section card ────────────────────────────────────────────────────────── */
function SectionCard({ icon: Icon, title, badge, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <button
        onClick={() => collapsible && setOpen((v) => !v)}
        className={cn("flex w-full items-center gap-2 border-b border-white/[0.06] px-4 py-3",
          collapsible ? "hover:bg-white/[0.03] transition-colors cursor-pointer" : "cursor-default")}
      >
        <Icon className="h-4 w-4 text-violet-400 shrink-0" />
        <span className="text-[12px] font-semibold text-slate-300 flex-1 text-left">{title}</span>
        {badge && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-500">{badge}</span>}
        {collapsible && (open ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />)}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

/* ─── Stacktrace block ────────────────────────────────────────────────────── */
function StacktraceBlock({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return <p className="text-[12px] text-slate-600 italic">No stacktrace available</p>;

  const lines = text.split("\n");
  const handleCopy = async () => { await copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="relative rounded-xl border border-red-500/10 bg-red-950/20 overflow-hidden">
      <div className="flex items-center justify-between border-b border-red-500/10 px-4 py-2">
        <span className="text-[10px] font-mono text-red-400/60 uppercase tracking-wider">Traceback</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[11.5px] leading-5.5 font-mono">
        {lines.map((line, i) => {
          const isFileLine = line.trim().startsWith("File ");
          const isErrorLine = /^\w+Error|^\w+Exception/.test(line.trim());
          return (
            <div key={i} className={cn(
              isErrorLine ? "text-red-400 font-semibold" :
              isFileLine  ? "text-amber-300/80" :
              "text-slate-400"
            )}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

/* ─── Key-value table ─────────────────────────────────────────────────────── */
function KVTable({ data }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <p className="text-[12px] text-slate-600 italic">No data</p>;
  return (
    <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.05] overflow-hidden">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors">
          <span className="w-32 shrink-0 text-[11px] font-mono text-slate-500">{k}</span>
          <span className="flex-1 text-[12px] text-slate-300 break-all font-mono">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Breadcrumb trail ────────────────────────────────────────────────────── */
function BreadcrumbTrail({ crumbs }) {
  if (!crumbs?.length) return <p className="text-[12px] text-slate-600 italic">No breadcrumbs recorded</p>;
  return (
    <ol className="space-y-1.5">
      {crumbs.map((crumb, i) => {
        const msg = typeof crumb === "string" ? crumb : (crumb.message ?? JSON.stringify(crumb));
        return (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[9px] font-bold text-violet-400">{i + 1}</span>
            <span className="text-[12px] text-slate-300 leading-snug">{msg}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Single event card ───────────────────────────────────────────────────── */
function EventCard({ event, index, isLatest }) {
  const [open, setOpen] = useState(isLatest);
  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-all",
      isLatest ? "border-violet-500/25 bg-violet-500/5" : "border-white/[0.06] bg-white/[0.015]"
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          isLatest ? "bg-violet-600/30 text-violet-300" : "bg-white/[0.06] text-slate-500")}>
          {index + 1}
        </div>
        <div className="flex flex-1 items-center gap-2 flex-wrap min-w-0">
          <span className={cn("text-[11px] font-mono rounded px-1.5 py-0.5",
            isLatest ? "bg-violet-500/15 text-violet-300" : "bg-white/[0.05] text-slate-500")}>
            {event.environment}
          </span>
          {event.release && (
            <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />{event.release}
            </span>
          )}
          {event.sdk_name && (
            <span className="text-[11px] text-slate-600 flex items-center gap-1">
              <Package className="h-3 w-3" />{event.sdk_name}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">{formatRelativeTime(event.received_at)}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-600 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-4 space-y-4">
          {/* Error message */}
          {event.message && (
            <div className="rounded-lg bg-red-950/30 border border-red-500/10 px-4 py-3">
              <p className="text-[11px] text-red-400/60 uppercase tracking-wider mb-1">Error Message</p>
              <p className="text-[13px] font-semibold text-red-300 font-mono">{event.message}</p>
            </div>
          )}

          {/* Stacktrace */}
          {event.stacktrace && (
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Terminal className="h-3 w-3" /> Stack Trace
              </p>
              <StacktraceBlock text={event.stacktrace} />
            </div>
          )}

          {/* 3-column: Context | User | Tags */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Monitor className="h-3 w-3" /> Runtime Context
              </p>
              <KVTable data={event.context} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="h-3 w-3" /> User Info
              </p>
              <KVTable data={event.user_info} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Tags
              </p>
              <KVTable data={event.tags} />
            </div>
          </div>

          {/* Breadcrumbs */}
          {event.breadcrumbs?.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Footprints className="h-3 w-3" /> Breadcrumbs
              </p>
              <BreadcrumbTrail crumbs={event.breadcrumbs} />
            </div>
          )}

          {/* Event meta footer */}
          <div className="flex flex-wrap gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 text-[11px] text-slate-500 font-mono">
            <span>ID: {String(event.id).split("-")[0]}…</span>
            {event.platform && <span>platform: {event.platform}</span>}
            <span>received: {formatDate(event.received_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function ErrorDetails() {
  const { orgId, projectId, issueId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: issue, isLoading: issueLoading } = useFetch(
    QUERY_KEYS.ISSUE(projectId, issueId),
    () => issuesApi.getIssue(projectId, issueId),
    { enabled: !!projectId && !!issueId },
  );

  const { data: events = [], isLoading: eventsLoading } = useFetch(
    QUERY_KEYS.ISSUE_EVENTS(projectId, issueId),
    () => issuesApi.listIssueEvents(projectId, issueId),
    { enabled: !!projectId && !!issueId },
  );

  const updateMutation = useMutation({
    mutationFn: (status) => issuesApi.updateIssue(projectId, issueId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ISSUE(projectId, issueId) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
    },
  });

  if (issueLoading) return <Loader />;
  if (!issue) return <EmptyState title="Issue not found" />;

  const latestEvent = events[0];
  const levelStyle = LEVEL_STYLES[issue.level] ?? LEVEL_STYLES.error;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Back ── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to issues
      </button>

      {/* ── Hero header ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
        {/* Coloured top accent */}
        <div className={cn("h-0.5 w-full", {
          "bg-gradient-to-r from-red-600 to-red-400/30": issue.level === "error",
          "bg-gradient-to-r from-amber-500 to-amber-400/30": issue.level === "warning",
          "bg-gradient-to-r from-blue-600 to-blue-400/30": issue.level === "info",
        })} />
        <div className="px-6 py-5 space-y-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <button onClick={() => navigate("/dashboard")} className="hover:text-slate-400 transition-colors">Dashboard</button>
            <span>›</span>
            <button onClick={() => navigate(`/orgs/${orgId}/projects`)} className="hover:text-slate-400 transition-colors">Projects</button>
            <span>›</span>
            <button onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/issues`)} className="hover:text-slate-400 transition-colors">Issues</button>
            <span>›</span>
            <span className="text-slate-500">Detail</span>
          </nav>

          {/* Title + badges */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <LevelBadge level={issue.level} />
                <StatusBadge status={issue.status} />
              </div>
              <h1 className="text-[17px] font-bold text-slate-100 font-mono leading-snug break-words">
                {issue.title}
              </h1>
              {latestEvent?.message && latestEvent.message !== issue.title && (
                <p className="text-[13px] text-slate-400">{latestEvent.message}</p>
              )}
            </div>

            {/* Status changer */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={issue.status}
                onChange={(e) => updateMutation.mutate(e.target.value)}
                disabled={updateMutation.isPending}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-slate-300 outline-none focus:border-violet-500/50 disabled:opacity-60 transition-colors hover:bg-white/[0.07]"
              >
                <option value="open">Mark Open</option>
                <option value="resolved">Mark Resolved</option>
                <option value="ignored">Mark Ignored</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Activity}     label="Total Events"    value={issue.event_count.toLocaleString()} colorClass="text-violet-400" bgClass="bg-violet-500/10" />
        <StatCard icon={User}         label="Affected Users"  value={issue.user_count.toLocaleString()}  colorClass="text-amber-400"  bgClass="bg-amber-500/10" />
        <StatCard icon={Clock}        label="First Seen"      value={formatDate(issue.first_seen)}       colorClass="text-slate-300"  bgClass="bg-white/[0.06]" />
        <StatCard icon={Clock}        label="Last Seen"       value={formatRelativeTime(issue.last_seen)} colorClass={issue.level === "error" ? "text-red-400" : "text-slate-300"} bgClass={issue.level === "error" ? "bg-red-500/10" : "bg-white/[0.06]"} />
      </div>

      {/* ── Two column layout ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_260px] items-start">
        {/* Left: events */}
        <div className="space-y-4">
          <SectionCard icon={Layers} title="Event Timeline" badge={`${events.length} events`}>
            {eventsLoading ? (
              <Loader />
            ) : events.length === 0 ? (
              <EmptyState title="No events found" description="Events will appear here as they are ingested." />
            ) : (
              <div className="space-y-3">
                {events.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} isLatest={i === 0} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: meta sidebar */}
        <div className="space-y-4">
          {/* Fingerprint */}
          <SectionCard icon={Shield} title="Fingerprint" collapsible defaultOpen>
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">Used for deduplication — events with the same fingerprint are grouped into this issue.</p>
              <code className="block rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-[11px] font-mono text-violet-300 break-all">
                {issue.fingerprint}
              </code>
            </div>
          </SectionCard>

          {/* Latest event context */}
          {latestEvent?.context && Object.keys(latestEvent.context).length > 0 && (
            <SectionCard icon={Cpu} title="Runtime Context" collapsible>
              <KVTable data={latestEvent.context} />
            </SectionCard>
          )}

          {/* Latest event user */}
          {latestEvent?.user_info && Object.keys(latestEvent.user_info).length > 0 && (
            <SectionCard icon={User} title="Affected User" collapsible>
              <KVTable data={latestEvent.user_info} />
            </SectionCard>
          )}

          {/* Latest event tags */}
          {latestEvent?.tags && Object.keys(latestEvent.tags).length > 0 && (
            <SectionCard icon={Tag} title="Tags" collapsible>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(latestEvent.tags).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 border border-violet-500/15 px-2.5 py-1 text-[11px] text-violet-300">
                    <span className="text-slate-500">{k}:</span>{String(v)}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* SDK info */}
          {latestEvent?.sdk_name && (
            <SectionCard icon={Package} title="SDK Info" collapsible>
              <KVTable data={{
                sdk: latestEvent.sdk_name,
                platform: latestEvent.platform,
                release: latestEvent.release ?? "—",
                environment: latestEvent.environment,
              }} />
            </SectionCard>
          )}

          {/* Breadcrumbs sidebar preview */}
          {latestEvent?.breadcrumbs?.length > 0 && (
            <SectionCard icon={Footprints} title="Breadcrumbs" collapsible>
              <BreadcrumbTrail crumbs={latestEvent.breadcrumbs} />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
