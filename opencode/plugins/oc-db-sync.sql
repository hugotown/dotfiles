-- OpenCode DB Sync — PostgreSQL Schema
-- Run once per VPS to initialize the centralized database.
-- Usage: psql $CLOUD_OPENCODE_POSTGRESQL_CNN -f oc-db-sync.sql

BEGIN;

-- ── Host identity (one per host machine) ──
CREATE TABLE IF NOT EXISTS hosts (
    host_id TEXT PRIMARY KEY,
    host_name TEXT,
    os TEXT,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_sync TIMESTAMPTZ
);

-- ── Projects ──
CREATE TABLE IF NOT EXISTS projects (
    host_id TEXT NOT NULL REFERENCES hosts(host_id),
    id TEXT NOT NULL,
    worktree TEXT,
    vcs TEXT,
    name TEXT,
    icon_url TEXT,
    icon_color TEXT,
    time_created BIGINT,
    time_updated BIGINT,
    time_initialized BIGINT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, id)
);

-- ── Sessions ──
CREATE TABLE IF NOT EXISTS sessions (
    host_id TEXT NOT NULL REFERENCES hosts(host_id),
    id TEXT NOT NULL,
    project_id TEXT,
    parent_id TEXT,
    slug TEXT,
    directory TEXT,
    title TEXT,
    version TEXT,
    share_url TEXT,
    summary_additions INT,
    summary_deletions INT,
    summary_files INT,
    summary_diffs TEXT,
    revert TEXT,
    permission TEXT,
    time_created BIGINT,
    time_updated BIGINT,
    time_compacting BIGINT,
    time_archived BIGINT,
    workspace_id TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, id)
);

-- ── Messages ──
CREATE TABLE IF NOT EXISTS messages (
    host_id TEXT NOT NULL REFERENCES hosts(host_id),
    id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    data JSONB NOT NULL,
    time_created BIGINT NOT NULL,
    time_updated BIGINT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, id)
);

-- ── Parts ──
CREATE TABLE IF NOT EXISTS parts (
    host_id TEXT NOT NULL REFERENCES hosts(host_id),
    id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    data JSONB NOT NULL,
    time_created BIGINT NOT NULL,
    time_updated BIGINT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, id)
);

-- ── Todos ──
CREATE TABLE IF NOT EXISTS todos (
    host_id TEXT NOT NULL REFERENCES hosts(host_id),
    session_id TEXT NOT NULL,
    position INT NOT NULL,
    content TEXT,
    status TEXT,
    priority TEXT,
    time_created BIGINT,
    time_updated BIGINT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, session_id, position)
);

-- ── User Feedback (for future /oc-feedback command) ──
CREATE TABLE IF NOT EXISTS user_feedback (
    host_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    rating TEXT CHECK (rating IN ('success', 'partial', 'failure')),
    notes TEXT,
    time_created TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (host_id, session_id)
);

-- ── Sync audit log ──
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    host_id TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    tables_synced TEXT[],
    rows_synced JSONB,
    duration_ms INT,
    status TEXT CHECK (status IN ('success', 'partial', 'error')),
    error_message TEXT
);

-- ── Indexes for analytical queries ──
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(host_id, project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(host_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON sessions(time_created DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(host_id, session_id);
CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time_created DESC);
CREATE INDEX IF NOT EXISTS idx_parts_message ON parts(host_id, message_id);
CREATE INDEX IF NOT EXISTS idx_parts_session ON parts(host_id, session_id);
CREATE INDEX IF NOT EXISTS idx_parts_type ON parts((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_parts_tool ON parts((data->>'tool')) WHERE data->>'type' = 'tool';
CREATE INDEX IF NOT EXISTS idx_parts_time ON parts(time_created DESC);
CREATE INDEX IF NOT EXISTS idx_todos_session ON todos(host_id, session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON user_feedback(host_id, session_id);

COMMIT;
