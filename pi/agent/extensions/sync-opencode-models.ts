/**
 * sync-opencode-models — Pi extension that refreshes the opencode / opencode-go
 * model lists in `~/.pi/agent/settings.json` when Pi is quit.
 *
 * On `session_shutdown` with reason="quit":
 *   1. Runs `opencode models opencode` and `opencode models opencode-go` in
 *      parallel (each prints one `<provider>/<model-id>` per line).
 *   2. Reads settings.json, replaces the entries for those two providers in
 *      `enabledModels` with the fresh lists, preserves every other entry.
 *   3. Writes atomically (temp file + rename) to avoid corruption if Pi is
 *      killed mid-write.
 *
 * Safety rules:
 *   - Pi awaits the handler (runner.js:52-58), so the sync completes before
 *     teardown.
 *   - We only run on reason="quit". `reload` / `new` / `resume` / `fork` are
 *     ignored — they aren't real exits and we don't want to thrash the file.
 *   - If a provider's `opencode models <name>` returns zero parseable lines
 *     (e.g. transient auth failure), we leave that provider's entries alone
 *     instead of wiping them.
 *   - Errors never throw out of the handler; Pi's shutdown path must not be
 *     blocked by us.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");
const PROVIDERS = ["opencode-go", "opencode"] as const;
type SyncedProvider = (typeof PROVIDERS)[number];

function log(level: "info" | "warn" | "error", message: string): void {
	console.error(`[sync-opencode-models] ${level.toUpperCase()} ${message}`);
}

function runOpencodeModels(provider: SyncedProvider): Promise<string[]> {
	return new Promise((resolve) => {
		const child = spawn("opencode", ["models", provider], {
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
		child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));

		child.on("error", (err) => {
			log("warn", `spawn 'opencode models ${provider}' failed: ${err.message}`);
			resolve([]);
		});

		child.on("exit", (code) => {
			if (code !== 0) {
				log(
					"warn",
					`'opencode models ${provider}' exited with code ${code}; stderr=${stderr.slice(0, 200)}`,
				);
				resolve([]);
				return;
			}
			const prefix = `${provider}/`;
			const ids = stdout
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.startsWith(prefix));
			resolve(ids);
		});
	});
}

function mergeEnabledModels(
	previous: string[],
	freshByProvider: Map<SyncedProvider, string[]>,
): string[] {
	const isManaged = (id: string): boolean =>
		PROVIDERS.some((p) => id.startsWith(`${p}/`));

	// Anchor: the index of the first managed entry in the original list. The
	// fresh blocks slot in there so the user's preferred ordering (vertex,
	// claude-local-cli, ..., opencode-go block, opencode block, ...) is kept.
	let anchor = previous.findIndex(isManaged);
	if (anchor === -1) anchor = previous.length;

	// Per-provider: if fresh list is empty (probably an error), keep the old
	// entries for that provider. Otherwise replace them entirely.
	const finalBlocks: string[] = [];
	for (const provider of PROVIDERS) {
		const fresh = freshByProvider.get(provider) ?? [];
		if (fresh.length > 0) {
			finalBlocks.push(...fresh);
		} else {
			const kept = previous.filter((id) => id.startsWith(`${provider}/`));
			if (kept.length > 0) {
				log(
					"warn",
					`provider '${provider}' returned no models; preserving ${kept.length} existing entries`,
				);
			}
			finalBlocks.push(...kept);
		}
	}

	// By definition of `anchor` (the first managed entry), every element in
	// `previous[0..anchor-1]` is a survivor, so the first `anchor` survivors
	// are exactly the ones that lived before the managed block.
	const survivors = previous.filter((id) => !isManaged(id));
	return [
		...survivors.slice(0, anchor),
		...finalBlocks,
		...survivors.slice(anchor),
	];
}

async function writeSettingsAtomic(target: string, json: string): Promise<void> {
	const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
	await fs.writeFile(tmp, json, "utf8");
	await fs.rename(tmp, target);
}

async function syncSettings(): Promise<void> {
	const [opencodeGo, opencode] = await Promise.all([
		runOpencodeModels("opencode-go"),
		runOpencodeModels("opencode"),
	]);
	const fresh = new Map<SyncedProvider, string[]>([
		["opencode-go", opencodeGo],
		["opencode", opencode],
	]);

	const totalFresh = opencodeGo.length + opencode.length;
	if (totalFresh === 0) {
		log("warn", "both providers returned no models; skipping write");
		return;
	}

	const raw = await fs.readFile(SETTINGS_PATH, "utf8");
	const settings = JSON.parse(raw) as Record<string, unknown>;

	if (!Array.isArray(settings.enabledModels)) {
		log("warn", "settings.enabledModels missing or not an array; skipping");
		return;
	}

	const previous = (settings.enabledModels as string[]).slice();
	const merged = mergeEnabledModels(previous, fresh);

	// Skip the write if nothing changed (avoids touching mtime / disk needlessly).
	if (
		merged.length === previous.length &&
		merged.every((id, i) => id === previous[i])
	) {
		log("info", "enabledModels already in sync; nothing to write");
		return;
	}

	settings.enabledModels = merged;
	await writeSettingsAtomic(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);

	const before = new Set(previous.filter((id) => id.startsWith("opencode")));
	const after = new Set(merged.filter((id) => id.startsWith("opencode")));
	const added = [...after].filter((id) => !before.has(id));
	const removed = [...before].filter((id) => !after.has(id));
	log(
		"info",
		`synced (added=${added.length} removed=${removed.length}) added=[${added.join(", ")}] removed=[${removed.join(", ")}]`,
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async (event) => {
		if (event.reason !== "quit") return;
		try {
			await syncSettings();
		} catch (err: any) {
			log("error", `sync failed: ${err?.message || err}`);
		}
	});
}
