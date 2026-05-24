import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPhaseConfig, drivePhase } from "../orchestrator.ts";
import { libraryResearchPrompt } from "../lib/prompts.ts";
import { artifactPath, dateStamp, sanitizeSlug } from "../lib/paths.ts";
import { researchPathFor } from "./plan.ts";
import type { LibraryRef, PipelineState } from "../state.ts";

/**
 * Safety net only: caps how many clean-context turns the orchestrator spends re-researching the
 * SAME library when confidence stays below "high". It does not cap searches within a turn.
 */
export const MAX_LIBRARY_ATTEMPTS = 4;

/** Per-library notes file (one per library so each research turn stays in clean context). */
export function libraryNotesPath(s: PipelineState, lib: LibraryRef): string {
	return artifactPath(s.artifactFolder ?? ".", dateStamp(), s.slug ?? "feature", `lib-${sanitizeSlug(lib.name)}`);
}

/** Read the LIBRARIES section of the research file and resolve each library's manifest version. */
export async function librariesFromResearch(pi: ExtensionAPI, s: PipelineState): Promise<LibraryRef[]> {
	const text = await safeCat(pi, researchPathFor(s));
	const parsed = parseLibraries(text);
	const out: LibraryRef[] = [];
	for (const p of parsed) {
		const version = await detectVersion(pi, p.name);
		out.push({ name: p.name, version, topic: p.topic, status: "pending", confidence: null });
	}
	return out;
}

/** Drive the clean-context research turn for the current library (carrying prior notes on retry). */
export async function startLibraryResearch(pi: ExtensionAPI, ctx: ExtensionContext, s: PipelineState): Promise<void> {
	const lib = s.libraries[s.currentLibraryIndex];
	if (!lib) return;
	ctx.ui.setStatus("dev-pipeline", `🔬 library ${s.currentLibraryIndex + 1}/${s.libraries.length}: ${lib.name}`);
	if (!(await applyPhaseConfig(pi, ctx, "LIBRARY_RESEARCH"))) return;
	const notesPath = libraryNotesPath(s, lib);
	const priorNotes = s.libraryAttempts > 0 ? await safeCat(pi, notesPath) : "";
	drivePhase(pi, libraryResearchPrompt(lib, notesPath, priorNotes, s.libraryAttempts));
}

/** Extract the self-declared confidence from the research reply (defaults to "low" if absent). */
export function parseConfidence(text: string): "high" | "medium" | "low" {
	const m = text.match(/CONFIDENCE:\s*(high|medium|low)/i);
	return m ? (m[1].toLowerCase() as "high" | "medium" | "low") : "low";
}

/** Concatenate every library's notes to hand off to the plan author. */
export async function gatherLibraryNotes(pi: ExtensionAPI, s: PipelineState): Promise<string> {
	const parts: string[] = [];
	for (const lib of s.libraries) {
		const c = await safeCat(pi, libraryNotesPath(s, lib));
		if (c.trim()) parts.push(`## ${lib.name}@${lib.version} (confidence: ${lib.confidence ?? "n/a"})\n${c.trim()}`);
	}
	return parts.join("\n\n") || "(no library research)";
}

// --- internals ---

function parseLibraries(text: string): { name: string; topic: string }[] {
	const out: { name: string; topic: string }[] = [];
	let inSection = false;
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (/^LIBRARIES:/.test(t)) {
			inSection = true;
			continue;
		}
		if (/^[A-Z]+:/.test(t)) inSection = false;
		if (inSection) {
			const m = line.match(/^\s*-\s*(.+)$/);
			if (m) {
				const [name, ...rest] = m[1].split("|");
				if (name.trim()) out.push({ name: name.trim(), topic: rest.join("|").trim() });
			}
		}
	}
	return out;
}

/** Best-effort version detection across the common manifests; "unknown" if nothing matches. */
async function detectVersion(pi: ExtensionAPI, name: string): Promise<string> {
	const pkg = await safeCat(pi, "package.json");
	if (pkg) {
		try {
			const j = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
			const v = j.dependencies?.[name] ?? j.devDependencies?.[name];
			if (v) return cleanVersion(String(v));
		} catch {
			// fall through to text manifests
		}
	}
	for (const f of ["go.mod", "Cargo.toml", "pyproject.toml", "requirements.txt"]) {
		const c = await safeCat(pi, f);
		if (!c) continue;
		const v = matchVersion(c, name);
		if (v) return v;
	}
	return "unknown";
}

function cleanVersion(raw: string): string {
	return raw.replace(/^[\^~>=<\s]+/, "").trim() || "unknown";
}

function matchVersion(content: string, name: string): string | null {
	const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// name, then any run of separators/operators/quotes (= : @ > < ~ ^ space " '), optional "v", then version.
	const re = new RegExp(`${esc}[\\s"'=:@>~^<]*v?(\\d+\\.\\d+[\\w.\\-]*)`, "i");
	const m = content.match(re);
	return m ? m[1] : null;
}

async function safeCat(pi: ExtensionAPI, path: string): Promise<string> {
	try {
		const r = await pi.exec("cat", [path]);
		return r.code === 0 ? r.stdout : "";
	} catch {
		return "";
	}
}
