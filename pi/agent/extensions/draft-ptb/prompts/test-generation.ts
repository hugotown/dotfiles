// Prompt builder for a test-generator subagent (one per testContract).
import type {
  FileContract,
  ProjectInfo,
  TestContract,
  TestSurface,
  TestJourney,
  IntegrationBoundary,
} from "../state.ts";

export interface TestGeneratorInput {
  contract: TestContract;
  /** The journey or integration boundary referenced by contract.journey. */
  journey: TestJourney | IntegrationBoundary | null;
  /** Resolved fileContracts under test (signatures only). */
  codeUnderTest: FileContract[];
  projectInfo: ProjectInfo;
  surface: TestSurface | null;
}

function isJourney(x: TestJourney | IntegrationBoundary): x is TestJourney {
  return (x as TestJourney).steps !== undefined;
}

function renderCodeUnderTest(contracts: FileContract[]): string {
  if (contracts.length === 0) return "(none provided)";
  return contracts.map((c) => {
    const exports = c.exports.length === 0
      ? "(no exports)"
      : c.exports.map((e) => `  - \`${e.signature}\``).join("\n");
    return `**${c.path}** — ${c.purpose}\n${exports}`;
  }).join("\n\n");
}

function renderJourney(j: TestJourney | IntegrationBoundary | null): string {
  if (!j) return "(no journey/boundary descriptor found — improvise from the spec)";
  if (isJourney(j)) {
    return `**${j.name}** (id: ${j.id})\nSteps:\n${j.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\nInvariants:\n${j.invariants.map((iv) => `  - ${iv}`).join("\n") || "  (none)"}`;
  }
  return `**Integration boundary** (id: ${j.id})\nModules: ${j.modules.join(", ")}\nInvariants:\n${j.invariants.map((iv) => `  - ${iv}`).join("\n") || "  (none)"}`;
}

function workbookFormatExample(): string {
  return [
    "```markdown",
    "## Setup",
    "```bash",
    "export AGENT_BROWSER_SESSION=\"journey-$$\"",
    "```",
    "",
    "## Step 1: <description>",
    "```bash",
    "agent-browser open https://example.com",
    "agent-browser fill '#email' \"test@example.com\"",
    "agent-browser click 'button[type=submit]'",
    "```",
    "",
    "## Step 2: <description>",
    "```bash",
    "agent-browser click '.create-btn'",
    "agent-browser assert-text '.success' \"Created\"",
    "```",
    "",
    "## Cleanup",
    "```bash",
    "agent-browser close",
    "```",
    "```",
  ].join("\n");
}

export function buildTestGeneratorPrompt(input: TestGeneratorInput): string {
  const c = input.contract;
  const targetFolder = c.kind === "integration"
    ? input.projectInfo.testFolders.integration || "tests/integration"
    : input.projectInfo.testFolders.e2e || "tests/e2e";

  const lines: string[] = [
    `You are a test-generator subagent. You produce ONE test artifact.`,
    ``,
    `## Test contract`,
    `- File to write: \`${c.path}\``,
    `- Kind: \`${c.kind}\``,
    `- Journey/boundary id: \`${c.journey}\``,
    `- Code under test:`,
    renderCodeUnderTest(input.codeUnderTest),
    ``,
    `## Journey/boundary descriptor`,
    renderJourney(input.journey),
    ``,
    `## Target test folder (from project detection)`,
    `${targetFolder}`,
    ``,
  ];

  if (c.kind === "workbook") {
    lines.push(
      `## Output format — Workbook (markdown with \`bash\` blocks runnable via \`wb run\`)`,
      `This format is verified to work with \`wb\` + \`agent-browser\`. Each \`bash\` block runs in its own subshell;`,
      `env vars exported in Setup persist via \`AGENT_BROWSER_SESSION\`. Follow this skeleton EXACTLY:`,
      ``,
      workbookFormatExample(),
      ``,
      `Rules:`,
      `- ALWAYS include the \`## Setup\` block with \`export AGENT_BROWSER_SESSION="journey-$$"\`.`,
      `- ALWAYS include a \`## Cleanup\` block with \`agent-browser close\`.`,
      `- Each step uses real \`agent-browser\` CLI commands.`,
      `- No skeleton/TODO placeholders.`,
    );
  } else if (c.kind === "playwright") {
    lines.push(
      `## Output format — Playwright spec (\`@playwright/test\`)`,
      `Standard Playwright spec file using \`import { test, expect } from '@playwright/test';\`.`,
      `If the project does NOT have \`@playwright/test\` in dependencies, report BLOCKED with reason "playwright not installed".`,
      `(Detected: hasPlaywright=${input.projectInfo.hasPlaywright})`,
      ``,
      `Rules:`,
      `- One \`test()\` per invariant; cover ALL invariants in the journey.`,
      `- Use \`page.goto(...)\`, locator-based assertions (\`expect(locator).toHaveText(...)\`).`,
      `- No \`test.skip\`, no \`test.fixme\`.`,
    );
  } else {
    lines.push(
      `## Output format — Integration test (project's existing test runner)`,
      `Use the same testing framework already present in the project (jest, vitest, bun:test, pytest, cargo test, etc.).`,
      `Read 1-2 existing tests in \`${input.projectInfo.testFolders.integration || "tests/integration"}\` to match style and imports.`,
      ``,
      `Rules:`,
      `- One test case per invariant in the boundary.`,
      `- Exercise the file contracts listed under "Code under test" by importing them directly.`,
    );
  }

  lines.push(
    ``,
    `## Your job`,
    `1. Inspect the code under test (read the actual files if they exist now).`,
    `2. Write the test file at the exact path \`${c.path}\`.`,
    `3. End your final assistant message with exactly one line:`,
    ``,
    `\`STATUS: <DONE|BLOCKED> | CONCERNS: <short text or "none">\``,
    ``,
    `Rules:`,
    `- Use bash, read, write, edit. Do NOT call ask_user_question (it is unavailable).`,
    `- Touch ONLY the test file at \`${c.path}\` (and optionally read code-under-test files).`,
    `- BLOCKED is appropriate if the framework is missing, the journey is too ambiguous, or the code under test does not exist yet.`,
    `- The STATUS line is REQUIRED. The controller parses it.`,
  );

  return lines.join("\n");
}
