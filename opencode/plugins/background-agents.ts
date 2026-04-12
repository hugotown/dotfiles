import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

// ── Types ──

interface DelegationRecord {
  id: string
  sessionID: string
  parentSessionID: string
  parentAgent: string
  agent: string
  prompt: string
  status: "running" | "complete" | "error" | "timeout"
  createdAt: Date
  completedAt?: Date
  title?: string
  error?: string
}

// ── State (in-memory, per OpenCode process) ──

const delegations = new Map<string, DelegationRecord>()
const delegationsBySession = new Map<string, string>()
const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>()

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const MAX_TERMINAL_DELEGATIONS = 50

// ── Helpers ──

function generateId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function isTerminal(status: DelegationRecord["status"]): boolean {
  return status === "complete" || status === "error" || status === "timeout"
}

/**
 * Extract a short title from result text (first non-empty line, truncated).
 */
function extractTitle(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) || "Delegation result"
  return line.slice(0, 50).trim() + (line.length > 50 ? "..." : "")
}

/**
 * Determine if an agent is read-only based on its permissions config.
 * Read-only = edit: deny. OpenCode's permission model has: edit, bash, webfetch, task.
 * There is NO "write" permission — edit controls file mutation.
 */
async function isAgentReadOnly(
  client: any,
  agentName: string,
): Promise<boolean> {
  try {
    const config = await client.config.get()
    const agentConfig = config.data?.agent?.[agentName]
    if (!agentConfig?.permission) return false

    const p = agentConfig.permission
    const editDenied = p.edit === "deny" || (typeof p.edit === "object" && p.edit["*"] === "deny")

    return editDenied
  } catch {
    return false
  }
}

/**
 * Check if an agent is a subagent by mode.
 */
async function isSubAgent(client: any, agentName: string): Promise<boolean> {
  try {
    const result = await client.app.agents({})
    const agents = (result.data ?? []) as { name: string; mode?: string }[]
    const agent = agents.find((a: any) => a.name === agentName)
    return agent?.mode === "subagent"
  } catch {
    return false
  }
}

/**
 * Finalize a delegation: mark terminal, extract title, notify parent.
 */
async function finalizeDelegation(
  client: any,
  id: string,
  status: "complete" | "error" | "timeout",
  errorMsg?: string,
): Promise<void> {
  const delegation = delegations.get(id)
  if (!delegation || isTerminal(delegation.status)) return

  delegation.status = status
  delegation.completedAt = new Date()
  if (errorMsg) delegation.error = errorMsg

  // Clear timeout timer
  const timer = timeoutTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    timeoutTimers.delete(id)
  }

  // Extract title from result
  try {
    const messages = await client.session.messages({ path: { id: delegation.sessionID } })
    const msgData = messages.data as { info: { role: string }; parts: { type: string; text?: string }[] }[] | undefined
    const assistantMsgs = msgData?.filter((m: any) => m.info.role === "assistant") ?? []
    const lastMsg = assistantMsgs[assistantMsgs.length - 1]
    const textParts = lastMsg?.parts?.filter((p: any) => p.type === "text") ?? []
    const resultText = textParts.map((p: any) => p.text).join("\n")
    if (resultText) delegation.title = extractTitle(resultText)
  } catch {
    // Title extraction is best-effort
  }

  // Notify parent
  try {
    const notification = [
      "<task-notification>",
      `<task-id>${delegation.id}</task-id>`,
      `<status>${delegation.status}</status>`,
      delegation.title ? `<title>${delegation.title}</title>` : "",
      delegation.error ? `<error>${delegation.error}</error>` : "",
      `<retrieval>Use delegation_read("${delegation.id}") for full output.</retrieval>`,
      "</task-notification>",
    ].filter(Boolean).join("\n")

    await client.session.prompt({
      path: { id: delegation.parentSessionID },
      body: {
        noReply: true,
        agent: delegation.parentAgent,
        parts: [{ type: "text", text: notification }],
      },
    })
  } catch {
    // Notification is best-effort
  }

  // Evict oldest terminal delegations to prevent unbounded Map growth
  const terminalEntries = Array.from(delegations.entries())
    .filter(([, d]) => isTerminal(d.status))
  if (terminalEntries.length > MAX_TERMINAL_DELEGATIONS) {
    terminalEntries
      .sort(([, a], [, b]) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0))
      .slice(0, terminalEntries.length - MAX_TERMINAL_DELEGATIONS)
      .forEach(([key, d]) => {
        delegations.delete(key)
        delegationsBySession.delete(d.sessionID)
      })
  }
}

// ── Plugin ──

const BackgroundAgents: Plugin = async ({ client }) => {
  const log = (level: string, msg: string) =>
    client.app.log({ body: { service: "background-agents", level, message: msg } }).catch(() => {})

  await log("info", "background-agents plugin loaded")

  return {
    tool: {
      delegate: tool({
        description: `Delegate a task to a background agent. Returns immediately with an ID.
Use for research, analysis, or any read-only task that can run in parallel.
You WILL receive a <task-notification> when complete. Do NOT poll.
Use delegation_read(id) to retrieve the full result.`,
        args: {
          prompt: tool.schema.string().describe("Detailed prompt for the agent. Must be in English."),
          agent: tool.schema.string().describe("Agent name to delegate to (must be a read-only subagent)."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID || !ctx?.messageID) {
            return "Error: delegate requires session context."
          }

          // Validate agent exists
          const agentsResult = await client.app.agents({})
          const agents = (agentsResult.data ?? []) as { name: string; mode?: string; description?: string }[]
          const targetAgent = agents.find((a: any) => a.name === args.agent)

          if (!targetAgent) {
            const available = agents
              .filter((a: any) => a.mode === "subagent")
              .map((a: any) => `- ${a.name}${a.description ? `: ${a.description}` : ""}`)
              .join("\n")
            return `Error: Agent "${args.agent}" not found.\n\nAvailable subagents:\n${available || "(none)"}`
          }

          // Validate agent is read-only
          const readOnly = await isAgentReadOnly(client, args.agent)
          if (!readOnly) {
            return `Error: Agent "${args.agent}" is write-capable. Use the native task tool instead.\ndelegate is for read-only subagents (edit denied).`
          }

          // Create child session
          const session = await client.session.create({
            body: {
              title: `Delegation: ${args.agent}`,
              parentID: ctx.sessionID,
            },
          })

          if (!session.data?.id) {
            return "Error: Failed to create delegation session."
          }

          // Register delegation
          const id = generateId()
          const delegation: DelegationRecord = {
            id,
            sessionID: session.data.id,
            parentSessionID: ctx.sessionID,
            parentAgent: ctx.agent,
            agent: args.agent,
            prompt: args.prompt.slice(0, 200),
            status: "running",
            createdAt: new Date(),
          }

          delegations.set(id, delegation)
          delegationsBySession.set(session.data.id, id)

          // Schedule timeout
          const timer = setTimeout(() => {
            void finalizeDelegation(client, id, "timeout", `Timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`)
          }, DEFAULT_TIMEOUT_MS)
          timeoutTimers.set(id, timer)

          // Fire prompt (async, don't await — finalize on resolution)
          // session.prompt() is blocking: it resolves when the agent finishes
          // all tool calls and produces its final response. This is the
          // canonical completion signal, not session.idle events.
          client.session.prompt({
            path: { id: session.data.id },
            body: {
              agent: args.agent,
              parts: [{ type: "text", text: args.prompt }],
              tools: { delegate: false, task: false, todowrite: false },
            },
          }).then(() => {
            void finalizeDelegation(client, id, "complete")
          }).catch((err: Error) => {
            void finalizeDelegation(client, id, "error", err.message)
          })

          await log("info", `Delegated to ${args.agent}: ${id} (session: ${session.data.id})`)

          return `Delegation started: ${id}\nAgent: ${args.agent}\nYou will be notified when complete. Do NOT poll.`
        },
      }),

      delegation_read: tool({
        description: `Read the output of a completed delegation by ID.
If the delegation is still running, waits for completion.
Use this after receiving a <task-notification>.`,
        args: {
          id: tool.schema.string().describe("The delegation ID (e.g., 'a3f8bc12')"),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID) return "Error: delegation_read requires session context."

          const delegation = delegations.get(args.id)
          if (!delegation) {
            return `Error: Delegation "${args.id}" not found.\nUse delegation_list() to see available delegations.`
          }

          // If still running, wait for completion
          if (!isTerminal(delegation.status)) {
            const remainingMs = Math.max(
              DEFAULT_TIMEOUT_MS - (Date.now() - delegation.createdAt.getTime()),
              5000,
            )
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (isTerminal(delegation.status)) {
                  clearInterval(check)
                  resolve()
                }
              }, 500)
              setTimeout(() => {
                clearInterval(check)
                resolve()
              }, remainingMs)
            })
          }

          // Re-check after wait: if still not terminal, report it
          if (!isTerminal(delegation.status)) {
            return `Delegation "${delegation.id}" is still running after waiting. You will be notified via <task-notification> when it completes.`
          }

          // Read result from child session
          if (delegation.status === "error") {
            return `Delegation "${delegation.id}" failed: ${delegation.error || "Unknown error"}`
          }

          if (delegation.status === "timeout") {
            return `Delegation "${delegation.id}" timed out after ${DEFAULT_TIMEOUT_MS / 1000}s.`
          }

          try {
            const messages = await client.session.messages({ path: { id: delegation.sessionID } })
            const msgData = messages.data as { info: { role: string }; parts: { type: string; text?: string }[] }[] | undefined
            const assistantMsgs = msgData?.filter((m: any) => m.info.role === "assistant") ?? []
            const lastMsg = assistantMsgs[assistantMsgs.length - 1]
            const textParts = lastMsg?.parts?.filter((p: any) => p.type === "text") ?? []
            const result = textParts.map((p: any) => p.text).join("\n")

            return result || `Delegation "${delegation.id}" completed but produced no text output.`
          } catch (err: any) {
            return `Error reading delegation result: ${err?.message ?? "unknown"}`
          }
        },
      }),

      delegation_list: tool({
        description: `List all delegations for the current session tree.
Shows running and completed delegations with their status.`,
        args: {},
        async execute(_args, ctx) {
          if (!ctx?.sessionID) return "Error: delegation_list requires session context."

          if (delegations.size === 0) {
            return "No delegations found."
          }

          const lines = Array.from(delegations.values()).map((d) => {
            const unread = d.status !== "running" && !d.title ? " [unread]" : ""
            return `- **${d.id}** [${d.status}] agent=${d.agent}${d.title ? ` | ${d.title}` : ""}${unread}`
          })

          return `## Delegations\n\n${lines.join("\n")}`
        },
      }),
    },

    // Routing guard: redirect read-only subagents from task to delegate
    "tool.execute.before": async (input: any, output: any) => {
      // Only intercept task tool
      if (input.tool !== "task") return

      // If the calling session is a swarm agent, skip routing guard.
      // The swarm plugin manages its own agent orchestration.
      const swarmBridge = (globalThis as any).__agentSwarm
      if (swarmBridge?.isAgentInSwarm?.(input.sessionID)) return

      const agentName = output.args?.subagent_type
      if (!agentName) return

      // Check if agent is a subagent
      const isSub = await isSubAgent(client, agentName)
      if (!isSub) return

      // Check if read-only
      const readOnly = await isAgentReadOnly(client, agentName)
      if (!readOnly) return

      // Read-only subagent via task → redirect to delegate
      throw new Error(
        `Agent "${agentName}" is read-only and should use the delegate tool for async background execution.\n` +
        `Read-only agents (edit denied) → delegate\n` +
        `Write-capable agents → task`,
      )
    },

    // System prompt injection
    "experimental.chat.system.transform": async (_input: any, output: any) => {
      output.system.push(`<delegation-system>
You have tools for parallel background work:
- delegate(prompt, agent) — Launch a task to a read-only subagent, returns ID immediately
- delegation_read(id) — Retrieve completed result
- delegation_list() — List delegations (use sparingly)

Routing rules:
- Read-only subagents (edit denied) → delegate
- Write-capable subagents → task (native)

You WILL be notified via <task-notification> when delegations complete. Do NOT poll delegation_list.
</delegation-system>`)
    },

    // Compaction hook
    "experimental.session.compacting": async (input: any, output: any) => {
      const running = Array.from(delegations.values()).filter((d) => d.status === "running")
      const completed = Array.from(delegations.values()).filter((d) => isTerminal(d.status))

      if (running.length === 0 && completed.length === 0) return

      const lines = ["## Active Delegations"]

      if (running.length > 0) {
        lines.push("")
        for (const d of running) {
          lines.push(`- **${d.id}** [running] agent=${d.agent} since ${d.createdAt.toISOString()}`)
        }
        lines.push("")
        lines.push("> You will be notified via <task-notification> when these complete.")
      }

      if (completed.length > 0) {
        lines.push("")
        lines.push("## Completed Delegations")
        lines.push("")
        for (const d of completed.slice(-10)) {
          lines.push(`- **${d.id}** [${d.status}] agent=${d.agent}${d.title ? ` | ${d.title}` : ""}`)
        }
        lines.push("")
        lines.push('Use delegation_read("id") to retrieve full output.')
      }

      output.context.push(lines.join("\n"))
    },
  }
}

export default BackgroundAgents
export { BackgroundAgents }
