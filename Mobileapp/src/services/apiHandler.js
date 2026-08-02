import apiClient from './apiClient';

/**
 * ─── Auth API ─────────────────────────────────────────────────────────────────
 */
export const authApi = {
  signup: (data) => apiClient.post('/auth/signup', data).then((r) => r.data),
  login: (data) => apiClient.post('/auth/login', data).then((r) => r.data),
  getGoogleUrl: () => apiClient.get('/auth/google').then((r) => r.data),
  getMe: () => apiClient.get('/auth/me').then((r) => r.data),
};

/**
 * ─── Organizations API ────────────────────────────────────────────────────────
 */
export const orgsApi = {
  createOrg: (data) => apiClient.post('/orgs/', data).then((r) => r.data),
  listMyOrgs: () => apiClient.get('/orgs/').then((r) => r.data),
  getOrg: (orgId) => apiClient.get(`/orgs/${orgId}`).then((r) => r.data),
  listMembers: (orgId) => apiClient.get(`/orgs/${orgId}/members`).then((r) => r.data),
  addMember: (orgId, data) => apiClient.post(`/orgs/${orgId}/members`, data).then((r) => r.data),
  getMyRole: (orgId) => apiClient.get(`/orgs/${orgId}/my-role`).then((r) => r.data),
  renameOrg: (orgId, name) => apiClient.patch(`/orgs/${orgId}`, { name }).then((r) => r.data),
  deleteOrg: (orgId) => apiClient.delete(`/orgs/${orgId}`),
};

/**
 * ─── Projects API ─────────────────────────────────────────────────────────────
 */
export const projectsApi = {
  createProject: (orgId, data) => apiClient.post(`/orgs/${orgId}/projects/`, data).then((r) => r.data),
  listProjects: (orgId) => apiClient.get(`/orgs/${orgId}/projects/`).then((r) => r.data),
  getProject: (projectId) => apiClient.get(`/projects/${projectId}`).then((r) => r.data),
  listDsnKeys: (projectId) => apiClient.get(`/projects/${projectId}/dsn`).then((r) => r.data),
  createDsnKey: (projectId, label = 'New Key') =>
    apiClient.post(`/projects/${projectId}/dsn`, null, { params: { label } }).then((r) => r.data),
  renameProject: (projectId, name) =>
    apiClient.patch(`/projects/${projectId}`, { name }).then((r) => r.data),
  deleteProject: (projectId) => apiClient.delete(`/projects/${projectId}`),
};

/**
 * ─── Issues API ───────────────────────────────────────────────────────────────
 */
export const issuesApi = {
  listIssues: (projectId, params = {}) =>
    apiClient.get(`/projects/${projectId}/issues/`, { params }).then((r) => r.data),
  getIssue: (projectId, issueId) =>
    apiClient.get(`/projects/${projectId}/issues/${issueId}`).then((r) => r.data),
  updateIssue: (projectId, issueId, data) =>
    apiClient.patch(`/projects/${projectId}/issues/${issueId}`, data).then((r) => r.data),
  listIssueEvents: (projectId, issueId, params = {}) =>
    apiClient.get(`/projects/${projectId}/issues/${issueId}/events`, { params }).then((r) => r.data),
};

/**
 * ─── Health API ───────────────────────────────────────────────────────────────
 */
export const healthApi = {
  check: () => apiClient.get('/health').then((r) => r.data),
};

/**
 * ─── LLM Report API ──────────────────────────────────────────────────────────
 */
export const reportApi = {
  generateProjectReport: (projectId) =>
    apiClient.post(`/report/projects/${projectId}/generate`).then((r) => r.data),
  checkHealth: () => apiClient.get('/report/health').then((r) => r.data),
};
