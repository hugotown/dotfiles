/**
 * agent-matrix-generator — Pi extension that mirrors the opencode plugin of the
 * same name. For every canonical role prompt at `~/.config/agents/agents/*.md`,
 * it emits one derived Pi agent markdown file per (provider, model) tuple whose
 * model satisfies the role's capability requirements. Derived files land in
 * `~/.pi/agent/agents/` alongside the user's hand-authored agents.
 *
 * Generated files carry `generated: true` in frontmatter — that sentinel is the
 * ONLY way we identify them for cleanup. Hand-authored agents (build.md,
 * plan.md, bmad-*.md, etc.) never carry it and are never touched.
 *
 * Triggers (both detached so Pi never blocks on us):
 *   - factory time: if no generated files exist yet, spawn a bootstrap worker.
 *   - session_shutdown(reason="quit"): spawn a worker that survives Pi's exit
 *     and regenerates for the NEXT session. Same pattern as
 *     agent-session-analyzer — `detached: true` + `child.unref()`, no await,
 *     so Pi's shutdown path is never blocked by HTTP fetches or `opencode
 *     models` subprocesses.
 *
 * Independence from sync-opencode-models: we read provider model lists by
 * invoking `opencode models <provider>` directly rather than reading
 * settings.enabledModels. Combined with the detached spawn, our handler does
 * not race or share state with the sync-opencode-models shutdown handler.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { spawn, spawnSync } from "node:child_process"
import {
	appendFileSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PROVIDERS: string[] = ["opencode-go", "github-copilot", "opencode"]
const REGEN_FLAG = "--agent-matrix-regen"
const FETCH_TIMEOUT_MS = 15_000
const CAPS_API_URL = "https://models.dev/api.json"

// Capabilities every model must have, regardless of role.
// `tool_call` is mandatory because Pi invokes tools (read, write, edit, bash) for all agents.
const GLOBAL_REQUIRED: string[] = ["tool_call"]

// Role profiles. Identical to the opencode plugin's set so both halves of the
// matrix (opencode and Pi) end up with the same per-role capability filter.
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
		patterns: [/\bworker\b/i, /\bjunior\b/i, /\bworker[- ]?junior\b/i],
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
const SOURCE_DIR = join(xdgConfig, "agents", "agents")
const OUTPUT_DIR = join(homedir(), ".pi", "agent", "agents")
const LOG_DIR = join(xdgState, "agent-matrix-generator")
const LOG_FILE = join(LOG_DIR, "regen-pi.log")

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

function baseNameFromFile(file: string): string {
	return file
		.replace(/-prompt\.md$/, "")
		.replace(/-agent\.md$/, "")
		.replace(/\.md$/, "")
}

function readSourceFile(file: string): { firstLine: string; title: string; body: string } | null {
	try {
		const body = readFileSync(join(SOURCE_DIR, file), "utf8")
		const nl = body.indexOf("\n")
		const firstLine = nl === -1 ? body : body.slice(0, nl)
		const title = firstLine.replace(/^#\s+/, "").trim() || baseNameFromFile(file)
		return { firstLine, title, body }
	} catch (err) {
		log("could not read source file", { file, error: String(err) })
		return null
	}
}

// Tolerant frontmatter parser — matches the one in agent-repository.ts so we
// stay consistent with how Pi reads its own agents.
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
	if (!fm) return { meta: {}, body: content }
	const meta: Record<string, string> = {}
	for (const line of fm[1].split(/\r?\n/)) {
		const m = line.match(/^([\w-]+):\s*(.*)$/)
		if (!m) continue
		let value = m[2].trim()
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1)
		}
		meta[m[1]] = value
	}
	return { meta, body: fm[2] }
}

function isGeneratedFile(absPath: string): boolean {
	try {
		const raw = readFileSync(absPath, "utf8")
		const { meta } = parseFrontmatter(raw)
		return meta.generated === "true"
	} catch {
		return false
	}
}

function listGeneratedFiles(): string[] {
	let entries: string[]
	try {
		entries = readdirSync(OUTPUT_DIR)
	} catch {
		return []
	}
	return entries
		.filter((f) => f.endsWith(".md"))
		.filter((f) => isGeneratedFile(join(OUTPUT_DIR, f)))
}

async function runRegenerator(): Promise<void> {
	log("regenerator start")
	mkdirSync(OUTPUT_DIR, { recursive: true })

	const providerModels: ProviderModel[] = []
	for (const providerId of PROVIDERS) {
		const models = fetchProviderModels(providerId)
		log("fetched models", { providerId, count: models.length })
		for (const modelId of models) providerModels.push({ providerId, modelId })
	}

	if (providerModels.length === 0) {
		log("no models fetched; aborting (leaving existing generated files in place)")
		return
	}

	let sourceEntries: string[]
	try {
		sourceEntries = readdirSync(SOURCE_DIR)
	} catch (err) {
		log("source dir unreadable", { dir: SOURCE_DIR, error: String(err) })
		return
	}
	const sourceFiles = sourceEntries.filter((f) => f.endsWith(".md") && !f.startsWith(".")).sort()
	log("found source files", { count: sourceFiles.length })
	if (sourceFiles.length === 0) return

	const capabilities = await fetchCapabilities()
	log("loaded capabilities", {
		providers: capabilities.size,
		totalModels: Array.from(capabilities.values()).reduce((sum, m) => sum + m.size, 0),
	})

	// expected = set of filenames that should exist after this run.
	const expected = new Set<string>()
	let written = 0
	let unchanged = 0
	let fallbackHits = 0
	const skipped: string[] = []

	for (const file of sourceFiles) {
		const base = baseNameFromFile(file)
		const source = readSourceFile(file)
		if (!source) continue
		const { reqs, profiles } = resolveAgentReqs(file, source.firstLine)
		log("resolved profiles", {
			agent: base,
			profiles,
			required: reqs.required ?? [],
			excluded: reqs.excluded ?? [],
		})
		let matched = 0
		for (const { providerId, modelId } of providerModels) {
			const lookup = lookupCaps(capabilities, providerId, modelId)
			if (lookup.fellBack) fallbackHits++
			if (!modelMatchesReqs(lookup.caps, reqs)) continue
			const outName = `${base}-${providerId}-${modelId}.md`
			expected.add(outName)
			const outPath = join(OUTPUT_DIR, outName)
			const content = buildAgentMarkdown({
				title: source.title,
				base,
				providerId,
				modelId,
				body: source.body,
			})
			if (writeIfChanged(outPath, content)) written++
			else unchanged++
			matched++
		}
		if (matched === 0) {
			skipped.push(base)
			log("agent has no matching models; skipped", { agent: base, required: reqs.required ?? [] })
		}
	}
	if (fallbackHits > 0) {
		log("capability fallback used", {
			hits: fallbackHits,
			note: "exact provider+model not in models.dev; used another provider's record",
		})
	}

	// Cleanup: any file with `generated: true` not in `expected` is stale.
	let deleted = 0
	for (const file of listGeneratedFiles()) {
		if (expected.has(file)) continue
		try {
			unlinkSync(join(OUTPUT_DIR, file))
			deleted++
		} catch (err) {
			log("failed to delete stale generated file", { file, error: String(err) })
		}
	}

	log("regenerator done", {
		written,
		unchanged,
		deleted,
		expectedTotal: expected.size,
		skippedAgents: skipped,
	})
}

function buildAgentMarkdown(args: {
	title: string
	base: string
	providerId: string
	modelId: string
	body: string
}): string {
	const desc = `${args.title} powered by ${args.providerId}/${args.modelId}`
	const fm = [
		"---",
		`description: ${yamlEscape(desc)}`,
		`provider: ${args.providerId}`,
		`model: ${args.modelId}`,
		`generated: true`,
		`generatedFrom: ${args.base}`,
		"---",
		"",
	].join("\n")
	const body = args.body.endsWith("\n") ? args.body : args.body + "\n"
	return `${fm}${body}`
}

// Single-line YAML scalar safety. Frontmatter parser is line-based; quote when
// the value contains characters that would confuse it (colons, leading dash).
function yamlEscape(value: string): string {
	if (/[:#]/.test(value) || /^\s/.test(value) || /^[-?!&*|>]/.test(value) || value.includes("'") || value.includes('"')) {
		return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
	}
	return value
}

function writeIfChanged(absPath: string, content: string): boolean {
	try {
		const existing = readFileSync(absPath, "utf8")
		if (existing === content) return false
	} catch {
		// file doesn't exist — write it
	}
	writeFileSync(absPath, content)
	return true
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

// Capability lookup with cross-provider union.
//
// models.dev publishes capabilities per (provider, modelId), and proxies like
// github-copilot routinely under-report what their upstream models can do
// (e.g. github-copilot/claude-opus-4.7 lists `[text, image]` while the native
// anthropic/claude-opus-4-7 lists `[text, image, pdf]`). The model brain is
// the same — we treat the union of capabilities across every provider that
// lists this modelId as the truth for routing decisions.
//
// We also normalize modelId punctuation (dots ↔ dashes) so github-copilot's
// `claude-opus-4.7` matches anthropic's `claude-opus-4-7`. This is the only
// alias convention I've seen in models.dev between proxy and native entries.
function lookupCaps(
	byProvider: CapsByProvider,
	providerId: string,
	modelId: string,
): { caps: ModelCaps | undefined; fellBack: boolean } {
	const norm = (s: string) => s.replace(/\./g, "-")
	const target = norm(modelId)

	const mergedInput = new Set<string>()
	let toolCall = false
	let reasoning = false
	let attachment = false
	let exactSeen = false
	let anySeen = false

	for (const [pid, models] of byProvider) {
		for (const [mid, caps] of models) {
			if (norm(mid) !== target) continue
			anySeen = true
			if (pid === providerId && mid === modelId) exactSeen = true
			for (const t of caps.input) mergedInput.add(t)
			if (caps.toolCall) toolCall = true
			if (caps.reasoning) reasoning = true
			if (caps.attachment) attachment = true
		}
	}

	if (!anySeen) return { caps: undefined, fellBack: false }
	return {
		caps: { input: Array.from(mergedInput), toolCall, reasoning, attachment },
		fellBack: !exactSeen,
	}
}

type ApiModel = {
	modalities?: { input?: string[]; output?: string[] }
	tool_call?: boolean
	reasoning?: boolean
	attachment?: boolean
}

const MODALITY_INPUT_TOKENS = new Set(["text", "image", "video", "audio", "pdf"])

function resolveAgentReqs(file: string, firstLine: string): { reqs: AgentReqs; profiles: string[] } {
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
		// Unknown model — assume only `text` modality, all flags false. Any
		// required token other than `text` fails. Exclusions are vacuously satisfied.
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
		env: process.env,
	})
	if (result.error) {
		log("opencode models failed", { providerId, error: String(result.error) })
		return []
	}
	if (result.status !== 0) {
		log("opencode models exit non-zero", {
			providerId,
			status: result.status,
			stderr: result.stderr?.slice(0, 200),
		})
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

function spawnDetachedWorker(): void {
	try {
		const scriptPath = fileURLToPath(import.meta.url)
		mkdirSync(LOG_DIR, { recursive: true })
		const fd = openSync(LOG_FILE, "a")
		const child = spawn("bun", [scriptPath, REGEN_FLAG], {
			detached: true,
			stdio: ["ignore", fd, fd],
			env: process.env,
			cwd: dirname(scriptPath),
		})
		child.unref()
		log("spawned detached regenerator", { pid: child.pid })
	} catch (err) {
		log("failed to spawn regenerator", { error: String(err) })
	}
}

export default function (pi: ExtensionAPI) {
	// Bootstrap: if no generated files yet, kick off a detached worker so first
	// session after install starts populating the matrix without blocking startup.
	if (listGeneratedFiles().length === 0) {
		log("no generated files found at factory time; spawning bootstrap worker")
		spawnDetachedWorker()
	}

	pi.on("session_shutdown", (event: { reason?: string }) => {
		// IMPORTANT: do not await. Pi awaits session_shutdown handlers (see
		// runner.js:52-58), so a synchronous regen here would block the exit
		// for the duration of the HTTP fetch + multiple `opencode models`
		// subprocesses. Instead we spawn a detached worker that outlives Pi
		// and regenerates on its own; the result is ready for the NEXT
		// session. Bootstrap (factory time) uses the same path.
		if (event.reason !== "quit") return
		log("session_shutdown quit; spawning detached regenerator")
		spawnDetachedWorker()
	})
}
