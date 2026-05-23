// steps/write-spec.ts — Step 6: assemble + write markdown spec
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Assumption, DesignSection, Question } from "../types.ts";

export interface SpecData {
  title: string;
  selectedApproach: string;
  assumptions: Assumption[];
  answers: Record<string, string>;
  questions: Question[];
  sections: DesignSection[];
}

export function generateSpecPath(cwd: string, title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return join(cwd, "docs", "superpowers", "specs", `${date}-${slug}-design.md`);
}

export function assembleSpec(data: SpecData): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Design: ${data.title}`);
  lines.push("");
  lines.push(`**Date:** ${date}`);
  lines.push(`**Approach:** ${data.selectedApproach}`);
  lines.push("");

  // Assumptions
  if (data.assumptions.length > 0) {
    lines.push("## Assumptions");
    lines.push("");
    for (const a of data.assumptions) {
      lines.push(`- ${a.text} (confidence: ${a.confidence})`);
    }
    lines.push("");
  }

  // Context & Decisions
  if (data.questions.length > 0) {
    lines.push("## Context & Decisions");
    lines.push("");
    lines.push("| Question | Answer | Reasoning |");
    lines.push("|----------|--------|-----------|");
    for (const q of data.questions) {
      const answer = data.answers[q.id] ?? q.default;
      lines.push(`| ${q.label} | ${answer} | ${q.reasoning} |`);
    }
    lines.push("");
  }

  // Design sections
  for (const section of data.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeSpec(cwd: string, data: SpecData): Promise<string> {
  const specPath = generateSpecPath(cwd, data.title);
  const content = assembleSpec(data);

  await mkdir(dirname(specPath), { recursive: true });
  await writeFile(specPath, content, "utf-8");

  return specPath;
}
