/**
 * BMAD Runner — automated story-cycle orchestrator driven by sprint-status.yaml.
 *
 * Architecture:
 *   - State Machine consumer: reads sprint-status.yaml from <cwd>/docs/implementation-artifacts/
 *     and treats it as the single source of truth (BMAD's own skills update it)
 *   - Strategy per status: backlog→step1, ready-for-dev→step2, in-progress→step2,
 *     review→step3, done→skip. Partials auto-resume from the right step.
 *   - Bail-fast on failure: one bad chain run halts the whole cycle, leaving the
 *     YAML and repo inspectable for human review (safer than cascading errors).
 *   - No private state file: re-running picks up wherever BMAD left off.
 *
 * Usage:
 *   --bmad-workflow                       process all backlog + partials, sequential
 *   --bmad-workflow --limit N             process at most N stories
 *   --bmad-workflow --epic 9              only stories whose key starts with "9-"
 *   --bmad-workflow --story 9-1-self-...  process a single story by key
 *   --bmad-workflow --dry-run             list what would be processed, do nothing
 *
 * The flag goes through flags-gateway like every other deterministic trigger.
 *
 * Requires: chains.ts (reuses spawnOnce via the bmad-cycle chain), yaml-mini.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawnOnce } from "./subagents.ts";
import type { SubagentResult } from "./subagents.ts";
import { parseYaml } from "./yaml-mini.ts";

// ============================================================================
// CONSTANTS — knobs the user may want to tune later
// ============================================================================

const SPRINT_STATUS_RELATIVE = "docs/implementation-artifacts/sprint-status.yaml";
const CHAIN_NAME = "bmad-cycle";

// Status transitions: which step to start at given the current status.
// 0-indexed step number into the bmad-cycle chain (3 steps total).
const STATUS_TO_START_STEP: Record<string, number> = {
  "backlog": 0,
  "ready-for-dev": 1,
  "in-progress": 1,   // Resume dev — the skill is expected to be idempotent
  "review": 2,
};

// Story key validation: real stories vs epic markers and retrospectives.
const EPIC_KEY_REGEX = /^epic-\d+$/;
const RETRO_KEY_REGEX = /-retrospective$/;

// ============================================================================
// SPRINT STATUS PARSING
// ============================================================================

interface StoryEntry {
  key: string;
  status: string;
  startStep: number; // Which step to start at (0-2). -1 means skip (done).
}

interface SprintStatus {
  storiesByKey: Map<string, string>;
  raw: Record<string, unknown>;
}

function loadSprintStatus(cwd: string): { ok: true; data: SprintStatus; path: string } | { ok: false; reason: string } {
  const filePath = path.join(cwd, SPRINT_STATUS_RELATIVE);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `sprint-status.yaml not found at ${filePath}` };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return { ok: false, reason: `Cannot read sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}` };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    return { ok: false, reason: `Failed to parse YAML: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "YAML root is not an object" };
  }
  const root = parsed as Record<string, unknown>;
  const dev = root.development_status;
  if (!dev || typeof dev !== "object") {
    return { ok: false, reason: "Missing or invalid development_status field in sprint-status.yaml" };
  }
  const storiesByKey = new Map<string, string>();
  for (const [k, v] of Object.entries(dev)) {
    if (typeof v === "string") storiesByKey.set(k, v);
  }
  return { ok: true, data: { storiesByKey, raw: root }, path: filePath };
}

function isRealStoryKey(key: string): boolean {
  if (EPIC_KEY_REGEX.test(key)) return false;
  if (RETRO_KEY_REGEX.test(key)) return false;
  return true;
}

function classifyStories(status: SprintStatus): StoryEntry[] {
  const entries: StoryEntry[] = [];
  for (const [key, value] of status.storiesByKey) {
    if (!isRealStoryKey(key)) continue;
    if (value === "done") continue;
    const startStep = STATUS_TO_START_STEP[value];
    if (startStep === undefined) continue; // Unknown status — skip silently
    entries.push({ key, status: value, startStep });
  }
  // Stable order: by key (which has natural epic.story numbering: 9-1, 9-2, ...)
  entries.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  return entries;
}

// ============================================================================
// FLAG PARSER
// ============================================================================

interface BmadFlag {
  enabled: boolean;
  limit?: number;
  epicFilter?: string;     // e.g. "9" → keys starting with "9-"
  singleStory?: string;    // process only this story key
  dryRun: boolean;
  cleanPrompt: string;
}

function parseBmadFlag(prompt: string): BmadFlag | null {
  if (!/--bmad-workflow\b/.test(prompt)) return null;
  const flag: BmadFlag = { enabled: true, dryRun: false, cleanPrompt: prompt };

  // Strip --bmad-workflow itself
  flag.cleanPrompt = flag.cleanPrompt.replace(/--bmad-workflow\b/, "").trim();

  // --limit N
  const limitM = flag.cleanPrompt.match(/--limit\s+(\d+)/);
  if (limitM) {
    flag.limit = parseInt(limitM[1], 10);
    flag.cleanPrompt = flag.cleanPrompt.replace(limitM[0], "").trim();
  }

  // --epic NUM
  const epicM = flag.cleanPrompt.match(/--epic\s+(\d+)/);
  if (epicM) {
    flag.epicFilter = epicM[1];
    flag.cleanPrompt = flag.cleanPrompt.replace(epicM[0], "").trim();
  }

  // --story KEY
  const storyM = flag.cleanPrompt.match(/--story\s+(\S+)/);
  if (storyM) {
    flag.singleStory = storyM[1];
    flag.cleanPrompt = flag.cleanPrompt.replace(storyM[0], "").trim();
  }

  // --dry-run
  if (/--dry-run\b/.test(flag.cleanPrompt)) {
    flag.dryRun = true;
    flag.cleanPrompt = flag.cleanPrompt.replace(/--dry-run\b/, "").trim();
  }

  return flag;
}

// ============================================================================
// CHAIN STEP EXECUTION (per story, starting at the appropriate step)
// ============================================================================

const CHAIN_AGENTS = ["bmad-create-story", "bmad-dev-story", "bmad-code-review"] as const;

function chainStepPrompt(stepIndex: number, story: string): string {
  // Prompts mirror run_stories.sh exactly so behavior matches the proven shell flow.
  switch (stepIndex) {
    case 0:
      return `bmad-create-story ${story} || no importa lo que diga github haremos esta historia\n\nThe story identifier is: ${story}\n\nRead the workflow at .claude/skills/bmad-create-story/workflow.md and execute it exactly. After completion, verify sprint-status.yaml advanced this story to ready-for-dev.`;
    case 1:
      return `bmad-dev-story => ${story} || no importa lo que diga github, desarrollaremos esta historia, antes de desarrollar la historia por favor lee: docs/planning-artifacts/architecture.md, docs/planning-artifacts/ux-design-specification.md, docs/planning-artifacts/{mockups-html,mockups-images} || por favor usar webfetch websearch por cada librería/paquete con su versión además de tocar base con ctx7 'npx ctx7 --help' para cada archivo/actividad y con ello obtener las referencias de implementación más recientes\n\nThe story identifier is: ${story}\n\nRead .claude/skills/bmad-dev-story/workflow.md and execute it exactly.`;
    case 2:
      return `bmad-code-review ${story} || no importa lo que diga github, desarrollaremos esta historia, antes de revisarla por favor lee: docs/planning-artifacts/architecture.md, docs/planning-artifacts/ux-design-specification.md, docs/planning-artifacts/{mockups-html,mockups-images} || por favor usar webfetch websearch por cada librería/paquete con su versión además de tocar base con ctx7 'npx ctx7 --help' para cada archivo/actividad y con ello obtener las referencias de implementación más recientes || cuando termines y todo funcione haz commit and push, esta tarea no se considera terminada hasta que todos los criterios de aceptación de la historia pasen y todas las pruebas pasen.\n\nThe story identifier is: ${story}\n\nRead .claude/skills/bmad-code-review/workflow.md and execute it exactly.`;
    default:
      throw new Error(`Invalid step index ${stepIndex}`);
  }
}

interface CycleResult {
  story: string;
  stepsRun: number;
  startedAtStep: number;
  success: boolean;
  failedStep?: number;
  failedStepError?: string;
  totalDurationMs: number;
}

async function runCycleForStory(story: StoryEntry, ctx: ExtensionContext): Promise<CycleResult> {
  const startedAt = Date.now();
  let stepsRun = 0;

  for (let stepIndex = story.startStep; stepIndex < CHAIN_AGENTS.length; stepIndex++) {
    const agent = CHAIN_AGENTS[stepIndex];
    const prompt = chainStepPrompt(stepIndex, story.key);
    const runRef = `bmad-${story.key}#step${stepIndex}`;

    const sm = ctx.sessionManager as unknown as { getSessionFile?: () => string | undefined };
    const parentSession = sm.getSessionFile?.();
    const baseName = parentSession ? path.basename(parentSession, ".jsonl") : "ephemeral";
    const sessionsDir = parentSession ? path.dirname(parentSession) : "/tmp";
    const stepDir = path.join(sessionsDir, baseName, "bmad", story.key);
    fs.mkdirSync(stepDir, { recursive: true });
    const sessionFile = path.join(stepDir, `step${stepIndex}-${agent}.jsonl`);

    const result: SubagentResult = await spawnOnce({
      task: prompt,
      agent,
      sessionFile,
      runRef,
      ctx,
    });
    stepsRun++;

    if (result.exitCode !== 0) {
      return {
        story: story.key,
        stepsRun,
        startedAtStep: story.startStep,
        success: false,
        failedStep: stepIndex,
        failedStepError: result.error || `exit ${result.exitCode}`,
        totalDurationMs: Date.now() - startedAt,
      };
    }
  }

  return {
    story: story.key,
    stepsRun,
    startedAtStep: story.startStep,
    success: true,
    totalDurationMs: Date.now() - startedAt,
  };
}

// ============================================================================
// RUNNER ORCHESTRATOR
// ============================================================================

interface RunSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  stoppedEarly: boolean;
  failedStory?: string;
  failedReason?: string;
}

async function runBmadWorkflow(flag: BmadFlag, ctx: ExtensionContext): Promise<{ summary: RunSummary; markdown: string }> {
  const overallStart = Date.now();
  const status = loadSprintStatus(ctx.cwd);
  if (!status.ok) {
    return {
      summary: { total: 0, completed: 0, failed: 0, skipped: 0, durationMs: 0, stoppedEarly: true, failedReason: status.reason },
      markdown: `## BMAD Run aborted\n\n**Reason:** ${status.reason}\n\nExpected at: \`${path.join(ctx.cwd, SPRINT_STATUS_RELATIVE)}\``,
    };
  }

  let stories = classifyStories(status.data);

  // Apply filters
  if (flag.singleStory) {
    stories = stories.filter((s) => s.key === flag.singleStory);
    if (stories.length === 0) {
      return {
        summary: { total: 0, completed: 0, failed: 0, skipped: 0, durationMs: 0, stoppedEarly: true, failedReason: `Story "${flag.singleStory}" not found or already done` },
        markdown: `## BMAD Run aborted\n\nStory \`${flag.singleStory}\` not found in backlog/partial. Either it doesn't exist or it's already done.`,
      };
    }
  } else if (flag.epicFilter) {
    stories = stories.filter((s) => s.key.startsWith(`${flag.epicFilter}-`));
  }
  if (flag.limit !== undefined) stories = stories.slice(0, flag.limit);

  // Dry run: just report the plan
  if (flag.dryRun) {
    const lines: string[] = [];
    lines.push(`## BMAD Dry Run — ${stories.length} story(ies) would be processed`);
    lines.push("");
    lines.push(`**Sprint status file:** \`${status.path}\``);
    lines.push("");
    lines.push("| # | Key | Status | Start step | Resume? |");
    lines.push("|---|-----|--------|-----------|---------|");
    stories.forEach((s, i) => {
      const stepName = CHAIN_AGENTS[s.startStep];
      lines.push(`| ${i + 1} | \`${s.key}\` | ${s.status} | step ${s.startStep + 1} (${stepName}) | ${s.startStep > 0 ? "yes" : "no"} |`);
    });
    return {
      summary: { total: stories.length, completed: 0, failed: 0, skipped: 0, durationMs: 0, stoppedEarly: false },
      markdown: lines.join("\n"),
    };
  }

  if (stories.length === 0) {
    return {
      summary: { total: 0, completed: 0, failed: 0, skipped: 0, durationMs: 0, stoppedEarly: false },
      markdown: `## BMAD Run — nothing to do\n\nNo backlog or partial stories found in \`${status.path}\`.`,
    };
  }

  const completedStories: string[] = [];
  let stoppedEarly = false;
  let failedStory: string | undefined;
  let failedReason: string | undefined;

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];

    if (ctx.hasUI) {
      ctx.ui.setStatus("bmad-runner", `🏃 [${i + 1}/${stories.length}] @${story.key} (start: step ${story.startStep + 1}/${CHAIN_AGENTS.length})`);
    }

    // Re-read YAML to confirm story still needs work — BMAD or user may have advanced it
    const fresh = loadSprintStatus(ctx.cwd);
    if (fresh.ok) {
      const currentStatus = fresh.data.storiesByKey.get(story.key);
      if (currentStatus === "done") {
        completedStories.push(story.key);
        continue; // Already done — skip
      }
      // Update startStep based on current status (it may have advanced)
      const newStartStep = STATUS_TO_START_STEP[currentStatus ?? "backlog"];
      if (newStartStep !== undefined) story.startStep = newStartStep;
    }

    const result = await runCycleForStory(story, ctx);

    if (!result.success) {
      stoppedEarly = true;
      failedStory = story.key;
      failedReason = `Step ${(result.failedStep ?? 0) + 1} (${CHAIN_AGENTS[result.failedStep ?? 0]}) failed: ${result.failedStepError}`;
      break;
    }

    // Verify story actually advanced — if BMAD didn't update YAML, that's a silent failure
    const verify = loadSprintStatus(ctx.cwd);
    if (verify.ok) {
      const newStatus = verify.data.storiesByKey.get(story.key);
      if (newStatus !== "done") {
        stoppedEarly = true;
        failedStory = story.key;
        failedReason = `Chain ran successfully but sprint-status still shows status "${newStatus}" instead of "done". BMAD skill may have failed silently — inspect repo state.`;
        break;
      }
    }

    completedStories.push(story.key);
  }

  if (ctx.hasUI) {
    ctx.ui.setStatus("bmad-runner", "");
  }

  const summary: RunSummary = {
    total: stories.length,
    completed: completedStories.length,
    failed: stoppedEarly ? 1 : 0,
    skipped: stories.length - completedStories.length - (stoppedEarly ? 1 : 0),
    durationMs: Date.now() - overallStart,
    stoppedEarly,
    failedStory,
    failedReason,
  };

  const md = formatSummary(summary, completedStories);
  return { summary, markdown: md };
}

function formatSummary(s: RunSummary, completed: string[]): string {
  const hours = (s.durationMs / 3600000).toFixed(2);
  const lines: string[] = [];
  lines.push(`## BMAD Run summary`);
  lines.push("");
  lines.push(`- **Stories processed:** ${s.completed} / ${s.total}`);
  if (s.failed > 0) lines.push(`- **Failed:** ${s.failed}`);
  if (s.skipped > 0) lines.push(`- **Skipped (after failure, not attempted):** ${s.skipped}`);
  lines.push(`- **Total duration:** ${hours}h`);
  lines.push(`- **Stopped early:** ${s.stoppedEarly ? "yes (bail policy)" : "no"}`);
  if (s.failedStory) {
    lines.push("");
    lines.push(`### ❌ Failure`);
    lines.push(`- Story: \`${s.failedStory}\``);
    lines.push(`- Reason: ${s.failedReason}`);
    lines.push(``);
    lines.push(`The repository and sprint-status.yaml are left in their current state for inspection. Use \`--bmad-workflow --story ${s.failedStory}\` to retry just this story after fixing the underlying issue.`);
  }
  if (completed.length > 0) {
    lines.push("");
    lines.push(`### ✓ Completed in this run`);
    for (const k of completed) lines.push(`- \`${k}\``);
  }
  return lines.join("\n");
}

// ============================================================================
// EXTENSION ENTRY POINT
// ============================================================================

export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  // Slash command: status snapshot of the BMAD sprint
  pi.registerCommand("bmad-status", {
    description: "Show BMAD sprint status: counts per state and next backlog/partial stories",
    handler: async (_args, ctx) => {
      const status = loadSprintStatus(ctx.cwd);
      if (!status.ok) {
        ctx.ui.notify(`No sprint-status.yaml found:\n${status.reason}`, "error");
        return;
      }
      const counts: Record<string, number> = {};
      let realStories = 0;
      for (const [k, v] of status.data.storiesByKey) {
        if (!isRealStoryKey(k)) continue;
        realStories++;
        counts[v] = (counts[v] || 0) + 1;
      }
      const upcoming = classifyStories(status.data).slice(0, 5);
      const lines = [
        `Sprint: ${path.basename(status.path)}`,
        `Real stories: ${realStories}`,
        ...Object.entries(counts).sort().map(([k, v]) => `  ${k.padEnd(15)} ${v}`),
        "",
        `Next ${upcoming.length} to process:`,
        ...upcoming.map((s, i) => `  ${i + 1}. ${s.key} (${s.status} → start at step ${s.startStep + 1})`),
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // Flag handler: --bmad-workflow [--limit N] [--epic N] [--story KEY] [--dry-run]
  // Higher priority value runs LATER — we want to run after smart-router/thinking
  // flags so we inherit any state they set, but the relative order vs chain/sub
  // doesn't matter (they parse different patterns).
  import("./flags-gateway.js")
    .then(({ registerFlagHandler }) => {
      registerFlagHandler(pi, {
        match: (prompt: string) => parseBmadFlag(prompt),
        priority: 900,
        execute: async (state, ctx, _piApi, parsed: BmadFlag) => {
          const { markdown } = await runBmadWorkflow(parsed, ctx);
          state.systemInjections.push(markdown);
          if (!parsed.cleanPrompt.trim()) {
            state.cleanPrompt =
              "The --bmad-workflow flag was processed and the full report is appended to your system context. " +
              "Present that report to the user verbatim. Do not run any tools, do not search the codebase, do not summarize — just relay the markdown report.";
          } else {
            state.cleanPrompt = parsed.cleanPrompt;
          }
        },
      });
    })
    .catch(() => { /* flags-gateway absent — runner inert */ });

  pi.on("session_start", async (_event, ctx) => {
    const status = loadSprintStatus(ctx.cwd);
    if (status.ok) {
      const realCount = [...status.data.storiesByKey.entries()].filter(([k]) => isRealStoryKey(k)).length;
      const todoCount = classifyStories(status.data).length;
      if (todoCount > 0) {
        ctx.ui.notify(`BMAD sprint detected: ${todoCount}/${realCount} stories pending — use --bmad-workflow`, "info");
      } else {
        ctx.ui.notify(`BMAD runner loaded · sprint-status.yaml has 0 pending stories`, "info");
      }
    } else {
      // Always confirm the runner is loaded so the user can spot when --bmad-workflow
      // would silently miss because the cwd is wrong or the YAML is missing.
      ctx.ui.notify(`BMAD runner loaded · ${status.reason}`, "info");
    }
  });
}
