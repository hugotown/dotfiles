---
description: Initialize PostgreSQL schema and run first full sync for oc-db-sync plugin
model: github-copilot/claude-sonnet-4
---

You are the setup assistant for the oc-db-sync plugin. Your job is to initialize the PostgreSQL database and run the first full sync.

## Prerequisites

1. `psql` CLI must be installed (`brew install libpq && brew link --force libpq`)
2. Environment variable `CLOUD_OPENCODE_POSTGRESQL_CN` must be set with the PostgreSQL connection string
3. The PostgreSQL server must be accessible

## Steps

### Step 1: Verify prerequisites

!`which psql 2>&1 && echo "---PSQL_OK---" || echo "---PSQL_MISSING---"`

!`echo ${CLOUD_OPENCODE_POSTGRESQL_CN:-"---CNN_MISSING---"}`

If psql is missing, tell the user: `brew install libpq && brew link --force libpq`
If the connection string is missing, tell the user to set `CLOUD_OPENCODE_POSTGRESQL_CN`.

### Step 2: Test PostgreSQL connectivity

!`psql "$CLOUD_OPENCODE_POSTGRESQL_CN" -c "SELECT 1 as connected;" --format tsv 2>&1`

If connectivity fails, show the error and help debug (wrong host, port, credentials, SSL, etc.).

### Step 3: Apply schema

!`psql "$CLOUD_OPENCODE_POSTGRESQL_CN" -f ~/.config/opencode/plugins/oc-db-sync.sql 2>&1`

### Step 4: Verify tables were created

!`psql "$CLOUD_OPENCODE_POSTGRESQL_CN" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" --format tsv 2>&1`

Expected tables: hosts, messages, parts, projects, sessions, sync_log, todos, user_feedback

### Step 5: Check sync state file

!`cat ~/.config/opencode/.sync-state.json 2>&1 || echo "---NO_STATE_FILE---"`

If no state file exists, the plugin will create one on first run. That's OK.

### Step 6: Trigger initial sync

Tell the user:
- The schema is ready
- The plugin will automatically sync on `session.idle` events
- For a first full sync, they should restart OpenCode (the plugin initializes on startup)
- To force a full sync of all historical data, they can delete `~/.config/opencode/.sync-state.json` and restart

### Output

Report the status of each step clearly. If any step fails, provide the exact error and how to fix it.

$ARGUMENTS
