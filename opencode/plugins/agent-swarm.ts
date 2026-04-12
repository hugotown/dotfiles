import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

// ── Types ──

interface MailMessage {
  id: string
  from: string // "orchestrator" | agentId
  text: string
  priority: "normal" | "urgent"
  createdAt: Date
  delivered: boolean
}

interface FileClaim {
  agentId: string
  filePath: string
  operation: "read" | "edit" | "write"
  timestamp: Date
}

interface SwarmAgent {
  id: string
  sessionID: string
  agent: string
  prompt: string
  status: "spawning" | "running" | "waiting" | "complete" | "error" | "aborted"
  mailbox: MailMessage[]
  createdAt: Date
  completedAt?: Date
  lastActivity?: Date
  currentTurn: number
  error?: string
  autoComplete: boolean
  scope?: string[]
}

interface SwarmState {
  id: string
  parentSessionID: string
  parentAgent: string
  agents: Map<string, SwarmAgent>
  agentsBySession: Map<string, string>
  fileClaims: Map<string, FileClaim[]>
  createdAt: Date
  status: "active" | "dissolved"
}

// ── State ──

let swarm: SwarmState | null = null
const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>()

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes per turn
const MAX_TERMINAL_AGENTS = 50
const ABORT_POLL_INTERVAL_MS = 100
const ABORT_POLL_MAX_MS = 3000
const RESUME_CONTEXT_MAX_CHARS = 2000

// ── Helpers ──

function generateId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function isTerminal(status: SwarmAgent["status"]): boolean {
  return status === "complete" || status === "error" || status === "aborted"
}

function extractSummary(text: string, maxLen = 100): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) || ""
  return line.slice(0, maxLen).trim() + (line.length > maxLen ? "..." : "")
}

function ensureSwarm(ctx: any): SwarmState {
  if (!swarm || swarm.status === "dissolved") {
    swarm = {
      id: generateId(),
      parentSessionID: ctx.sessionID,
      parentAgent: ctx.agent,
      agents: new Map(),
      agentsBySession: new Map(),
      fileClaims: new Map(),
      createdAt: new Date(),
      status: "active",
    }
  }
  return swarm
}

function getAgent(agentId: string): SwarmAgent | undefined {
  return swarm?.agents.get(agentId)
}

/** Check if a session belongs to an active swarm agent. */
function isAgentInSwarm(sessionID: string): boolean {
  if (!swarm || swarm.status !== "active") return false
  return swarm.agentsBySession.has(sessionID)
}

// Expose to other plugins via globalThis (plugins can't import each other)
;(globalThis as any).__agentSwarm = { isAgentInSwarm }

function evictTerminalAgents(): void {
  if (!swarm) return
  const terminal = Array.from(swarm.agents.entries()).filter(([, a]) => isTerminal(a.status))
  if (terminal.length > MAX_TERMINAL_AGENTS) {
    terminal
      .sort(([, a], [, b]) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0))
      .slice(0, terminal.length - MAX_TERMINAL_AGENTS)
      .forEach(([key, a]) => {
        swarm!.agents.delete(key)
        swarm!.agentsBySession.delete(a.sessionID)
      })
  }
}

// ── Plugin ──

const AgentSwarm: Plugin = async ({ client }) => {
  const log = (level: string, msg: string) =>
    client.app.log({ body: { service: "agent-swarm", level, message: msg } }).catch(() => {})

  await log("info", "agent-swarm plugin loaded")

  // ── Notification helpers ──

  async function notifyOrchestrator(
    event: string,
    agent: SwarmAgent,
    extra?: Record<string, string>,
  ): Promise<void> {
    if (!swarm) return
    const summary = await getAgentLastText(agent.sessionID)
    const lines = [
      "<swarm-event>",
      `<agent-id>${agent.id}</agent-id>`,
      `<agent>${agent.agent}</agent>`,
      `<event>${event}</event>`,
      `<turn>${agent.currentTurn}</turn>`,
      summary ? `<summary>${extractSummary(summary)}</summary>` : "",
      `<pending-mailbox>${agent.mailbox.filter((m) => !m.delivered).length}</pending-mailbox>`,
      ...Object.entries(extra ?? {}).map(([k, v]) => `<${k}>${v}</${k}>`),
      `<action>Use swarm_peek("${agent.id}") for full output, or swarm_message("${agent.id}", "...") to give new instructions.</action>`,
      "</swarm-event>",
    ].filter(Boolean).join("\n")

    try {
      await client.session.prompt({
        path: { id: swarm.parentSessionID },
        body: {
          noReply: true,
          agent: swarm.parentAgent,
          parts: [{ type: "text", text: lines }],
        },
      })
    } catch {
      // Notification is best-effort
    }
  }

  async function getAgentLastText(sessionID: string): Promise<string> {
    try {
      const messages = await client.session.messages({ path: { id: sessionID } })
      const msgData = messages.data as { info: { role: string }; parts: { type: string; text?: string }[] }[] | undefined
      const assistantMsgs = msgData?.filter((m: any) => m.info.role === "assistant") ?? []
      const lastMsg = assistantMsgs[assistantMsgs.length - 1]
      const textParts = lastMsg?.parts?.filter((p: any) => p.type === "text") ?? []
      return textParts.map((p: any) => p.text).join("\n")
    } catch {
      return ""
    }
  }

  async function getAgentWorkSummary(sessionID: string): Promise<string> {
    try {
      const messages = await client.session.messages({ path: { id: sessionID } })
      const msgData = messages.data as { info: { role: string }; parts: { type: string; text?: string }[] }[] | undefined
      const assistantMsgs = msgData?.filter((m: any) => m.info.role === "assistant") ?? []
      const texts = assistantMsgs
        .flatMap((m: any) => m.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text) ?? [])
        .join("\n\n")
      if (texts.length <= RESUME_CONTEXT_MAX_CHARS) return texts
      return texts.slice(0, RESUME_CONTEXT_MAX_CHARS) + "\n... [truncated]"
    } catch {
      return "(unable to retrieve work summary)"
    }
  }

  // ── Turn lifecycle ──

  function clearAgentTimeout(agentId: string): void {
    const timer = timeoutTimers.get(agentId)
    if (timer) {
      clearTimeout(timer)
      timeoutTimers.delete(agentId)
    }
  }

  function setAgentTimeout(agentId: string): void {
    clearAgentTimeout(agentId)
    const timer = setTimeout(() => {
      const agent = getAgent(agentId)
      if (!agent || isTerminal(agent.status)) return
      agent.status = "error"
      agent.error = `Turn timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`
      agent.completedAt = new Date()
      void notifyOrchestrator("timeout", agent)
      void log("warn", `Agent ${agentId} timed out`)
    }, DEFAULT_TIMEOUT_MS)
    timeoutTimers.set(agentId, timer)
  }

  async function dispatchMailbox(agentId: string): Promise<void> {
    const agent = getAgent(agentId)
    if (!agent || isTerminal(agent.status)) return

    const pending = agent.mailbox.find((m) => !m.delivered)
    if (!pending) return

    pending.delivered = true
    agent.status = "running"
    agent.currentTurn++
    agent.lastActivity = new Date()

    const prompt = pending.from === "orchestrator"
      ? pending.text
      : `Message from agent ${pending.from}:\n\n${pending.text}`

    setAgentTimeout(agentId)

    client.session.prompt({
      path: { id: agent.sessionID },
      body: {
        agent: agent.agent,
        parts: [{ type: "text", text: prompt }],
      },
    }).then(() => {
      void handleAgentTurnComplete(agentId)
    }).catch((err: Error) => {
      void handleAgentError(agentId, err)
    })
  }

  async function handleAgentTurnComplete(agentId: string): Promise<void> {
    const agent = getAgent(agentId)
    if (!agent || isTerminal(agent.status)) return

    clearAgentTimeout(agentId)
    agent.lastActivity = new Date()

    // Check mailbox for pending messages
    const pending = agent.mailbox.find((m) => !m.delivered)
    if (pending) {
      await dispatchMailbox(agentId)
      return
    }

    // No pending messages
    if (agent.autoComplete) {
      agent.status = "complete"
      agent.completedAt = new Date()
      await notifyOrchestrator("complete", agent)
      await log("info", `Agent ${agentId} completed (turn ${agent.currentTurn})`)
    } else {
      agent.status = "waiting"
      await notifyOrchestrator("waiting", agent)
      await log("info", `Agent ${agentId} waiting for instructions (turn ${agent.currentTurn})`)
    }

    evictTerminalAgents()
  }

  async function handleAgentError(agentId: string, err: Error): Promise<void> {
    const agent = getAgent(agentId)
    if (!agent || isTerminal(agent.status)) return

    clearAgentTimeout(agentId)
    agent.status = "error"
    agent.error = err.message
    agent.completedAt = new Date()
    agent.lastActivity = new Date()

    await notifyOrchestrator("error", agent, { error: err.message })
    await log("error", `Agent ${agentId} error: ${err.message}`)

    evictTerminalAgents()
  }

  // ── Abort-Resume ──

  async function abortAndResume(agentId: string, urgentText: string): Promise<string> {
    const agent = getAgent(agentId)
    if (!agent) return `Error: Agent "${agentId}" not found.`
    if (isTerminal(agent.status)) return `Error: Agent "${agentId}" is ${agent.status}, cannot abort.`

    // 1. Abort
    try {
      await client.session.abort({ path: { id: agent.sessionID } })
    } catch {
      // May already be idle
    }

    // 2. Poll until idle
    const start = Date.now()
    while (Date.now() - start < ABORT_POLL_MAX_MS) {
      try {
        const session = await client.session.get({ path: { id: agent.sessionID } })
        const sessionData = session.data as any
        if (!sessionData?.status || sessionData.status === "idle" || sessionData.status?.type === "idle") break
      } catch {
        break
      }
      await new Promise((r) => setTimeout(r, ABORT_POLL_INTERVAL_MS))
    }

    // 3. Build resume context
    const workSummary = await getAgentWorkSummary(agent.sessionID)
    const resumePrompt = [
      "You were working on a task and were interrupted to receive new instructions.",
      "",
      "## Original Task",
      agent.prompt,
      "",
      "## Work Completed So Far",
      workSummary,
      "",
      "## New Instruction (PRIORITY)",
      urgentText,
      "",
      "Continue your work incorporating the new instruction. Do not repeat work already done.",
      "If the new instruction conflicts with previous work, the new instruction takes precedence.",
    ].join("\n")

    // 4. Re-prompt
    clearAgentTimeout(agentId)
    agent.status = "running"
    agent.currentTurn++
    agent.lastActivity = new Date()

    setAgentTimeout(agentId)

    client.session.prompt({
      path: { id: agent.sessionID },
      body: {
        agent: agent.agent,
        parts: [{ type: "text", text: resumePrompt }],
      },
    }).then(() => {
      void handleAgentTurnComplete(agentId)
    }).catch((err: Error) => {
      void handleAgentError(agentId, err)
    })

    await notifyOrchestrator("aborted", agent, { reason: "urgent redirect" })
    await log("info", `Agent ${agentId} abort-resumed with urgent message`)

    return `Agent "${agentId}" aborted and resumed with new instructions. Turn ${agent.currentTurn}.`
  }

  // ── Tools ──

  return {
    tool: {
      swarm_spawn: tool({
        description: `Spawn an agent in the coordinated swarm. Returns immediately with an agent ID.
Use for multi-agent parallel work where agents need coordination, communication, and file safety.
You WILL receive <swarm-event> notifications as agents complete or need attention.`,
        args: {
          agent: tool.schema.string().describe("Agent name to spawn (any subagent)."),
          prompt: tool.schema.string().describe("Detailed task prompt for the agent."),
          autoComplete: tool.schema.boolean().optional().describe("Auto-complete when turn finishes with empty mailbox (default: true)."),
          scope: tool.schema.array(tool.schema.string()).optional().describe("File paths this agent is allowed to edit (workspace partitioning)."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID || !ctx?.messageID) return "Error: swarm_spawn requires session context."

          const s = ensureSwarm(ctx)

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

          // Create child session
          const session = await client.session.create({
            body: {
              title: `Swarm: ${args.agent} (${s.id})`,
              parentID: ctx.sessionID,
            },
          })

          if (!session.data?.id) return "Error: Failed to create child session."

          // Register agent
          const id = generateId()
          const autoComplete = args.autoComplete !== false
          const scopeLines = args.scope?.length
            ? `\n\nYou are part of an agent swarm. Other agents are working in parallel.\nYour workspace scope: ${args.scope.join(", ")}\nDo NOT edit files outside your scope unless explicitly instructed.`
            : ""

          const fullPrompt = args.prompt + scopeLines

          const agent: SwarmAgent = {
            id,
            sessionID: session.data.id,
            agent: args.agent,
            prompt: args.prompt.slice(0, 500),
            status: "running",
            mailbox: [],
            createdAt: new Date(),
            lastActivity: new Date(),
            currentTurn: 1,
            autoComplete,
            scope: args.scope,
          }

          s.agents.set(id, agent)
          s.agentsBySession.set(session.data.id, id)

          // Set timeout
          setAgentTimeout(id)

          // Fire prompt
          client.session.prompt({
            path: { id: session.data.id },
            body: {
              agent: args.agent,
              parts: [{ type: "text", text: fullPrompt }],
              tools: { swarm_spawn: false, swarm_message: false, swarm_peek: false, swarm_broadcast: false, swarm_status: false, swarm_kill: false, swarm_dissolve: false, todowrite: false },
            },
          }).then(() => {
            void handleAgentTurnComplete(id)
          }).catch((err: Error) => {
            void handleAgentError(id, err)
          })

          await log("info", `Spawned ${args.agent} as ${id} in swarm ${s.id}`)

          const agentCount = Array.from(s.agents.values()).filter((a) => !isTerminal(a.status)).length
          return `Agent spawned: ${id}\nAgent: ${args.agent}\nSwarm: ${s.id} (${agentCount} active agents)\nYou will receive <swarm-event> notifications.`
        },
      }),

      swarm_message: tool({
        description: `Send a message to a specific agent in the swarm.
Normal priority: delivered when the agent finishes its current turn.
Urgent priority: immediately aborts the agent and resumes with new instructions.`,
        args: {
          agentId: tool.schema.string().describe("Target agent ID."),
          text: tool.schema.string().describe("Message text to send."),
          priority: tool.schema.enum(["normal", "urgent"]).optional().describe("Message priority (default: normal)."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_message requires session context."
          if (!swarm || swarm.status === "dissolved") return "Error: No active swarm."

          const agent = getAgent(args.agentId)
          if (!agent) return `Error: Agent "${args.agentId}" not found. Use swarm_status() to list agents.`

          const priority = args.priority || "normal"

          // Urgent = abort-resume
          if (priority === "urgent") {
            return await abortAndResume(args.agentId, args.text)
          }

          // Normal = enqueue in mailbox
          const msg: MailMessage = {
            id: generateId(),
            from: "orchestrator",
            text: args.text,
            priority: "normal",
            createdAt: new Date(),
            delivered: false,
          }
          agent.mailbox.push(msg)

          // If agent is waiting or complete, dispatch immediately
          if (agent.status === "waiting" || agent.status === "complete") {
            agent.status = "running"
            await dispatchMailbox(args.agentId)
            return `Message dispatched immediately to agent "${args.agentId}" (was ${agent.status}).`
          }

          const pendingCount = agent.mailbox.filter((m) => !m.delivered).length
          return `Message queued for agent "${args.agentId}" (${pendingCount} pending). Will be delivered when current turn completes.`
        },
      }),

      swarm_peek: tool({
        description: `Read the current state of a swarm agent without blocking.
Returns the last assistant response, status, and mailbox info.`,
        args: {
          agentId: tool.schema.string().describe("Agent ID to peek at."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_peek requires session context."
          if (!swarm || swarm.status === "dissolved") return "Error: No active swarm."

          const agent = getAgent(args.agentId)
          if (!agent) return `Error: Agent "${args.agentId}" not found.`

          const lastText = await getAgentLastText(agent.sessionID)
          const pendingMail = agent.mailbox.filter((m) => !m.delivered).length
          const elapsed = Math.round((Date.now() - agent.createdAt.getTime()) / 1000)

          return [
            `## Agent ${agent.id} (${agent.agent})`,
            `**Status:** ${agent.status}`,
            `**Turn:** ${agent.currentTurn}`,
            `**Elapsed:** ${elapsed}s`,
            `**Mailbox:** ${pendingMail} pending`,
            agent.scope ? `**Scope:** ${agent.scope.join(", ")}` : "",
            agent.error ? `**Error:** ${agent.error}` : "",
            "",
            "### Last Response",
            lastText || "(no response yet)",
          ].filter(Boolean).join("\n")
        },
      }),

      swarm_broadcast: tool({
        description: `Send a message to all (or filtered subset of) agents in the swarm.`,
        args: {
          text: tool.schema.string().describe("Message text to broadcast."),
          status: tool.schema.string().optional().describe("Filter by agent status (e.g., 'running')."),
          agent: tool.schema.string().optional().describe("Filter by agent name."),
          priority: tool.schema.enum(["normal", "urgent"]).optional().describe("Message priority (default: normal)."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_broadcast requires session context."
          if (!swarm || swarm.status === "dissolved") return "Error: No active swarm."

          let targets = Array.from(swarm.agents.values()).filter((a) => !isTerminal(a.status))
          if (args.status) targets = targets.filter((a) => a.status === args.status)
          if (args.agent) targets = targets.filter((a) => a.agent === args.agent)

          if (targets.length === 0) return "No agents matched the filter."

          const priority = args.priority || "normal"
          const results: string[] = []

          for (const target of targets) {
            if (priority === "urgent") {
              const result = await abortAndResume(target.id, args.text)
              results.push(`${target.id}: ${result}`)
            } else {
              const msg: MailMessage = {
                id: generateId(),
                from: "orchestrator",
                text: args.text,
                priority: "normal",
                createdAt: new Date(),
                delivered: false,
              }
              target.mailbox.push(msg)

              if (target.status === "waiting" || target.status === "complete") {
                target.status = "running"
                void dispatchMailbox(target.id)
                results.push(`${target.id}: dispatched immediately`)
              } else {
                results.push(`${target.id}: queued`)
              }
            }
          }

          return `Broadcast to ${targets.length} agents:\n${results.join("\n")}`
        },
      }),

      swarm_status: tool({
        description: `Get an overview of the entire swarm: all agents, their status, and any file conflicts.`,
        args: {},
        async execute(_args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_status requires session context."
          if (!swarm || swarm.status === "dissolved") return "No active swarm."

          const grouped: Record<string, SwarmAgent[]> = {}
          for (const agent of swarm.agents.values()) {
            const key = agent.status
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(agent)
          }

          const lines: string[] = [`## Swarm ${swarm.id} [${swarm.status}]`, ""]

          for (const status of ["running", "spawning", "waiting", "complete", "error", "aborted"]) {
            const agents = grouped[status]
            if (!agents?.length) continue
            lines.push(`### ${status.charAt(0).toUpperCase() + status.slice(1)} (${agents.length})`)
            for (const a of agents) {
              const elapsed = Math.round((Date.now() - a.createdAt.getTime()) / 1000)
              const pending = a.mailbox.filter((m) => !m.delivered).length
              lines.push(`- **${a.id}** ${a.agent} | turn=${a.currentTurn} | ${elapsed}s | mailbox=${pending}${a.error ? ` | error: ${a.error}` : ""}`)
            }
            lines.push("")
          }

          // File conflicts
          const conflicts: string[] = []
          for (const [filePath, claims] of swarm.fileClaims.entries()) {
            const writers = claims.filter((c) => c.operation !== "read")
            const uniqueAgents = new Set(writers.map((c) => c.agentId))
            if (uniqueAgents.size > 1) {
              conflicts.push(`- ${filePath}: ${Array.from(uniqueAgents).join(", ")}`)
            }
          }
          if (conflicts.length > 0) {
            lines.push("### File Conflicts")
            lines.push(...conflicts)
            lines.push("")
          }

          return lines.join("\n")
        },
      }),

      swarm_kill: tool({
        description: `Abort a specific agent and remove it from the swarm.`,
        args: {
          agentId: tool.schema.string().describe("Agent ID to kill."),
          reason: tool.schema.string().optional().describe("Reason for killing the agent."),
        },
        async execute(args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_kill requires session context."
          if (!swarm || swarm.status === "dissolved") return "Error: No active swarm."

          const agent = getAgent(args.agentId)
          if (!agent) return `Error: Agent "${args.agentId}" not found.`
          if (isTerminal(agent.status)) return `Agent "${args.agentId}" is already ${agent.status}.`

          // Abort session
          try {
            await client.session.abort({ path: { id: agent.sessionID } })
          } catch {
            // May already be idle
          }

          clearAgentTimeout(args.agentId)
          agent.status = "aborted"
          agent.error = args.reason || "Killed by orchestrator"
          agent.completedAt = new Date()
          agent.mailbox = agent.mailbox.map((m) => ({ ...m, delivered: true })) // clear pending

          await log("info", `Agent ${args.agentId} killed: ${args.reason || "no reason"}`)

          const active = Array.from(swarm.agents.values()).filter((a) => !isTerminal(a.status)).length
          return `Agent "${args.agentId}" killed.${args.reason ? ` Reason: ${args.reason}` : ""}\nSwarm: ${active} agents remaining.`
        },
      }),

      swarm_dissolve: tool({
        description: `Terminate the entire swarm. Aborts all running agents and cleans up state.`,
        args: {},
        async execute(_args, ctx) {
          if (!ctx?.sessionID) return "Error: swarm_dissolve requires session context."
          if (!swarm || swarm.status === "dissolved") return "No active swarm to dissolve."

          const running = Array.from(swarm.agents.values()).filter((a) => !isTerminal(a.status))

          // Abort all running agents
          for (const agent of running) {
            try {
              await client.session.abort({ path: { id: agent.sessionID } })
            } catch {
              // Best effort
            }
            clearAgentTimeout(agent.id)
            agent.status = "aborted"
            agent.error = "Swarm dissolved"
            agent.completedAt = new Date()
          }

          // Clear all timers
          for (const [id] of timeoutTimers) {
            clearAgentTimeout(id)
          }

          swarm.status = "dissolved"
          await log("info", `Swarm ${swarm.id} dissolved (${running.length} agents aborted)`)

          return `Swarm ${swarm.id} dissolved. ${running.length} running agents aborted.`
        },
      }),
    },

    // ── File claim tracking via tool.execute.after ──

    "tool.execute.after": async (input: any, _output: any) => {
      if (!swarm || swarm.status !== "active") return

      const tool = input.tool
      if (tool !== "edit" && tool !== "write" && tool !== "apply_patch") return

      const sessionID = input.sessionID
      if (!sessionID) return

      const agentId = swarm.agentsBySession.get(sessionID)
      if (!agentId) return

      // Extract file path from args
      let filePath: string | undefined
      if (input.args?.filePath) {
        filePath = input.args.filePath
      } else if (tool === "apply_patch" && input.args?.patchText) {
        // Extract from patch markers
        const match = input.args.patchText.match(/\*\*\* (?:Update|Add|Move to|Delete) File: (.+)/)
        if (match) filePath = match[1]
      }
      if (!filePath) return

      const claim: FileClaim = {
        agentId,
        filePath,
        operation: tool === "edit" || tool === "apply_patch" ? "edit" : "write",
        timestamp: new Date(),
      }

      if (!swarm.fileClaims.has(filePath)) {
        swarm.fileClaims.set(filePath, [])
      }
      swarm.fileClaims.get(filePath)!.push(claim)

      // Check for conflicts
      const claims = swarm.fileClaims.get(filePath)!
      const writers = claims.filter((c) => c.operation !== "read")
      const uniqueAgents = new Set(writers.map((c) => c.agentId))
      if (uniqueAgents.size > 1) {
        const agent = getAgent(agentId)
        if (agent) {
          const others = Array.from(uniqueAgents).filter((id) => id !== agentId)
          await notifyOrchestrator("conflict", agent, {
            conflict: `File ${filePath} also edited by: ${others.join(", ")}`,
          })
          await log("warn", `File conflict: ${filePath} edited by ${Array.from(uniqueAgents).join(", ")}`)
        }
      }
    },

    // ── System prompt injection ──

    "experimental.chat.system.transform": async (_input: any, output: any) => {
      output.system.push(`<swarm-system>
You have tools for coordinated multi-agent work:
- swarm_spawn(agent, prompt) — Spawn an agent in the swarm
- swarm_message(agentId, text, priority?) — Send message (normal=between turns, urgent=abort+resume)
- swarm_peek(agentId) — Read agent's current state and last response
- swarm_broadcast(text, filter?) — Message all/filtered agents
- swarm_status() — Overview of entire swarm
- swarm_kill(agentId) — Abort and remove an agent
- swarm_dissolve() — Terminate entire swarm

You WILL receive <swarm-event> notifications when agents complete, error, or need attention.
When you see a <swarm-event>:
1. Process it immediately
2. Decide: give new instructions, peek for details, or acknowledge
3. Check swarm_status() if multiple agents may have finished

Communication:
- Normal: swarm_message(id, text) — delivered between turns
- Urgent redirect: swarm_message(id, text, "urgent") — aborts + resumes immediately
- Observe: swarm_peek(id) — non-blocking read of agent progress
- Relay: peek Agent-A, then message Agent-B with findings

Use swarm for coordinated parallel work. Use delegate for independent fire-and-forget research.
</swarm-system>`)
    },

    // ── Compaction hook ──

    "experimental.session.compacting": async (_input: any, output: any) => {
      if (!swarm || swarm.status === "dissolved") return

      const running = Array.from(swarm.agents.values()).filter((a) => a.status === "running" || a.status === "spawning")
      const waiting = Array.from(swarm.agents.values()).filter((a) => a.status === "waiting")
      const completed = Array.from(swarm.agents.values()).filter((a) => isTerminal(a.status))

      if (running.length === 0 && waiting.length === 0 && completed.length === 0) return

      const lines: string[] = [`## Active Swarm (${swarm.id})`]

      if (running.length > 0) {
        lines.push("", "### Running")
        for (const a of running) {
          const pending = a.mailbox.filter((m) => !m.delivered).length
          lines.push(`- **${a.id}** ${a.agent} turn=${a.currentTurn} mailbox=${pending} since ${a.createdAt.toISOString()}`)
        }
      }

      if (waiting.length > 0) {
        lines.push("", "### Waiting for instructions")
        for (const a of waiting) {
          lines.push(`- **${a.id}** ${a.agent} turn=${a.currentTurn}`)
        }
      }

      if (completed.length > 0) {
        lines.push("", "### Completed/Terminal")
        for (const a of completed.slice(-10)) {
          lines.push(`- **${a.id}** [${a.status}] ${a.agent} turns=${a.currentTurn}`)
        }
      }

      // File conflicts
      const conflicts: string[] = []
      for (const [filePath, claims] of swarm.fileClaims.entries()) {
        const writers = claims.filter((c) => c.operation !== "read")
        const unique = new Set(writers.map((c) => c.agentId))
        if (unique.size > 1) conflicts.push(`- ${filePath}: ${Array.from(unique).join(", ")}`)
      }
      if (conflicts.length > 0) {
        lines.push("", "### File Conflicts", ...conflicts)
      }

      lines.push("", 'Use swarm_status() for full details. Use swarm_peek("id") to read agent output.')
      output.context.push(lines.join("\n"))
    },
  }
}

export default AgentSwarm
export { AgentSwarm }
