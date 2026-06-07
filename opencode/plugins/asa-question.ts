// /asa:question plugin — registers a custom tool the LLM can call directly.
// The slash command in commands/asa:question.md covers user-typed invocations;
// this tool covers LLM-typed invocations (e.g. when the agent wants to query
// the analyzer on its own). Both paths share the same Python backend.
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { spawnSync } from "node:child_process";

const PKG_DIR = "/Users/hugoruiz/.config/agent-tools/session-analyzer/src";

export const AsaQuestion: Plugin = async () => {
  return {
    tool: {
      asa_question: tool({
        description:
          "Query the session-analyzer DuckDB for historical session data. " +
          "Returns a plain-text summary sourced from past opencode/claude/pi sessions.",
        args: {
          question: tool.schema
            .string()
            .describe(
              "Natural-language question, e.g. " +
                "'qué indicaciones di al skill brainstorming'",
            ),
        },
        async execute(args) {
          const r = spawnSync(
            "python3",
            ["-m", "session_analyzer", "ask", args.question],
            { cwd: PKG_DIR, encoding: "utf-8", timeout: 30_000 },
          );
          if (r.error) return `error: ${r.error.message}`;
          if (r.status !== 0) {
            return `error: ${(r.stderr || "").trim() || `exit ${r.status}`}`;
          }
          return (r.stdout || "").trim() || "(sin resultados)";
        },
      }),
    },
  };
};
