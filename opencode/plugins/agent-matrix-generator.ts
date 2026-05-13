import type { Plugin } from "@opencode-ai/plugin"
import { spawn, spawnSync } from "node:child_process"
import { appendFileSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROVIDERS: string[] = ["opencode-go", "github-copilot"]
const REGEN_FLAG = "--agent-matrix-regen"
const FETCH_TIMEOUT_MS = 15_000
const CAPS_API_URL = "https://models.dev/api.json"

// Capabilities every agent must have, regardless of role.
// `tool_call` is mandatory because opencode invokes tools (Read, Edit, Bash, etc.) for all agents.
const GLOBAL_REQUIRED: string[] = ["tool_call"]

// Role profiles. Each agent's requirements are derived by matching its filename + first H1 line
// against every profile's patterns. All matching profiles contribute their required/optional/excluded
// sets (union). Patterns are case-insensitive JS regexes; use \b for word boundaries to avoid false
// positives. Recognized capability tokens: "text" | "image" | "video" | "audio" | "pdf"
// (modalities.input) plus "tool_call" | "reasoning" | "attachment".
// `required` — model MUST have all. `excluded` — model MUST NOT have any.
// `optional` — informational only (kept for future ranking, not used in filtering).
type AgentReqs = { required?: string[]; optional?: string[]; excluded?: string[] }
type RoleProfile = {
  name: string
  patterns: RegExp[]
  required?: string[]
  optional?: string[]
  excluded?: string[]
}
const ROLE_PROFILES: RoleProfile[] = [
  {
    name: "designer",
    patterns: [/ux-?ui/i, /\bdesigner\b/i],
    required: ["image", "pdf"],
    optional: ["video"],
  },
  {
    name: "architect",
    patterns: [/\barchitect(?:ure|ural)?\b/i],
    required: ["reasoning"],
  },
  {
    name: "planner",
    patterns: [/\bprincipal\b/i, /\bplanner\b/i, /\bplanning\b/i, /\bstrategist\b/i],
    required: ["reasoning"],
  },
  {
    name: "security",
    patterns: [/\bsecurity\b/i, /\bthreat\b/i],
    required: ["reasoning"],
  },
  {
    name: "reviewer",
    patterns: [/\breviewer\b/i, /\bcode[- ]?review\b/i],
    required: ["reasoning"],
  },
  {
    name: "ai-engineer",
    patterns: [/\bllm\b/i, /\bprompt[- ]?engineer\b/i],
    required: ["reasoning"],
  },
  {
    name: "developer",
    patterns: [
      /\bdeveloper\b/i,
      /\bfull[- ]?stack\b/i,
      /\bbackend[- ]developer\b/i,
      /\bfrontend[- ]developer\b/i,
    ],
    required: ["reasoning", "attachment"],
  },
  {
    name: "worker-junior",
    patterns: [/\bworker[- ]?junior\b/i],
    // `reasoning` is omitted on purpose: reasoning is opt-in per call, not a runtime cost
    // workers pay automatically. Excluding `image` and `attachment` is what actually steers
    // matching toward simpler, non-multimodal models (typically the cheapest tier).
    excluded: ["image", "attachment"],
  },
]

type ModelCaps = {
  input: string[]
  toolCall: boolean
  reasoning: boolean
  attachment: boolean
}

const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
const xdgState = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
const AGENTS_DIR = join(xdgConfig, "agents", "agents")
const OPENCODE_JSON = join(xdgConfig, "opencode", "opencode.json")
const PROMPT_PATH_PREFIX = "../agents/agents"
const LOG_DIR = join(xdgState, "agent-matrix-generator")
const LOG_FILE = join(LOG_DIR, "regen.log")

const baseNameFromFile = (file: string): string => file.replace(/-prompt\.md$/, "").replace(/\.md$/, "")

type ProviderModel = { providerId: string; modelId: string }

function log(message: string, extra?: Record<string, unknown>): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const line = `[${new Date().toISOString()}] ${message}${extra ? " " + JSON.stringify(extra) : ""}\n`
    appendFileSync(LOG_FILE, line)
  } catch {
    // best-effort
  }
}

const isRegenerator = process.argv.includes(REGEN_FLAG)

if (isRegenerator) {
  runRegenerator()
    .then(() => process.exit(0))
    .catch((err) => {
      log("regenerator crashed", { error: String(err) })
      process.exit(1)
    })
}

const AgentMatrixGenerator: Plugin = async () => {
  if (process.env.OPENCODE_PROCESS_ROLE === "worker") return {}

  try {
    const scriptPath = fileURLToPath(import.meta.url)
    mkdirSync(LOG_DIR, { recursive: true })
    const fd = openSync(LOG_FILE, "a")
    const child = spawn("bun", [scriptPath, REGEN_FLAG], {
      detached: true,
      stdio: ["ignore", fd, fd],
      env: { ...process.env, OPENCODE_PROCESS_ROLE: "worker" },
      cwd: dirname(scriptPath),
    })
    child.unref()
    log("spawned detached regenerator", { pid: child.pid })
  } catch (err) {
    log("failed to spawn regenerator", { error: String(err) })
  }

  return {}
}

async function runRegenerator(): Promise<void> {
  log("regenerator start")

  const providerModels: ProviderModel[] = []
  for (const providerId of PROVIDERS) {
    const models = fetchProviderModels(providerId)
    log("fetched models", { providerId, count: models.length })
    for (const modelId of models) providerModels.push({ providerId, modelId })
  }

  if (providerModels.length === 0) {
    log("no models fetched; aborting")
    return
  }

  const entries = readdirSync(AGENTS_DIR)
  const agentFiles = entries.filter((f) => f.endsWith(".md")).sort()
  log("found agent files", { count: agentFiles.length })
  if (agentFiles.length === 0) return

  const capabilities = await fetchCapabilities()
  log("loaded capabilities", {
    providers: capabilities.size,
    totalModels: Array.from(capabilities.values()).reduce((sum, m) => sum + m.size, 0),
  })

  const agents: Record<string, unknown> = {}
  let count = 0
  const skipped: string[] = []
  let fallbackHits = 0

  for (const file of agentFiles) {
    const base = baseNameFromFile(file)
    const { reqs, profiles } = resolveAgentReqs(file)
    log("resolved profiles", { agent: base, profiles, required: reqs.required ?? [], optional: reqs.optional ?? [], excluded: reqs.excluded ?? [] })
    let matched = 0
    for (const { providerId, modelId } of providerModels) {
      const lookup = lookupCaps(capabilities, providerId, modelId)
      if (lookup.fellBack) fallbackHits++
      if (!modelMatchesReqs(lookup.caps, reqs)) continue
      const name = `${base}-${providerId}-${modelId}`
      agents[name] = {
        description: `${base} agent powered by ${providerId}/${modelId}`,
        mode: "all",
        model: `${providerId}/${modelId}`,
        prompt: `{file:${PROMPT_PATH_PREFIX}/${file}}`,
      }
      matched++
      count++
    }
    if (matched === 0) {
      skipped.push(base)
      log("agent has no matching models; skipped", { agent: base, required: reqs.required ?? [] })
    }
  }
  if (fallbackHits > 0) log("capability fallback used", { hits: fallbackHits, note: "exact provider+model not in models.dev; used another provider's record" })

  const configRaw = readFileSync(OPENCODE_JSON, "utf8")
  const config = JSON.parse(configRaw) as Record<string, unknown>
  config.agent = agents
  writeFileSync(OPENCODE_JSON, `${JSON.stringify(config, null, 2)}\n`)

  log("regenerator done", { agents: count, skippedAgents: skipped })
}

type CapsByProvider = Map<string, Map<string, ModelCaps>>

async function fetchCapabilities(): Promise<CapsByProvider> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(CAPS_API_URL, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const api = (await res.json()) as Record<string, { models?: Record<string, ApiModel> }>
    const byProvider: CapsByProvider = new Map()
    for (const [providerId, provider] of Object.entries(api)) {
      const models = provider.models ?? {}
      const perModel = new Map<string, ModelCaps>()
      for (const [modelId, model] of Object.entries(models)) {
        perModel.set(modelId, {
          input: Array.isArray(model.modalities?.input) ? model.modalities.input : [],
          toolCall: !!model.tool_call,
          reasoning: !!model.reasoning,
          attachment: !!model.attachment,
        })
      }
      byProvider.set(providerId, perModel)
    }
    return byProvider
  } catch (err) {
    log("capability fetch failed; agents with requirements will be skipped", { error: String(err) })
    return new Map()
  } finally {
    clearTimeout(timer)
  }
}

// Provider-aware capability lookup. Exact `providerId/modelId` first; if not found, fall back to
// any provider that lists this `modelId` (last resort — distinct providers may report differently).
function lookupCaps(
  byProvider: CapsByProvider,
  providerId: string,
  modelId: string,
): { caps: ModelCaps | undefined; fellBack: boolean } {
  const exact = byProvider.get(providerId)?.get(modelId)
  if (exact) return { caps: exact, fellBack: false }
  for (const [, models] of byProvider) {
    const m = models.get(modelId)
    if (m) return { caps: m, fellBack: true }
  }
  return { caps: undefined, fellBack: false }
}

type ApiModel = {
  modalities?: { input?: string[]; output?: string[] }
  tool_call?: boolean
  reasoning?: boolean
  attachment?: boolean
}

const MODALITY_INPUT_TOKENS = new Set(["text", "image", "video", "audio", "pdf"])

function resolveAgentReqs(file: string): { reqs: AgentReqs; profiles: string[] } {
  let firstLine = ""
  try {
    const content = readFileSync(join(AGENTS_DIR, file), "utf8")
    const newlineIdx = content.indexOf("\n")
    firstLine = newlineIdx === -1 ? content : content.slice(0, newlineIdx)
  } catch (err) {
    log("could not read agent file for profile resolution", { file, error: String(err) })
  }
  const haystack = `${file}\n${firstLine}`

  const required = new Set<string>()
  const optional = new Set<string>()
  const excluded = new Set<string>()
  const profiles: string[] = []
  for (const profile of ROLE_PROFILES) {
    if (!profile.patterns.some((p) => p.test(haystack))) continue
    profiles.push(profile.name)
    for (const r of profile.required ?? []) required.add(r)
    for (const o of profile.optional ?? []) optional.add(o)
    for (const e of profile.excluded ?? []) excluded.add(e)
  }
  return {
    reqs: {
      required: Array.from(required),
      optional: Array.from(optional),
      excluded: Array.from(excluded),
    },
    profiles,
  }
}

function hasCapability(caps: ModelCaps, token: string): boolean {
  if (MODALITY_INPUT_TOKENS.has(token)) return caps.input.includes(token)
  if (token === "tool_call") return caps.toolCall
  if (token === "reasoning") return caps.reasoning
  if (token === "attachment") return caps.attachment
  return false
}

function modelMatchesReqs(caps: ModelCaps | undefined, reqs: AgentReqs): boolean {
  const required = Array.from(new Set([...GLOBAL_REQUIRED, ...(reqs.required ?? [])]))
  const excluded = reqs.excluded ?? []
  if (!caps) {
    // Unknown model — assume only `text` modality, all flags false.
    if (excluded.length > 0 && excluded.some((e) => e === "tool_call" || e === "reasoning" || e === "attachment")) {
      // false flags are inherently "not excluded"; only modality tokens could clash, and unknown
      // input is just [text], so any modality exclusion (image/pdf/video/audio) is satisfied.
    }
    return required.every((r) => r === "text")
  }
  for (const r of required) if (!hasCapability(caps, r)) return false
  for (const e of excluded) if (hasCapability(caps, e)) return false
  return true
}

function fetchProviderModels(providerId: string): string[] {
  const result = spawnSync("opencode", ["models", providerId], {
    encoding: "utf8",
    timeout: FETCH_TIMEOUT_MS,
    env: { ...process.env, OPENCODE_PROCESS_ROLE: "worker" },
  })
  if (result.error) {
    log("opencode models failed", { providerId, error: String(result.error) })
    return []
  }
  if (result.status !== 0) {
    log("opencode models exit non-zero", { providerId, status: result.status, stderr: result.stderr?.slice(0, 200) })
    return []
  }
  const prefix = `${providerId}/`
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length))
    .sort()
}

export { AgentMatrixGenerator }
