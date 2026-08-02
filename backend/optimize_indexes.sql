-- ═══════════════════════════════════════════════════════════════════════════════
-- Tracelify DB Optimization — GIN + Full-Text Search + Composite Indexes
-- Run once on Neon (psql or Neon SQL Editor).
-- Safe: all statements use IF NOT EXISTS / CONCURRENTLY — zero downtime.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Required extension for full-text search vectors
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram similarity (ILIKE → GIN)
CREATE EXTENSION IF NOT EXISTS btree_gin; -- allows GIN on scalar columns


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 1: events table
-- Hot paths:
--   • Alert count:  WHERE project_id = ? AND received_at >= ?
--   • Issue events: WHERE issue_id = ? ORDER BY received_at DESC
--   • Tag search:   WHERE tags @> '{"env": "production"}'
--   • FTS:          WHERE search_vector @@ to_tsquery(?)
-- ───────────────────────────────────────────────────────────────────────────────

-- 1a. Composite index for alert_service event_count query (eliminates seq scan)
--     Covers: project_id filter + received_at range in a single index scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_project_received
    ON events (project_id, received_at DESC);

-- 1b. Composite index for issue event listing (covers WHERE + ORDER BY together)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_issue_received
    ON events (issue_id, received_at DESC);

-- 1c. GIN index on tags JSONB — enables fast containment queries: tags @> '{...}'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tags_gin
    ON events USING GIN (tags);

-- 1d. GIN index on context JSONB — enables: context @> '{"os": "Darwin"}'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_context_gin
    ON events USING GIN (context);

-- 1e. GIN index on user_info JSONB — for querying events by user id/email
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_user_info_gin
    ON events USING GIN (user_info);

-- 1f. Trigram index on error_type — fast prefix/ILIKE search: error_type ILIKE '%Error%'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_error_type_trgm
    ON events USING GIN (error_type gin_trgm_ops);

-- 1g. Trigram index on message — fast substring search on error message
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_message_trgm
    ON events USING GIN (message gin_trgm_ops);

-- 1h. Partial index — only active (non-null) error events (most common query shape)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_errors_only
    ON events (project_id, received_at DESC)
    WHERE error_type IS NOT NULL;

-- 1i. Full-text search: add tsvector column + GIN index on events
--     Combines error_type (weight A) + message (weight B) + stacktrace (weight C)
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE events
SET search_vector = (
    setweight(to_tsvector('english', coalesce(error_type, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(message,    '')), 'B') ||
    setweight(to_tsvector('english', coalesce(stacktrace, '')), 'C')
)
WHERE search_vector IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_fts
    ON events USING GIN (search_vector);

-- Auto-update tsvector on INSERT/UPDATE via trigger
CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.error_type, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.message,    '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.stacktrace, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;
CREATE TRIGGER events_search_vector_trigger
    BEFORE INSERT OR UPDATE OF error_type, message, stacktrace
    ON events
    FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 2: issues table
-- Hot paths:
--   • List open issues: WHERE project_id = ? AND status = 'open' ORDER BY last_seen DESC
--   • List by level:    WHERE project_id = ? AND level = 'error'
--   • Fingerprint dedup: WHERE project_id = ? AND fingerprint = ?  (already indexed)
--   • FTS on title:     WHERE search_vector @@ to_tsquery(?)
-- ───────────────────────────────────────────────────────────────────────────────

-- 2a. Composite covering index for the most common list query
--     Covers project_id filter + status filter + last_seen sort — no heap fetch needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_project_status_seen
    ON issues (project_id, status, last_seen DESC);

-- 2b. Composite index for level filter queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_project_level_seen
    ON issues (project_id, level, last_seen DESC);

-- 2c. Partial index — only open issues (dominant query path, much smaller index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_open
    ON issues (project_id, last_seen DESC)
    WHERE status = 'open';

-- 2d. Partial index — only error-level issues
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_errors
    ON issues (project_id, last_seen DESC)
    WHERE level = 'error';

-- 2e. Full-text search on issue titles
ALTER TABLE issues ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE issues
SET search_vector = to_tsvector('english', coalesce(title, ''))
WHERE search_vector IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_fts
    ON issues USING GIN (search_vector);

CREATE OR REPLACE FUNCTION issues_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.title, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issues_search_vector_trigger ON issues;
CREATE TRIGGER issues_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title
    ON issues
    FOR EACH ROW EXECUTE FUNCTION issues_search_vector_update();

-- 2f. Trigram index on title for fast ILIKE searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issues_title_trgm
    ON issues USING GIN (title gin_trgm_ops);


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 3: alert_rules table
-- Hot path: WHERE project_id = ? AND is_active = true  (called per-event!)
-- ───────────────────────────────────────────────────────────────────────────────

-- 3a. Partial composite index — only active rules (reduces index size ~50%)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_rules_active
    ON alert_rules (project_id)
    WHERE is_active = true;

-- 3b. GIN index on condition JSONB — for querying rules by condition type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_rules_condition_gin
    ON alert_rules USING GIN (condition);

-- 3c. GIN index on action JSONB — for querying rules by action type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_rules_action_gin
    ON alert_rules USING GIN (action);


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 4: dsn_keys table
-- Hot path: WHERE public_key = ? AND is_active = true  (called on every SDK event!)
-- ───────────────────────────────────────────────────────────────────────────────

-- 4a. Partial index — only active keys (eliminates inactive key rows from scan)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dsn_keys_active
    ON dsn_keys (public_key)
    WHERE is_active = true;


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 5: organization_members table
-- Hot paths:
--   • Auth check:  WHERE org_id = ? AND user_id = ?
--   • My orgs:     WHERE user_id = ?
--   • Role filter: WHERE org_id = ? AND user_id = ? AND role IN ('owner','admin')
-- ───────────────────────────────────────────────────────────────────────────────

-- 5a. Composite covering index for auth checks (org + user → role)
--     INCLUDE role avoids a heap fetch when only role is needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_org_user_role
    ON organization_members (org_id, user_id) INCLUDE (role);

-- 5b. Index for "my orgs" query (user → list of orgs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_org
    ON organization_members (user_id, org_id);


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 6: users table
-- Hot paths:
--   • Login: WHERE email = ?       (already UNIQUE, covered)
--   • OAuth: WHERE google_id = ?   (already UNIQUE, covered)
-- No extra indexes needed — UNIQUE constraints create B-tree indexes automatically.
-- ───────────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 7: PostgreSQL planner hints (session-level, safe to run anytime)
-- ───────────────────────────────────────────────────────────────────────────────

-- Increase statistics targets for JSONB columns so the planner makes better
-- decisions about index vs seq scan on tags/context/user_info
ALTER TABLE events ALTER COLUMN tags       SET STATISTICS 500;
ALTER TABLE events ALTER COLUMN context    SET STATISTICS 500;
ALTER TABLE events ALTER COLUMN user_info  SET STATISTICS 500;
ALTER TABLE alert_rules ALTER COLUMN condition SET STATISTICS 500;
ALTER TABLE alert_rules ALTER COLUMN action    SET STATISTICS 500;

-- Refresh planner statistics after bulk changes
ANALYZE events;
ANALYZE issues;
ANALYZE alert_rules;
ANALYZE dsn_keys;
ANALYZE organization_members;


-- ───────────────────────────────────────────────────────────────────────────────
-- USAGE: Full-text search queries (no backend changes needed)
-- ───────────────────────────────────────────────────────────────────────────────
--
-- Search issues by title:
--   SELECT * FROM issues
--   WHERE search_vector @@ plainto_tsquery('english', 'NameError undefined variable')
--   ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'NameError undefined variable')) DESC;
--
-- Search events by error type + message:
--   SELECT * FROM events
--   WHERE search_vector @@ plainto_tsquery('english', 'RecursionError maximum depth')
--   AND project_id = '<uuid>'
--   ORDER BY received_at DESC;
--
-- Tag containment (uses GIN idx_events_tags_gin):
--   SELECT * FROM events WHERE tags @> '{"env": "production", "service": "payment-gateway"}';
--
-- Trigram ILIKE (uses idx_events_error_type_trgm):
--   SELECT * FROM events WHERE error_type ILIKE '%Error%';
--
-- ═══════════════════════════════════════════════════════════════════════════════
