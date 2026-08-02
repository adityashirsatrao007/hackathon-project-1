import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { issuesApi } from "@/services/api/apiHandler";
import { useFetch } from "@/hooks/useFetch";
import { QUERY_KEYS, ISSUE_STATUSES, ISSUE_LEVELS, DEFAULT_PAGE_LIMIT } from "@/utils/constants";
import { formatRelativeTime, formatCount } from "@/utils/helpers";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import Loader from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";

const STATUS_TABS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
  { value: "all", label: "All" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

export default function ErrorsList() {
  const { orgId, projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("open");
  const [levelFilter, setLevelFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const params = {
    status: statusFilter,
    ...(levelFilter && { level: levelFilter }),
    limit: DEFAULT_PAGE_LIMIT,
    offset,
  };

  const { data, isLoading, isError } = useFetch(
    QUERY_KEYS.ISSUES(projectId, params),
    () => issuesApi.listIssues(projectId, params),
    { enabled: !!projectId },
  );

  const issues = data?.issues ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / DEFAULT_PAGE_LIMIT);
  const currentPage = Math.floor(offset / DEFAULT_PAGE_LIMIT) + 1;

  const updateMutation = useMutation({
    mutationFn: ({ issueId, status }) => issuesApi.updateIssue(projectId, issueId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Issues"
        description={`${formatCount(total)} ${statusFilter !== "all" ? statusFilter : ""} issues`}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Projects", to: `/orgs/${orgId}/projects` },
          { label: "Issues" },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-xl border border-slate-800/60 bg-slate-900/40 p-1 gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              id={`tab-status-${tab.value}`}
              onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === tab.value
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setOffset(0); }}
          className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-violet-500/50"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <EmptyState variant="error" title="Failed to load issues" description="Check your connection and try again." />
      ) : issues.length === 0 ? (
        <EmptyState title="No issues found" description="No issues match the current filters." />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/60">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Events</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Last seen</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="group hover:bg-slate-800/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/issues/${issue.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                          issue.level === "error" ? "text-red-400" :
                          issue.level === "warning" ? "text-amber-400" : "text-blue-400"
                        }`} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate max-w-xs group-hover:text-violet-300 transition-colors">
                            {issue.title}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{issue.fingerprint.slice(0, 16)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <StatusBadge level={issue.level} />
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-4 py-4 text-right hidden sm:table-cell">
                      <span className="text-sm text-slate-300 font-mono">{formatCount(issue.event_count)}</span>
                    </td>
                    <td className="px-4 py-4 text-right hidden lg:table-cell">
                      <span className="text-xs text-slate-500">{formatRelativeTime(issue.last_seen)}</span>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={issue.status}
                        onChange={(e) => updateMutation.mutate({ issueId: issue.id, status: e.target.value })}
                        className="rounded-lg border border-slate-700/60 bg-slate-800 px-2 py-1 text-xs text-slate-300 outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="resolved">Resolve</option>
                        <option value="ignored">Ignore</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs">
                Page {currentPage} of {totalPages} ({formatCount(total)} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - DEFAULT_PAGE_LIMIT))}
                  disabled={offset === 0}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => setOffset(offset + DEFAULT_PAGE_LIMIT)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
