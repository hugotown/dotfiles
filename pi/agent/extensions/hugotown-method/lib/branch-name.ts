// lib/branch-name.ts — Deterministic-prefix, unique-suffix run branch name.
export function makeBranchName(workflow: string): string {
  const slug = workflow.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `hugotown/${slug}-${hash}`;
}
