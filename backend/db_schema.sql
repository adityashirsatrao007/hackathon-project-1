
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT,
    picture         TEXT,
    google_id       TEXT UNIQUE,
    hashed_password TEXT,          
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organization_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member', 
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform    TEXT DEFAULT 'python', 
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS dsn_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    public_key  TEXT UNIQUE NOT NULL, 
    label       TEXT DEFAULT 'Default',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,        
    fingerprint     TEXT NOT NULL,             
    level           TEXT DEFAULT 'error',    
    status          TEXT DEFAULT 'open',       
    first_seen      TIMESTAMPTZ DEFAULT NOW(),
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    event_count     INTEGER DEFAULT 1,
    user_count      INTEGER DEFAULT 0,
    UNIQUE(project_id, fingerprint)
);


CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY,           
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id        UUID REFERENCES issues(id) ON DELETE SET NULL,
    level           TEXT DEFAULT 'error',
    message         TEXT,
    error_type      TEXT,                      
    stacktrace      TEXT,
    release         TEXT,
    environment     TEXT DEFAULT 'production',
    platform        TEXT DEFAULT 'python',
    sdk_name        TEXT DEFAULT 'tracelify.python',
    context         JSONB DEFAULT '{}',       
    tags            JSONB DEFAULT '{}',        
    user_info       JSONB DEFAULT '{}',         
    breadcrumbs     JSONB DEFAULT '[]',        
    fingerprint     TEXT,                       
    received_at     TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS alert_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    condition   JSONB NOT NULL DEFAULT '{}',  
    action      JSONB NOT NULL DEFAULT '{}',  
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_project_id     ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_issue_id       ON events(issue_id);
CREATE INDEX IF NOT EXISTS idx_events_received_at    ON events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_fingerprint    ON events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_issues_project_id     ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_fingerprint    ON issues(fingerprint);
CREATE INDEX IF NOT EXISTS idx_issues_status         ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_last_seen      ON issues(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_dsn_keys_public_key   ON dsn_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_org_members_user      ON organization_members(user_id);
