import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";

const STATUS_FILE = "docs/implementation-artifacts/sprint-status.yaml";
const ARTIFACT_ROOT_ENV = "BMAD_RESOLUTION_ARTIFACT_ROOT";
const PROJECT_CWD_ENV = "BMAD_RESOLUTION_PROJECT_CWD";
const DEFAULT_PROJECT_CWD = path.join(
  process.env.HOME ?? "",
  "work",
  "Developer",
  "avantech",
  "aplus",
);
const STORY_DIR = "docs/implementation-artifacts";

const STORY_STATUSES = new Set([
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "done",
  "drafted",
]);
const EPIC_STATUSES = new Set(["backlog", "in-progress", "done", "contexted"]);
const RETRO_STATUSES = new Set(["optional", "done"]);

const PHASE_MODELS: Record<PhaseName, string> = {
  create: "minimax/M3",
  dev: "minimax/MiniMax-M2.7-highspeed",
  verify: "minimax/M3",
  review: "minimax/M3",
};

type EntryKind = "epic" | "story" | "retrospective";
type PhaseName = "create" | "dev" | "verify" | "review";
type RunMode = "status" | "once" | "run";
type ContextMode = "fork" | "fresh";

interface StatusEntry {
  key: string;
  status: string;
  kind: EntryKind;
  line: number;
}

interface SprintStatus {
  path: string;
  entries: StatusEntry[];
  stories: StatusEntry[];
  invalid: StatusEntry[];
}

interface PhaseAction {
  kind: "phase";
  name: PhaseName;
  story: StatusEntry;
}

interface DoneAction {
  kind: "done";
}

type Action = PhaseAction | DoneAction;

interface PhaseResult {
  phase: PhaseName;
  storyKey: string;
  model: string;
  exitCode: number;
  logPath: string;
  promptPath: string;
  summaryPath: string;
  finalText: string;
  commandCount: number;
  durationMs: number;
}

interface ChildJsonEvent {
  type?: string;
  message?: unknown;
  toolName?: string;
  args?: unknown;
  isError?: boolean;
}

interface ToolArgs {
  path?: unknown;
  command?: unknown;
  url?: unknown;
  pregunta?: unknown;
  query?: unknown;
  edits?: unknown;
}

const Params = Type.Object({
  mode: Type.Optional(
    StringEnum(["status", "once", "run"] as const, {
      description:
        "status only, run one deterministic phase, or run until all implementation stories are done/blocker.",
      default: "run",
    }),
  ),
  context: Type.Optional(
    StringEnum(["fork", "fresh"] as const, {
      description:
        "fresh uses isolated no-session children; fork uses the current parent session file for each child when available.",
      default: "fresh",
    }),
  ),
  maxPhases: Type.Optional(
    Type.Number({
      description:
        "Optional safety limit for phase executions. Omit to rely on status progress/blocker detection.",
    }),
  ),
});

type Params = Static<typeof Params>;

const isEpic = (key: string): boolean => /^epic-\d+$/.test(key);
const isRetrospective = (key: string): boolean =>
  /^epic-\d+-retrospective$/.test(key);
const classify = (key: string): EntryKind => {
  if (isRetrospective(key)) return "retrospective";
  if (isEpic(key)) return "epic";
  return "story";
};

const normalizedStoryStatus = (status: string): string =>
  status === "drafted" ? "ready-for-dev" : status;

const storyFileFor = (storyKey: string): string =>
  path.join(STORY_DIR, `${storyKey}.md`);

function readSprintStatus(cwd: string): SprintStatus {
  const absolutePath = path.join(cwd, STATUS_FILE);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `BLOCKER: mandatory BMAD status file is missing: ${STATUS_FILE}`,
    );
  }

  const raw = fs.readFileSync(absolutePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    /^development_status:\s*$/.test(line),
  );
  if (start === -1) {
    throw new Error(
      `BLOCKER: ${STATUS_FILE} does not contain development_status.`,
    );
  }

  const entries: StatusEntry[] = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim() !== "") break;
    const match = line.match(
      /^\s{2}([A-Za-z0-9-]+):\s*([A-Za-z0-9-]+)\s*(?:#.*)?$/,
    );
    if (!match) continue;
    entries.push({
      key: match[1],
      status: match[2],
      kind: classify(match[1]),
      line: index + 1,
    });
  }

  if (entries.length === 0) {
    throw new Error(`BLOCKER: ${STATUS_FILE} development_status is empty.`);
  }

  const invalid = entries.filter((entry) => {
    if (entry.kind === "story") return !STORY_STATUSES.has(entry.status);
    if (entry.kind === "epic") return !EPIC_STATUSES.has(entry.status);
    return !RETRO_STATUSES.has(entry.status);
  });

  if (invalid.length > 0) {
    const rendered = invalid
      .map((entry) => `${entry.key}: ${entry.status} (line ${entry.line})`)
      .join(", ");
    throw new Error(
      `BLOCKER: invalid status values in ${STATUS_FILE}: ${rendered}`,
    );
  }

  return {
    path: absolutePath,
    entries,
    stories: entries.filter((entry) => entry.kind === "story"),
    invalid,
  };
}

function selectNextAction(status: SprintStatus): Action {
  const firstReview = status.stories.find(
    (entry) => normalizedStoryStatus(entry.status) === "review",
  );
  if (firstReview) return { kind: "phase", name: "verify", story: firstReview };

  const firstInProgress = status.stories.find(
    (entry) => normalizedStoryStatus(entry.status) === "in-progress",
  );
  if (firstInProgress)
    return { kind: "phase", name: "dev", story: firstInProgress };

  const firstReady = status.stories.find(
    (entry) => normalizedStoryStatus(entry.status) === "ready-for-dev",
  );
  if (firstReady) return { kind: "phase", name: "dev", story: firstReady };

  const firstBacklog = status.stories.find(
    (entry) => normalizedStoryStatus(entry.status) === "backlog",
  );
  if (firstBacklog)
    return { kind: "phase", name: "create", story: firstBacklog };

  return { kind: "done" };
}

function selectPostVerifyAction(cwd: string, storyKey: string): Action {
  const status = readSprintStatus(cwd);
  const story = status.stories.find((entry) => entry.key === storyKey);
  if (!story)
    throw new Error(
      `BLOCKER: story disappeared from ${STATUS_FILE}: ${storyKey}`,
    );
  if (normalizedStoryStatus(story.status) !== "review") {
    return selectNextAction(status);
  }
  return { kind: "phase", name: "review", story };
}

function safePathSegment(value: string): string {
  return (
    value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo"
  );
}

function resolveProjectCwd(fallbackCwd: string): string {
  const configuredCwd = process.env[PROJECT_CWD_ENV];
  if (configuredCwd && configuredCwd.trim() !== "") {
    return path.resolve(configuredCwd);
  }
  return fs.existsSync(path.join(DEFAULT_PROJECT_CWD, STATUS_FILE))
    ? DEFAULT_PROJECT_CWD
    : fallbackCwd;
}

function artifactRootFor(cwd: string): string {
  const configuredRoot = process.env[ARTIFACT_ROOT_ENV];
  if (configuredRoot && configuredRoot.trim() !== "") {
    return path.resolve(configuredRoot);
  }
  const repoName = safePathSegment(path.basename(cwd));
  const repoHash = createHash("sha256").update(cwd).digest("hex").slice(0, 10);
  return path.join(
    process.env.HOME ?? cwd,
    ".pi",
    "bmad-resolution",
    "runs",
    `${repoName}-${repoHash}`,
  );
}

function displayArtifactPath(cwd: string, targetPath: string): string {
  const relativePath = path.relative(cwd, targetPath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? targetPath
    : relativePath;
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeTextFile(filePath: string, content: string): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, content, "utf-8");
}

function appendTextFile(filePath: string, content: string): void {
  ensureParentDir(filePath);
  fs.appendFileSync(filePath, content, "utf-8");
}

function isUnsafeRuntimeCommand(command: string): string | null {
  const normalized = command.replace(/\s+/g, " ").trim();
  const protectsPi =
    normalized.includes(":(exclude).pi") ||
    normalized.includes(":(exclude).pi/**");
  const stashesUntracked =
    /\bgit\s+stash\b/.test(normalized) &&
    (/--include-untracked\b/.test(normalized) ||
      /(^|\s)-[^\s]*u[^\s]*/.test(normalized));
  if (stashesUntracked && !protectsPi) {
    return "Blocked unsafe git stash with untracked files because it can remove active .pi runtime files. Use: git stash push --include-untracked -- . ':(exclude).pi'";
  }
  if (/\bgit\s+clean\b/.test(normalized)) {
    return "Blocked git clean during bmad-resolution runtime because it can delete active agent artifacts.";
  }
  if (/\brm\s+[^\n;|&]*(\.pi|~\/\.pi|\$HOME\/\.pi)/.test(normalized)) {
    return "Blocked command that removes Pi runtime artifacts (.pi or ~/.pi).";
  }
  return null;
}

function statusSummary(status: SprintStatus): string {
  const counts = new Map<string, number>();
  for (const story of status.stories) {
    const key = normalizedStoryStatus(story.status);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const next = selectNextAction(status);
  const nextText =
    next.kind === "done"
      ? "done"
      : `${next.name} ${next.story.key} (${next.story.status})`;
  return [
    `Status file: ${STATUS_FILE}`,
    `Stories: backlog ${counts.get("backlog") ?? 0}, ready-for-dev ${counts.get("ready-for-dev") ?? 0}, in-progress ${counts.get("in-progress") ?? 0}, review ${counts.get("review") ?? 0}, done ${counts.get("done") ?? 0}`,
    `Next deterministic action: ${nextText}`,
  ].join("\n");
}

function buildTask(
  phase: PhaseName,
  story: StatusEntry,
  projectCwd: string,
): string {
  const storyFile = storyFileFor(story.key);
  const common = `
This is a bmad-resolution automated child process.

Repository root / required cwd: ${projectCwd}

Hard rules:
- Non-interactive: do not ask the parent/user questions and do not initiate intercom.
- Do not use the pi-subagents plugin or the subagent tool. If a workflow asks for subagents, perform the necessary work sequentially inside this process instead of halting for external subagents.
- Read and obey docs/ai/story-cycle-constraints.md.
- Treat docs/implementation-artifacts/sprint-status.yaml as the mandatory source of truth.
- If ambiguity appears, first review docs/planning-artifacts/prds/, docs/planning-artifacts/architecture.md, and docs/planning-artifacts/ux-designs/, then choose the safest minimal MVP resolution for that specific ambiguity only.
- Stop only for missing required repo artifacts, missing irreplaceable credentials/services, or irreversible destructive risk.
- Return a concise operational result with status transition, changed files, validations, and blockers.
- Runtime safety: never edit, delete, move, clean, stash, or reset .pi/ or ~/.pi/ artifacts.
- Do not run git stash --include-untracked, git stash -u, git clean, or broad cleanup commands. If a stash is absolutely required, use: git stash push --include-untracked -- . ':(exclude).pi' and first verify .pi/ is excluded by .git/info/exclude.
`.trim();

  if (phase === "create") {
    return `${common}

CS — Run bmad-create-story non-interactively through Amelia/bmad-agent-dev.

Explicit selected backlog story from ${STATUS_FILE}:
- story_key: ${story.key}

Requirements:
- **Important:** GitHub may already contain changes that appear to reference the activities for this story. Even if we find clues that some work was already attempted or partially done, we must treat it as *not correctly implemented*. Our duty is to re-implement what is needed and verify that everything is correct.
- Create the corresponding story file under docs/implementation-artifacts/.
- Let the BMAD create-story workflow update sprint-status.yaml from backlog to ready-for-dev and update the epic status as defined by BMAD.
- Research technical decisions as required by the story-cycle constraints.
- Do not show the Amelia menu.`;
  }

  if (phase === "dev") {
    return `${common}

DS — Run bmad-dev-story non-interactively through Amelia/bmad-agent-dev for this explicit story.

Explicit selected story:
- story_key: ${story.key}
- story_file: ${storyFile}
- current_status: ${story.status}

Requirements:
- **Important:** GitHub may already contain changes that appear to reference the activities for this story. Even if we find clues that some work was already attempted or partially done, we must treat it as *not correctly implemented*. Our duty is to re-implement what is needed and verify that everything is correct.
- Continue this exact story until it reaches review status.
- Run pnpm check-types, pnpm check, pnpm build, and relevant tests before finishing.
- Use systematic-debugging for any technical failure.
- Do not show the Amelia menu.`;
  }

  if (phase === "verify") {
    return `${common}

Validate and stabilize this explicit story before code review.

Explicit selected story:
- story_key: ${story.key}
- story_file: ${storyFile}
- current_status: ${story.status}

Requirements:
- Run pnpm check-types, pnpm check, pnpm build, and targeted tests required by touched code.
- If anything fails, use systematic-debugging, do RCA, repair minimally, and rerun validations.
- Keep the story in review unless a BMAD-required repair changes it.
- Do not show any menu.`;
  }

  return `${common}

CR — Run bmad-code-review non-interactively through Amelia/bmad-agent-dev for this explicit story currently in review.

Explicit selected story:
- story_key: ${story.key}
- story_file: ${storyFile}
- current_status: ${story.status}

Automated review policy:
- Use ${storyFile} as the spec/story context.
- If asked to confirm the review target or proceed, auto-confirm.
- If baseline_commit exists in the story frontmatter, use it as the diff baseline; otherwise review the current working tree/uncommitted diff for this story's changed files.
- Auto-apply every patch finding.
- Resolve decision-needed findings with the safest minimal-scope MVP choice for that specific doubt.
- Defer only clearly pre-existing or truly out-of-scope issues.
- Run pnpm check-types, pnpm check, pnpm build, and targeted tests after fixes.
- If final status is done and validations pass, run graphify update for each modified file, then commit and push if the BMAD workflow requires it.
- Sync sprint-status.yaml to done or in-progress according to BMAD code-review rules.
- Do not show the Amelia menu.`;
}

function ensureStoryFile(cwd: string, action: PhaseAction): void {
  if (action.name === "create") return;
  const file = path.join(cwd, storyFileFor(action.story.key));
  if (!fs.existsSync(file)) {
    throw new Error(
      `BLOCKER: expected story file is missing for ${action.name}: ${storyFileFor(action.story.key)}`,
    );
  }
}

function getTextContent(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function compactText(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function displayPath(cwd: string, value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.startsWith(cwd) ? path.relative(cwd, value) : value;
  return compactText(normalized, 90);
}

function summarizeToolActivity(
  toolName: string,
  rawArgs: unknown,
  cwd: string,
): string {
  const args = (
    rawArgs && typeof rawArgs === "object" ? rawArgs : {}
  ) as ToolArgs;
  const targetPath = displayPath(cwd, args.path);

  if (toolName === "read") return `leyendo ${targetPath ?? "archivo"}`;
  if (toolName === "write") return `escribiendo ${targetPath ?? "archivo"}`;
  if (toolName === "edit") {
    const editCount = Array.isArray(args.edits) ? args.edits.length : 1;
    return `editando ${targetPath ?? "archivo"} (${editCount} bloque${editCount === 1 ? "" : "s"})`;
  }
  if (toolName === "bash") {
    return `ejecutando ${compactText(typeof args.command === "string" ? args.command : "comando", 100)}`;
  }
  if (toolName === "curl") {
    return `consultando ${compactText(typeof args.url === "string" ? args.url : "URL", 90)}`;
  }
  if (toolName === "investigate") {
    return `investigando ${compactText(typeof args.pregunta === "string" ? args.pregunta : "tema", 90)}`;
  }
  if (toolName.startsWith("gemini_")) {
    return `usando ${toolName}${typeof args.query === "string" ? `: ${compactText(args.query, 70)}` : ""}`;
  }
  return `usando ${toolName}`;
}

function createPhaseActivityReporter(
  cwd: string,
  phaseIndex: number,
  action: PhaseAction,
  onUpdate?: (text: string) => void,
): (event: ChildJsonEvent) => void {
  let lastText = "";
  let lastAt = 0;
  let toolCount = 0;

  const emit = (text: string, force = false) => {
    if (!onUpdate || text === lastText) return;
    const now = Date.now();
    if (!force && now - lastAt < 2500) return;
    lastText = text;
    lastAt = now;
    onUpdate(text);
  };

  return (event) => {
    if (event.type === "tool_execution_start" || event.type === "tool_call") {
      const toolName = event.toolName ?? "tool";
      toolCount++;
      const activity = summarizeToolActivity(toolName, event.args, cwd);
      const important =
        toolName === "bash" ||
        toolName === "edit" ||
        toolName === "write" ||
        toolName === "curl" ||
        toolName === "investigate";
      emit(
        `… fase ${phaseIndex} ${action.name} ${action.story.key}: ${activity} (#${toolCount})`,
        important,
      );
      return;
    }

    if (event.type === "tool_execution_end" && event.isError) {
      emit(
        `⚠ fase ${phaseIndex} ${action.name} ${action.story.key}: falló ${event.toolName ?? "tool"}`,
        true,
      );
      return;
    }

    if (event.type === "turn_start") {
      emit(
        `… fase ${phaseIndex} ${action.name} ${action.story.key}: razonando / planificando`,
      );
    }
  };
}

async function runPiPhase(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  projectCwd: string,
  runDir: string,
  index: number,
  action: PhaseAction,
  contextMode: ContextMode,
  onUpdate?: (text: string) => void,
  signal?: AbortSignal,
): Promise<PhaseResult> {
  ensureStoryFile(projectCwd, action);

  const model = PHASE_MODELS[action.name];
  const task = buildTask(action.name, action.story, projectCwd);
  const prefix = `${String(index).padStart(3, "0")}-${action.name}-${action.story.key}`;
  const promptPath = path.join(runDir, `${prefix}-prompt.md`);
  const logPath = path.join(runDir, `${prefix}.jsonl`);
  const summaryPath = path.join(runDir, `${prefix}-summary.md`);
  writeTextFile(promptPath, task);
  writeTextFile(logPath, "");

  const args = [
    "--mode",
    "json",
    "-p",
    "--approve",
    "--model",
    model,
    "--exclude-tools",
    "subagent,bmad_resolution",
    "--name",
    `bmad-resolution ${action.name} ${action.story.key}`,
  ];

  if (contextMode === "fork") {
    const sessionFile = ctx.sessionManager.getSessionFile();
    if (!sessionFile) {
      throw new Error(
        "BLOCKER: context=fork requested, but current parent session has no session file. Retry with context=fresh.",
      );
    }
    if (!fs.existsSync(sessionFile) || fs.statSync(sessionFile).size === 0) {
      throw new Error(
        `BLOCKER: context=fork requested, but parent session file is empty or missing: ${sessionFile}. Retry with context=fresh.`,
      );
    }
    args.push("--fork", sessionFile);
  } else {
    args.push("--no-session");
  }

  args.push(task);

  const start = Date.now();
  let finalText = "";
  let commandCount = 0;
  const reportActivity = createPhaseActivityReporter(
    projectCwd,
    index,
    action,
    onUpdate,
  );
  onUpdate?.(
    `▶ fase ${index}: ${action.name} ${action.story.key} via ${model}`,
  );
  onUpdate?.(
    `… fase ${index} ${action.name} ${action.story.key}: preparando prompt y sesión hija`,
  );

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("pi", args, {
      cwd: projectCwd,
      env: { ...process.env, [PROJECT_CWD_ENV]: projectCwd, PWD: projectCwd },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const phaseSignal = signal ?? ctx.signal;

    let stdoutBuffer = "";
    let stderr = "";

    const abort = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      }, 5000).unref();
    };

    if (phaseSignal?.aborted) abort();
    phaseSignal?.addEventListener("abort", abort, { once: true });

    const processLine = (line: string) => {
      if (!line.trim()) return;
      appendTextFile(logPath, `${line}\n`);
      try {
        const event = JSON.parse(line) as ChildJsonEvent;
        reportActivity(event);
        if (
          event.type === "message_end" &&
          event.message &&
          typeof event.message === "object"
        ) {
          const role = (event.message as { role?: unknown }).role;
          if (role === "assistant") {
            const text = getTextContent(event.message).trim();
            if (text) finalText = text;
          }
        }
        if (
          event.type === "tool_execution_start" ||
          event.type === "tool_call"
        ) {
          commandCount++;
        }
      } catch {
        // Preserve unparsable line in raw log; no-op for summary extraction.
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      onUpdate?.(
        `… fase ${index} ${action.name} ${action.story.key}: salida stderr recibida`,
      );
    });

    child.on("error", (error) => {
      phaseSignal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code, signal) => {
      phaseSignal?.removeEventListener("abort", abort);
      if (stdoutBuffer.trim()) processLine(stdoutBuffer);
      if (stderr.trim())
        appendTextFile(
          logPath,
          `${JSON.stringify({ type: "stderr", text: stderr })}\n`,
        );
      if (signal)
        appendTextFile(
          logPath,
          `${JSON.stringify({ type: "child_signal", signal })}\n`,
        );
      onUpdate?.(
        `… fase ${index} ${action.name} ${action.story.key}: proceso hijo terminó con ${signal ? `señal ${signal}` : `código ${code ?? 0}`}`,
      );
      resolve(code ?? (signal ? 1 : 0));
    });
  });

  const durationMs = Date.now() - start;
  const result: PhaseResult = {
    phase: action.name,
    storyKey: action.story.key,
    model,
    exitCode,
    logPath,
    promptPath,
    summaryPath,
    finalText: finalText || "(no assistant final text captured)",
    commandCount,
    durationMs,
  };

  const summary = [
    `# ${action.name} ${action.story.key}`,
    `- model: ${model}`,
    `- exitCode: ${exitCode}`,
    `- durationMs: ${durationMs}`,
    `- commandCount: ${commandCount}`,
    `- prompt: ${promptPath}`,
    `- log: ${logPath}`,
    "",
    "## Final text",
    result.finalText,
    "",
  ].join("\n");
  writeTextFile(summaryPath, summary);

  if (exitCode !== 0) {
    throw new Error(
      `BLOCKER: child phase failed (${action.name} ${action.story.key}) exit=${exitCode}. See ${logPath}`,
    );
  }

  onUpdate?.(
    `✓ ${action.name} ${action.story.key} completed (${Math.round(durationMs / 1000)}s)`,
  );
  return result;
}

function verifyProgress(
  cwd: string,
  before: StatusEntry,
  phase: PhaseName,
): string | null {
  if (phase === "verify") return null;
  const afterStatus = readSprintStatus(cwd);
  const after = afterStatus.stories.find((entry) => entry.key === before.key);
  if (!after) return `story disappeared from ${STATUS_FILE}: ${before.key}`;

  const beforeStatus = normalizedStoryStatus(before.status);
  const afterValue = normalizedStoryStatus(after.status);

  if (
    phase === "create" &&
    beforeStatus === "backlog" &&
    afterValue !== "backlog"
  )
    return null;
  if (phase === "dev" && afterValue === "review") return null;
  if (
    phase === "review" &&
    (afterValue === "done" || afterValue === "in-progress")
  )
    return null;
  if (afterValue !== beforeStatus) return null;

  return `${phase} made no status progress for ${before.key}: remained ${beforeStatus}`;
}

async function runResolution(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  params: Params,
  onUpdate?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const mode: RunMode = params.mode ?? "run";
  const contextMode: ContextMode = params.context ?? "fresh";
  const projectCwd = resolveProjectCwd(ctx.cwd);
  const runId =
    new Date().toISOString().replace(/[:.]/g, "-") +
    `-${randomUUID().slice(0, 8)}`;
  const artifactRoot = artifactRootFor(projectCwd);
  const runDir = path.join(artifactRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  onUpdate?.(`📍 bmad-resolution: cwd ${projectCwd}`);
  onUpdate?.(`🔎 bmad-resolution: leyendo ${STATUS_FILE}`);
  onUpdate?.(
    `📁 bmad-resolution: artifacts en ${displayArtifactPath(projectCwd, runDir)}`,
  );

  const initialStatus = readSprintStatus(projectCwd);
  if (mode === "status") {
    return `${statusSummary(initialStatus)}\n\nArtifacts directory for future runs: ${runDir}`;
  }

  const results: PhaseResult[] = [];
  const noProgress = new Map<string, number>();
  let phaseCount = 0;

  while (true) {
    if (params.maxPhases !== undefined && phaseCount >= params.maxPhases) {
      throw new Error(
        `BLOCKER: maxPhases reached (${params.maxPhases}). Artifacts: ${runDir}`,
      );
    }

    const status = readSprintStatus(projectCwd);
    let action = selectNextAction(status);
    if (action.kind === "phase") {
      onUpdate?.(
        `📌 siguiente: ${action.name} ${action.story.key} (${action.story.status})`,
      );
    }
    if (action.kind === "done") {
      return renderFinalSummary(
        "success",
        projectCwd,
        runDir,
        results,
        readSprintStatus(projectCwd),
      );
    }

    const before = { ...action.story };
    const result = await runPiPhase(
      pi,
      ctx,
      projectCwd,
      runDir,
      phaseCount + 1,
      action,
      contextMode,
      onUpdate,
      signal,
    );
    results.push(result);
    phaseCount++;

    const progressIssue = verifyProgress(projectCwd, before, action.name);
    if (progressIssue) {
      const key = `${action.name}:${before.key}:${normalizedStoryStatus(before.status)}`;
      const attempts = (noProgress.get(key) ?? 0) + 1;
      noProgress.set(key, attempts);
      if (attempts >= 2) {
        throw new Error(
          `BLOCKER: repeated no-progress phase. ${progressIssue}. Artifacts: ${runDir}`,
        );
      }
      onUpdate?.(`⚠ ${progressIssue}; retrying once before blocker.`);
    }

    if (action.name === "verify") {
      action = selectPostVerifyAction(projectCwd, before.key);
      if (action.kind === "phase" && action.name === "review") {
        if (params.maxPhases !== undefined && phaseCount >= params.maxPhases) {
          throw new Error(
            `BLOCKER: maxPhases reached (${params.maxPhases}). Artifacts: ${runDir}`,
          );
        }
        const reviewBefore = { ...action.story };
        const reviewResult = await runPiPhase(
          pi,
          ctx,
          projectCwd,
          runDir,
          phaseCount + 1,
          action,
          contextMode,
          onUpdate,
          signal,
        );
        results.push(reviewResult);
        phaseCount++;
        const reviewProgressIssue = verifyProgress(
          projectCwd,
          reviewBefore,
          action.name,
        );
        if (reviewProgressIssue)
          throw new Error(
            `BLOCKER: ${reviewProgressIssue}. Artifacts: ${runDir}`,
          );
      }
    }

    if (mode === "once") {
      return renderFinalSummary(
        "once-complete",
        projectCwd,
        runDir,
        results,
        readSprintStatus(projectCwd),
      );
    }
  }
}

function renderFinalSummary(
  outcome: string,
  projectCwd: string,
  runDir: string,
  results: PhaseResult[],
  status: SprintStatus,
): string {
  const phaseLines = results.map(
    (result) =>
      `- ${result.phase} ${result.storyKey} · ${result.model} · exit ${result.exitCode} · ${Math.round(result.durationMs / 1000)}s · ${displayArtifactPath(projectCwd, result.summaryPath)}`,
  );
  return [
    `# bmad-resolution ${outcome}`,
    "",
    statusSummary(status),
    "",
    `Artifacts: ${displayArtifactPath(projectCwd, runDir)}`,
    "",
    "## Phases executed",
    phaseLines.length > 0 ? phaseLines.join("\n") : "- none",
  ].join("\n");
}

export default function registerBmadResolution(pi: ExtensionAPI): void {
  pi.on("tool_call", (event) => {
    if (event.toolName !== "bash") return;
    const input = event.input as { command?: unknown };
    if (typeof input.command !== "string") return;
    const reason = isUnsafeRuntimeCommand(input.command);
    if (reason) return { block: true, reason };
  });

  pi.registerTool({
    name: "bmad_resolution",
    label: "bmad-resolution",
    description:
      "Deterministically continue the BMAD implementation cycle from sprint-status.yaml by spawning isolated pi child processes per phase. Does not use pi-subagents.",
    parameters: Params,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const update = (text: string) => {
        ctx.ui.setStatus("bmad-resolution", text);
        onUpdate?.({ content: [{ type: "text", text }] });
      };
      try {
        const summary = await runResolution(pi, ctx, params, update, signal);
        ctx.ui.setStatus("bmad-resolution", undefined);
        return {
          content: [{ type: "text", text: summary }],
          details: { ok: true, summary },
          terminate: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setStatus("bmad-resolution", undefined);
        return {
          content: [
            { type: "text", text: `# bmad-resolution blocker\n\n${message}` },
          ],
          details: { ok: false, error: message },
          terminate: true,
        };
      }
    },
  });

  pi.registerCommand("bmad-resolution", {
    description:
      "Run deterministic BMAD resolution: /bmad-resolution [status|once|run] [fresh|fork] (defaults: run fresh)",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const mode = (tokens.find(
        (token) => token === "status" || token === "once" || token === "run",
      ) ?? "run") as RunMode;
      const context = (tokens.find(
        (token) => token === "fresh" || token === "fork",
      ) ?? "fresh") as ContextMode;
      const showProgress = (text: string) => {
        ctx.ui.setStatus("bmad-resolution", text);
        ctx.ui.setWidget("bmad-resolution", [text], {
          placement: "belowEditor",
        });
      };
      try {
        const summary = await runResolution(
          pi,
          ctx,
          { mode, context },
          showProgress,
        );
        ctx.ui.setStatus("bmad-resolution", undefined);
        ctx.ui.setWidget("bmad-resolution", undefined);
        pi.sendMessage({
          customType: "bmad-resolution",
          content: summary,
          display: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setStatus("bmad-resolution", undefined);
        ctx.ui.setWidget("bmad-resolution", undefined);
        pi.sendMessage({
          customType: "bmad-resolution",
          content: `# bmad-resolution blocker\n\n${message}`,
          display: true,
        });
        ctx.ui.notify(message, "error");
      }
    },
  });
}
