// lib/deps.ts — Build the injected RunDeps from the pi API and context.
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { RunDeps, RunState } from "../runtime-types.ts";

interface PiLike { exec: RunDeps["exec"]; }
interface CtxLike {
  cwd: string;
  ui: {
    notify: (m: string, l?: "info" | "warning" | "error") => void;
    setStatus: (k: string, t: string | undefined) => void;
    setWorkingMessage: (m?: string) => void;
  };
  model?: { provider: string; id: string };
}

function progressLine(s: RunState): string {
  const entries = Object.entries(s.nodes);
  const done = entries.filter(([, n]) => n.status === "completed").length;
  const running = entries.filter(([, n]) => n.status === "running").map(([k]) => k);
  const tail = running.length > 0 ? `running ${running.join(", ")}` : s.status;
  return `${s.workflow}: ${tail} (${done}/${entries.length})`;
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 70 ? `…${flat.slice(-70)}` : flat;
}

export function makeDeps(pi: PiLike, ctx: CtxLike): RunDeps {
  return {
    exec: pi.exec,
    notify: (m, l) => ctx.ui.notify(m, l),
    emit: (s: RunState) => {
      const line = progressLine(s);
      ctx.ui.setStatus("daddy", line);
      if (s.status === "running") ctx.ui.setWorkingMessage(line);
      else ctx.ui.setWorkingMessage();
    },
    progress: (nodeId, text) => ctx.ui.setWorkingMessage(`${nodeId}: ${snippet(text)}`),
    home: path.join(ctx.cwd, ".daddy"),
    bundledDir: fileURLToPath(new URL("..", import.meta.url)),
    projectDir: ctx.cwd,
    defaultProvider: ctx.model?.provider,
    defaultModel: ctx.model?.id,
  };
}
