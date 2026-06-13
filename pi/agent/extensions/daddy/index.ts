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
import type { RunState } from "./runtime-types.ts";
import { createStore } from "./panel/store.ts";
import { openDaddyPanel } from "./panel/open.ts";

export default function daddy(pi: ExtensionAPI): void {
  const onPause = (s: RunState) => pi.appendEntry(STATE_ENTRY, { id: s.id, paused_node: s.paused_node });
  const report = (text: string) => pi.sendMessage({ customType: CMD_NAME, content: text, display: true });

  let activeStore: ReturnType<typeof createStore> | null = null;

  const openPanel = (ctx: ExtensionContext) => {
    if (!activeStore) activeStore = createStore();
    openDaddyPanel(ctx as any, activeStore, makeDeps(pi, ctx));
  };

  pi.registerCommand(CMD_NAME, {
    description: "Run/resume a daddy workflow DAG (flow=<name>, approve, reject, resume, list, status, merge, remove, validate, observer)",
    handler: async (args, ctx) => {
      try {
        await handleCommand(parseCommand(args), makeDeps(pi, ctx), report, onPause, () => openPanel(ctx));
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
      const deps = makeDeps(pi, ctx);
      activeStore = createStore();
      const s = await startRun(p.flow, p.arguments ?? "", {
        ...deps,
        onStream: (nodeId, text) => activeStore!.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() }),
        emit: (state) => { deps.emit(state); activeStore!.setRun(state); },
      });
      openPanel(ctx);
      return { content: [{ type: "text", text: buildSummary(s) }], details: s };
    },
  });

  pi.on("session_start", (_e, ctx: ExtensionContext) => {
    const paused = listRuns(makeDeps(pi, ctx).home).find((r) => r.status === "paused");
    if (paused) ctx.ui.notify(`daddy: run ${paused.id} paused at "${paused.paused_node}". /${CMD_NAME} observer`, "info");
  });
}
