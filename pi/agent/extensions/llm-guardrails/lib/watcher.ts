import chokidar, { type FSWatcher } from "chokidar";
import micromatch from "micromatch";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface Logger {
  error(message: string): void;
  warn(message: string): void;
  debug?(message: string): void;
}

type OnFile = (file: string, content: string) => void | Promise<void>;
type FileStat = {
  isFile(): boolean;
  size: number;
};
type ReadFile = (file: string) => Promise<Buffer>;
type StatFile = (file: string) => Promise<FileStat>;

interface WatcherOptions {
  debounceMs: number;
  maxSizeKb: number;
  logger: Logger;
  retryDelayMs?: number;
  readFile?: ReadFile;
  stat?: StatFile;
}
type StartConfig = {
  cwd: string;
  include: readonly string[];
  ignore: readonly string[];
  onFile: OnFile;
};

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
  let startConfig: StartConfig | undefined;
  let generation = 0;
  let running = false;
  let disabled = false;
  let restartAttempted = false;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const eaccesWarnings = new Set<string>();

  const stat = options.stat ?? fs.stat;
  const readFile = options.readFile ?? fs.readFile;

  function relativePath(cwd: string, filePath: string): string {
    const relative = path.isAbsolute(filePath) ? path.relative(cwd, filePath) : filePath;
    return relative.split(path.sep).join("/");
  }

  function isIgnored(cwd: string, filePath: string, ignored: readonly string[]): boolean {
    return micromatch.isMatch(relativePath(cwd, filePath), ignored, { dot: true });
  }

  async function processFile(file: string, onFile: OnFile, fileGeneration: number): Promise<void> {
    try {
      const fileStat = await stat(file);
      if (!running || generation !== fileGeneration) return;
      if (!fileStat.isFile()) return;
      if (fileStat.size > options.maxSizeKb * 1024) {
        options.logger.debug?.(`llm-guardrail: skipped large file ${file}`);
        return;
      }

      const buffer = await readFile(file);
      if (!running || generation !== fileGeneration) return;
      if (hasNullByte(buffer)) {
        options.logger.debug?.(`llm-guardrail: skipped binary file ${file}`);
        return;
      }

      if (!running || generation !== fileGeneration) return;
      await onFile(file, buffer.toString("utf8"));
    } catch (error) {
      if (!running || generation !== fileGeneration) return;
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        options.logger.debug?.(`llm-guardrail: file disappeared before read ${file}`);
      } else if (code === "EACCES") {
        if (!eaccesWarnings.has(file)) {
          eaccesWarnings.add(file);
          options.logger.warn(`llm-guardrail: permission denied reading ${file}`);
        }
      } else {
        options.logger.warn(`llm-guardrail: failed reading ${file}: ${errorMessage(error)}`);
      }
    }
  }

  function schedule(file: string, onFile: OnFile): void {
    if (!running) return;
    const existing = timers.get(file);
    if (existing) clearTimeout(existing);

    const fileGeneration = generation;
    const timer = setTimeout(() => {
      timers.delete(file);
      void processFile(file, onFile, fileGeneration);
    }, options.debounceMs);
    timer.unref?.();
    timers.set(file, timer);
  }

  async function closeCurrent(): Promise<void> {
    const current = watcher;
    watcher = undefined;
    if (current) await current.close();
  }

  function startChokidar(config: StartConfig): void {
    const ignored = [...BUILT_IN_IGNORE, ...config.ignore];
    watcher = chokidar.watch([...config.include], {
      cwd: config.cwd,
      ignored: (filePath: string) => isIgnored(config.cwd, filePath, ignored),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on("add", (file) => schedule(path.resolve(config.cwd, file), config.onFile));
    watcher.on("change", (file) => schedule(path.resolve(config.cwd, file), config.onFile));
    watcher.on("error", (error) => {
      void handleWatcherError(error);
    });
  }

  async function disableWatcher(): Promise<void> {
    running = false;
    disabled = true;
    generation += 1;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    await closeCurrent();
  }

  async function handleWatcherError(error: unknown): Promise<void> {
    options.logger.error(`llm-guardrail: watcher error: ${errorMessage(error)}`);
    if (!running || disabled) return;

    if (restartAttempted) {
      await disableWatcher();
      return;
    }

    restartAttempted = true;
    const config = startConfig;
    const restartGeneration = generation;
    await closeCurrent();

    await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 100));
    if (!running || disabled || generation !== restartGeneration || !config) return;

    try {
      startChokidar(config);
    } catch (restartError) {
      options.logger.warn(`llm-guardrail: watcher restart failed, disabling watcher: ${errorMessage(restartError)}`);
      await disableWatcher();
    }
  }

  async function start(cwd: string, include: readonly string[], ignore: readonly string[], onFile: OnFile): Promise<void> {
    if (watcher || disabled) return;

    running = true;
    restartAttempted = false;
    generation += 1;
    startConfig = { cwd, include, ignore, onFile };
    startChokidar(startConfig);
  }

  async function stop(): Promise<void> {
    running = false;
    disabled = false;
    generation += 1;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    await closeCurrent();
  }

  return { start, stop };
}
