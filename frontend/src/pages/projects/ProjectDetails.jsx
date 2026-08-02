import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, Copy, Check, Plus, Loader2, Key, Book,
  MoreVertical, Pencil, Trash2, X, Sparkles, Download
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { projectsApi, reportApi } from "@/services/api/apiHandler";
import { useFetch } from "@/hooks/useFetch";
import { QUERY_KEYS } from "@/utils/constants";
import { formatDate, copyToClipboard } from "@/utils/helpers";
import PageHeader from "@/components/common/PageHeader";
import Loader from "@/components/common/Loader";
import Modal from "@/components/common/Modal";

/* ─── Inline rename/delete modal ──────────────────────────────────────────── */
function ProjectActionsMenu({ project, orgId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(null); // "rename" | "delete"
  const [name, setName] = useState(project.name);

  const renameMut = useMutation({
    mutationFn: (newName) => projectsApi.renameProject(project.id, newName),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.PROJECT(project.id), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS(orgId) });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => projectsApi.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS(orgId) });
      navigate(`/orgs/${orgId}/projects`);
    },
  });

  return (
    <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-white/[0.08] bg-[#12121e] shadow-2xl py-1 overflow-hidden">
      <button
        onClick={() => setMode("rename")}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" /> Rename project
      </button>
      <div className="my-1 border-t border-white/[0.05]" />
      <button
        onClick={() => setMode("delete")}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete project
      </button>

      {/* Rename inline */}
      {mode === "rename" && (
        <div className="border-t border-white/[0.05] p-3 space-y-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && renameMut.mutate(name)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-slate-200 outline-none focus:border-violet-500/50"
            placeholder="New name…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => renameMut.mutate(name)}
              disabled={renameMut.isPending || !name.trim()}
              className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {renameMut.isPending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setMode(null)} className="px-2 text-slate-600 hover:text-slate-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm inline */}
      {mode === "delete" && (
        <div className="border-t border-white/[0.05] p-3 space-y-2">
          <p className="text-[11px] text-slate-500">This will permanently delete all issues and data.</p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </button>
            <button onClick={() => setMode(null)} className="px-2 text-slate-600 hover:text-slate-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export default function ProjectDetails() {
  const { orgId, projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  const backendUrl = import.meta.env.VITE_API_BASE_URL || "";
  const backendHost = backendUrl ? new URL(backendUrl).host : "localhost:8000";
  const fixDsn = (dsn) => dsn?.replace("localhost:8000", backendHost);

  const { data: project, isLoading: projectLoading } = useFetch(
    QUERY_KEYS.PROJECT(projectId),
    () => projectsApi.getProject(projectId),
    { enabled: !!projectId },
  );

  const { data: dsnKeys = [], isLoading: dsnLoading } = useFetch(
    QUERY_KEYS.PROJECT_DSN(projectId),
    () => projectsApi.listDsnKeys(projectId),
    { enabled: !!projectId },
  );

  const rotateMutation = useMutation({
    mutationFn: (label) => projectsApi.createDsnKey(projectId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECT_DSN(projectId) });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: () => reportApi.generateProjectReport(projectId),
    onSuccess: (data) => setReportResult(data),
    onError: (err) => {
      setReportResult({ error: err.response?.data?.detail || "Failed to generate AI report." });
    },
  });

  const handleGenerateReport = () => {
    setShowReport(true);
    setReportResult(null);
    generateReportMutation.mutate();
  };

  const handleDownloadReport = () => {
    if (!reportResult?.full_report) return;
    const blob = new Blob([reportResult.full_report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracelify_health_report_${project?.slug || "project"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text, id) => {
    await copyToClipboard(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (projectLoading) return <Loader />;
  if (!project) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={project.name}
        description={`Platform: ${project.platform} · Created ${formatDate(project.created_at)}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Projects", to: `/orgs/${orgId}/projects` },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Docs link */}
            <button
              onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/docs`)}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
            >
              <Book className="h-4 w-4" />
              SDK Docs
            </button>

            {/* ── View Issues (prominent) ── */}
            <button
              id="btn-view-issues"
              onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/issues`)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/30"
            >
              <AlertCircle className="h-4 w-4" />
              View Issues
            </button>

            {/* ⋮ More menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-[36px] w-[36px] items-center justify-center rounded-xl border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <ProjectActionsMenu
                  project={project}
                  orgId={orgId}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        }
      />

      {/* ── Quick action strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "View Issues",
            icon: AlertCircle,
            color: "text-red-400",
            bg: "bg-red-500/10 border-red-500/15 hover:border-red-500/30",
            onClick: () => navigate(`/orgs/${orgId}/projects/${projectId}/issues`),
          },
          {
            label: "SDK Docs",
            icon: Book,
            color: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/15 hover:border-violet-500/30",
            onClick: () => navigate(`/orgs/${orgId}/projects/${projectId}/docs`),
          },
          {
            label: "AI Health Report",
            icon: Sparkles,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/15 hover:border-emerald-500/30",
            onClick: handleGenerateReport,
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`flex items-center gap-2.5 rounded-xl border ${item.bg} px-4 py-3 text-[12px] font-medium transition-all ${item.color}`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Project info */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Project Details</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Project ID", value: project.id, mono: true },
            { label: "Slug", value: project.slug, mono: true },
            { label: "Platform", value: project.platform },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className={`text-sm text-slate-200 ${item.mono ? "font-mono" : ""} break-all`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DSN Keys */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-100">DSN Keys</h2>
            <p className="text-xs text-slate-500 mt-0.5">Use these keys in your Tracelify SDK integration.</p>
          </div>
          <button
            id="btn-new-dsn"
            onClick={() => rotateMutation.mutate(`Key ${dsnKeys.length + 1}`)}
            disabled={rotateMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {rotateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New Key
          </button>
        </div>

        {dsnLoading ? (
          <Loader />
        ) : dsnKeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
            No DSN keys found.
          </div>
        ) : (
          <div className="space-y-3">
            {dsnKeys.map((key) => (
              <div key={key.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-medium text-slate-200">{key.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${key.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                      {key.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{formatDate(key.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-slate-950/60 border border-slate-800/60 px-4 py-3">
                  <code className="flex-1 text-xs text-slate-300 font-mono break-all leading-relaxed">{fixDsn(key.dsn)}</code>
                  <button
                    onClick={() => handleCopy(fixDsn(key.dsn), key.id)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    {copiedKey === key.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Public key:</span>
                  <code className="text-slate-400 font-mono">{key.public_key}</code>
                  <button onClick={() => handleCopy(key.public_key, `pk-${key.id}`)} className="text-slate-600 hover:text-slate-400">
                    {copiedKey === `pk-${key.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Report Modal ── */}
      <Modal
        open={showReport}
        onClose={() => setShowReport(false)}
        title="AI System Health Report"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {!reportResult && generateReportMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-4" />
              <p className="text-slate-300 font-medium">Generating project-specific report...</p>
              <p className="text-sm text-slate-500 mt-1">Analyzing database records for this project...</p>
            </div>
          )}

          {reportResult?.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-red-400">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <AlertCircle className="h-5 w-5" />
                Report Generation Failed
              </div>
              <p className="text-sm">{reportResult.error}</p>
            </div>
          )}

          {reportResult?.full_report && (
            <>
              <div className="prose prose-invert prose-emerald max-w-none text-sm bg-slate-800/50 p-6 rounded-xl border border-slate-700/60 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportResult.full_report}</ReactMarkdown>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
