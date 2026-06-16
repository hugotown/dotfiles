import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

type Handler = (...args: unknown[]) => void;
type WatchOptions = {
  ignored: (filePath: string) => boolean;
};

class FakeWatcher {
  readonly handlers = new Map<string, Handler[]>();
  readonly close = mock(async () => {});

  on(event: string, handler: Handler): this {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

const watchers: FakeWatcher[] = [];
let throwOnWatch = false;
const watch = mock((_include: readonly string[], _options: unknown) => {
  if (throwOnWatch) throw new Error("restart failed");
  const watcher = new FakeWatcher();
  watchers.push(watcher);
  return watcher;
});

mock.module("chokidar", () => ({
  default: { watch },
  watch,
}));

const { createWatcher } = await import("../lib/watcher.ts");

function createLogger() {
  return {
    error: mock((_message: string) => {}),
    warn: mock((_message: string) => {}),
    debug: mock((_message: string) => {}),
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for predicate");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("createWatcher", () => {
  let dir: string;

  beforeEach(async () => {
    watchers.length = 0;
    throwOnWatch = false;
    watch.mockClear();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "llm-guardrails-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("starts one chokidar watcher with safe defaults", async () => {
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: createLogger() });

    await watcher.start(dir, ["**/*"], ["**/*.log"], mock(() => {}));
    await watcher.start(dir, ["other/**"], [], mock(() => {}));

    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0]?.[0]).toEqual(["**/*"]);
    expect(watch.mock.calls[0]?.[1]).toMatchObject({
      cwd: dir,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    await watcher.stop();
  });

  test("applies built-in ignores before user ignores", async () => {
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: createLogger() });

    await watcher.start(dir, ["**/*"], ["**/*.generated.ts"], mock(() => {}));
    const ignored = (watch.mock.calls[0]?.[1] as WatchOptions | undefined)?.ignored;
    expect(ignored).toBeDefined();

    expect(ignored?.("node_modules/pkg/index.ts")).toBe(true);
    expect(ignored?.(".git/config")).toBe(true);
    expect(ignored?.("dist/index.js")).toBe(true);
    expect(ignored?.("build/index.js")).toBe(true);
    expect(ignored?.(".next/server/app.js")).toBe(true);
    expect(ignored?.("coverage/lcov.info")).toBe(true);
    expect(ignored?.("vendor/pkg/index.ts")).toBe(true);
    expect(ignored?.("assets/photo.png")).toBe(true);
    expect(ignored?.("docs/file.pdf")).toBe(true);
    expect(ignored?.("archive/file.zip")).toBe(true);
    expect(ignored?.("package-lock.json")).toBe(true);
    expect(ignored?.("src/foo.generated.ts")).toBe(true);
    expect(ignored?.("src/foo.ts")).toBe(false);

    await watcher.stop();
  });

  test("matches user ignore globs against paths relative to cwd", async () => {
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: createLogger() });

    await watcher.start(dir, ["**/*"], ["src/**/*.generated.ts"], mock(() => {}));
    const ignored = (watch.mock.calls[0]?.[1] as WatchOptions | undefined)?.ignored;

    expect(ignored?.(path.join(dir, "src/foo.generated.ts"))).toBe(true);
    expect(ignored?.(path.join(dir, ".git/config"))).toBe(true);
    expect(ignored?.(path.join(dir, "src/foo.ts"))).toBe(false);

    await watcher.stop();
  });

  test("invokes callback with absolute path and content after a file is added", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: createLogger() });
    const file = path.join(dir, "foo.ts");

    await fs.writeFile(file, "// @ts-ignore");
    await watcher.start(dir, ["**/*"], [], onFile);
    watchers[0]?.emit("add", "foo.ts");

    await waitFor(() => onFile.mock.calls.length === 1);
    expect(onFile.mock.calls[0]?.[0]).toBe(file);
    expect(onFile.mock.calls[0]?.[1]).toBe("// @ts-ignore");

    await watcher.stop();
  });

  test("debounces rapid events to the same file", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    const watcher = createWatcher({ debounceMs: 50, maxSizeKb: 500, logger: createLogger() });
    const file = path.join(dir, "foo.ts");

    await watcher.start(dir, ["**/*"], [], onFile);
    for (let i = 0; i < 5; i += 1) {
      await fs.writeFile(file, String(i));
      watchers[0]?.emit("change", "foo.ts");
    }

    await waitFor(() => onFile.mock.calls.length === 1);
    expect(onFile.mock.calls[0]?.[1]).toBe("4");

    await watcher.stop();
  });

  test("skips large and binary files", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    const logger = createLogger();
    const watcher = createWatcher({ debounceMs: 10, maxSizeKb: 1, logger });

    await watcher.start(dir, ["**/*"], [], onFile);
    await fs.writeFile(path.join(dir, "large.ts"), "x".repeat(2048));
    await fs.writeFile(path.join(dir, "binary.bin"), Buffer.from([65, 0, 66]));
    watchers[0]?.emit("add", "large.ts");
    watchers[0]?.emit("add", "binary.bin");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onFile).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("skipped large file"));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("skipped binary file"));

    await watcher.stop();
  });

  test("logs expected read failures without crashing", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    const logger = createLogger();
    const watcher = createWatcher({ debounceMs: 10, maxSizeKb: 500, logger });

    await watcher.start(dir, ["**/*"], [], onFile);
    watchers[0]?.emit("add", "missing.ts");

    await waitFor(() => logger.debug.mock.calls.length === 1);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("file disappeared before read"));
    expect(onFile).toHaveBeenCalledTimes(0);

    await watcher.stop();
  });

  test("warns once per path for repeated EACCES read failures", async () => {
    const logger = createLogger();
    const inaccessible = path.join(dir, "secret.ts");
    const watcher = createWatcher({
      debounceMs: 10,
      maxSizeKb: 500,
      logger,
      readFile: mock(async () => {
        const error = new Error("denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }),
      stat: mock(async () => ({ isFile: () => true, size: 10 })),
    });

    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    watchers[0]?.emit("add", "secret.ts");
    await waitFor(() => logger.warn.mock.calls.length === 1);
    watchers[0]?.emit("change", "secret.ts");
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(`llm-guardrail: permission denied reading ${inaccessible}`);

    await watcher.stop();
  });

  test("stop during in-flight processing prevents the callback", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    let releaseRead: (() => void) | undefined;
    const watcher = createWatcher({
      debounceMs: 0,
      maxSizeKb: 500,
      logger: createLogger(),
      stat: mock(async () => ({ isFile: () => true, size: 10 })),
      readFile: mock(async () => {
        await new Promise<void>((resolve) => {
          releaseRead = resolve;
        });
        return Buffer.from("content");
      }),
    });

    await watcher.start(dir, ["**/*"], [], onFile);
    watchers[0]?.emit("add", "foo.ts");
    await waitFor(() => releaseRead !== undefined);
    await watcher.stop();
    releaseRead?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onFile).toHaveBeenCalledTimes(0);
  });

  test("logs chokidar errors", async () => {
    const logger = createLogger();
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger });

    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    watchers[0]?.emit("error", new Error("boom"));

    expect(logger.error).toHaveBeenCalledWith("llm-guardrail: watcher error: boom");

    await watcher.stop();
  });

  test("restarts once after a watcher error", async () => {
    const logger = createLogger();
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger, retryDelayMs: 1 });

    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    watchers[0]?.emit("error", new Error("boom"));

    await waitFor(() => watch.mock.calls.length === 2);
    expect(logger.error).toHaveBeenCalledWith("llm-guardrail: watcher error: boom");
    expect(watchers[0]?.close).toHaveBeenCalledTimes(1);

    watchers[1]?.emit("error", new Error("boom again"));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(watch).toHaveBeenCalledTimes(2);

    await watcher.stop();
  });

  test("disables watcher when restart fails", async () => {
    const logger = createLogger();
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger, retryDelayMs: 1 });

    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    throwOnWatch = true;
    watchers[0]?.emit("error", new Error("boom"));

    await waitFor(() => logger.warn.mock.calls.length === 1);
    expect(watchers[0]?.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith("llm-guardrail: watcher restart failed, disabling watcher: restart failed");

    await watcher.stop();
  });

  test("stop is idempotent and cancels pending work", async () => {
    const onFile = mock((_file: string, _content: string) => {});
    const watcher = createWatcher({ debounceMs: 50, maxSizeKb: 500, logger: createLogger() });
    const file = path.join(dir, "foo.ts");

    await fs.writeFile(file, "content");
    await watcher.start(dir, ["**/*"], [], onFile);
    watchers[0]?.emit("add", "foo.ts");
    await watcher.stop();
    await watcher.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(watchers[0]?.close).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledTimes(0);
  });
});
