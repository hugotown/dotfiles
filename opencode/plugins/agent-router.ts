/**
 * agent-router.ts — PAUSED 2026-05-12
 * ====================================
 *
 * STATUS
 * ------
 * Paused pending architectural decision. This file exports an inert Plugin
 * (returns {}); it does NOT register any hooks or tools. opencode loads it
 * silently. To resume, follow one of the paths in "Forward paths" below.
 *
 *
 * GOAL (what we set out to build)
 * -------------------------------
 * Auto-route user tasks to the best specialist agent from the matrix that
 * `agent-matrix-generator.ts` produces in ~/.config/opencode/opencode.json
 * (~400 entries: 16 agent role files × N models × 2 providers).
 *
 * Example: user types "design a secure auth architecture" → plugin should
 * ensure the message is processed by `security-engineer` and/or
 * `backend-architect`, NOT by the default `build` agent.
 *
 *
 * WHY PAUSED — empirically observed blockers
 * ------------------------------------------
 * 1) Skill priority conflict with the `superpowers` plugin.
 *    `superpowers` injects an explicit priority order into the system prompt:
 *      "When multiple skills could apply, use this order:
 *       1. Process skills first (brainstorming, debugging)"
 *    The model obeys this hierarchically. Whatever we inject — whether via
 *    `experimental.chat.system.transform` or by prepending text in
 *    `chat.message` — is consumed as ADDITIONAL info, not as an override of
 *    the priority order. Verified empirically with two iterations:
 *      a) Soft system-prompt hint           → ignored
 *      b) Imperative `[router triage]` block prepended to user text
 *                                           → model thinking literally cited
 *         superpowers' priority and proceeded with brainstorming anyway
 *
 * 2) Per-message noise.
 *    `chat.message` fires on every user turn. A 20-turn conversation produced
 *    20 triages — most redundant follow-ups on the same topic. To do this
 *    right we would need topic / activity-change detection (clustering,
 *    debouncing). That is a separate non-trivial project.
 *
 *
 * THE FUNDAMENTAL LIMIT (server plugin API)
 * -----------------------------------------
 * opencode's server-plugin Hooks do NOT expose a pre-routing intercept.
 * `chat.message` receives `input.agent` (already decided) and only allows
 * mutation of `output.parts`. There is no documented way for a server plugin
 * to redirect an in-flight message to a different agent before the LLM call
 * begins. Verified by reading:
 *   - @opencode-ai/plugin/dist/index.d.ts (Hooks interface)
 *   - packages/opencode/src/plugin/index.ts (anomalyco/opencode dev branch)
 *
 *
 * FORWARD PATHS (when resuming)
 * -----------------------------
 * A) TUI plugin with onSubmit interceptor  ──  MATCHES THE ORIGINAL VISION
 *    Write a separate `tui`-kind plugin (different runtime, different
 *    package). Register a Slot replacing the default Prompt. In `onSubmit`:
 *      - capture user text BEFORE session.prompt is called
 *      - run a fast classifier via api.client.session.prompt with a cheap
 *        model and a JSON-schema response (see SDK Examples-5, structured
 *        output via body.format = { type: "json_schema", schema })
 *      - call api.client.session.prompt({ body: { agent: <specialist>,
 *        parts: [...] } }) with the correct agent override
 *    See @opencode-ai/plugin/dist/tui.d.ts → TuiPromptProps.onSubmit and
 *    TuiPluginApi.slots.register.
 *
 * B) Server plugin with parallel dispatch  ──  COMPROMISE
 *    Keep this as a server plugin. In `chat.message`:
 *      - run classifier via client.session.prompt
 *      - fire-and-forget a parallel turn: client.session.prompt({
 *          body: { agent: specialist, parts: output.parts }
 *        })
 *    Trade-off: TWO responses per user prompt (build's + specialist's).
 *    Could be framed as a "second opinion" feature. Verified the SDK accepts
 *    `agent` field on the prompt body (see SessionPromptData in
 *    @opencode-ai/sdk/dist/gen/types.gen.d.ts).
 *
 * C) Remove the `superpowers` dependency
 *    Drop superpowers from opencode.json `plugin` array. The skill-priority
 *    conflict disappears. The chat.message prepend that's preserved below
 *    would then likely steer the model correctly without further changes.
 *    Cost: lose brainstorming / debugging / writing-plans skills.
 *
 *
 * WHAT THE PRESERVED CODE BELOW CONTAINS
 * --------------------------------------
 *   - ROLES table: regex-based role detection (architect, planner, designer,
 *     security, reviewer, ai-engineer, developer, worker-junior) with patterns
 *     for both task description and agent-base name matching
 *   - loadAgents(): parses ~/.config/opencode/opencode.json `agent` map and
 *     splits each entry name into <base>-<provider>-<model> using the known
 *     providers list as a separator
 *   - detectRoles(task) and agentMatchesRole(agent, role)
 *   - computeRecommendations(): groups agents by base, scores by # of role
 *     hits, returns top N groups with model variants
 *   - formatTriage(): formats the prepended router-triage block
 *   - recommend_agent tool: exposes the same logic as a callable tool
 *   - chat.message hook: idempotent prepend of the triage to the first text
 *     part
 *
 * To resume Path A: re-derive the regex/classifier logic in a TUI plugin.
 * To resume Path B: uncomment, add classifier call, fire parallel
 *                   session.prompt with agent override.
 * To resume Path C: uncomment as-is, no further work required.
 *
 *
 * RELATED FILES (do not modify when resuming this plugin)
 * -------------------------------------------------------
 *   - agent-matrix-generator.ts → owns the matrix in opencode.json
 *   - ~/.config/agents/agents/*.md → the agent role definitions
 *   - ~/.local/state/agent-router/router.log → previous log location (verbose
 *     logs are commented out in the preserved code below; nothing writes
 *     here while paused)
 */

import type { Plugin } from "@opencode-ai/plugin"

const AgentRouter: Plugin = async () => {
  // Inert. See file header for paused-state notes and resume paths.
  return {}
}

export { AgentRouter }

/* ───────────────────────── PRESERVED IMPLEMENTATION (inactive) ─────────────────────────
 * The code below is the last working version before pause. It is kept inside
 * a block comment so it does not execute, type-check, or trigger imports.
 * When resuming, copy out the pieces you need and re-enable the hook(s) by
 * returning them from AgentRouter above.
 *
 * Original imports needed when reactivating:
 *   import { tool } from "@opencode-ai/plugin"
 *   import { appendFileSync, mkdirSync, readFileSync } from "node:fs"
 *   import { homedir } from "node:os"
 *   import { join } from "node:path"
 *
 * ────────────────────────────────────────────────────────────────────────
 *
 * const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
 * const xdgState = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
 * const OPENCODE_JSON = join(xdgConfig, "opencode", "opencode.json")
 * const LOG_DIR = join(xdgState, "agent-router")
 * const LOG_FILE = join(LOG_DIR, "router.log")
 *
 * const KNOWN_PROVIDERS = ["opencode-go", "github-copilot"]
 * const MAX_MODELS_PER_ROLE = 5
 * const MAX_RECOMMENDATIONS = 8
 * const DEFAULT_RECOMMENDATIONS = 3
 *
 * type RoleHint = {
 *   role: string
 *   // Patterns to detect this role in the USER'S TASK DESCRIPTION.
 *   taskPatterns: RegExp[]
 *   // Patterns to identify agents whose base name represents this role.
 *   agentBasePatterns: RegExp[]
 * }
 *
 * const ROLES: RoleHint[] = [
 *   {
 *     role: "architect",
 *     taskPatterns: [
 *       /\barchitect/i,
 *       /\bdesign (?:a |the )?(?:system|api|schema|service)/i,
 *       /\bservice boundaries\b/i,
 *       /\bdomain model/i,
 *       /\bbounded context/i,
 *       /\btopology\b/i,
 *       /\bdata (?:model|schema)/i,
 *       /\bmigration plan\b/i,
 *     ],
 *     agentBasePatterns: [/\barchitect/i],
 *   },
 *   {
 *     role: "planner",
 *     taskPatterns: [
 *       /\bplan(?:ning)?\b/i,
 *       /\bstrategy\b/i,
 *       /\broadmap\b/i,
 *       /\borchestrat/i,
 *       /\btest (?:plan|strategy)\b/i,
 *       /\bQA\b/i,
 *       /\btest pyramid\b/i,
 *     ],
 *     agentBasePatterns: [/\b(principal|strategist|planner|planning)\b/i],
 *   },
 *   {
 *     role: "designer",
 *     taskPatterns: [
 *       /\bUX\b/i,
 *       /\bUI\b/i,
 *       /\bUX[ \/-]UI|UI[ \/-]UX/i,
 *       /\bwireframe/i,
 *       /\bmockup/i,
 *       /\bvisual design/i,
 *       /\baccessibility\b/i,
 *       /\bcomponent library\b/i,
 *       /\bdesign tokens?\b/i,
 *     ],
 *     agentBasePatterns: [/(ux-?ui|designer)/i],
 *   },
 *   {
 *     role: "security",
 *     taskPatterns: [
 *       /\bsecurity\b/i,
 *       /\bthreat/i,
 *       /\bvulnerab/i,
 *       /\bSAST\b/i,
 *       /\bauth(?:n|z)?\b/i,
 *       /\bcompliance\b/i,
 *       /\bencrypt/i,
 *       /\bsecret(?:s)?\b/i,
 *       /\bSTRIDE\b/i,
 *     ],
 *     agentBasePatterns: [/security/i],
 *   },
 *   {
 *     role: "reviewer",
 *     taskPatterns: [
 *       /\breview\b/i,
 *       /\bcode[- ]?review/i,
 *       /\baudit\b/i,
 *     ],
 *     agentBasePatterns: [/reviewer/i],
 *   },
 *   {
 *     role: "ai-engineer",
 *     taskPatterns: [
 *       /\bLLM\b/i,
 *       /\bprompt (?:engineering|tuning|design)/i,
 *       /\beval(?:s|uation)?\b/i,
 *       /\bfine[- ]?tun/i,
 *       /\bembedding/i,
 *       /\bRAG\b/i,
 *     ],
 *     agentBasePatterns: [/(llm|prompt-engineer)/i],
 *   },
 *   {
 *     role: "developer",
 *     taskPatterns: [
 *       /\bimplement\b/i,
 *       /\bbuild (?:a|the|me)\b/i,
 *       /\bdevelop\b/i,
 *       /\bnew feature\b/i,
 *       /\bfull[- ]?stack/i,
 *       /\bAPI endpoint/i,
 *     ],
 *     agentBasePatterns: [/(developer|full[- ]?stack)/i],
 *   },
 *   {
 *     role: "worker-junior",
 *     taskPatterns: [
 *       /\bfix (?:a |the )?(?:typo|bug)\b/i,
 *       /\brename\b/i,
 *       /\bdelete (?:file|function|line)/i,
 *       /\bmove (?:file|function)/i,
 *       /\bmechanical\b/i,
 *       /\bcleanup\b/i,
 *       /\bhousekeeping\b/i,
 *       /\bsmall change/i,
 *     ],
 *     agentBasePatterns: [/(worker|junior)/i],
 *   },
 * ]
 *
 * type Agent = {
 *   name: string
 *   base: string
 *   provider: string
 *   model: string
 *   description: string
 * }
 *
 * // Logging helper. ALL verbose logs commented at call sites; uncomment selectively when resuming.
 * function log(message: string, extra?: Record<string, unknown>): void {
 *   try {
 *     mkdirSync(LOG_DIR, { recursive: true })
 *     const line = `[${new Date().toISOString()}] ${message}${extra ? " " + JSON.stringify(extra) : ""}\n`
 *     appendFileSync(LOG_FILE, line)
 *   } catch {
 *     // best-effort
 *   }
 * }
 *
 * function loadAgents(): Agent[] {
 *   try {
 *     const json = JSON.parse(readFileSync(OPENCODE_JSON, "utf8")) as {
 *       agent?: Record<string, { description?: string; model?: string }>
 *     }
 *     const result: Agent[] = []
 *     for (const [name, def] of Object.entries(json.agent ?? {})) {
 *       let parsed: { base: string; provider: string; model: string } | null = null
 *       for (const p of KNOWN_PROVIDERS) {
 *         const marker = `-${p}-`
 *         const idx = name.indexOf(marker)
 *         if (idx > 0) {
 *           parsed = { base: name.slice(0, idx), provider: p, model: name.slice(idx + marker.length) }
 *           break
 *         }
 *       }
 *       if (!parsed) continue
 *       result.push({ name, ...parsed, description: def.description ?? "" })
 *     }
 *     return result
 *   } catch (err) {
 *     // log("failed to load agents", { error: String(err) })
 *     return []
 *   }
 * }
 *
 * function detectRoles(task: string): string[] {
 *   const found: string[] = []
 *   for (const r of ROLES) {
 *     if (r.taskPatterns.some((p) => p.test(task))) found.push(r.role)
 *   }
 *   return found
 * }
 *
 * function agentMatchesRole(agent: Agent, role: string): boolean {
 *   const r = ROLES.find((x) => x.role === role)
 *   if (!r) return false
 *   return r.agentBasePatterns.some((p) => p.test(agent.base))
 * }
 *
 * type Recommendation = {
 *   agent_role: string
 *   matched_roles: string[]
 *   available_models: { name: string; provider: string; model: string }[]
 *   total_available: number
 * }
 * type ComputeResult = {
 *   matched_roles: string[]
 *   recommendations: Recommendation[]
 *   note?: string
 * }
 *
 * function computeRecommendations(taskDescription: string, count: number): ComputeResult {
 *   const roles = detectRoles(taskDescription)
 *   if (roles.length === 0) {
 *     return { matched_roles: [], recommendations: [], note: "No specialist role detected." }
 *   }
 *   const agents = loadAgents()
 *   if (agents.length === 0) {
 *     return { matched_roles: roles, recommendations: [], note: "No agents configured in opencode.json." }
 *   }
 *
 *   const byBase = new Map<string, { base: string; roles: string[]; instances: Agent[] }>()
 *   for (const a of agents) {
 *     const hits = roles.filter((role) => agentMatchesRole(a, role))
 *     if (hits.length === 0) continue
 *     const group = byBase.get(a.base) ?? { base: a.base, roles: hits, instances: [] }
 *     group.roles = Array.from(new Set([...group.roles, ...hits]))
 *     group.instances.push(a)
 *     byBase.set(a.base, group)
 *   }
 *
 *   const ranked = Array.from(byBase.values())
 *     .sort((x, y) => y.roles.length - x.roles.length || x.base.localeCompare(y.base))
 *     .slice(0, count)
 *
 *   return {
 *     matched_roles: roles,
 *     recommendations: ranked.map((g) => ({
 *       agent_role: g.base,
 *       matched_roles: g.roles,
 *       available_models: g.instances
 *         .slice(0, MAX_MODELS_PER_ROLE)
 *         .map((a) => ({ name: a.name, provider: a.provider, model: a.model })),
 *       total_available: g.instances.length,
 *     })),
 *   }
 * }
 *
 * function formatTriage(result: ComputeResult): string {
 *   const lines = [`[router triage: task matches role(s): ${result.matched_roles.join(", ")}.`]
 *   lines.push(`  Suggested specialist agents (one example per role):`)
 *   for (const rec of result.recommendations) {
 *     const primary = rec.available_models[0]
 *     if (!primary) continue
 *     const extra = rec.total_available > 1 ? ` (+${rec.total_available - 1} other models)` : ""
 *     lines.push(`  • @${primary.name} — ${rec.agent_role}${extra}`)
 *   }
 *   lines.push(
 *     `  Consider delegating via @<agent-name> if a specialist clearly fits better than your current context; otherwise proceed normally.]`,
 *   )
 *   return lines.join("\n")
 * }
 *
 * // ─── Original Plugin body (was returning hooks; now inert above) ──────
 * //
 * // const AgentRouter: Plugin = async () => {
 * //   if (process.env.OPENCODE_PROCESS_ROLE === "worker") return {}
 * //   // log("plugin loaded")  ← was here; commented to stop noise
 * //
 * //   return {
 * //     tool: {
 * //       recommend_agent: tool({
 * //         description:
 * //           "Given a user task description, returns the top specialist agents from the configured matrix in opencode.json " +
 * //           "that best match the task's role. Use when a task clearly fits a specialist (architect, security, designer, reviewer, " +
 * //           "ai-engineer, developer, worker-junior, planner). Returns groups by role with one or more model variants each.",
 * //         args: {
 * //           task_description: tool.schema
 * //             .string()
 * //             .describe("Short, plain description of the user's task or problem"),
 * //           count: tool.schema
 * //             .number()
 * //             .optional()
 * //             .describe(`Number of role-groups to return (default ${DEFAULT_RECOMMENDATIONS}, max ${MAX_RECOMMENDATIONS})`),
 * //         },
 * //         async execute(args) {
 * //           const count = Math.min(Math.max(args.count ?? DEFAULT_RECOMMENDATIONS, 1), MAX_RECOMMENDATIONS)
 * //           const result = computeRecommendations(args.task_description, count)
 * //           // log("tool recommendation served", {
 * //           //   task: args.task_description.slice(0, 80),
 * //           //   roles: result.matched_roles,
 * //           //   groups: result.recommendations.length,
 * //           // })
 * //           return JSON.stringify({
 * //             ...result,
 * //             usage:
 * //               "Suggest delegating via '@<name>' from one of the available_models if the match is clearly better than the current agent. Otherwise proceed without delegation.",
 * //           })
 * //         },
 * //       }),
 * //     },
 * //
 * //     "chat.message": async (_input, output) => {
 * //       const textIdx = output.parts.findIndex((p) => (p as { type: string }).type === "text")
 * //       if (textIdx === -1) return
 * //       const textPart = output.parts[textIdx] as { type: "text"; text: string }
 * //       const userText = textPart.text ?? ""
 * //       if (userText.trim().length < 10) return
 * //       // Skip if a triage block is already present (idempotency).
 * //       if (userText.startsWith("[router triage:")) return
 * //
 * //       const result = computeRecommendations(userText, DEFAULT_RECOMMENDATIONS)
 * //       if (result.matched_roles.length === 0 || result.recommendations.length === 0) return
 * //
 * //       const triage = formatTriage(result)
 * //       textPart.text = `${triage}\n\n${userText}`
 * //       // log("triage injected", {
 * //       //   roles: result.matched_roles,
 * //       //   groups: result.recommendations.length,
 * //       // })
 * //     },
 * //   }
 * // }
 *
 * ─── END PRESERVED IMPLEMENTATION ─────────────────────────────────────
 */
