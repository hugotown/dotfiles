// index.ts — Entry point: wire the /daddy command, tool, and panel.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CMD_NAME, STATE_ENTRY } from "./constants.ts";
import { parseCommand } from "./lib/command-router.ts";
import { handleCommand } from "./lib/handle-command.ts";
import { makeDeps } from "./lib/deps.ts";
import { startRun } from "./lib/run-controller.ts";
import { buildSummary } from "./lib/summary.ts";
import { listRuns } from "./lib/state.ts";
import { RunWorkflowParams } from "./schema.ts";
import type { RunDeps, RunState } from "./runtime-types.ts";
import { createStore, type Store } from "./panel/store.ts";
import { openDaddyPanel } from "./panel/open.ts";
import { wrapDeps } from "./panel/wire.ts";

export default function daddy(pi: ExtensionAPI): void {
  const onPause = (s: RunState) => pi.appendEntry(STATE_ENTRY, { id: s.id, paused_node: s.paused_node });
  const report = (text: string) => pi.sendMessage({ customType: CMD_NAME, content: text, display: true });

  let activeStore: Store | null = null;
  let panelOpen = false;

  const openPanel = (ctx: ExtensionContext, store: Store, deps: RunDeps) => {
    if (panelOpen || !ctx.hasUI) return;
    panelOpen = true;
    void openDaddyPanel(ctx, store, deps).finally(() => { panelOpen = false; });
  };

  const hydrate = (store: Store, home: string) => {
    const runs = listRuns(home);
    const run = runs.find((r) => r.status === "paused") ?? runs.find((r) => r.status === "running");
    if (!run) return;
    store.setRun(run);
    if (run.status === "paused" && run.paused_node) {
      store.setWaiting(run.paused_node, run.nodes[run.paused_node]?.output ?? "");
    }
  };

  pi.registerCommand(CMD_NAME, {
    description: "Run/resume a daddy workflow DAG (flow=<name>, approve, reject, resume, list, status, merge, remove, validate, observer)",
    handler: async (args, ctx) => {
      try {
        const parsed = parseCommand(args);
        const base = makeDeps(pi, ctx);
        if (parsed.kind === "run") {
          activeStore = createStore();
          const deps = wrapDeps(activeStore, base);
          openPanel(ctx, activeStore, deps);
          await handleCommand(parsed, deps, report, onPause);
          return;
        }
        const onObserver = () => {
          if (!activeStore) { activeStore = createStore(); hydrate(activeStore, base.home); }
          openPanel(ctx, activeStore, wrapDeps(activeStore, base));
        };
        const deps = activeStore ? wrapDeps(activeStore, base) : base;
        await handleCommand(parsed, deps, report, onPause, onObserver);
      } catch (e) { ctx.ui.notify(`daddy: ${e instanceof Error ? e.message : e}`, "error"); }
    },
  });

  pi.registerTool({
    name: "daddy",
    label: "Daddy",
    description: "Run a daddy workflow DAG by name; returns a per-node summary.",
    parameters: RunWorkflowParams,
    execute: async (_id, params, _signal, _onUpdate, ctx) => {
      const p = params as { flow: string; arguments?: string };
      activeStore = createStore();
      const deps = wrapDeps(activeStore, makeDeps(pi, ctx));
      openPanel(ctx, activeStore, deps);
      const s = await startRun(p.flow, p.arguments ?? "", deps);
      return { content: [{ type: "text", text: buildSummary(s) }], details: s };
    },
  });

  pi.on("session_start", (_e, ctx: ExtensionContext) => {
    const paused = listRuns(makeDeps(pi, ctx).home).find((r) => r.status === "paused");
    if (paused) ctx.ui.notify(`daddy: run ${paused.id} paused at "${paused.paused_node}". /${CMD_NAME} observer`, "info");
  });
}