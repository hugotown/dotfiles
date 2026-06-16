import { beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { createMessenger } from "../lib/messenger.ts";
import type { GuardrailsContext, GuardrailsPi, Match, Rule } from "../lib/types.ts";

const rule: Rule = {
  id: "no-type-suppressions",
  name: "No type suppressions",
  description: "Type suppressions hide type errors.",
  filePatterns: ["**/*.ts"],
  patterns: [/\/\/\s*@ts-ignore/g],
  message: "Resolve it.",
};

const match: Match = {
  ruleId: rule.id,
  file: "foo.ts",
  line: 42,
  column: 13,
  matchedText: "// @ts-ignore",
};

const expectedMessage = [
  "Guardrail violation: No type suppressions",
  "File: foo.ts:42:13",
  "Match: `// @ts-ignore`",
  "Rule: Type suppressions hide type errors.",
  "",
  "This shortcut hides the real problem. Resolve it at the root, not with a suppression.",
].join("\n");

function createLogger() {
  return {
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  };
}

function createSendUserMessageMock() {
  return mock((_message: string, _options?: { deliverAs?: "followUp" }) => {});
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createMessenger", () => {
  beforeEach(() => setSystemTime(new Date("2026-06-15T00:00:00Z")));

  test("sends exactly formatted follow-up when idle", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: createLogger() });

    await messenger.sendWarning([match], rule, { isIdle: () => true });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(sendUserMessage.mock.calls[0]?.[0]).toBe(expectedMessage);
    expect(sendUserMessage.mock.calls[0]?.[1]).toEqual({ deliverAs: "followUp" });
  });

  test("dedups repeated warning by file line and rule within cooldown", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: createLogger() });
    const ctx: GuardrailsContext = { isIdle: () => true };

    await messenger.sendWarning([match], rule, ctx);
    await messenger.sendWarning([{ ...match, column: 99, matchedText: "// @ts-expect-error" }], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    setSystemTime(new Date("2026-06-15T00:00:31Z"));
    await messenger.sendWarning([match], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
  });

  test("keeps dedup entries bounded as an LRU", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, {
      cooldownMs: 30_000,
      logger: createLogger(),
      maxDedupEntries: 2,
    });
    const ctx: GuardrailsContext = { isIdle: () => true };

    await messenger.sendWarning([{ ...match, file: "a.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "b.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "c.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "a.ts" }], rule, ctx);

    expect(sendUserMessage).toHaveBeenCalledTimes(4);
  });

  test("refreshes dedup recency when suppressing duplicate warnings", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, {
      cooldownMs: 30_000,
      logger: createLogger(),
      maxDedupEntries: 2,
    });
    const ctx: GuardrailsContext = { isIdle: () => true };

    await messenger.sendWarning([{ ...match, file: "a.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "b.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "a.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "c.ts" }], rule, ctx);
    await messenger.sendWarning([{ ...match, file: "a.ts" }], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(3);

    await messenger.sendWarning([{ ...match, file: "b.ts" }], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(4);
  });

  test("queues when not idle and drains in order", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: createLogger() });
    const secondMatch: Match = { ...match, file: "bar.ts", line: 7, column: 3, matchedText: "// @ts-expect-error" };

    await messenger.sendWarning([match, secondMatch], rule, { isIdle: () => false });
    expect(sendUserMessage).toHaveBeenCalledTimes(0);

    await messenger.drain();
    expect(sendUserMessage.mock.calls.map((call) => call[0])).toEqual([
      expectedMessage,
      [
        "Guardrail violation: No type suppressions",
        "File: bar.ts:7:3",
        "Match: `// @ts-expect-error`",
        "Rule: Type suppressions hide type errors.",
        "",
        "This shortcut hides the real problem. Resolve it at the root, not with a suppression.",
      ].join("\n"),
    ]);
  });

  test("overlapping drains share one sequential drain", async () => {
    const delivered: string[] = [];
    const resolvers: Array<() => void> = [];
    const sendUserMessage = mock(async (message: string, _options?: { deliverAs?: "followUp" }) => {
      await new Promise<void>((resolve) => resolvers.push(resolve));
      delivered.push(message);
    });
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: createLogger() });
    const secondMatch: Match = { ...match, file: "bar.ts", line: 7, column: 3, matchedText: "// @ts-expect-error" };

    await messenger.sendWarning([match, secondMatch], rule, { isIdle: () => false });
    const firstDrain = messenger.drain();
    const secondDrain = messenger.drain();
    await Promise.resolve();

    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await nextTick();
    expect(sendUserMessage).toHaveBeenCalledTimes(2);

    resolvers[1]?.();
    await Promise.all([firstDrain, secondDrain]);

    expect(delivered).toEqual([
      expectedMessage,
      [
        "Guardrail violation: No type suppressions",
        "File: bar.ts:7:3",
        "Match: `// @ts-expect-error`",
        "Rule: Type suppressions hide type errors.",
        "",
        "This shortcut hides the real problem. Resolve it at the root, not with a suppression.",
      ].join("\n"),
    ]);
  });

  test("drops queued messages on flush and logs a warning", async () => {
    const sendUserMessage = createSendUserMessageMock();
    const logger = createLogger();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger });

    await messenger.sendWarning([match], rule, { isIdle: () => false });
    messenger.flush();
    await messenger.drain();

    expect(sendUserMessage).toHaveBeenCalledTimes(0);
    expect(logger.warn).toHaveBeenCalledWith("llm-guardrail: dropped 1 queued warnings on shutdown");
  });

  test("retries sendUserMessage once after a failure", async () => {
    let calls = 0;
    const sendUserMessage = mock((_message: string, _options?: { deliverAs?: "followUp" }) => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });
    const logger = createLogger();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger, retryDelayMs: 1 });

    await messenger.sendWarning([match], rule, { isIdle: () => true });

    expect(sendUserMessage).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith("llm-guardrail: sendUserMessage failed, retrying: boom");
  });

  test("drops and warns after retry fails", async () => {
    const sendUserMessage = mock((_message: string, _options?: { deliverAs?: "followUp" }) => {
      throw new Error("boom");
    });
    const logger = createLogger();
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger, retryDelayMs: 1 });

    await messenger.sendWarning([match], rule, { isIdle: () => true });

    expect(sendUserMessage).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith("llm-guardrail: dropping warning after retry failed: boom");
  });
});
