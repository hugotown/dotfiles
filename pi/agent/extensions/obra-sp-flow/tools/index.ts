// obra_spec — the brainstorm phase's commit tool. Writes the finalized design
// spec to disk and flags readiness so the agent_end handler can advance.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { FlowState } from "../types.ts";
import { specPath } from "../lib/paths.ts";

type GetState = () => FlowState | null;
type SetState = (s: FlowState) => void;

export function registerTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "obra_spec",
    label: "Obra: Write Spec",
    description: "Commit the finalized design spec. Call ONLY when ambiguity is zero.",
    parameters: Type.Object({
      intent: Type.String({ description: "Requirement intent: architecture|design|feature|bug|behavior" }),
      title: Type.String({ description: "Short spec title" }),
      spec: Type.String({ description: "Full design markdown incl. a 'Decisions & Resolved Ambiguities' section" }),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const s = get();
      if (!s) throw new Error("No active obra-sp-flow workflow");
      const p = specPath(ctx.cwd, s.idea);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, `# ${params.title}\n\n${params.spec}\n`, "utf-8");
      set({ ...s, scratch: { ...s.scratch, specReady: true, specPath: p, intent: params.intent } });
      return { content: [{ type: "text", text: `Spec written: ${p}` }], details: null, terminate: true };
    },
  });
}
