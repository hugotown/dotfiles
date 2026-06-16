import type { GuardrailsContext, GuardrailsPi, Match, Rule } from "./types.ts";

interface Logger {
  error(message: string): void;
  warn(message: string): void;
  debug?(message: string): void;
}

interface MessengerOptions {
  cooldownMs: number;
  logger: Logger;
  retryDelayMs?: number;
  maxDedupEntries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function format(match: Match, rule: Rule): string {
  return [
    `Guardrail violation: ${rule.name}`,
    `File: ${match.file}:${match.line}:${match.column}`,
    `Match: \`${match.matchedText}\``,
    `Rule: ${rule.description ?? rule.message}`,
    "",
    "This shortcut hides the real problem. Resolve it at the root, not with a suppression.",
  ].join("\n");
}

export function createMessenger(pi: GuardrailsPi, options: MessengerOptions) {
  const queue: string[] = [];
  const dedup = new Map<string, number>();
  const retryDelayMs = options.retryDelayMs ?? 500;
  const maxDedupEntries = options.maxDedupEntries ?? 10_000;

  function remember(key: string, now: number): boolean {
    const previous = dedup.get(key);
    if (previous !== undefined && now - previous < options.cooldownMs) {
      options.logger.debug?.("llm-guardrail: suppressed duplicate warning");
      return false;
    }

    dedup.delete(key);
    dedup.set(key, now);

    while (dedup.size > maxDedupEntries) {
      const oldest = dedup.keys().next().value;
      if (oldest === undefined) break;
      dedup.delete(oldest);
    }

    return true;
  }

  async function deliver(message: string): Promise<void> {
    try {
      await pi.sendUserMessage(message, { deliverAs: "followUp" });
    } catch (error) {
      options.logger.error(`llm-guardrail: sendUserMessage failed, retrying: ${errorMessage(error)}`);
      await sleep(retryDelayMs);

      try {
        await pi.sendUserMessage(message, { deliverAs: "followUp" });
      } catch (secondError) {
        options.logger.warn(`llm-guardrail: dropping warning after retry failed: ${errorMessage(secondError)}`);
      }
    }
  }

  async function sendWarning(matches: readonly Match[], rule: Rule, ctx: GuardrailsContext): Promise<void> {
    const now = Date.now();

    for (const match of matches) {
      const key = `${match.file}:${match.line}:${match.ruleId}`;
      if (!remember(key, now)) continue;

      const message = format(match, rule);
      if (ctx.isIdle?.() === false) queue.push(message);
      else await deliver(message);
    }
  }

  async function drain(): Promise<void> {
    while (queue.length > 0) {
      const message = queue.shift();
      if (message !== undefined) await deliver(message);
    }
  }

  function flush(): void {
    if (queue.length > 0) options.logger.warn(`llm-guardrail: dropped ${queue.length} queued warnings on shutdown`);
    queue.length = 0;
  }

  return { sendWarning, drain, flush };
}
