# Lean Delegation Plugin — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Replaces:** agent-hub-server.ts, agent-file-lock.ts
**Inspired by:** [opencode-workspace/background-agents.ts](https://github.com/kdcokenny/opencode-workspace/blob/main/src/plugin/background-agents.ts)

## Problem Statement

The current multi-agent coordination stack uses a Unix domain socket server (`agent-hub-server.ts`) and in-memory file locking (`agent-file-lock.ts`). This approach fails cross-process because each OpenCode process loads its own plugin instance with its own `Map<string, LockInfo>` — locks are never shared. The stress test with 30 agents demonstrated this failure conclusively.

## Decision

Replace both plugins with a single `background-agents.ts` plugin that uses the OpenCode SDK natively for agent delegation. File conflict detection remains the responsibility of `smart-edit-guard.ts` (optimistic concurrency, not pessimistic locking).

## Architecture

### Plugin Ecosystem (After)

| Plugin | Lines | Responsibility |
|--------|-------|----------------|
| `background-agents.ts` | ~400 | Delegation system + agent routing |
| `smart-edit-guard.ts` | ~192 | Edit validation (pre/post hooks) |
| `oc-db-sync.ts` | ~407 | SQLite → PostgreSQL sync |

### Deleted

- `agent-hub-server.ts` — Unix socket coordination server
- `agent-file-lock.ts` — In-memory file locking
- `~/.config/opencode/plugins/agent-hub-server/` — Hub control files
- `~/.config/opencode/test-file-lock/` — Stress test files

### Dependencies

No new npm dependencies. Uses only `@opencode-ai/plugin` (already installed).

## Tools

### `delegate`

```typescript
delegate({ prompt: string, agent: string }): string
```

- Creates an isolated child session via `client.session.create({ parentID })`
- Sends prompt to the specified agent via `client.session.prompt()`
- Returns immediately with a short ID (e.g., `"a3f8bc12"`)
- Agent executes asynchronously in the child session
- On completion (`session.idle` event), notifies parent via `noReply` prompt
- Disables recursive delegation in child: `tools: { delegate: false, task: false, todowrite: false }`

### `delegation_read`

```typescript
delegation_read({ id: string }): string
```

- Reads the result of a completed delegation
- If still running, waits up to remaining timeout
- Extracts the last assistant message text from the child session via `session.messages()`
- Returns the full text content

### `delegation_list`

```typescript
delegation_list(): string
```

- Lists all delegations visible to the current root session tree
- Shows: id, status, agent, title, unread flag
- In-memory only (no filesystem scan needed)

## Agent Routing

### Routing Table

| Agent Config | Route To | Reason |
|-------------|----------|--------|
| `mode: subagent` + `edit: deny` + `write: deny` | `delegate` | Read-only, safe for background |
| `mode: subagent` + any write permission enabled | `task` (native) | Needs undo/branching support |
| `mode: subagent` + `bash: allow` + `edit: deny` | `delegate` | Can read via bash but no file mutations |
| Not a subagent | `task` (native) | Main agent, full capabilities |

### Routing Guard

`tool.execute.before` hook intercepts the `task` tool. If the target agent is a read-only subagent, throws an error with guidance to use `delegate` instead. This teaches the model correct routing over time.

### Write Capability Detection

An agent is considered **read-only** when ALL of:
- `permission.edit` is `"deny"`
- `permission.write` is `"deny"`

Note: `bash: allow` does NOT make an agent write-capable for routing purposes. Bash is used for reading (grep, find, etc.) not for file mutations in research agents.

## State Management

### In-Memory State

```typescript
const delegations = new Map<string, DelegationRecord>()
const delegationsBySession = new Map<string, string>()

interface DelegationRecord {
  id: string                // crypto.randomUUID().slice(0,8)
  sessionID: string         // child session ID
  parentSessionID: string   // caller's session
  parentAgent: string       // caller's agent name
  agent: string             // delegated agent
  prompt: string            // original prompt (truncated for display)
  status: "running" | "complete" | "error" | "timeout"
  createdAt: Date
  completedAt?: Date
  title?: string            // first line of result, truncated
  error?: string
}
```

### Timeout

- Default: 15 minutes per delegation
- On timeout: marks delegation as `"timeout"`, attempts `session.abort()`
- Timeout timer via `setTimeout`, cleaned up on completion

### Persistence

No filesystem artifacts. Results persist in OpenCode's SQLite database as child session messages. `delegation_read` retrieves them via `session.messages()`. This means `oc-db-sync.ts` automatically syncs delegation results to PostgreSQL (child sessions are regular sessions).

## Plugin Hooks

### 1. `tool.execute.before`

Routing guard: intercepts `task` tool calls targeting read-only subagents. Throws error with guidance to use `delegate`.

### 2. `event` (session.idle)

Detects when a child session completes. Looks up the delegation by sessionID, marks as complete, extracts title from result, notifies parent.

### 3. `experimental.session.compacting`

Injects delegation context into compaction prompt:
- Running delegations: id, agent, status
- Recently completed delegations: id, agent, status, title
- Instructions for result retrieval

### 4. `experimental.chat.system.transform`

Injects delegation rules into the system prompt:
- Available tools (delegate, delegation_read, delegation_list)
- Routing rules (read-only → delegate, write-capable → task)
- Anti-polling instruction (wait for notifications)

## Notification Flow

1. Parent calls `delegate(prompt, agent)`
2. Plugin creates child session, sends prompt, returns ID to parent
3. Parent continues other work
4. Child session agent works, makes tool calls, produces result
5. Child session goes idle → `session.idle` event fires
6. Plugin extracts result title, marks delegation complete
7. Plugin sends `noReply` notification to parent session with summary
8. Parent reads full result via `delegation_read(id)` when ready

## Error Handling

| Error | Handling |
|-------|----------|
| Agent not found | Immediate error with list of available agents |
| Write-capable agent via delegate | Immediate error with guidance to use `task` |
| Session creation failure | Immediate error |
| Child session timeout | Mark as timeout, notify parent |
| Child session error | Mark as error, include error message in notification |
| delegation_read for unknown ID | Error with suggestion to use delegation_list |
| delegation_read while running | Wait until timeout, then return partial or timeout message |

## Testing Strategy

1. Manual: delegate a research task to `researcher-ghc-claude-haiku-4.5`, verify notification arrives
2. Manual: attempt to delegate to a write-capable agent, verify routing guard blocks
3. Manual: delegate multiple tasks, verify delegation_list shows all
4. Manual: let a delegation timeout, verify timeout notification
5. Verify oc-db-sync captures child sessions in PostgreSQL
