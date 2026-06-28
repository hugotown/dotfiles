import { initProjectConfig, loadConfig } from "../config/load.ts";
import { getRunsBaseDir, runPaths } from "../paths/run-paths.ts";
import { ensureSession, sessionGateFrom, SessionUnavailableError } from "../run/ensure-session.ts";
import { executeRun, type ExecuteResult } from "../run/execute.ts";
import { DEFAULT_REGISTRY } from "../run/phase-registry.ts";
import { realPorts } from "../run/ports.ts";
import { resolveRun } from "../run/resolve-run.ts";
import { startRun } from "../run/start.ts";
import type { CommandResult, PiCommandApi } from "../types/command.ts";
import type { CommandCtx, NotifyLevel } from "../types/ports.ts";
import { COMMAND_HELP } from "./help.ts";

function notify(ctx: CommandCtx, text: string, level: NotifyLevel = "info"): void {
	ctx.ui.notify(`[obra-sp-flow] ${text}`, level);
}

export function notifyOutcome(ctx: CommandCtx, result: ExecuteResult): void {
	if (result.kind === "complete") {
		notify(ctx, "ejecución completada");
	} else if (result.kind === "paused") {
		notify(ctx, `pausado en '${result.phaseId}' (esperando aprobación)`, "warning");
	} else {
		notify(ctx, `detenido en '${result.phaseId}': ${result.errors.join("; ")}`, "warning");
	}
}

export function showHelp(ctx: CommandCtx): CommandResult {
	notify(ctx, `\n${COMMAND_HELP}`);
	return { kind: "help" };
}

export function initConfig(ctx: CommandCtx, extDir: string): CommandResult {
	const result = initProjectConfig(ctx.cwd, extDir);
	notify(ctx, `${result.created ? "creado" : "existente"}: ${result.path}`);
	return { kind: "init", ...result };
}

export async function continueRun(
	ctx: CommandCtx,
	extDir: string,
	selector?: string,
): Promise<CommandResult> {
	const baseDir = getRunsBaseDir(ctx.sessionManager.getSessionFile());
	const runId = resolveRun(baseDir, selector);
	if (!runId) {
		notify(ctx, "no hay runs para reanudar", "warning");
		return { kind: "continue", runId: null };
	}
	notify(ctx, `run seleccionado: ${runId}`);
	const paths = runPaths(baseDir, runId);
	const { config } = loadConfig(ctx.cwd, extDir);
	const result = await executeRun({
		statePath: paths.statePath,
		runDir: paths.runDir,
		artifactsDir: paths.artifactsDir,
		config,
		ports: realPorts(ctx),
		registry: DEFAULT_REGISTRY,
	});
	notifyOutcome(ctx, result);
	return { kind: "continue", runId };
}

export async function startNewRun(
	ctx: CommandCtx,
	pi: PiCommandApi | undefined,
	extDir: string,
	requirement: string,
): Promise<CommandResult> {
	const { config, sources } = loadConfig(ctx.cwd, extDir);
	// First runtime action: anchor to a real pi session (never fall back to /tmp).
	let parentSessionFile: string;
	try {
		parentSessionFile = await ensureSession(sessionGateFrom(ctx, pi));
	} catch (err) {
		const reason = err instanceof SessionUnavailableError ? err.message : String(err);
		notify(ctx, `sesión no disponible: ${reason}`, "error");
		return { kind: "blocked", reason: "session-unavailable" };
	}
	const run = startRun({ requirement, parentSessionFile });
	notify(ctx, `run creado: ${run.runId}`);
	const result = await executeRun({
		statePath: run.paths.statePath,
		runDir: run.paths.runDir,
		artifactsDir: run.paths.artifactsDir,
		config,
		ports: realPorts(ctx),
		registry: DEFAULT_REGISTRY,
	});
	notifyOutcome(ctx, result);
	return {
		kind: "start",
		runId: run.runId,
		statePath: run.paths.statePath,
		configSources: sources.length,
	};
}
