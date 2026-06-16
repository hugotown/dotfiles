import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

type Handler = (...args: unknown[]) => unknown;

class FakeWatcher {
  readonly handlers = new Map<string, Handler[]>();
  readonly close = mock(async () => {});

  on(event: string, handler: Handler): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

const watchers: FakeWatcher[] = [];
const watch = mock((_include: readonly string[], _options: unknown) => {
  const watcher = new FakeWatcher();
  watchers.push(watcher);
  return watcher;
});

mock.module("chokidar", () => ({
  default: { watch },
  watch,
}));

const { default: extension } = await import("../index.ts");

function createPi() {
  const handlers = new Map<string, Handler[]>();
  const eventHandlers = new Map<string, Handler[]>();
  return {
    handlers,
    eventHandlers,
    events: {
      on: mock((event: string, handler: Handler) => {
        eventHandlers.set(event, [...(eventHandlers.get(event) ?? []), handler]);
        return () => eventHandlers.set(event, (eventHandlers.get(event) ?? []).filter((candidate) => candidate !== handler));
      }),
    },
    sendUserMessage: mock((_message: string, _options?: { deliverAs?: "followUp" }) => {}),
    on: mock((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for predicate");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("llm-guardrails extension", () => {
  const originalMode = process.env.LLM_GUARDRAILS_MODE;
  const originalDebounce = process.env.LLM_GUARDRAILS_DEBOUNCE_MS;
  let dir: string;

  beforeEach(async () => {
    watchers.length = 0;
    watch.mockClear();
    process.env.LLM_GUARDRAILS_MODE = "warn";
    process.env.LLM_GUARDRAILS_DEBOUNCE_MS = "0";
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "llm-guardrails-integration-"));
  });

  afterEach(async () => {
    if (originalMode === undefined) delete process.env.LLM_GUARDRAILS_MODE;
    else process.env.LLM_GUARDRAILS_MODE = originalMode;
    if (originalDebounce === undefined) delete process.env.LLM_GUARDRAILS_DEBOUNCE_MS;
    else process.env.LLM_GUARDRAILS_DEBOUNCE_MS = originalDebounce;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("registers lifecycle hooks", () => {
    const pi = createPi();

    extension(pi as never);

    expect(pi.on.mock.calls.map((call) => call[0])).toEqual(["session_start", "agent_end", "session_shutdown"]);
  });

  test("off mode skips rule subscription and watcher startup", async () => {
    process.env.LLM_GUARDRAILS_MODE = "off";
    const pi = createPi();
    extension(pi as never);

    await pi.handlers.get("session_start")?.[0]?.({}, {});

    expect(pi.events.on).not.toHaveBeenCalled();
    expect(watch).not.toHaveBeenCalled();
  });

  test("agent_end drains without a started session", async () => {
    const pi = createPi();
    extension(pi as never);

    await pi.handlers.get("agent_end")?.[0]?.({}, {});
  });

  test("session_shutdown is safe before session_start", async () => {
    const pi = createPi();
    extension(pi as never);

    await pi.handlers.get("session_shutdown")?.[0]?.({}, {});
  });

  test("sends a warning for a changed file with a built-in rule match", async () => {
    const pi = createPi();
    const file = path.join(dir, "unsafe.ts");
    await fs.writeFile(file, "// @ts-ignore\nconst value = 1;\n");

    extension(pi as never);
    await pi.handlers.get("session_start")?.[0]?.({}, { isIdle: () => true });
    watchers[0]?.emit("change", file);

    await waitFor(() => pi.sendUserMessage.mock.calls.length === 1);
    expect(pi.events.on).toHaveBeenCalledWith("llm-guardrail:register", expect.any(Function));
    expect(pi.sendUserMessage.mock.calls[0]?.[0]).toContain("Guardrail violation: No type suppressions");
    expect(pi.sendUserMessage.mock.calls[0]?.[0]).toContain(`File: ${file}:1:1`);
    expect(pi.sendUserMessage.mock.calls[0]?.[1]).toEqual({ deliverAs: "followUp" });

    await pi.handlers.get("session_shutdown")?.[0]?.({}, {});
    expect(watchers[0]?.close).toHaveBeenCalledTimes(1);
  });

  test("duplicate session_start cleans up the previous watcher and listener", async () => {
    const pi = createPi();
    extension(pi as never);

    await pi.handlers.get("session_start")?.[0]?.({}, { cwd: dir, isIdle: () => true });
    const firstWatcher = watchers[0];
    const firstUnsubscribe = pi.events.on.mock.results[0]?.value as (() => void) | undefined;
    await pi.handlers.get("session_start")?.[0]?.({}, { cwd: dir, isIdle: () => true });

    expect(watchers).toHaveLength(2);
    expect(firstWatcher?.close).toHaveBeenCalledTimes(1);
    expect(pi.eventHandlers.get("llm-guardrail:register")).toHaveLength(1);
    firstUnsubscribe?.();
    expect(pi.eventHandlers.get("llm-guardrail:register")).toHaveLength(1);
  });

  test("stale watcher callback after restart does not send warnings", async () => {
    const pi = createPi();
    const staleFile = path.join(dir, "stale.ts");
    const currentFile = path.join(dir, "current.ts");
    await fs.writeFile(staleFile, "// @ts-ignore\nconst stale = 1;\n");
    await fs.writeFile(currentFile, "// @ts-ignore\nconst current = 1;\n");

    extension(pi as never);
    await pi.handlers.get("session_start")?.[0]?.({}, { cwd: dir, isIdle: () => true });
    await pi.handlers.get("session_start")?.[0]?.({}, { cwd: dir, isIdle: () => true });

    watchers[0]?.emit("change", staleFile);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(pi.sendUserMessage).toHaveBeenCalledTimes(0);

    watchers[1]?.emit("change", currentFile);
    await waitFor(() => pi.sendUserMessage.mock.calls.length === 1);
    expect(pi.sendUserMessage.mock.calls[0]?.[0]).toContain(`File: ${currentFile}:1:1`);
  });
});
