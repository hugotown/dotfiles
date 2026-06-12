// obra_spec + obra_stories — the brainstorm phase's commit tools.
// obra_stories: writes user stories (Given/When/Then) into scratch for the spec node.
// obra_spec: writes the finalized design spec to disk and flags readiness.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { FlowState } from "../types.ts";
import { specPath } from "../lib/paths.ts";
import { validateSpec } from "../phases/brainstorm/spec-validate.ts";
import { validateStories } from "../phases/brainstorm/stories.ts";

type GetState = () => FlowState | null;
type SetState = (s: FlowState) => void;

export function registerTools(pi: ExtensionAPI, get: GetState, set: SetState): void {
  pi.registerTool({
    name: "obra_stories",
    label: "Obra: Write User Stories",
    description: "Commit user stories with Given/When/Then acceptance criteria. Call after questions are resolved, before writing the spec.",
    parameters: Type.Object({
      stories: Type.String({ description: "User stories in markdown with Given/When/Then acceptance criteria for each story" }),
    }),
    async execute(_id, params, _sig, _upd, _ctx) {
      const s = get();
      if (!s) throw new Error("No active obra-sp-flow workflow");
      const { valid, problems } = validateStories(params.stories);
      if (!valid) {
        return { content: [{ type: "text", text: `Stories rejected — fix these and call obra_stories again:\n- ${problems.join("\n- ")}` }], details: null, terminate: false };
      }
      set({ ...s, scratch: { ...s.scratch, brainstorm: { ...(s.scratch.brainstorm ?? {}), userStories: params.stories, node: "spec" }, storiesReady: true } });
      return { content: [{ type: "text", text: "User stories accepted. The spec node will include them." }], details: null, terminate: true };
    },
  });

  pi.registerTool({
    name: "obra_spec",
    label: "Obra: Write Spec",
    description: "Commit the finalized design spec. Call ONLY when ambiguity is zero.",
    parameters: Type.Object({
      intent: Type.String({ description: "Requirement intent: architecture|design|feature|bug|behavior" }),
      title: Type.String({ description: "Short spec title" }),
      spec: Type.String({ description: "Full design markdown incl. a 'Decisions & Resolved Ambiguities' section and acceptance criteria" }),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const s = get();
      if (!s) throw new Error("No active obra-sp-flow workflow");
      // Code-driven quality gate: reject (without terminating) so the model fixes
      // and re-calls. specReady stays false until a complete spec lands.
      const problems = validateSpec(params.spec);
      if (problems.length) {
        return { content: [{ type: "text", text: `Spec rejected — fix these and call obra_spec again:\n- ${problems.join("\n- ")}` }], details: null, terminate: false };
      }
      const p = specPath(ctx.cwd, s.idea);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      // Avoid a duplicated H1: only prepend the title when the spec lacks its own.
      const body = params.spec.trimStart();
      const content = (/^#\s/.test(body) ? body : `# ${params.title}\n\n${body}`).replace(/\n*$/, "\n");
      fs.writeFileSync(p, content, "utf-8");
      set({ ...s, scratch: { ...s.scratch, specReady: true, specPath: p, intent: params.intent } });
      return { content: [{ type: "text", text: `Spec written: ${p}` }], details: null, terminate: true };
    },
  });
}
