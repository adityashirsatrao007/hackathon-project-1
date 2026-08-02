/**
 * Tracelify Frontend — TypeScript/JSDoc type declarations.
 * These mirror the Pydantic schemas in the FastAPI backend.
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} User
 * @property {string} id         - UUID
 * @property {string} email
 * @property {string|null} name
 * @property {string|null} picture
 * @property {boolean} is_active
 * @property {string} created_at - ISO datetime
 */

/**
 * @typedef {Object} TokenResponse
 * @property {string} access_token
 * @property {string} token_type
 * @property {User} user
 */

// ── Organizations ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Organization
 * @property {string} id       - UUID
 * @property {string} name
 * @property {string} slug
 * @property {string} owner_id - UUID
 * @property {string} created_at
 */

/**
 * @typedef {Object} OrganizationMember
 * @property {string} id
 * @property {string} org_id   - UUID
 * @property {string} user_id  - UUID
 * @property {"owner"|"admin"|"member"} role
 * @property {string} joined_at
 */

// ── Projects ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Project
 * @property {string} id       - UUID
 * @property {string} name
 * @property {string} slug
 * @property {string} org_id   - UUID
 * @property {string} platform
 * @property {string} created_at
 */

/**
 * @typedef {Object} DsnKey
 * @property {string} id         - UUID
 * @property {string} project_id - UUID
 * @property {string} public_key
 * @property {string} label
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} dsn        - Full DSN string: http://<key>@host/api/<project_id>/events
 */

// ── Issues ────────────────────────────────────────────────────────────────────

/**
 * @typedef {"open"|"resolved"|"ignored"} IssueStatus
 * @typedef {"error"|"warning"|"info"} IssueLevel
 *
 * @typedef {Object} Issue
 * @property {string} id          - UUID
 * @property {string} project_id  - UUID
 * @property {string} title
 * @property {string} fingerprint
 * @property {IssueLevel} level
 * @property {IssueStatus} status
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {number} event_count
 * @property {number} user_count
 */

/**
 * @typedef {Object} IssueListResponse
 * @property {number} total
 * @property {Issue[]} issues
 */

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TracelifyEvent
 * @property {string} id          - UUID
 * @property {string} project_id  - UUID
 * @property {string} issue_id    - UUID
 * @property {string|null} message
 * @property {string} level
 * @property {string|null} environment
 * @property {string|null} platform
 * @property {Object|null} exception
 * @property {Object|null} request_data
 * @property {Object|null} user_context
 * @property {Object|null} tags
 * @property {Object|null} extra
 * @property {string} received_at
 */

export {};
