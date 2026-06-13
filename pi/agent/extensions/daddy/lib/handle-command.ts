// lib/handle-command.ts — Route a ParsedCommand to controller/wt actions and report results.
import * as path from "node:path";
import { startRun, resumeRun, loadDef } from "./run-controller.ts";
import { listWorkflows } from "./discovery.ts";
import { listRuns } from "./state.ts";
import { buildSummary } from "./summary.ts";
import { wtMerge, wtRemove } from "./wt.ts";
import type { ParsedCommand } from "./command-router.ts";
import type { RunDeps, RunState } from "../runtime-types.ts";

type Report = (text: string) => void;
type OnPause = (s: RunState) => void;

async function settle(s: RunState, report: Report, onPause: OnPause): Promise<void> {
  report(buildSummary(s));
  if (s.status === "paused") onPause(s);
}

export async function handleCommand(p: ParsedCommand, deps: RunDeps, report: Report, onPause: OnPause, onObserver?: () => void, store?: import("../panel/store.ts").Store): Promise<void> {
  const dirs = [path.join(deps.projectDir, ".daddy"), deps.bundledDir];
  switch (p.kind) {
    case "run": {
      const runDeps = store ? {
        ...deps,
        onStream: (nodeId: string, text: string) => store.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() }),
        emit: (state: RunState) => { deps.emit(state); store.setRun(state); },
      } : deps;
      return settle(await startRun(p.flow, p.args, runDeps), report, onPause);
    }
    case "resume": return settle(await resumeRun(p.id, deps), report, onPause);
    case "approve": case "reject": {
      const active = listRuns(deps.home).find((r) => r.status === "paused");
      if (!active) return report("No paused run to act on.");
      const comment = p.kind === "approve" ? p.comment : p.reason;
      return settle(await resumeRun(active.id, deps, { decision: p.kind, comment }), report, onPause);
    }
    case "list": return report(listWorkflows(dirs).map((w) => `- ${w.name}: ${w.description}`).join("\n") || "No workflows.");
    case "status": return report(listRuns(deps.home).map((r) => `${r.id} ${r.workflow} ${r.status}`).join("\n") || "No runs.");
    case "observer": { if (onObserver) onObserver(); return; }
    case "validate": { try { loadDef(p.name, deps); report(`Workflow "${p.name}" is valid.`); } catch (e) { report(e instanceof Error ? e.message : String(e)); } return; }
    case "merge": await wtMerge(deps.exec, deps.projectDir); return report("Worktree merged.");
    case "remove": { const r = listRuns(deps.home).reverse().find((x) => x.worktree); if (r?.worktree) await wtRemove(deps.exec, r.worktree.branch, deps.projectDir); return report("Worktree removed."); }
    case "keep": return report("Worktree kept.");
    case "unknown": return report(`Unknown subcommand: ${p.raw}. Try: flow=<name> <args>, list, status, approve, reject, resume <id>, merge, remove, keep, validate <name>.`);
  }
}
