import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./lib/config-loader.ts";
import { createMessenger } from "./lib/messenger.ts";
import { createRuleRegistry } from "./lib/rule-registry.ts";
import { scan } from "./lib/scanner.ts";
import type { GuardrailsPi, Match } from "./lib/types.ts";
import { createWatcher } from "./lib/watcher.ts";
import { BUILT_IN_RULES } from "./rules/built-in.ts";

const logger = {
  error: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message),
  info: (message: string) => console.log(message),
  debug: (message: string) => console.log(message),
};

export default function llmGuardrails(pi: ExtensionAPI): void {
  let registry: ReturnType<typeof createRuleRegistry> | undefined;
  let watcher: ReturnType<typeof createWatcher> | undefined;
  let messenger: ReturnType<typeof createMessenger> | undefined;
  let unsubscribeRegistry: (() => void) | undefined;
  let generation = 0;

  async function cleanup(): Promise<void> {
    generation += 1;

    const currentWatcher = watcher;
    const currentMessenger = messenger;
    const currentRegistry = registry;
    const currentUnsubscribeRegistry = unsubscribeRegistry;
    watcher = undefined;
    messenger = undefined;
    registry = undefined;
    unsubscribeRegistry = undefined;

    currentUnsubscribeRegistry?.();
    await currentWatcher?.stop();
    currentMessenger?.flush();
    currentRegistry?.clear();
  }

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    await cleanup();

    const config = loadConfig(undefined, logger);
    if (config.mode === "off") return;

    const sessionGeneration = generation + 1;
    generation = sessionGeneration;
    registry = createRuleRegistry(logger);
    for (const rule of BUILT_IN_RULES) {
      if (config.builtInRules[rule.id] === false) logger.info(`llm-guardrail: built-in rule disabled: ${rule.id}`);
      else registry.register(rule);
    }
    for (const rule of config.customRules) registry.register(rule);
    unsubscribeRegistry = registry.subscribe(pi.events);

    messenger = createMessenger(pi as unknown as GuardrailsPi, { cooldownMs: config.cooldownMs, logger });
    watcher = createWatcher({ debounceMs: config.debounceMs, maxSizeKb: config.watch.maxSizeKb, logger });

    await watcher.start(ctx.cwd, config.watch.include, config.watch.ignore, async (file, content) => {
      if (generation !== sessionGeneration) return;
      const rules = registry?.getAll() ?? [];
      const matches = scan(file, content, rules);
      const byRule = new Map<string, Match[]>();

      for (const match of matches) byRule.set(match.ruleId, [...(byRule.get(match.ruleId) ?? []), match]);
      for (const rule of rules) {
        if (generation !== sessionGeneration) return;
        const ruleMatches = byRule.get(rule.id);
        if (ruleMatches?.length) await messenger?.sendWarning(ruleMatches, rule, ctx);
      }
    });
  });

  pi.on("agent_end", async () => {
    await messenger?.drain();
  });

  pi.on("session_shutdown", async () => {
    await cleanup();
  });
}
