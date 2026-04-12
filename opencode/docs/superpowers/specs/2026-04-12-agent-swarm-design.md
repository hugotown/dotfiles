# Agent Swarm Plugin Design Spec

> Coordinated multi-agent work with bidirectional real-time communication.

## Problem

The existing `background-agents.ts` plugin provides fire-and-forget delegation to read-only subagents. It works for independent research tasks, but cannot:

- Coordinate multiple write-capable agents working in parallel on the same codebase
- Send new instructions to agents mid-task (redirect, scope changes)
- Relay findings from one agent to another
- Detect and resolve file conflicts between concurrent agents
- Provide real-time observability of agent progress

## Solution

A new plugin `agent-swarm.ts` implementing an Event-Driven Swarm with mailbox-based inter-turn messaging, abort-resume for urgent redirects, and optimistic file conflict detection.

## Architecture

### Component Overview

```
User (Hugo)
    │
    ▼
Orchestrator (LLM principal, main session)
    │ tools
    ▼
agent-swarm.ts (plugin)
    ├── Registry (agent tracking)
    ├── Mailbox (per-agent message queues)
    ├── Event Loop (completion handling + dispatch)
    └── File Claims (conflict detection)
    │
    │ session.prompt()
    ├────────────┬────────────┐
    ▼            ▼            ▼
Agent 1      Agent 2      Agent N
(child       (child       (child
 session)     session)     session)
```

### Core Data Structures

```typescript
interface SwarmAgent {
  id: string                   // short UUID (8 chars)
  sessionID: string            // OpenCode child session ID
  agent: string                // agent config name
  prompt: string               // original task prompt (truncated for display)
  status: "spawning" | "running" | "waiting" | "complete" | "error" | "aborted"
  mailbox: MailMessage[]       // pending messages for this agent
  createdAt: Date
  completedAt?: Date
  lastActivity?: Date          // updated on every completion event
  currentTurn: number          // prompt cycle count
  error?: string
  autoComplete: boolean        // if true, complete when turno finishes with empty mailbox
  scope?: string[]             // assigned file paths (workspace partitioning)
}

interface MailMessage {
  id: string
  from: string                 // "orchestrator" | agentId
  text: string
  priority: "normal" | "urgent"
  createdAt: Date
  delivered: boolean
}

interface SwarmState {
  id: string                   // swarm instance ID
  parentSessionID: string      // orchestrator's session
  parentAgent: string          // orchestrator's agent name
  agents: Map<string, SwarmAgent>
  agentsBySession: Map<string, string>  // sessionID → agentId
  fileClaims: Map<string, FileClaim[]>  // filePath → claims
  createdAt: Date
  status: "active" | "dissolved"
}

interface FileClaim {
  agentId: string
  filePath: string
  operation: "read" | "edit" | "write"
  timestamp: Date
}
```

## Tools

### swarm_spawn

```
swarm_spawn(agent: string, prompt: string, options?: { autoComplete?: boolean, scope?: string[] })
```

Creates an agent in the swarm. Returns immediately with agentId.

- Creates child session with `parentID` linking to orchestrator session
- Registers agent in Registry
- Launches `session.prompt()` fire-and-forget with `.then()` for completion signal
- Injects workspace scope into agent's prompt if provided
- Default timeout: 15 minutes per turn
- `autoComplete` default: `true`

### swarm_message

```
swarm_message(agentId: string, text: string, priority?: "normal" | "urgent")
```

Enqueues a message in the agent's mailbox.

- `priority: "normal"` (default) — delivered when agent finishes current turn (wait-inject)
- `priority: "urgent"` — immediate abort + resume with accumulated context + new message
- If agent is "waiting" or "complete", dispatches immediately
- Returns confirmation with mailbox state

### swarm_peek

```
swarm_peek(agentId: string)
```

Reads current state of an agent without blocking.

- Calls `session.messages()` on child session
- Returns: last assistant message text, running tool calls, status, mailbox size
- Read-only, does not affect the agent

### swarm_broadcast

```
swarm_broadcast(text: string, filter?: { status?: string, agent?: string })
```

Sends the same message to all (or filtered subset of) agents.

- Internally calls `swarm_message()` for each matching agent
- Returns count of agents that received the message

### swarm_status

```
swarm_status()
```

Overview of the entire swarm.

- Lists all agents with: id, agent name, status, current turn, active time, mailbox size, last activity
- Agents grouped by status
- File conflict summary if any

### swarm_kill

```
swarm_kill(agentId: string, reason?: string)
```

Aborts an agent and removes it from the swarm.

- `session.abort()` on the child session
- Marks as "aborted"
- Clears mailbox
- Notifies orchestrator

### swarm_dissolve

```
swarm_dissolve()
```

Terminates the entire swarm.

- Aborts all "running" agents
- Marks swarm as "dissolved"
- Cleanup of all state

## Completion Signal

**Canonical signal: `session.prompt().then()`**

Each agent is launched with:
```typescript
client.session.prompt({ ... })
  .then(() => handleAgentTurnComplete(agentId))
  .catch((err) => handleAgentError(agentId, err))
```

`session.idle` events are NOT used — they fire prematurely between tool calls (lesson learned from background-agents.ts).

### Turn completion flow

```
Agent finishes turn
    │
    ▼
session.prompt().then()
    │
    ▼
handleAgentTurnComplete(agentId)
    │
    ├── mailbox has messages?
    │     YES → dispatch next message as new session.prompt()
    │            agent.status = "running"
    │            agent.currentTurn++
    │            register new .then() / .catch()
    │
    └── mailbox empty?
            │
            ├── autoComplete = true?
            │     YES → agent.status = "complete"
            │            notifyOrchestrator(complete)
            │
            └── autoComplete = false?
                    agent.status = "waiting"
                    notifyOrchestrator(waiting)
```

## Abort-Resume Protocol

When orchestrator sends `swarm_message(agentId, text, "urgent")`:

```
1. session.abort(sessionID)
2. Poll session status until "idle" (max 3s, 100ms intervals)
3. Build resume context:
   - Read all messages from child session
   - Extract: original task, work completed so far
   - Append new instruction
4. session.prompt() with resume prompt
5. Register new .then() / .catch()
```

### Resume prompt template

```
You were working on a task and were interrupted to receive new instructions.

## Original Task
{originalPrompt}

## Work Completed So Far
{summaryOfCompletedWork}

## New Instruction (PRIORITY)
{urgentMessage}

Continue your work incorporating the new instruction. Do not repeat
work already done. If the new instruction conflicts with previous
work, the new instruction takes precedence.
```

Work summary is generated from `session.messages()` — extracting text parts from all assistant messages, truncated to ~2000 chars.

## Notification System

### Notification format

```xml
<swarm-event>
  <agent-id>{id}</agent-id>
  <agent>{agentName}</agent>
  <event>{complete|waiting|error|timeout|conflict|aborted}</event>
  <turn>{turnNumber}</turn>
  <summary>{first 100 chars of last response}</summary>
  <pending-mailbox>{count}</pending-mailbox>
  <action>{suggested next action}</action>
</swarm-event>
```

### Events that notify orchestrator

| Event | Trigger |
|-------|---------|
| Agent completed turn (empty mailbox) | `session.prompt().then()` + empty mailbox |
| Agent error | `.catch()` from session.prompt |
| Agent timeout | setTimeout expired |
| Agent aborted + resumed | Post abort-resume |
| File conflict detected | Two agents edited same file |

### Events that do NOT notify (to avoid noise)

- Individual tool calls
- Partial progress updates
- Mailbox enqueue confirmations

### Delivery mechanism

`session.prompt({ noReply: true })` to the orchestrator's session. The orchestrator sees it in their next turn.

## File Safety (3 layers)

### Layer 1: smart-edit-guard.ts (existing)

Validates that `oldString` exists in the file before applying edit. Detects stale edits when the file changed since the agent last read it.

### Layer 2: File claim registry (new, inside agent-swarm.ts)

Tracks which files each agent touches via `tool.execute.after` hook:

- When an agent completes an edit/write, the file path is registered as a claim
- If two agents have claims on the same file, a `conflict` swarm-event is sent to the orchestrator
- The orchestrator decides: abort one agent, have one agent merge, or ignore

### Layer 3: Workspace partitioning (system prompt)

When spawning an agent with `scope`, the plugin injects:

```
You are part of an agent swarm. Other agents are working in parallel.
Your workspace scope: {assignedPaths}
Do NOT edit files outside your scope unless explicitly instructed.
```

Soft boundary — depends on agent compliance. Combined with Layer 2 conflict detection for enforcement.

### Why no hard file locks

Hard locks with 10+ agents cause deadlocks. Optimistic concurrency (detect + notify + resolve) scales better and avoids the cross-process sharing problem that killed the original `agent-file-lock.ts`.

## Coexistence with background-agents.ts

### Scope boundary

| | background-agents.ts | agent-swarm.ts |
|---|---|---|
| Pattern | Fire-and-forget delegation | Coordinated multi-agent work |
| Communication | Unidirectional | Bidirectional |
| Agents | Read-only only (edit: deny) | Any subagent |
| Concurrency | Independent | Coordinated with file claims |
| Lifetime | Per-delegation (single turn) | Per-swarm (multi-turn, ephemeral) |
| Notification tag | `<task-notification>` | `<swarm-event>` |

### Routing guard integration

`background-agents.ts` routing guard must check if an agent is part of an active swarm before blocking:

```typescript
// agent-swarm.ts exports
export function isAgentInSwarm(sessionID: string): boolean

// background-agents.ts checks in routing guard
if (isAgentInSwarm(sessionID)) return // let swarm handle it
```

### System prompt guidance

```
## Agent coordination

Two systems available:

**delegate** — For independent read-only research tasks.
  Use when: you need an answer, not collaboration.

**swarm** — For coordinated multi-agent work with communication.
  Use when: agents need to share context, receive redirects,
  or work on the same codebase in parallel.
```

### Shared patterns (not shared code)

Both plugins use the same primitives:
- `session.prompt().then()` for completion
- `session.prompt({ noReply: true })` for notifications
- `session.messages()` for reading results
- Short UUID generation, title extraction, timeout management

These are ~10 lines of helpers duplicated across both plugins. No shared module — premature abstraction with 2 consumers is worse than duplication.

## Compaction Hook

When session compacts, inject swarm state:

```
## Active Swarm (id: {swarmId})

### Running agents
- {id} [{status}] agent={name} turn={n} mailbox={n} since {timestamp}

### Completed agents
- {id} [complete] agent={name} turns={n}

### File conflicts (if any)
- {filePath}: claimed by {agent1}, {agent2}

### Pending notifications
- {count} events waiting for orchestrator attention

Use swarm_status() for full details. Use swarm_peek(id) to read agent output.
```

## Constraints

- Zero new npm dependencies (only `@opencode-ai/plugin` already installed)
- Single file: `~/.config/opencode/plugins/agent-swarm.ts`
- Estimated size: 600-800 LOC
- State is in-memory per OpenCode process (no persistence across restarts)
- Max terminal agents eviction: same pattern as background-agents (50 max)

## Non-goals

- Cross-process swarm coordination (would need external state store)
- Persistent swarm state across OpenCode restarts
- Agent-to-agent direct communication (always via orchestrator)
- Real-time streaming of agent tool calls to orchestrator (use swarm_peek for on-demand)
