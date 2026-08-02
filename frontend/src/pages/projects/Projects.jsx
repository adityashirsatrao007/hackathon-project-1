import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertCircle, ArrowRight, Book, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { projectsApi } from "@/services/api/apiHandler";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { QUERY_KEYS, PLATFORMS } from "@/utils/constants";
import { formatRelativeTime, slugify } from "@/utils/helpers";
import PageHeader from "@/components/common/PageHeader";
import Loader from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";
import Modal from "@/components/common/Modal";

/* ─── Platform emoji map ──────────────────────────────────────────────────── */
const PLATFORM_EMOJI = {
  python: "🐍", javascript: "🟨", react: "⚛️", node: "🟢",
  django: "🎸", fastapi: "⚡", flask: "🧪", java: "☕",
  cpp: "⚙️", go: "🐹", ruby: "💎", php: "🐘", other: "📦",
};

/* ─── Project Card ────────────────────────────────────────────────────────── */
function ProjectCard({ project, orgId }) {
  const navigate = useNavigate();
  const emoji = PLATFORM_EMOJI[project.platform] ?? "📦";

  return (
    <div className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-violet-500/30 hover:bg-white/[0.04] transition-all duration-200">
      {/* Top accent line — appears on hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-600 to-violet-400/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Card body — click → project details */}
      <button
        onClick={() => navigate(`/orgs/${orgId}/projects/${project.id}`)}
        className="flex flex-1 flex-col gap-4 p-5 text-left"
      >
        {/* Icon + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-2xl border border-violet-500/10 group-hover:bg-violet-600/25 transition-colors select-none">
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[14px] text-slate-100 group-hover:text-violet-200 transition-colors truncate leading-snug">
              {project.name}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{project.slug}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-700 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1 text-[11px] font-mono text-slate-400">
            {project.platform}
          </span>
          <span className="text-[11px] text-slate-600 ml-auto">
            {formatRelativeTime(project.created_at)}
          </span>
        </div>
      </button>

      {/* ── Bottom CTA bar ── */}
      <div className="border-t border-white/[0.05] p-3 flex gap-2">
        {/* VIEW ISSUES — primary, always visible, fills space */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orgs/${orgId}/projects/${project.id}/issues`);
          }}
          className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl
            bg-red-500/10 border border-red-500/20
            px-4 py-2.5
            text-[13px] font-semibold text-red-400
            hover:bg-red-500 hover:text-white hover:border-red-400
            hover:shadow-lg hover:shadow-red-900/30
            active:scale-[0.98]
            transition-all duration-150"
        >
          <AlertCircle className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-150" />
          View Issues
        </button>

        {/* SDK Docs — secondary icon-only button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orgs/${orgId}/projects/${project.id}/docs`);
          }}
          title="SDK Docs"
          className="flex items-center justify-center rounded-xl
            bg-white/[0.03] border border-white/[0.06]
            px-3 py-2.5
            text-slate-500
            hover:text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/20
            transition-all duration-150"
        >
          <Book className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function Projects() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOwnerOrAdmin } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  
  const [form, setForm] = useState({ name: "", slug: "", platform: "python" });
  const [formError, setFormError] = useState("");

  const { data: projects = [], isLoading } = useFetch(
    QUERY_KEYS.PROJECTS(orgId),
    () => projectsApi.listProjects(orgId),
    { enabled: !!orgId },
  );

  const createMutation = useMutation({
    mutationFn: (data) => projectsApi.createProject(orgId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS(orgId) });
      setShowCreate(false);
      setForm({ name: "", slug: "", platform: "python" });
      navigate(`/orgs/${orgId}/projects/${data.project.id}`);
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || "Failed to create project.");
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.slug) {
      setFormError("Name and slug are required.");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        description="Manage your projects and their error tracking configurations."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Projects" }]}
        actions={
          isOwnerOrAdmin && (
            <div className="flex items-center gap-3">
              <button
                id="btn-new-project"
                onClick={() => { setFormError(""); setShowCreate(true); }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>
          )
        }
      />

      {/* ── Create project modal (centered via Modal component) ── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Project"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {formError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Project name</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
              placeholder="My Backend Service"
              autoFocus
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Slug</label>
            <input
              type="text" required value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="my-backend-service"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
            >
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={() => setShowCreate(false)}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={createMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-60"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Project grid ── */}
      {isLoading ? (
        <Loader />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project and get your DSN to start capturing errors."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Create project
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  );
}
