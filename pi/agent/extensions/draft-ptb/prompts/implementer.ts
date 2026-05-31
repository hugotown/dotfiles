// Prompt builder for an implementer subagent (one per file contract or for the infra task).
import type { FileContract, InfraTask, Understanding } from "../state.ts";

export interface ImplementerInput {
  /** Contract this subagent OWNS. Null when implementing the solo infra task. */
  contract: FileContract | null;
  /** Resolved contracts of files the OWNED file imports (signatures only). */
  importedContracts: FileContract[];
  /** Repo-relative paths the subagent is FORBIDDEN from writing (shared files unless this is infra). */
  forbiddenFiles: string[];
  /** Infra task descriptor (used when contract is null). */
  infraTask: InfraTask | null;
  /** Understanding excerpt to ground the subagent. */
  understanding: Understanding;
  /** Compressed project context (tree + manifests). */
  projectContext: string;
  /** Plan markdown so the subagent sees the steps the human-readable plan describes. */
  planMarkdown: string;
}

function renderContractBlock(c: FileContract): string {
  const exports = c.exports.length === 0
    ? "(no exports declared)"
    : c.exports.map((e) => `- \`${e.signature}\` — ${e.description}`).join("\n");
  return `### ${c.path}\n**Purpose:** ${c.purpose}\n**Exports:**\n${exports}`;
}

export function buildImplementerPrompt(input: ImplementerInput): string {
  const isInfra = input.contract === null;
  const u = input.understanding;

  const header = isInfra
    ? `You are an implementer subagent. Your task is the SHARED-FILES INFRA TASK.\n` +
      `You are the ONLY subagent allowed to touch these files in this run:\n` +
      input.infraTask!.files.map((f) => `  - ${f}`).join("\n") + "\n\n" +
      `**Task description:** ${input.infraTask!.description}\n`
    : `You are an implementer subagent. You OWN exactly ONE file contract.\n\n` +
      `## Your file contract\n${renderContractBlock(input.contract!)}\n`;

  const importedBlock = input.importedContracts.length === 0
    ? "(none — your file does not import other contracts)"
    : input.importedContracts.map(renderContractBlock).join("\n\n");

  const forbiddenBlock = input.forbiddenFiles.length === 0
    ? "(none)"
    : input.forbiddenFiles.map((f) => `  - ${f}`).join("\n");

  return [
    header,
    ``,
    `## Imported contracts (signatures only — do NOT modify these files)`,
    importedBlock,
    ``,
    `## Forbidden files (writing here will cause your task to be marked BLOCKED)`,
    forbiddenBlock,
    ``,
    `## Understanding context`,
    `- User story: when=${u.userStory.when} | given=${u.userStory.given} | then=${u.userStory.then}`,
    `- Value: ${u.value}`,
    `- Non-goals: ${u.nonGoals.join("; ") || "(none)"}`,
    ``,
    `## Project context (compressed)`,
    "```",
    input.projectContext,
    "```",
    ``,
    `## Reference plan (for context only — implement YOUR slice)`,
    input.planMarkdown.length > 6000
      ? input.planMarkdown.slice(0, 6000) + "\n... (truncated)"
      : input.planMarkdown,
    ``,
    `## Your job`,
    isInfra
      ? `Implement the infra task. Touch ONLY the files listed under "your task". When done, print exactly one line:`
      : `Implement the contract for ${input.contract!.path}. Touch ONLY that file. When done, print exactly one line:`,
    ``,
    `\`STATUS: <DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT> | CONCERNS: <short text or "none">\``,
    ``,
    `- DONE: implementation complete, matches the contract, no caveats.`,
    `- DONE_WITH_CONCERNS: implemented, but flag a tradeoff in CONCERNS (e.g. test gap, perf cost).`,
    `- BLOCKED: cannot proceed. Put the reason in CONCERNS. Do NOT leave partial files.`,
    `- NEEDS_CONTEXT: missing info to implement safely. Put the missing piece in CONCERNS.`,
    ``,
    `## Rules`,
    `- Use the bash, read, write, edit tools as needed.`,
    `- Do NOT call ask_user_question (you are a subagent — it is unavailable).`,
    `- Do NOT touch files outside your scope. Doing so will cause the controller to mark you BLOCKED.`,
    `- Do NOT commit. The orchestrator handles git on its own.`,
    `- Match existing project style. Read 1-2 nearby files first if unsure of conventions.`,
    `- No "TBD", no "TODO: implement later", no placeholder bodies.`,
    `- The STATUS line is REQUIRED in your final assistant message. The controller parses it.`,
  ].join("\n");
}
