// lib/handle-command.ts — Route a ParsedCommand to controller/wt actions and report results.
import * as path from "node:path";
import { startRun, resumeRun, loadDef } from "./run-controller.ts";
import { listWorkflows } from "./discovery.ts";
import { findRun, listRuns, runFile } from "./state.ts";
import { buildSummary } from "./summary.ts";
import { buildStatusReport } from "./status-report.ts";
import { buildDoctorReport } from "./doctor.ts";
import { cancelRun, cleanupReport, recoverRun, resetNodeForRetry } from "./run-control.ts";
import { buildPreflightReport } from "./preflight.ts";
import { wtMerge, wtRemove } from "./wt.ts";
import type { ParsedCommand } from "./command-router.ts";
import type { RunDeps, RunState } from "../runtime-types.ts";

type Report = (text: string) => void;
type OnPause = (s: RunState) => void;

async function settle(s: RunState, report: Report, onPause: OnPause): Promise<void> {
  report(buildSummary(s));
  if (s.status === "paused") onPause(s);
}

export async function handleCommand(p: ParsedCommand, deps: RunDeps, report: Report, onPause: OnPause, onObserver?: () => void): Promise<void> {
  const dirs = [path.join(deps.projectDir, ".daddy"), deps.bundledDir];
  switch (p.kind) {
    case "run": return settle(await startRun(p.flow, p.args, deps), report, onPause);
    case "resume": return settle(await resumeRun(p.id, deps), report, onPause);
    case "approve": case "reject": {
      const active = listRuns(deps.home).find((r) => r.status === "paused");
      if (!active) return report("No paused run to act on.");
      const comment = p.kind === "approve" ? p.comment : p.reason;
      return settle(await resumeRun(active.id, deps, { decision: p.kind, comment }), report, onPause);
    }
    case "list": return report(listWorkflows(dirs).map((w) => `- ${w.name}: ${w.description}`).join("\n") || "No workflows.");
    case "status": {
      if (!p.id) return report(listRuns(deps.home).map((r) => `${r.id} ${r.workflow} ${r.status}`).join("\n") || "No runs.");
      const run = findRun(deps.home, p.id);
      if (!run) return report(`Run not found or ambiguous: ${p.id}`);
      return report(buildStatusReport(run, runFile(deps.home, run.id)));
    }
    case "observer": { if (onObserver) onObserver(); return; }
    case "doctor": return report(await buildDoctorReport({ home: deps.home, projectDir: deps.projectDir, bundledDir: deps.bundledDir, exec: deps.exec }));
    case "cancel": return report(cancelRun(deps.home, p.id, p.reason));
    case "recover": return report(recoverRun(deps.home, p.id));
    case "retry": {
      const run = findRun(deps.home, p.id);
      if (!run) return report(`Run not found or ambiguous: ${p.id}`);
      const def = loadDef(run.workflow, deps);
      return report(resetNodeForRetry(deps.home, run.id, p.node, def.nodes));
    }
    case "cleanup": return report(cleanupReport(deps.home));
    case "preflight": {
      const def = loadDef(p.flow, deps);
      return report(buildPreflightReport(def, p.args));
    }
    case "validate": { try { loadDef(p.name, deps); report(`Workflow "${p.name}" is valid.`); } catch (e) { report(e instanceof Error ? e.message : String(e)); } return; }
    case "merge": await wtMerge(deps.exec, deps.projectDir); return report("Worktree merged.");
    case "remove": { const r = listRuns(deps.home).reverse().find((x) => x.worktree); if (r?.worktree) await wtRemove(deps.exec, r.worktree.branch, deps.projectDir); return report("Worktree removed."); }
    case "keep": return report("Worktree kept.");
    case "unknown": return report(`Unknown subcommand: ${p.raw}. Try: flow=<name> <args>, list, status [id], doctor, preflight <name>, approve, reject, resume <id>, cancel <id>, recover <id>, retry <id> <node>, cleanup, merge, remove, keep, validate <name>.`);
  }
}
