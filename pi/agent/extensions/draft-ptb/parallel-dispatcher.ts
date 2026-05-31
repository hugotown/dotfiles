// Dispatcher for PARALLEL_IMPLEMENTATION and TEST_GENERATION phases.
//
// We orchestrate deterministically (no LLM in the controller). Each subagent runs
// as a child `pi` process in `--mode json -p --no-session` mode, with its own
// provider/model/thinking level. This mirrors the subagent extension's runner.ts
// (see extensions/subagent/lib/runner.ts) but gives M3 direct control over which
// model each task uses (sonnet by default, opus on BLOCKED retry).
//
// Output contract: each subagent must end its final assistant message with a line
// matching `STATUS: <X> | CONCERNS: <...>`. We parse that to build the result.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
  DraftState,
  FileContract,
  ImplementationResult,
  TestContract,
  TestGenerationResult,
} from "./state.ts";
import { buildLevels } from "./dag.ts";
import { buildImplementerPrompt } from "./prompts/implementer.ts";
import { buildTestGeneratorPrompt } from "./prompts/test-generation.ts";

const SONNET = { provider: "github-copilot", model: "claude-sonnet-4.6" };
const OPUS = { provider: "github-copilot", model: "claude-opus-4.6" };

const IMPL_TOOLS = ["bash", "read", "write", "edit"];
const TEST_TOOLS = ["bash", "read", "write", "edit"];

const MAX_NEEDS_CONTEXT_RETRIES = 2;
const TEST_CONCURRENCY = 4;

// ---------- spawning ----------

interface SpawnSpec {
  provider: string;
  model: string;
  systemPrompt: string;
  userTask: string;
  toolAllowlist: string[];
  cwd: string;
}

interface SpawnResult {
  exitCode: number;
  finalText: string;
  stderr: string;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  // Same heuristic as the subagent extension: prefer current script, then `pi` on PATH.
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  return isGenericRuntime ? { command: "pi", args } : { command: process.execPath, args };
}

async function writeSystemPromptFile(name: string, prompt: string): Promise<{ dir: string; file: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "draft-ptb-sub-"));
  const safe = name.replace(/[^\w.-]+/g, "_");
  const file = path.join(dir, `system-${safe}.md`);
  await fs.promises.writeFile(file, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir, file };
}

function cleanup(dir: string | null, file: string | null): void {
  if (file) { try { fs.unlinkSync(file); } catch { /* ignore */ } }
  if (dir) { try { fs.rmdirSync(dir); } catch { /* ignore */ } }
}

async function runChildPi(spec: SpawnSpec, taskName: string): Promise<SpawnResult> {
  const { dir, file } = await writeSystemPromptFile(taskName, spec.systemPrompt);
  try {
    const args = [
      "--mode", "json",
      "-p",
      "--no-session",
      "--provider", spec.provider,
      "--model", spec.model,
      "--thinking", "medium",
      "--tools", spec.toolAllowlist.join(","),
      "--append-system-prompt", file,
      spec.userTask,
    ];
    const { command, args: cmdArgs } = getPiInvocation(args);

    return await new Promise<SpawnResult>((resolve) => {
      const proc = spawn(command, cmdArgs, { cwd: spec.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      let buf = "";
      let stderr = "";
      let finalText = "";
      const onLine = (line: string) => {
        if (!line.trim()) return;
        let event: { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }> } };
        try { event = JSON.parse(line); } catch { return; }
        if (event.type !== "message_end" || !event.message || event.message.role !== "assistant") return;
        for (const part of event.message.content ?? []) {
          if (part.type === "text" && typeof part.text === "string") finalText = part.text;
        }
      };
      proc.stdout.on("data", (data) => {
        buf += data.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) onLine(line);
      });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      proc.on("close", (code) => {
        if (buf.trim()) onLine(buf);
        resolve({ exitCode: code ?? 0, finalText, stderr });
      });
      proc.on("error", (err) => resolve({ exitCode: 1, finalText, stderr: stderr + String(err) }));
    });
  } finally {
    cleanup(dir, file);
  }
}

// ---------- status parsing ----------

/**
 * Parse the required STATUS line out of a subagent's final assistant message.
 * Format: `STATUS: <DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT> | CONCERNS: <text>`.
 */
function parseImplStatus(text: string): { status: ImplementationResult["status"]; concerns: string | null } {
  const m = text.match(/STATUS\s*:\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)\s*(?:\|\s*CONCERNS\s*:\s*([^\n]*))?/i);
  if (!m) return { status: "BLOCKED", concerns: "no STATUS line in subagent output" };
  const status = m[1].toUpperCase() as ImplementationResult["status"];
  const concernsRaw = (m[2] ?? "").trim();
  const concerns = concernsRaw && concernsRaw.toLowerCase() !== "none" ? concernsRaw : null;
  return { status, concerns };
}

function parseTestStatus(text: string): { status: TestGenerationResult["status"]; concerns: string | null } {
  const m = text.match(/STATUS\s*:\s*(DONE|BLOCKED)\s*(?:\|\s*CONCERNS\s*:\s*([^\n]*))?/i);
  if (!m) return { status: "BLOCKED", concerns: "no STATUS line in subagent output" };
  const status = m[1].toUpperCase() as TestGenerationResult["status"];
  const concernsRaw = (m[2] ?? "").trim();
  const concerns = concernsRaw && concernsRaw.toLowerCase() !== "none" ? concernsRaw : null;
  return { status, concerns };
}

// ---------- git / file-lock validation ----------

async function workingDiffPaths(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  // Use `git diff --name-only HEAD` to see what changed in the working tree since HEAD.
  const r = await pi.exec("git", ["diff", "--name-only", "HEAD"], { cwd });
  if (r.code !== 0) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function workingUntrackedPaths(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const r = await pi.exec("git", ["ls-files", "--others", "--exclude-standard"], { cwd });
  if (r.code !== 0) return [];
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function snapshotChangedPaths(pi: ExtensionAPI, cwd: string): Promise<Set<string>> {
  const [diff, untracked] = await Promise.all([
    workingDiffPaths(pi, cwd),
    workingUntrackedPaths(pi, cwd),
  ]);
  return new Set([...diff, ...untracked]);
}

function diff(before: Set<string>, after: Set<string>): string[] {
  const out: string[] = [];
  for (const p of after) if (!before.has(p)) out.push(p);
  return out;
}

// ---------- branch / backup setup ----------

function slugifyIdea(idea: string): string {
  return idea.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/(^-+|-+$)/g, "") || "feature";
}

/**
 * If git mode: create feat/<slug> branch from baseBranch (only if current is base/main/master/trunk).
 * If no-git mode: ensure backup folder exists; per-file backup happens lazily before each subagent runs.
 */
async function prepareWorkspace(pi: ExtensionAPI, cwd: string, state: DraftState, ctx: ExtensionContext): Promise<void> {
  if (state.gitInfo.hasGit) {
    const slug = slugifyIdea(state.idea);
    const target = `feat/${slug}`;
    const current = state.gitInfo.currentBranch;
    if (current && (current === state.gitInfo.baseBranch || ["main", "master", "trunk"].includes(current))) {
      const exists = (await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${target}`], { cwd })).code === 0;
      const checkoutArgs = exists ? ["checkout", target] : ["checkout", "-b", target];
      const r = await pi.exec("git", checkoutArgs, { cwd });
      if (r.code !== 0) {
        ctx.ui.notify(`⚠️ No se pudo crear/cambiar a la rama ${target}: ${r.stderr.trim()}`, "warning");
      } else {
        ctx.ui.notify(`🌿 Trabajando en la rama ${target}`, "info");
      }
    }
  } else {
    const backupDir = path.join(cwd, ".draft-ptb-backup");
    await fs.promises.mkdir(backupDir, { recursive: true });
  }
}

/** No-git mode: copy original file to `<cwd>/.draft-ptb-backup/<relPath>` before a subagent may overwrite it. */
async function backupFile(cwd: string, relPath: string): Promise<void> {
  const src = path.join(cwd, relPath);
  if (!fs.existsSync(src)) return; // file is new — nothing to back up
  const dst = path.join(cwd, ".draft-ptb-backup", relPath);
  if (fs.existsSync(dst)) return; // already backed up from a prior iteration — preserve original
  await fs.promises.mkdir(path.dirname(dst), { recursive: true });
  try {
    await fs.promises.copyFile(src, dst);
  } catch { /* ignore */ }
}

// ---------- implementation dispatch ----------

interface DispatchCtx {
  state: DraftState;
  pi: ExtensionAPI;
  ctx: ExtensionContext;
}

/**
 * Build the user task message that goes to a child `pi` process. This is the
 * "user message" — equivalent to `prompt` in the subagent tool schema.
 */
function implementerTask(c: FileContract | null, infraId: string | null): string {
  if (c === null) return `Implement the infra task "${infraId}". Follow the system prompt exactly.`;
  return `Implement the file contract for \`${c.path}\`. Follow the system prompt exactly.`;
}

function testGenTask(c: TestContract): string {
  return `Generate the ${c.kind} test artifact at \`${c.path}\`. Follow the system prompt exactly.`;
}

async function runOneImplementer(
  d: DispatchCtx,
  contract: FileContract | null,
  taskId: string,
  forbiddenFiles: string[],
  initialModel: { provider: string; model: string },
): Promise<ImplementationResult> {
  const isInfra = contract === null;
  const importedContracts = isInfra
    ? []
    : d.state.fileContracts.filter((c) => contract!.imports.includes(c.path));

  const systemPrompt = buildImplementerPrompt({
    contract,
    importedContracts,
    forbiddenFiles,
    infraTask: d.state.infraTask,
    understanding: d.state.understanding,
    projectContext: d.state.compressedContext,
    planMarkdown: d.state.plan,
  });

  // No-git mode: back up every file this subagent may touch.
  if (!d.state.gitInfo.hasGit) {
    const targets = isInfra ? d.state.infraTask?.files ?? [] : [contract!.path];
    for (const t of targets) await backupFile(d.ctx.cwd, t);
  }

  let model = initialModel;
  let needsContextRetries = 0;
  let lastConcerns: string | null = null;

  // Loop: NEEDS_CONTEXT can retry up to MAX_NEEDS_CONTEXT_RETRIES; BLOCKED on first
  // attempt escalates to opus once and retries; subsequent BLOCKED stays BLOCKED.
  let blockedRetried = false;
  while (true) {
    const before = await snapshotChangedPaths(d.pi, d.ctx.cwd);

    const taskMsg = lastConcerns
      ? `${implementerTask(contract, d.state.infraTask?.id ?? null)}\n\n` +
        `## Additional context from previous attempt\n${lastConcerns}`
      : implementerTask(contract, d.state.infraTask?.id ?? null);

    const result = await runChildPi(
      {
        provider: model.provider,
        model: model.model,
        systemPrompt,
        userTask: taskMsg,
        toolAllowlist: IMPL_TOOLS,
        cwd: d.ctx.cwd,
      },
      taskId,
    );

    const after = await snapshotChangedPaths(d.pi, d.ctx.cwd);
    const newFiles = diff(before, after);

    if (result.exitCode !== 0) {
      return {
        taskId,
        status: "BLOCKED",
        filesWritten: newFiles,
        commit: null,
        concerns: `child pi exited ${result.exitCode}: ${result.stderr.trim().slice(0, 400)}`,
      };
    }

    // File-lock validation: did the subagent touch a forbidden file?
    const forbiddenSet = new Set(forbiddenFiles);
    const violations = newFiles.filter((f) => forbiddenSet.has(f));
    if (violations.length > 0) {
      return {
        taskId,
        status: "BLOCKED",
        filesWritten: newFiles,
        commit: null,
        concerns: `wrote to forbidden file(s): ${violations.join(", ")}`,
      };
    }

    const parsed = parseImplStatus(result.finalText);

    if (parsed.status === "NEEDS_CONTEXT" && needsContextRetries < MAX_NEEDS_CONTEXT_RETRIES) {
      needsContextRetries++;
      lastConcerns = parsed.concerns ?? "additional context requested";
      continue;
    }

    if (parsed.status === "BLOCKED" && !blockedRetried) {
      blockedRetried = true;
      model = OPUS;
      lastConcerns = parsed.concerns ?? "previous attempt blocked";
      continue;
    }

    return {
      taskId,
      status: parsed.status,
      filesWritten: newFiles,
      commit: null,
      concerns: parsed.concerns,
    };
  }
}

export async function dispatchImplementation(
  state: DraftState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<ImplementationResult[]> {
  const d: DispatchCtx = { state, pi, ctx };
  await prepareWorkspace(pi, ctx.cwd, state, ctx);

  const results: ImplementationResult[] = [];

  // LEVEL 0: infra task alone (if present).
  if (state.infraTask) {
    ctx.ui.notify(`🛠 Ejecutando tarea de infraestructura: ${state.infraTask.id}`, "info");
    // Infra owns sharedFiles, so its forbidden set is the union of all non-shared contract paths.
    const contractPaths = new Set(state.fileContracts.map((c) => c.path));
    const forbidden = Array.from(contractPaths);
    const r = await runOneImplementer(d, null, state.infraTask.id, forbidden, SONNET);
    results.push(r);
    if (r.status === "BLOCKED") {
      ctx.ui.notify(`⛔ Tarea de infraestructura BLOQUEADA: ${r.concerns ?? "(sin detalles)"}`, "error");
      // Continue anyway — M4 will decide how to iterate.
    }
  }

  // LEVELS 1..N: file-contract subagents in parallel per level.
  const dag = buildLevels(state.fileContracts);
  const sharedSet = new Set(state.sharedFiles);

  for (let i = 0; i < dag.levels.length; i++) {
    const level = dag.levels[i];
    ctx.ui.notify(`🧩 Nivel ${i + 1}/${dag.levels.length}: ${level.length} subagentes en paralelo`, "info");
    const levelResults = await Promise.all(
      level.map((node) => {
        // Forbidden: shared files + every OTHER contract's path.
        const forbidden = [
          ...sharedSet,
          ...state.fileContracts.filter((c) => c.path !== node.contract.path).map((c) => c.path),
        ];
        return runOneImplementer(d, node.contract, node.id, forbidden, SONNET);
      }),
    );
    for (const r of levelResults) results.push(r);
  }

  return results;
}

// ---------- test generation dispatch ----------

async function runOneTestGenerator(
  d: DispatchCtx,
  contract: TestContract,
): Promise<TestGenerationResult> {
  // Resolve the journey/boundary descriptor.
  const journey =
    d.state.testSurface?.journeys.find((j) => j.id === contract.journey) ??
    d.state.testSurface?.integrationBoundaries.find((b) => b.id === contract.journey) ??
    null;

  const codeUnderTest = d.state.fileContracts.filter((c) =>
    contract.codeContractsUnderTest.includes(c.path),
  );

  const systemPrompt = buildTestGeneratorPrompt({
    contract,
    journey,
    codeUnderTest,
    projectInfo: d.state.projectInfo,
    surface: d.state.testSurface,
  });

  if (!d.state.gitInfo.hasGit) await backupFile(d.ctx.cwd, contract.path);

  const result = await runChildPi(
    {
      provider: SONNET.provider,
      model: SONNET.model,
      systemPrompt,
      userTask: testGenTask(contract),
      toolAllowlist: TEST_TOOLS,
      cwd: d.ctx.cwd,
    },
    `test-${contract.path.replace(/[^a-z0-9]/gi, "_")}`,
  );

  if (result.exitCode !== 0) {
    return { testPath: contract.path, status: "BLOCKED", artifact: contract.kind };
  }
  const parsed = parseTestStatus(result.finalText);
  return { testPath: contract.path, status: parsed.status, artifact: contract.kind };
}

/** Run test generators with a small concurrency cap to avoid spawning N processes at once. */
export async function dispatchTestGeneration(
  state: DraftState,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<TestGenerationResult[]> {
  const d: DispatchCtx = { state, pi, ctx };
  const results: TestGenerationResult[] = new Array(state.testContracts.length);

  let cursor = 0;
  const workers: Promise<void>[] = [];
  const total = state.testContracts.length;
  const workerCount = Math.min(TEST_CONCURRENCY, total);

  for (let w = 0; w < workerCount; w++) {
    workers.push((async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= total) return;
        const contract = state.testContracts[idx];
        ctx.ui.notify(`🧪 Generando test ${idx + 1}/${total}: ${contract.path}`, "info");
        results[idx] = await runOneTestGenerator(d, contract);
      }
    })());
  }

  await Promise.all(workers);
  return results;
}
