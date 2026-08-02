import apiClient from "./apiClient";

/**
 * ─── Auth API ─────────────────────────────────────────────────────────────────
 * Matches backend: /auth/signup, /auth/login, /auth/google, /auth/me
 */
export const authApi = {
  /** POST /auth/signup — { email, password, name } → { access_token, user } */
  signup: (data) => apiClient.post("/auth/signup", data).then((r) => r.data),

  /** POST /auth/login — { email, password } → { access_token, user } */
  login: (data) => apiClient.post("/auth/login", data).then((r) => r.data),

  /** GET /auth/me → UserOut */
  getMe: () => apiClient.get("/auth/me").then((r) => r.data),
};

/**
 * ─── Organizations API ────────────────────────────────────────────────────────
 * Matches backend: /orgs/* routes
 */
export const orgsApi = {
  /** POST /orgs/ — { name, slug } → OrgOut */
  createOrg: (data) => apiClient.post("/orgs/", data).then((r) => r.data),

  /** GET /orgs/ → OrgOut[] */
  listMyOrgs: () => apiClient.get("/orgs/").then((r) => r.data),

  /** GET /orgs/:id → OrgOut */
  getOrg: (orgId) => apiClient.get(`/orgs/${orgId}`).then((r) => r.data),

  /** GET /orgs/:id/members → MemberOut[] (includes user_name, user_email) */
  listMembers: (orgId) =>
    apiClient.get(`/orgs/${orgId}/members`).then((r) => r.data),

  /** POST /orgs/:id/members — { email, role } → MemberOut */
  addMember: (orgId, data) =>
    apiClient.post(`/orgs/${orgId}/members`, data).then((r) => r.data),

  /** GET /orgs/:id/my-role → { org_id, role } */
  getMyRole: (orgId) =>
    apiClient.get(`/orgs/${orgId}/my-role`).then((r) => r.data),

  /** PATCH /orgs/:id — { name } → OrgOut */
  renameOrg: (orgId, name) =>
    apiClient.patch(`/orgs/${orgId}`, { name }).then((r) => r.data),

  /** DELETE /orgs/:id */
  deleteOrg: (orgId) => apiClient.delete(`/orgs/${orgId}`),
};

/**
 * ─── Projects API ─────────────────────────────────────────────────────────────
 * Matches backend: /orgs/{id}/projects/* and /projects/* routes
 */
export const projectsApi = {
  /** POST /orgs/:orgId/projects/ — { name, slug, platform } → ProjectWithDsn */
  createProject: (orgId, data) =>
    apiClient.post(`/orgs/${orgId}/projects/`, data).then((r) => r.data),

  /** GET /orgs/:orgId/projects/ → ProjectOut[] */
  listProjects: (orgId) =>
    apiClient.get(`/orgs/${orgId}/projects/`).then((r) => r.data),

  /** GET /projects/:projectId → ProjectOut */
  getProject: (projectId) =>
    apiClient.get(`/projects/${projectId}`).then((r) => r.data),

  /** GET /projects/:projectId/dsn → DsnKeyOut[] */
  listDsnKeys: (projectId) =>
    apiClient.get(`/projects/${projectId}/dsn`).then((r) => r.data),

  /** POST /projects/:projectId/dsn?label=X → DsnKeyOut */
  createDsnKey: (projectId, label = "New Key") =>
    apiClient
      .post(`/projects/${projectId}/dsn`, null, { params: { label } })
      .then((r) => r.data),

  /** PATCH /projects/:id — { name } → ProjectOut */
  renameProject: (projectId, name) =>
    apiClient.patch(`/projects/${projectId}`, { name }).then((r) => r.data),

  /** DELETE /projects/:id */
  deleteProject: (projectId) => apiClient.delete(`/projects/${projectId}`),
};

/**
 * ─── Issues API ───────────────────────────────────────────────────────────────
 * Matches backend: /projects/{id}/issues/* routes
 */
export const issuesApi = {
  /**
   * GET /projects/:projectId/issues/
   * @param {string} projectId
   * @param {{ status?: string, level?: string, limit?: number, offset?: number }} params
   * → IssueListResponse { total, issues[] }
   */
  listIssues: (projectId, params = {}) =>
    apiClient
      .get(`/projects/${projectId}/issues/`, { params })
      .then((r) => r.data),

  /** GET /projects/:projectId/issues/:issueId → IssueOut */
  getIssue: (projectId, issueId) =>
    apiClient
      .get(`/projects/${projectId}/issues/${issueId}`)
      .then((r) => r.data),

  /**
   * PATCH /projects/:projectId/issues/:issueId
   * @param {{ status: string }} data
   * → IssueOut
   */
  updateIssue: (projectId, issueId, data) =>
    apiClient
      .patch(`/projects/${projectId}/issues/${issueId}`, data)
      .then((r) => r.data),

  /**
   * GET /projects/:projectId/issues/:issueId/events
   * @param {{ limit?: number, offset?: number }} params
   * → EventOut[]
   */
  listIssueEvents: (projectId, issueId, params = {}) =>
    apiClient
      .get(`/projects/${projectId}/issues/${issueId}/events`, { params })
      .then((r) => r.data),
};

/**
 * ─── Health API ───────────────────────────────────────────────────────────────
 */
export const healthApi = {
  check: () => apiClient.get("/health").then((r) => r.data),
};

/**
 * ─── LLM Report API ───────────────────────────────────────────────────────────
 */
export const reportApi = {
  /** POST /report/projects/:projectId/generate → ReportResponse */
  generateProjectReport: (projectId) => 
    apiClient.post(`/report/projects/${projectId}/generate`).then((r) => r.data),

  /** GET /report/health → Health check status */
  checkHealth: () => apiClient.get(`/report/health`).then((r) => r.data),
};
