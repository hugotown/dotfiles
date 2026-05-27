import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DraftState } from "./state.ts";

export function slugify(idea: string): string {
  return idea.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/-+$/, "");
}

export async function saveSpec(pi: ExtensionAPI, ctx: ExtensionContext, state: DraftState): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(state.idea);
  const specPath = `docs/superpowers/specs/${date}-${slug}-design.md`;
  await pi.exec("mkdir", ["-p", "docs/superpowers/specs"], { cwd: ctx.cwd });
  const { writeFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  await writeFile(resolve(ctx.cwd, specPath), `# ${state.specTitle}\n\n${state.spec}`, "utf8");
  return specPath;
}

export async function savePlan(pi: ExtensionAPI, ctx: ExtensionContext, state: DraftState): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(state.idea);
  const planPath = `docs/superpowers/plans/${date}-${slug}.md`;
  await pi.exec("mkdir", ["-p", "docs/superpowers/plans"], { cwd: ctx.cwd });
  const { writeFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  await writeFile(resolve(ctx.cwd, planPath), state.plan, "utf8");
  return planPath;
}
