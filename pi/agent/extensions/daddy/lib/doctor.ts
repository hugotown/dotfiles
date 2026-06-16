import * as fs from "node:fs";
import * as path from "node:path";
import { listWorkflows } from "./discovery.ts";
import { loadDef } from "./run-controller.ts";
import { listRuns } from "./state.ts";
import type { ExecLike } from "../runtime-types.ts";

interface DoctorInput {
  home: string;
  projectDir: string;
  bundledDir: string;
  exec: ExecLike;
}

function dirLine(label: string, dir: string): string {
  try {
    const stat = fs.statSync(dir);
    return `- ${label}: ${stat.isDirectory() ? "ok" : "not a directory"} (${dir})`;
  } catch {
    return `- ${label}: missing (${dir})`;
  }
}

async function commandLine(exec: ExecLike, command: string): Promise<string> {
  const result = await exec(command, ["--version"]);
  return `- ${command}: ${result.code === 0 ? "ok" : "unavailable"}`;
}

export async function buildDoctorReport(input: DoctorInput): Promise<string> {
  const dirs = [path.join(input.projectDir, ".daddy"), input.bundledDir];
  const workflows = listWorkflows(dirs);
  let valid = 0;
  const invalid: string[] = [];
  for (const wf of workflows) {
    try {
      loadDef(wf.name, { exec: input.exec, notify: () => {}, emit: () => {}, home: input.home, bundledDir: input.bundledDir, projectDir: input.projectDir });
      valid++;
    } catch (e) {
      invalid.push(`${wf.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const runs = listRuns(input.home);
  const stale = runs.filter((r) => r.status === "running" && Date.parse(r.started_at) < Date.now() - 60 * 60 * 1000).map((r) => r.id);
  const lines = [
    "Daddy doctor report",
    "",
    "Filesystem",
    dirLine("home", input.home),
    dirLine("runs", path.join(input.home, "runs")),
    dirLine("artifacts", path.join(input.home, "artifacts")),
    dirLine("project workflows", path.join(input.projectDir, ".daddy", "workflows")),
    dirLine("project commands", path.join(input.projectDir, ".daddy", "commands")),
    "",
    "Workflows",
    `- workflows: ${valid} valid, ${invalid.length} invalid`,
    ...invalid.map((x) => `- invalid: ${x}`),
    "",
    "Runs",
    `- total runs: ${runs.length}`,
    `- stale running runs: ${stale.length ? stale.join(", ") : "none"}`,
    "",
    "Commands",
    await commandLine(input.exec, "pi"),
    await commandLine(input.exec, "wt"),
    await commandLine(input.exec, "gh"),
    await commandLine(input.exec, "bun"),
    await commandLine(input.exec, "uv"),
  ];
  return lines.join("\n");
}
