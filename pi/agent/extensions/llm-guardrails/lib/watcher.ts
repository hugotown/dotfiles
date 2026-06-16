import chokidar, { type FSWatcher } from "chokidar";
import micromatch from "micromatch";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface Logger {
  error(message: string): void;
  warn(message: string): void;
  debug?(message: string): void;
}

interface WatcherOptions {
  debounceMs: number;
  maxSizeKb: number;
  logger: Logger;
}

type OnFile = (file: string, content: string) => void | Promise<void>;

const BUILT_IN_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/vendor/**",
  "**/*.{png,jpg,jpeg,gif,webp,svg,avif,ico,pdf}",
  "**/*.{zip,tar,gz,tgz,bz2,xz,7z}",
  "**/package-lock.json",
  "**/bun.lock",
  "**/bun.lockb",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
];

function hasNullByte(buffer: Buffer): boolean {
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createWatcher(options: WatcherOptions): { start(cwd: string, include: readonly string[], ignore: readonly string[], onFile: OnFile): Promise<void>; stop(): Promise<void> } {
  let watcher: FSWatcher | undefined;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  async function processFile(file: string, onFile: OnFile): Promise<void> {
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) return;
      if (stat.size > options.maxSizeKb * 1024) {
        options.logger.debug?.(`llm-guardrail: skipped large file ${file}`);
        return;
      }

      const buffer = await fs.readFile(file);
      if (hasNullByte(buffer)) {
        options.logger.debug?.(`llm-guardrail: skipped binary file ${file}`);
        return;
      }

      await onFile(file, buffer.toString("utf8"));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        options.logger.debug?.(`llm-guardrail: file disappeared before read ${file}`);
      } else if (code === "EACCES") {
        options.logger.warn(`llm-guardrail: permission denied reading ${file}`);
      } else {
        options.logger.warn(`llm-guardrail: failed reading ${file}: ${errorMessage(error)}`);
      }
    }
  }

  function schedule(file: string, onFile: OnFile): void {
    const existing = timers.get(file);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(file);
      void processFile(file, onFile);
    }, options.debounceMs);
    timer.unref?.();
    timers.set(file, timer);
  }

  async function start(cwd: string, include: readonly string[], ignore: readonly string[], onFile: OnFile): Promise<void> {
    if (watcher) return;

    const ignored = [...BUILT_IN_IGNORE, ...ignore];
    watcher = chokidar.watch([...include], {
      cwd,
      ignored: (filePath: string) => micromatch.isMatch(filePath, ignored, { dot: true }),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on("add", (file) => schedule(path.resolve(cwd, file), onFile));
    watcher.on("change", (file) => schedule(path.resolve(cwd, file), onFile));
    watcher.on("error", (error) => {
      options.logger.error(`llm-guardrail: watcher error: ${errorMessage(error)}`);
    });
  }

  async function stop(): Promise<void> {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();

    const current = watcher;
    watcher = undefined;
    if (current) await current.close();
  }

  return { start, stop };
}
