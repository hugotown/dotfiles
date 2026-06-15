export type Mode = "warn" | "strict" | "off";

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly filePatterns: readonly string[];
  readonly patterns: ReadonlyArray<RegExp>;
  readonly message: string;
  readonly severity?: "error" | "warning";
}

export interface Match {
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly matchedText: string;
}

export interface Config {
  readonly mode: Mode;
  readonly watch: {
    readonly include: readonly string[];
    readonly ignore: readonly string[];
    readonly maxSizeKb: number;
  };
  readonly debounceMs: number;
  readonly cooldownMs: number;
  readonly builtInRules: Readonly<Record<string, boolean>>;
  readonly customRules: readonly Rule[];
}

export interface EventBus {
  on(event: string, handler: (payload: unknown) => void): void;
}

export interface GuardrailsPi {
  events: EventBus;
  sendUserMessage(message: string, options?: { deliverAs?: "followUp" }): void | Promise<void>;
}

export interface GuardrailsContext {
  cwd?: string;
  isIdle?: () => boolean;
}
