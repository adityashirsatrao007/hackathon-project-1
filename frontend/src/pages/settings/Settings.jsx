import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, Building2, Users, Plus, Loader2, Crown, ShieldCheck, UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFetch } from "@/hooks/useFetch";
import { orgsApi } from "@/services/api/apiHandler";
import { QUERY_KEYS, MEMBER_ROLES } from "@/utils/constants";
import { formatDate, getInitials, slugify } from "@/utils/helpers";
import PageHeader from "@/components/common/PageHeader";
import Loader from "@/components/common/Loader";
import Modal from "@/components/common/Modal";

/* ─── Role badge ───────────────────────────────────────────────────────────── */
function RoleBadge({ role, size = "sm" }) {
  const cfg = {
    owner: {
      icon: Crown,
      className: "bg-amber-500/15 border-amber-500/25 text-amber-400",
      label: "Owner",
    },
    admin: {
      icon: ShieldCheck,
      className: "bg-blue-500/15 border-blue-500/25 text-blue-400",
      label: "Admin",
    },
    member: {
      icon: UserCheck,
      className: "bg-slate-500/15 border-slate-500/25 text-slate-400",
      label: "Member",
    },
  };
  const { icon: Icon, className, label } = cfg[role] ?? cfg.member;
  const textSize = size === "xs" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium capitalize ${textSize} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/* ─── Settings page ────────────────────────────────────────────────────────── */
export default function Settings() {
  const { user, activeOrg, setActiveOrg, userRole, isOwnerOrAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Modal open states
  const [showNewOrg, setShowNewOrg]       = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Form state
  const [orgForm,    setOrgForm]    = useState({ name: "", slug: "" });
  const [memberForm, setMemberForm] = useState({ email: "", role: "member" });
  const [orgError,    setOrgError]    = useState("");
  const [memberError, setMemberError] = useState("");

  /* Queries */
  const { data: orgs = [], isLoading: orgsLoading } = useFetch(
    QUERY_KEYS.ORGS,
    () => orgsApi.listMyOrgs(),
  );

  const { data: members = [], isLoading: membersLoading } = useFetch(
    QUERY_KEYS.ORG_MEMBERS(activeOrg?.id),
    () => orgsApi.listMembers(activeOrg?.id),
    { enabled: !!activeOrg?.id },
  );

  /* Mutations */
  const createOrgMutation = useMutation({
    mutationFn: (data) => orgsApi.createOrg(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGS });
      setActiveOrg(data);
      setShowNewOrg(false);
      setOrgForm({ name: "", slug: "" });
    },
    onError: (err) => setOrgError(err.response?.data?.detail || "Failed to create organization."),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data) => orgsApi.addMember(activeOrg?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORG_MEMBERS(activeOrg?.id) });
      setShowAddMember(false);
      setMemberForm({ email: "", role: "member" });
    },
    onError: (err) => setMemberError(err.response?.data?.detail || "Failed to add member."),
  });

  /* Handlers */
  const handleCreateOrg = (e) => {
    e.preventDefault();
    setOrgError("");
    if (!orgForm.name || !orgForm.slug) { setOrgError("Name and slug are required."); return; }
    createOrgMutation.mutate(orgForm);
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    setMemberError("");
    if (!memberForm.email) { setMemberError("Email is required."); return; }
    addMemberMutation.mutate(memberForm);
  };

  /* Input class */
  const inputCls =
    "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2";

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <PageHeader title="Settings" description="Manage your profile, organizations, and team members." />

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <User className="h-4 w-4 text-violet-400" />
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/30 text-violet-300 text-xl font-bold">
            {getInitials(user?.name || user?.email || "?")}
          </div>
          <div>
            <p className="font-semibold text-slate-100">{user?.name || "—"}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <p className="text-xs text-slate-600 mt-0.5">Member since {formatDate(user?.created_at)}</p>
          </div>
          {userRole && (
            <div className="ml-auto">
              <RoleBadge role={userRole} />
            </div>
          )}
        </div>
      </section>

      {/* ── Organizations ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Building2 className="h-4 w-4 text-violet-400" />
            Organizations
          </h2>
          {/* Any user can create a new org */}
          <button
            id="btn-new-org"
            onClick={() => { setOrgError(""); setShowNewOrg(true); }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Org
          </button>
        </div>

        {orgsLoading ? <Loader /> : (
          <div className="space-y-2">
            {orgs.map((org) => (
              <div
                key={org.id}
                onClick={() => setActiveOrg(org)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                  activeOrg?.id === org.id
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 text-xs font-bold">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{org.name}</p>
                    <p className="text-xs text-slate-500">/{org.slug}</p>
                  </div>
                </div>
                {activeOrg?.id === org.id && (
                  <span className="text-xs text-violet-400 font-medium">Active</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Team Members ─────────────────────────────────────────────────────── */}
      {activeOrg && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Users className="h-4 w-4 text-violet-400" />
              Team — {activeOrg.name}
            </h2>
            {/* Only owner/admin can add members */}
            {isOwnerOrAdmin && (
              <button
                id="btn-add-member"
                onClick={() => { setMemberError(""); setShowAddMember(true); }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </button>
            )}
          </div>

          {membersLoading ? <Loader /> : (
            <div className="space-y-2">
              {members.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">No members found.</p>
              )}
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-400 border border-slate-700">
                      {getInitials(m.user_name || m.user_email || "?")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {m.user_name || <span className="text-slate-500 italic">Unknown</span>}
                      </p>
                      <p className="text-xs text-slate-500">{m.user_email || ""}</p>
                    </div>
                  </div>
                  <RoleBadge role={m.role} size="xs" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Modal: New Organization ──────────────────────────────────────────── */}
      <Modal
        open={showNewOrg}
        onClose={() => setShowNewOrg(false)}
        title="Create Organization"
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          {orgError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {orgError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Organization name</label>
            <input
              type="text"
              placeholder="Acme Corp"
              value={orgForm.name}
              onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Slug</label>
            <input
              type="text"
              placeholder="acme-corp"
              value={orgForm.slug}
              onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowNewOrg(false)}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrgMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-60"
            >
              {createOrgMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Add Member ────────────────────────────────────────────────── */}
      <Modal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        title={`Add Member to ${activeOrg?.name ?? "Organization"}`}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          {memberError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {memberError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Email address</label>
            <input
              type="email"
              placeholder="member@example.com"
              value={memberForm.email}
              onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Role</label>
            <select
              value={memberForm.role}
              onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))}
              className={inputCls}
            >
              {Object.entries(MEMBER_ROLES)
                .filter(([k]) => k !== "OWNER") // can't assign owner via invite
                .map(([k, v]) => (
                  <option key={v} value={v}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>
                ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowAddMember(false)}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMemberMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-60"
            >
              {addMemberMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send Invite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
