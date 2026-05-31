import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "./state.ts";

const OBSIDIAN_PROJECTS_ROOT =
  "/Users/hugoruiz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Projects";

/** Slugify the user's idea — first 30 chars, alphanumeric + dashes only. */
export function slugify(idea: string): string {
  return idea.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/(^-+|-+$)/g, "");
}

/** Escape an absolute path into a single folder name (decision D6). */
export function projectSlug(cwd: string): string {
  return cwd.replace(/^\/+/, "").replace(/\//g, "-");
}

/**
 * Absolute path of the per-feature folder inside Obsidian.
 * Layout: <OBSIDIAN_PROJECTS_ROOT>/<project-slug>/features/<startedAt>-<idea-slug>/
 */
export function featureFolder(cwd: string, idea: string, startedAt: string): string {
  const project = projectSlug(cwd);
  const tsSafe = startedAt.replace(/[:.]/g, "-"); // ISO -> filesystem-safe
  const idea_ = slugify(idea);
  const feature = `${tsSafe}-${idea_}`;
  return `${OBSIDIAN_PROJECTS_ROOT}/${project}/features/${feature}`;
}

async function ensureDir(absPath: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(absPath, { recursive: true });
}

async function writeUtf8(absPath: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(absPath, content, "utf8");
}

/** Render brainstorming.md from current state (after answers are collected). */
function renderBrainstorming(state: DraftState): string {
  const qa = state.answers
    .map((a, i) => `### Q${i + 1}: ${a.question}\n\n${a.answer}`)
    .join("\n\n");

  return `# Brainstorming

**Idea:** ${state.idea}

**Started at:** ${state.startedAt}

## Project Context (compressed)

${state.compressedContext || "_(not gathered)_"}

## Clarifying Questions

${qa || "_(no answers)_"}
`;
}

/** Render the run snapshot (decision B6). */
function renderRunJson(state: DraftState): string {
  // Strip transient fields that pollute the snapshot but are not useful post-mortem.
  const snapshot = {
    phase: state.phase,
    idea: state.idea,
    featureFolder: state.featureFolder,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    questions: state.questions,
    answers: state.answers,
    approaches: state.approaches,
    recommendation: state.recommendation,
    chosenApproach: state.chosenApproach,
    specTitle: state.specTitle,
    specPath: state.specPath,
    planPath: state.planPath,
    brainstormingPath: state.brainstormingPath,
  };
  return JSON.stringify(snapshot, null, 2);
}

export async function saveBrainstorming(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const path = `${state.featureFolder}/brainstorming.md`;
  await writeUtf8(path, renderBrainstorming(state));
  return path;
}

export async function saveSpec(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const path = `${state.featureFolder}/spec.md`;
  await writeUtf8(path, `# ${state.specTitle}\n\n${state.spec}`);
  return path;
}

export async function savePlan(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  await ensureDir(state.featureFolder);
  const path = `${state.featureFolder}/plan.md`;
  await writeUtf8(path, state.plan);
  return path;
}

export async function saveRun(_ctx: ExtensionContext, state: DraftState): Promise<string> {
  const runsDir = `${state.featureFolder}/runs`;
  await ensureDir(runsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${runsDir}/${ts}.json`;
  await writeUtf8(path, renderRunJson(state));
  return path;
}
