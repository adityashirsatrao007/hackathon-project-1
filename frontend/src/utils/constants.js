// ── Constants shared across the app ────────────────────────────────────────────

/** TanStack Query cache keys — use these everywhere so invalidation is consistent */
export const QUERY_KEYS = {
  ME: ["auth", "me"],
  ORGS: ["orgs"],
  ORG: (orgId) => ["orgs", orgId],
  ORG_MEMBERS: (orgId) => ["orgs", orgId, "members"],
  ORG_ROLE: (orgId) => ["orgs", orgId, "my-role"],
  PROJECTS: (orgId) => ["orgs", orgId, "projects"],
  PROJECT: (projectId) => ["projects", projectId],
  PROJECT_DSN: (projectId) => ["projects", projectId, "dsn"],
  ISSUES: (projectId, params) => ["projects", projectId, "issues", params],
  ISSUE: (projectId, issueId) => ["projects", projectId, "issues", issueId],
  ISSUE_EVENTS: (projectId, issueId) => [
    "projects",
    projectId,
    "issues",
    issueId,
    "events",
  ],
};

export const ISSUE_STATUSES = {
  OPEN: "open",
  RESOLVED: "resolved",
  IGNORED: "ignored",
  ALL: "all",
};

export const ISSUE_LEVELS = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

export const PLATFORMS = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "react", label: "React" },
  { value: "node", label: "Node.js" },
  { value: "django", label: "Django" },
  { value: "fastapi", label: "FastAPI" },
  { value: "flask", label: "Flask" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "other", label: "Other" },
];

export const MEMBER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
};

export const TOKEN_STORAGE_KEY = "tracelify_access_token";
export const ORG_STORAGE_KEY = "tracelify_active_org";

/** Default pagination */
export const DEFAULT_PAGE_LIMIT = 50;
