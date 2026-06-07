// /asa:question — spawns `python3 -m session_analyzer ask <args>` and shows
// the result in pi's UI. Pure facade: zero DB knowledge here.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";

const PKG_DIR = "/Users/hugoruiz/.config/agent-tools/session-analyzer/src";

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("asa:question", {
    description: "Pregunta al session-analyzer sobre tus sesiones históricas",
    handler: async (args, ctx) => {
      const question = args.trim();
      if (!question) {
        ctx.ui.notify("Uso: /asa:question <pregunta>", "warning");
        return;
      }
      const child = spawn("python3", ["-m", "session_analyzer", "ask", question], {
        cwd: PKG_DIR,
        encoding: "utf-8",
        timeout: 30_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (data) => { stdout += data; });
      child.stderr?.on("data", (data) => { stderr += data; });
      child.on("close", (code) => {
        if (code !== 0) {
          ctx.ui.notify(`asa:question falló: ${stderr || `exit ${code}`}`, "error");
          return;
        }
        const out = stdout.trim() || "(sin resultados)";
        ctx.ui.notify(out, "info");
      });
      child.on("error", (err) => {
        ctx.ui.notify(`asa:question falló: ${err.message}`, "error");
      });
    },
  });
}
