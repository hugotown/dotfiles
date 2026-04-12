import type { Plugin } from "@opencode-ai/plugin"

/**
 * oc-db-sync — Synchronizes local OpenCode SQLite database to a centralized
 * PostgreSQL instance for cross-host analytics and AI coaching.
 *
 * Trigger: session.idle event (after each session completes)
 * Transport: psql CLI via Bun shell ($)
 * Connection: CLOUD_OPENCODE_POSTGRESQL_CN environment variable
 *
 * Sync strategy:
 *  - Incremental: only rows with time_updated > last_sync
 *  - Idempotent: INSERT ON CONFLICT DO UPDATE (upsert)
 *  - Multi-host: each host has a deterministic host_id slug
 */

import { hostname, userInfo } from "os"

const STATE_FILE = `${process.env.HOME}/.config/opencode/.sync-state.json`
const PG_CNN_ENV = "CLOUD_OPENCODE_POSTGRESQL_CN"

interface SyncState {
  host_id: string
  host_name: string
  os: string
  last_sync: {
    project: number
    session: number
    message: number
    part: number
    todo: number
  }
}

// Tables synced in FK-dependency order
const SYNC_TABLES = ["project", "session", "message", "part", "todo"] as const
type SyncTable = (typeof SYNC_TABLES)[number]

/**
 * Generate a deterministic, human-readable host slug from OS info.
 * Format: {user}-{hostname}-{platform}
 * Example: hugoruiz-hugos-macbook-pro-darwin
 */
function generateHostId(): string {
  const user = userInfo().username ?? process.env.USER ?? "unknown"
  const host = hostname()
    .toLowerCase()
    .replace(/\.local$/, "")
    .replace(/[^a-z0-9-]/g, "-")
  const platform = process.platform

  return `${user}-${host}-${platform}`
}

function getDefaultState(): SyncState {
  return {
    host_id: generateHostId(),
    host_name: `${userInfo().username}@${hostname()}`,
    os: `${process.platform}/${require("os").arch()}`,
    last_sync: {
      project: 0,
      session: 0,
      message: 0,
      part: 0,
      todo: 0,
    },
  }
}

async function loadState(): Promise<SyncState> {
  try {
    const raw = await Bun.file(STATE_FILE).text()
    return JSON.parse(raw) as SyncState
  } catch {
    const state = getDefaultState()
    await saveState(state)
    return state
  }
}

async function saveState(state: SyncState): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2))
}

/** Escape a string for safe inclusion in a SQL literal (single-quote based). */
function pgEscape(value: string | null | undefined): string {
  if (value == null) return "NULL"
  // Double single quotes and wrap
  return `'${value.replace(/'/g, "''")}'`
}

/** Escape a value for JSONB — same as pgEscape but ensures valid JSON string. */
function pgEscapeJson(value: string | null | undefined): string {
  if (value == null) return "NULL"
  // Ensure it's valid JSON, then escape for SQL
  try {
    JSON.parse(value)
    return pgEscape(value)
  } catch {
    return pgEscape(value)
  }
}

function numOrNull(v: unknown): string {
  if (v == null || v === "") return "NULL"
  return String(v)
}

const OcDbSync: Plugin = async ({ client, $ }) => {
  const pgCnn = process.env[PG_CNN_ENV]

  if (!pgCnn) {
    await client.app.log({
      body: {
        service: "oc-db-sync",
        level: "warn",
        message: `${PG_CNN_ENV} not set — sync disabled. Set this env var to enable PostgreSQL sync.`,
      },
    })
    return {}
  }

  // Verify psql is available
  try {
    await $`which psql`.quiet()
  } catch {
    await client.app.log({
      body: {
        service: "oc-db-sync",
        level: "error",
        message:
          "psql not found. Install via: brew install libpq && brew link --force libpq",
      },
    })
    return {}
  }

  const state = await loadState()

  // ── Schema drift detection ──
  // If OpenCode updates its local SQLite schema, our sync will break.
  // Check that local tables match the columns we expect before enabling sync.
  const EXPECTED_COLUMNS: Record<string, string[]> = {
    project: ["id", "worktree", "vcs", "name", "icon_url", "icon_color", "time_created", "time_updated", "time_initialized"],
    session: ["id", "project_id", "parent_id", "slug", "directory", "title", "version", "share_url", "summary_additions", "summary_deletions", "summary_files", "summary_diffs", "revert", "permission", "time_created", "time_updated", "time_compacting", "time_archived", "workspace_id"],
    message: ["id", "session_id", "time_created", "time_updated", "data"],
    part: ["id", "message_id", "session_id", "time_created", "time_updated", "data"],
    todo: ["session_id", "position", "content", "status", "priority", "time_created", "time_updated"],
  }

  for (const [table, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
    try {
      const result = await $`opencode db "PRAGMA table_info(${table})" --format tsv`.quiet()
      const output = result.stdout.toString().trim()
      if (!output) continue

      const lines = output.split("\n")
      if (lines.length < 2) continue

      const headers = lines[0].split("\t")
      const nameIdx = headers.indexOf("name")
      if (nameIdx === -1) continue

      const actualCols = lines.slice(1).map((l) => l.split("\t")[nameIdx]).filter(Boolean)
      const missing = expectedCols.filter((c) => !actualCols.includes(c))
      const extra = actualCols.filter((c) => !expectedCols.includes(c))

      if (missing.length > 0 || extra.length > 0) {
        const drift = [
          missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
          extra.length > 0 ? `new: ${extra.join(", ")}` : "",
        ].filter(Boolean).join("; ")

        await client.app.log({
          body: {
            service: "oc-db-sync",
            level: "error",
            message: `Schema drift detected in '${table}' (${drift}). Sync DISABLED until schemas are reconciled. Run /oc-db-sync-setup to update.`,
          },
        })

        await client.tui.showToast({
          body: {
            message: `oc-db-sync: Local OpenCode DB schema differs from expected in '${table}' (${drift}). Sync DISABLED. Run /oc-db-sync-setup to update.`,
            variant: "error",
          },
        })

        return {} // No hooks — sync completely disabled
      }
    } catch (err: any) {
      await client.app.log({
        body: {
          service: "oc-db-sync",
          level: "warn",
          message: `Schema check failed for '${table}': ${err?.message ?? "unknown"}. Proceeding with sync.`,
        },
      })
    }
  }

  await client.app.log({
    body: {
      service: "oc-db-sync",
      level: "info",
      message: `Plugin loaded — host_id: ${state.host_id}, host: ${state.host_name}, os: ${state.os}`,
    },
  })

  /** Ensure the host record exists in PostgreSQL. */
  async function ensureHost(): Promise<void> {
    const sql = `INSERT INTO hosts (host_id, host_name, os, last_sync)
      VALUES (${pgEscape(state.host_id)}, ${pgEscape(state.host_name)}, ${pgEscape(state.os)}, NOW())
      ON CONFLICT (host_id) DO UPDATE SET host_name = EXCLUDED.host_name, os = EXCLUDED.os, last_sync = NOW();`

    await $`psql ${pgCnn} -c ${sql}`.quiet()
  }

  /** Query local SQLite via opencode db CLI, return parsed TSV rows. */
  async function queryLocal(sql: string): Promise<Record<string, string>[]> {
    const result = await $`opencode db ${sql} --format tsv`.quiet()
    const output = result.stdout.toString().trim()
    if (!output) return []

    const lines = output.split("\n")
    if (lines.length < 2) return [] // header only

    const headers = lines[0].split("\t")
    return lines.slice(1).map((line) => {
      const values = line.split("\t")
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = values[i] ?? ""
      })
      return row
    })
  }

  /** Sync a single table from SQLite to PostgreSQL. Returns row count. */
  async function syncTable(table: SyncTable): Promise<number> {
    const lastSync = state.last_sync[table]

    // Build SELECT query based on table
    let query: string
    let upsertFn: (rows: Record<string, string>[]) => string

    switch (table) {
      case "project":
        query = `SELECT id, worktree, vcs, name, icon_url, icon_color, time_created, time_updated, time_initialized FROM project WHERE time_updated > ${lastSync}`
        upsertFn = (rows) =>
          rows
            .map(
              (r) =>
                `INSERT INTO projects (host_id, id, worktree, vcs, name, icon_url, icon_color, time_created, time_updated, time_initialized)
            VALUES (${pgEscape(state.host_id)}, ${pgEscape(r.id)}, ${pgEscape(r.worktree)}, ${pgEscape(r.vcs)}, ${pgEscape(r.name)}, ${pgEscape(r.icon_url)}, ${pgEscape(r.icon_color)}, ${numOrNull(r.time_created)}, ${numOrNull(r.time_updated)}, ${numOrNull(r.time_initialized)})
            ON CONFLICT (host_id, id) DO UPDATE SET worktree=EXCLUDED.worktree, vcs=EXCLUDED.vcs, name=EXCLUDED.name, icon_url=EXCLUDED.icon_url, icon_color=EXCLUDED.icon_color, time_updated=EXCLUDED.time_updated, time_initialized=EXCLUDED.time_initialized, synced_at=NOW();`,
            )
            .join("\n")
        break

      case "session":
        query = `SELECT id, project_id, parent_id, slug, directory, title, version, share_url, summary_additions, summary_deletions, summary_files, summary_diffs, revert, permission, time_created, time_updated, time_compacting, time_archived, workspace_id FROM session WHERE time_updated > ${lastSync}`
        upsertFn = (rows) =>
          rows
            .map(
              (r) =>
                `INSERT INTO sessions (host_id, id, project_id, parent_id, slug, directory, title, version, share_url, summary_additions, summary_deletions, summary_files, summary_diffs, revert, permission, time_created, time_updated, time_compacting, time_archived, workspace_id)
            VALUES (${pgEscape(state.host_id)}, ${pgEscape(r.id)}, ${pgEscape(r.project_id)}, ${pgEscape(r.parent_id)}, ${pgEscape(r.slug)}, ${pgEscape(r.directory)}, ${pgEscape(r.title)}, ${pgEscape(r.version)}, ${pgEscape(r.share_url)}, ${numOrNull(r.summary_additions)}, ${numOrNull(r.summary_deletions)}, ${numOrNull(r.summary_files)}, ${pgEscape(r.summary_diffs)}, ${pgEscape(r.revert)}, ${pgEscape(r.permission)}, ${numOrNull(r.time_created)}, ${numOrNull(r.time_updated)}, ${numOrNull(r.time_compacting)}, ${numOrNull(r.time_archived)}, ${pgEscape(r.workspace_id)})
            ON CONFLICT (host_id, id) DO UPDATE SET title=EXCLUDED.title, summary_additions=EXCLUDED.summary_additions, summary_deletions=EXCLUDED.summary_deletions, summary_files=EXCLUDED.summary_files, summary_diffs=EXCLUDED.summary_diffs, time_updated=EXCLUDED.time_updated, time_compacting=EXCLUDED.time_compacting, time_archived=EXCLUDED.time_archived, synced_at=NOW();`,
            )
            .join("\n")
        break

      case "message":
        query = `SELECT id, session_id, time_created, time_updated, data FROM message WHERE time_updated > ${lastSync}`
        upsertFn = (rows) =>
          rows
            .map(
              (r) =>
                `INSERT INTO messages (host_id, id, session_id, data, time_created, time_updated)
            VALUES (${pgEscape(state.host_id)}, ${pgEscape(r.id)}, ${pgEscape(r.session_id)}, ${pgEscapeJson(r.data)}::jsonb, ${numOrNull(r.time_created)}, ${numOrNull(r.time_updated)})
            ON CONFLICT (host_id, id) DO UPDATE SET data=EXCLUDED.data, time_updated=EXCLUDED.time_updated, synced_at=NOW();`,
            )
            .join("\n")
        break

      case "part":
        query = `SELECT id, message_id, session_id, time_created, time_updated, data FROM part WHERE time_updated > ${lastSync}`
        upsertFn = (rows) =>
          rows
            .map(
              (r) =>
                `INSERT INTO parts (host_id, id, message_id, session_id, data, time_created, time_updated)
            VALUES (${pgEscape(state.host_id)}, ${pgEscape(r.id)}, ${pgEscape(r.message_id)}, ${pgEscape(r.session_id)}, ${pgEscapeJson(r.data)}::jsonb, ${numOrNull(r.time_created)}, ${numOrNull(r.time_updated)})
            ON CONFLICT (host_id, id) DO UPDATE SET data=EXCLUDED.data, time_updated=EXCLUDED.time_updated, synced_at=NOW();`,
            )
            .join("\n")
        break

      case "todo":
        query = `SELECT session_id, position, content, status, priority, time_created, time_updated FROM todo WHERE time_updated > ${lastSync}`
        upsertFn = (rows) =>
          rows
            .map(
              (r) =>
                `INSERT INTO todos (host_id, session_id, position, content, status, priority, time_created, time_updated)
            VALUES (${pgEscape(state.host_id)}, ${pgEscape(r.session_id)}, ${numOrNull(r.position)}, ${pgEscape(r.content)}, ${pgEscape(r.status)}, ${pgEscape(r.priority)}, ${numOrNull(r.time_created)}, ${numOrNull(r.time_updated)})
            ON CONFLICT (host_id, session_id, position) DO UPDATE SET content=EXCLUDED.content, status=EXCLUDED.status, priority=EXCLUDED.priority, time_updated=EXCLUDED.time_updated, synced_at=NOW();`,
            )
            .join("\n")
        break
    }

    const rows = await queryLocal(query)
    if (rows.length === 0) return 0

    // Batch in chunks of 50 to avoid psql command length limits
    const BATCH_SIZE = 50
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const sql = `BEGIN;\n${upsertFn(batch)}\nCOMMIT;`
      await $`psql ${pgCnn} -c ${sql}`.quiet()
    }

    return rows.length
  }

  /** Run full incremental sync across all tables. */
  async function runSync(): Promise<void> {
    const startTime = Date.now()
    const rowCounts: Record<string, number> = {}

    try {
      await ensureHost()

      for (const table of SYNC_TABLES) {
        const count = await syncTable(table)
        rowCounts[table] = count
      }

      // Update last_sync timestamps to now
      const now = Date.now()
      for (const table of SYNC_TABLES) {
        state.last_sync[table] = now
      }
      await saveState(state)

      const duration = Date.now() - startTime
      const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0)

      // Log sync result to PostgreSQL
      const logSql = `INSERT INTO sync_log (host_id, tables_synced, rows_synced, duration_ms, status)
        VALUES (${pgEscape(state.host_id)}, ARRAY[${SYNC_TABLES.map((t) => pgEscape(t)).join(",")}], ${pgEscape(JSON.stringify(rowCounts))}::jsonb, ${duration}, 'success');`
      await $`psql ${pgCnn} -c ${logSql}`.quiet()

      if (totalRows > 0) {
        await client.app.log({
          body: {
            service: "oc-db-sync",
            level: "info",
            message: `Sync complete: ${totalRows} rows in ${duration}ms (${JSON.stringify(rowCounts)})`,
          },
        })
      }
    } catch (err: any) {
      const duration = Date.now() - startTime

      await client.app.log({
        body: {
          service: "oc-db-sync",
          level: "error",
          message: `Sync failed after ${duration}ms: ${err?.message ?? "unknown error"}`,
        },
      })

      // Try to log failure to PostgreSQL (best effort)
      try {
        const logSql = `INSERT INTO sync_log (host_id, tables_synced, rows_synced, duration_ms, status, error_message)
          VALUES (${pgEscape(state.host_id)}, ARRAY[]::text[], '{}'::jsonb, ${duration}, 'error', ${pgEscape(String(err?.message ?? "unknown"))});`
        await $`psql ${pgCnn} -c ${logSql}`.quiet()
      } catch {
        // Best effort — if PG is down, just log locally
      }
    }
  }

  // Track if a sync is already in progress (debounce)
  let syncInProgress = false

  return {
    event: async ({ event }: any) => {
      // Trigger sync when a session becomes idle (work completed)
      if (event.type === "session.idle") {
        if (syncInProgress) return
        syncInProgress = true
        try {
          await runSync()
        } finally {
          syncInProgress = false
        }
      }
    },
  }
}

export default OcDbSync
export { OcDbSync }
