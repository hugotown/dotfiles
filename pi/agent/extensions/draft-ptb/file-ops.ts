// File system operations: feature folder, save brainstorming/spec/plan/run.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "./state.ts";
import { slugify } from "./utils.ts";
import { renderBrainstorming, renderRunJson } from "./file-renders.ts";

const OBSIDIAN_PROJECTS_ROOT =
  "/Users/hugoruiz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Projects";

export function projectSlug(cwd: string): string {
  return cwd.replace(/^\/+/, "").replace(/\//g, "-");
}

export function featureFolder(cwd: string, idea: string, startedAt: string): string {
  const project = projectSlug(cwd);
  const tsSafe = startedAt.replace(/[:.]/g, "-");
  return `${OBSIDIAN_PROJECTS_ROOT}/${project}/features/${tsSafe}-${slugify(idea)}`;
}

async function ensureDir(absPath: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(absPath, { recursive: true });
}

async function writeUtf8(absPath: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(absPath, content, "utf8");
}

export async function saveBrainstorming(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const p = `${state.featureFolder}/brainstorming.md`;
  await writeUtf8(p, renderBrainstorming(state));
  return p;
}

export async function saveSpec(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const p = `${state.featureFolder}/spec.md`;
  await writeUtf8(p, `# ${state.specTitle}\n\n${state.spec}`);
  return p;
}

export async function savePlan(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const p = `${state.featureFolder}/plan.md`;
  await writeUtf8(p, state.plan);
  return p;
}

export async function saveRun(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  const runsDir = `${state.featureFolder}/runs`;
  await ensureDir(runsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const p = `${runsDir}/${ts}.json`;
  await writeUtf8(p, renderRunJson(state));
  return p;
}
