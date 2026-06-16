# LLM Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `llm-guardrails` pi extension that watches agent-written files and warns the LLM when it introduces suppression directives instead of fixing root causes.

**Architecture:** A small facade inside `pi/agent/extensions/llm-guardrails`: typed config loader, rule registry, scanner, watcher, and messenger. The watcher reads changed files, the scanner applies registered rules, and the messenger sends follow-up user messages with cooldown and idle-queue behavior.

**Tech Stack:** Bun, TypeScript strict mode, pi extension API (`@earendil-works/pi-coding-agent`), `yaml`, `chokidar`, `micromatch`, `safe-regex`, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-15-llm-guardrails-design.md`

**Important repo correction:** The spec names `~/.pi/agent/extensions/llm-guardrails/`, but this repository stores extensions under `pi/agent/extensions/`. Implement at `pi/agent/extensions/llm-guardrails/`.

**Implementation correction:** The spec asks for TypeBox validation. Existing extension config loaders in this repo use focused validation functions (`curl/lib/settings.ts`, `obra-sp-flow/lib/config-load.ts`). Use focused validation functions here too. This is simpler, matches local style, and avoids adding TypeBox only for config validation.

---

## File Structure

Create this directory:

```text
pi/agent/extensions/llm-guardrails/
├── package.json
├── tsconfig.json
├── config.yml
├── index.ts
├── README.md
├── lib/
│   ├── types.ts
│   ├── env-resolver.ts
│   ├── config-loader.ts
│   ├── rule-registry.ts
│   ├── scanner.ts
│   ├── watcher.ts
│   └── messenger.ts
├── rules/
│   └── built-in.ts
└── tests/
    ├── config-loader.test.ts
    ├── rule-registry.test.ts
    ├── scanner.test.ts
    ├── watcher.test.ts
    ├── messenger.test.ts
    ├── integration.test.ts
    └── built-in.test.ts
```

Responsibilities:

- `index.ts`: pi lifecycle wiring only.
- `lib/types.ts`: shared contracts and lightweight pi context adapter types.
- `lib/env-resolver.ts`: `$ENV` and `$ENV:default` resolution.
- `lib/config-loader.ts`: YAML parsing, defaults, coercion, custom-rule loading.
- `lib/rule-registry.ts`: rule validation, dedup/overwrite behavior, event-bus subscription.
- `lib/scanner.ts`: glob filtering, regex scanning, string-literal/prose avoidance, line/column conversion.
- `lib/watcher.ts`: chokidar wrapper, hardcoded ignores, per-file debounce, file safety checks.
- `lib/messenger.ts`: message formatting, cooldown, idle queue, retry-on-send failure.
- `rules/built-in.ts`: four built-in suppression rule groups.
- `tests/*.test.ts`: Bun tests colocated under the extension, matching local extension style.

---

## Task 0: Scaffold The Extension Package

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/package.json`
- Create: `pi/agent/extensions/llm-guardrails/tsconfig.json`
- Create: `pi/agent/extensions/llm-guardrails/config.yml`
- Create: `pi/agent/extensions/llm-guardrails/README.md`
- Test: `pi/agent/extensions/llm-guardrails/package.json`

- [ ] **Step 0.1: Create package metadata**

Create `pi/agent/extensions/llm-guardrails/package.json`:

```json
{
  "name": "pi-llm-guardrails",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "0.75.4",
    "chokidar": "^3.6.0",
    "micromatch": "^4.0.8",
    "safe-regex": "^2.1.1",
    "yaml": "2.9.0"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14",
    "@types/micromatch": "^4.0.9",
    "@types/node": "^22.0.0",
    "@types/safe-regex": "^1.1.6",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 0.2: Create TypeScript config**

Create `pi/agent/extensions/llm-guardrails/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "lib": ["ESNext", "DOM"],
    "types": ["node", "bun"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 0.3: Create default config**

Create `pi/agent/extensions/llm-guardrails/config.yml`:

```yaml
mode: "$LLM_GUARDRAILS_MODE:warn"

watch:
  include:
    - "**/*"
  ignore:
    - "**/*.log"
    - "**/*.lock"
    - "**/tmp/**"
  max_size_kb: "$LLM_GUARDRAILS_MAX_SIZE_KB:500"

debounce_ms: "$LLM_GUARDRAILS_DEBOUNCE_MS:200"
cooldown_ms: "$LLM_GUARDRAILS_COOLDOWN_MS:30000"

built_in_rules:
  no-linter-suppressions: "$LLM_GUARDRAILS_RULE_LINTER:true"
  no-type-suppressions: "$LLM_GUARDRAILS_RULE_TYPE:true"
  no-runtime-suppressions: "$LLM_GUARDRAILS_RULE_RUNTIME:true"
  no-compiler-suppressions: "$LLM_GUARDRAILS_RULE_COMPILER:true"

custom_rules: []
```

- [ ] **Step 0.4: Create README**

Create `pi/agent/extensions/llm-guardrails/README.md`:

```markdown
# llm-guardrails

Watches files changed during a pi session and warns the LLM when it writes lint, type, runtime, or compiler suppression directives.

The extension does not edit files and does not block writes in v1. `strict` mode currently behaves like `warn`; blocking is future work.

## Configuration

Edit `config.yml` to change mode, watch globs, cooldowns, built-in rule toggles, or custom rules.

Supported modes:

- `warn`: scan changed files and send a follow-up warning to the LLM.
- `strict`: same as `warn` in v1.
- `off`: load the extension but do not watch or register rules.

Custom rules use this shape:

```yaml
custom_rules:
  - id: "no-todo-comments"
    name: "No TODO comments"
    filePatterns: ["**/*.ts"]
    patterns: ["//\\s*TODO", "//\\s*FIXME"]
    message: "Resolve the TODO at line {line}; do not leave it for later."
    severity: "warning"
```

## Testing

Run from this directory:

```bash
bun install
bun test
bun run typecheck
```
```

- [ ] **Step 0.5: Install dependencies**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun install
```

Expected: `bun.lock` is created and dependencies install successfully.

- [ ] **Step 0.6: Commit scaffold**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/package.json pi/agent/extensions/llm-guardrails/tsconfig.json pi/agent/extensions/llm-guardrails/config.yml pi/agent/extensions/llm-guardrails/README.md pi/agent/extensions/llm-guardrails/bun.lock
git commit -m "feat(llm-guardrails): scaffold extension package"
```

Expected: commit succeeds.

---

## Task 1: Define Core Types And Built-In Rules

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/types.ts`
- Create: `pi/agent/extensions/llm-guardrails/rules/built-in.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/built-in.test.ts`

- [ ] **Step 1.1: Write failing built-in rule tests**

Create `pi/agent/extensions/llm-guardrails/tests/built-in.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { BUILT_IN_RULES } from "../rules/built-in.ts";

describe("BUILT_IN_RULES", () => {
  test("each rule has a unique id and usable metadata", () => {
    const ids = new Set<string>();
    for (const rule of BUILT_IN_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.filePatterns.length).toBeGreaterThan(0);
      expect(rule.patterns.length).toBeGreaterThan(0);
      expect(rule.message.length).toBeGreaterThan(0);
    }
  });

  test("all built-in regexes are global and case-insensitive", () => {
    for (const rule of BUILT_IN_RULES) {
      for (const pattern of rule.patterns) {
        expect(pattern.flags).toContain("g");
        expect(pattern.flags).toContain("i");
      }
    }
  });

  test("exports the four suppression rule groups", () => {
    expect(BUILT_IN_RULES.map((rule) => rule.id)).toEqual([
      "no-linter-suppressions",
      "no-type-suppressions",
      "no-runtime-suppressions",
      "no-compiler-suppressions",
    ]);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/built-in.test.ts
```

Expected: FAIL because `rules/built-in.ts` does not exist.

- [ ] **Step 1.3: Add shared types**

Create `pi/agent/extensions/llm-guardrails/lib/types.ts`:

```ts
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
```

- [ ] **Step 1.4: Add built-in rules**

Create `pi/agent/extensions/llm-guardrails/rules/built-in.ts`:

```ts
import type { Rule } from "../lib/types.ts";

const MESSAGE = "This shortcut hides the real problem. Resolve it at the root.";

export const BUILT_IN_RULES: readonly Rule[] = Object.freeze([
  {
    id: "no-linter-suppressions",
    name: "No linter suppressions",
    description: "Linter suppressions hide problems instead of fixing them.",
    filePatterns: ["**/*.{js,ts,jsx,tsx,vue,svelte,rb,php,css,scss}"],
    patterns: [
      /\/\/\s*eslint\s*-?\s*(disable|enable)(?:\s*-?\s*next\s*-?\s*line|\s*-?\s*line)?\b[^\n]*/gi,
      /\/\*\s*eslint\s*-?\s*(disable|enable)\b[\s\S]*?\*\//gi,
      /\/\*\s*stylelint\s*-?\s*disable\b[\s\S]*?\*\//gi,
      /#\s*rubocop:disable\b[^\n]*/gi,
      /\/\/\s*@phpstan-ignore-line\b[^\n]*/gi,
      /\/\/\s*@psalm-suppress\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-type-suppressions",
    name: "No type suppressions",
    description: "Type suppressions hide type errors instead of fixing them.",
    filePatterns: ["**/*.{ts,tsx,js,jsx,py}"],
    patterns: [
      /\/\/\s*@ts-(ignore|nocheck|expect-error)\b[^\n]*/gi,
      /#\s*type:\s*ignore\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-runtime-suppressions",
    name: "No runtime suppressions",
    description: "Runtime suppressions hide runtime problems instead of fixing them.",
    filePatterns: ["**/*.{ts,tsx,js,jsx,go,py}"],
    patterns: [
      /\/\/\s*@bun-ignore\b[^\n]*/gi,
      /\/\/\s*nolint(?::all)?\b[^\n]*/gi,
      /#\s*noqa\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-compiler-suppressions",
    name: "No compiler suppressions",
    description: "Compiler suppressions hide compiler diagnostics instead of fixing them.",
    filePatterns: ["**/*.{java,cs,c,cpp,h,hpp}"],
    patterns: [
      /\/\/\s*@SuppressWarnings\b[^\n]*/gi,
      /#pragma\s+warning\s+disable\b[^\n]*/gi,
      /#pragma\s+GCC\s+diagnostic\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
]);
```

- [ ] **Step 1.5: Run tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/built-in.test.ts
```

Expected: PASS.

- [ ] **Step 1.6: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/types.ts pi/agent/extensions/llm-guardrails/rules/built-in.ts pi/agent/extensions/llm-guardrails/tests/built-in.test.ts
git commit -m "feat(llm-guardrails): add built-in suppression rules"
```

Expected: commit succeeds.

---

## Task 2: Implement Scanner

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/scanner.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/scanner.test.ts`

- [ ] **Step 2.1: Write scanner tests**

Create `pi/agent/extensions/llm-guardrails/tests/scanner.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { scan } from "../lib/scanner.ts";
import { BUILT_IN_RULES } from "../rules/built-in.ts";
import type { Rule } from "../lib/types.ts";

describe("scan", () => {
  test("matches canonical built-in suppression directives", () => {
    const cases: Array<[string, string, string]> = [
      ["foo.ts", "// eslint-disable-next-line", "no-linter-suppressions"],
      ["foo.ts", "// eslint-disable-next-line react-hooks/exhaustive-deps", "no-linter-suppressions"],
      ["foo.ts", "/* eslint-disable */", "no-linter-suppressions"],
      ["foo.ts", "// @ts-ignore", "no-type-suppressions"],
      ["foo.ts", "// @ts-nocheck", "no-type-suppressions"],
      ["foo.ts", "// @ts-expect-error", "no-type-suppressions"],
      ["foo.ts", "// @bun-ignore", "no-runtime-suppressions"],
      ["foo.go", "//nolint", "no-runtime-suppressions"],
      ["foo.go", "//nolint:all", "no-runtime-suppressions"],
      ["foo.py", "# noqa", "no-runtime-suppressions"],
      ["foo.py", "# type: ignore", "no-type-suppressions"],
      ["Foo.java", "// @SuppressWarnings(\"unchecked\")", "no-compiler-suppressions"],
      ["foo.cs", "#pragma warning disable 414", "no-compiler-suppressions"],
      ["foo.c", "#pragma GCC diagnostic ignored \"-Wunused\"", "no-compiler-suppressions"],
      ["foo.css", "/* stylelint-disable */", "no-linter-suppressions"],
      ["foo.php", "// @phpstan-ignore-line", "no-linter-suppressions"],
      ["foo.php", "// @psalm-suppress PropertyNotSetInConstructor", "no-linter-suppressions"],
      ["foo.rb", "# rubocop:disable Style/Documentation", "no-linter-suppressions"],
    ];

    for (const [file, content, ruleId] of cases) {
      expect(scan(file, content, BUILT_IN_RULES).map((match) => match.ruleId)).toContain(ruleId);
    }
  });

  test("matches common evasion variants", () => {
    const cases = ["//   eslint-disable", "// ESLINT-DISABLE", "//EsLint-Disable-next-Line", "/*eslint-disable*/", "/* eslint-disable react-hooks/exhaustive-deps */"];
    for (const content of cases) {
      expect(scan("foo.ts", content, BUILT_IN_RULES)).toHaveLength(1);
    }
  });

  test("avoids prose, URLs, and string literals", () => {
    const content = [
      "// I disabled the lint warning",
      "// this is a comment about eslint-disable, not using it",
      "const x = \"// eslint-disable\";",
      "const y = '/* eslint-disable */';",
      "const z = `// @ts-ignore`;",
      "https://eslint-disable-docs.com",
    ].join("\n");

    expect(scan("foo.ts", content, BUILT_IN_RULES)).toEqual([]);
  });

  test("filters rules by filePatterns", () => {
    const rule: Rule = {
      id: "only-ts",
      name: "Only TS",
      filePatterns: ["**/*.ts"],
      patterns: [/\/\/\s*NOPE/g],
      message: "nope",
    };

    expect(scan("foo.py", "// NOPE", [rule])).toEqual([]);
    expect(scan("foo.ts", "// NOPE", [rule])).toHaveLength(1);
  });

  test("returns multiple matches sorted by line and column", () => {
    const matches = scan("foo.ts", "ok\n// @ts-ignore\n  // eslint-disable-next-line\n// @bun-ignore", BUILT_IN_RULES);
    expect(matches.map((match) => [match.ruleId, match.line, match.column])).toEqual([
      ["no-type-suppressions", 2, 1],
      ["no-linter-suppressions", 3, 3],
      ["no-runtime-suppressions", 4, 1],
    ]);
  });

  test("scans a one megabyte file with a match at the end quickly", () => {
    const content = `${"x".repeat(1024 * 1024)}\n// @ts-ignore`;
    const started = performance.now();
    const matches = scan("foo.ts", content, BUILT_IN_RULES);
    expect(matches).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
```

- [ ] **Step 2.2: Run scanner tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/scanner.test.ts
```

Expected: FAIL because `lib/scanner.ts` does not exist.

- [ ] **Step 2.3: Implement scanner**

Create `pi/agent/extensions/llm-guardrails/lib/scanner.ts`:

```ts
import micromatch from "micromatch";
import type { Match, Rule } from "./types.ts";

function lineStart(content: string, offset: number): number {
  return content.lastIndexOf("\n", offset - 1) + 1;
}

function lineEnd(content: string, offset: number): number {
  const end = content.indexOf("\n", offset);
  return end === -1 ? content.length : end;
}

function insideStringLiteralOnLine(content: string, offset: number): boolean {
  const start = lineStart(content, offset);
  const before = content.slice(start, offset);
  for (const quote of ["\"", "'", "`"] as const) {
    let open = false;
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] === "\\") {
        i += 1;
        continue;
      }
      if (before[i] === quote) open = !open;
    }
    if (open) return true;
  }
  return false;
}

function lineAndColumn(content: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < offset; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
      lastNewline = i;
    }
  }
  return { line, column: offset - lastNewline };
}

function cloneGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

export function scan(file: string, content: string, rules: readonly Rule[]): Match[] {
  const matches: Match[] = [];

  for (const rule of rules) {
    if (!micromatch.isMatch(file, [...rule.filePatterns])) continue;

    for (const originalPattern of rule.patterns) {
      const pattern = cloneGlobal(originalPattern);
      let found: RegExpExecArray | null;
      while ((found = pattern.exec(content)) !== null) {
        if (found[0].length === 0) {
          pattern.lastIndex += 1;
          continue;
        }

        const offset = found.index;
        if (insideStringLiteralOnLine(content, offset)) continue;

        const { line, column } = lineAndColumn(content, offset);
        matches.push({
          ruleId: rule.id,
          file,
          line,
          column,
          matchedText: content.slice(offset, Math.min(lineEnd(content, offset), offset + found[0].length)),
        });
      }
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
}
```

- [ ] **Step 2.4: Run scanner tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/scanner.test.ts tests/built-in.test.ts
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/scanner.ts pi/agent/extensions/llm-guardrails/tests/scanner.test.ts
git commit -m "feat(llm-guardrails): scan files for suppression directives"
```

Expected: commit succeeds.

---

## Task 3: Implement Rule Registry

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/rule-registry.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/rule-registry.test.ts`

- [ ] **Step 3.1: Write registry tests**

Create `pi/agent/extensions/llm-guardrails/tests/rule-registry.test.ts`:

```ts
import { describe, expect, mock, test } from "bun:test";
import { createRuleRegistry, validateRule } from "../lib/rule-registry.ts";
import type { EventBus, Rule } from "../lib/types.ts";

const validRule: Rule = {
  id: "no-empty-catch",
  name: "No empty catch",
  filePatterns: ["**/*.ts"],
  patterns: [/catch\s*\([^)]*\)\s*\{\s*\}/g],
  message: "Empty catch blocks hide errors.",
};

describe("validateRule", () => {
  test("accepts a valid rule", () => {
    expect(validateRule(validRule).ok).toBe(true);
  });

  test("rejects invalid metadata", () => {
    expect(validateRule({ ...validRule, id: "" }).ok).toBe(false);
    expect(validateRule({ ...validRule, name: "" }).ok).toBe(false);
    expect(validateRule({ ...validRule, filePatterns: [] }).ok).toBe(false);
    expect(validateRule({ ...validRule, patterns: [] }).ok).toBe(false);
  });

  test("rejects unsafe regexes", () => {
    expect(validateRule({ ...validRule, patterns: [/(a+)+$/g] }).ok).toBe(false);
  });
});

describe("createRuleRegistry", () => {
  test("register, overwrite, unregister, and immutable getAll", () => {
    const warn = mock(() => {});
    const info = mock(() => {});
    const registry = createRuleRegistry({ warn, info });

    expect(registry.register(validRule)).toBe(true);
    expect(registry.getAll()).toHaveLength(1);

    const replacement = { ...validRule, name: "Replacement" };
    expect(registry.register(replacement)).toBe(true);
    expect(registry.getAll()[0]?.name).toBe("Replacement");
    expect(info).toHaveBeenCalledWith("llm-guardrail: rule overwritten: no-empty-catch");

    const snapshot = registry.getAll() as Rule[];
    snapshot.pop();
    expect(registry.getAll()).toHaveLength(1);

    registry.unregister("no-empty-catch");
    expect(registry.getAll()).toEqual([]);
    registry.unregister("missing");
    expect(registry.getAll()).toEqual([]);
  });

  test("invalid rules are rejected and logged", () => {
    const warn = mock(() => {});
    const registry = createRuleRegistry({ warn, info: mock(() => {}) });
    expect(registry.register({ ...validRule, id: "" })).toBe(false);
    expect(registry.getAll()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  test("event bus registration takes effect immediately", () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const bus: EventBus = { on: (event, handler) => handlers.set(event, handler) };
    const registry = createRuleRegistry({ warn: mock(() => {}), info: mock(() => {}) });

    registry.subscribe(bus);
    handlers.get("llm-guardrail:register")?.(validRule);
    expect(registry.getAll().map((rule) => rule.id)).toEqual(["no-empty-catch"]);

    handlers.get("llm-guardrail:register")?.({ nope: true });
    expect(registry.getAll()).toHaveLength(1);
  });
});
```

- [ ] **Step 3.2: Run tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/rule-registry.test.ts
```

Expected: FAIL because `lib/rule-registry.ts` does not exist.

- [ ] **Step 3.3: Implement registry**

Create `pi/agent/extensions/llm-guardrails/lib/rule-registry.ts`:

```ts
import safeRegex from "safe-regex";
import type { EventBus, Rule } from "./types.ts";

interface Logger {
  warn(message: string): void;
  info(message: string): void;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

function isRule(value: unknown): value is Rule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<Rule>;
  return Array.isArray(rule.filePatterns) && Array.isArray(rule.patterns);
}

export function validateRule(value: unknown): ValidationResult {
  if (!isRule(value)) return { ok: false, reason: "rule must be an object with filePatterns and patterns arrays" };
  if (typeof value.id !== "string" || value.id.trim().length === 0) return { ok: false, reason: "rule id must be non-empty" };
  if (typeof value.name !== "string" || value.name.trim().length === 0) return { ok: false, reason: "rule name must be non-empty" };
  if (value.filePatterns.length === 0 || value.filePatterns.some((pattern) => typeof pattern !== "string" || pattern.length === 0)) {
    return { ok: false, reason: "rule filePatterns must contain at least one non-empty string" };
  }
  if (value.patterns.length === 0 || value.patterns.some((pattern) => !(pattern instanceof RegExp))) {
    return { ok: false, reason: "rule patterns must contain at least one RegExp" };
  }
  if (value.patterns.some((pattern) => !safeRegex(pattern))) return { ok: false, reason: "rule contains an unsafe regex" };
  if (typeof value.message !== "string" || value.message.trim().length === 0) return { ok: false, reason: "rule message must be non-empty" };
  if (value.severity !== undefined && value.severity !== "error" && value.severity !== "warning") return { ok: false, reason: "rule severity must be error or warning" };
  return { ok: true };
}

export function createRuleRegistry(logger: Logger) {
  const rules = new Map<string, Rule>();

  function register(rule: unknown): boolean {
    const result = validateRule(rule);
    if (!result.ok) {
      logger.warn(`llm-guardrail: invalid rule skipped: ${result.reason}`);
      return false;
    }

    const typedRule = rule as Rule;
    const existed = rules.has(typedRule.id);
    rules.set(typedRule.id, typedRule);
    logger.info(`llm-guardrail: rule ${existed ? "overwritten" : "registered"}: ${typedRule.id}`);
    return true;
  }

  function unregister(id: string): void {
    rules.delete(id);
  }

  function getAll(): readonly Rule[] {
    return Object.freeze([...rules.values()]);
  }

  function clear(): void {
    rules.clear();
  }

  function subscribe(bus: EventBus): void {
    bus.on("llm-guardrail:register", (rule) => {
      try {
        register(rule);
      } catch (error) {
        logger.warn(`llm-guardrail: register listener failed: ${(error as Error).message}`);
      }
    });
  }

  return { register, unregister, getAll, clear, subscribe };
}
```

- [ ] **Step 3.4: Run registry tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/rule-registry.test.ts
```

Expected: PASS.

- [ ] **Step 3.5: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/rule-registry.ts pi/agent/extensions/llm-guardrails/tests/rule-registry.test.ts
git commit -m "feat(llm-guardrails): add runtime rule registry"
```

Expected: commit succeeds.

---

## Task 4: Implement Config Loading

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/env-resolver.ts`
- Create: `pi/agent/extensions/llm-guardrails/lib/config-loader.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/config-loader.test.ts`

- [ ] **Step 4.1: Write config loader tests**

Create `pi/agent/extensions/llm-guardrails/tests/config-loader.test.ts`:

```ts
import { afterEach, describe, expect, mock, test } from "bun:test";
import { DEFAULT_CONFIG, parseConfig, resolveValue } from "../lib/config-loader.ts";

describe("resolveValue", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("resolves literals and env references", () => {
    process.env.FOO = "bar";
    delete process.env.NOPE;
    expect(resolveValue("literal")).toBe("literal");
    expect(resolveValue("$FOO")).toBe("bar");
    expect(resolveValue("$NOPE:fallback")).toBe("fallback");
    expect(resolveValue("$NOPE")).toBe("$NOPE");
    expect(resolveValue(123)).toBe(123);
  });
});

describe("parseConfig", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("valid YAML resolves env vars and produces typed config", () => {
    process.env.MODE = "strict";
    const config = parseConfig(`
mode: "$MODE"
watch:
  include: ["src/**"]
  ignore: ["**/*.snap"]
  max_size_kb: "123"
debounce_ms: "50"
cooldown_ms: "1000"
built_in_rules:
  no-runtime-suppressions: "false"
custom_rules:
  - id: "no-todo"
    name: "No TODO"
    filePatterns: ["**/*.ts"]
    patterns: ["//\\s*TODO"]
    message: "Resolve TODO at {line}: {match}"
    severity: "warning"
`, { warn: mock(() => {}) });

    expect(config.mode).toBe("strict");
    expect(config.watch.include).toEqual(["src/**"]);
    expect(config.watch.ignore).toEqual(["**/*.snap"]);
    expect(config.watch.maxSizeKb).toBe(123);
    expect(config.debounceMs).toBe(50);
    expect(config.cooldownMs).toBe(1000);
    expect(config.builtInRules["no-runtime-suppressions"]).toBe(false);
    expect(config.customRules).toHaveLength(1);
    expect(config.customRules[0]?.patterns[0]?.flags).toContain("g");
    expect(config.customRules[0]?.patterns[0]?.flags).toContain("i");
  });

  test("invalid YAML falls back to DEFAULT_CONFIG", () => {
    const warn = mock(() => {});
    expect(parseConfig("mode: [", { warn })).toEqual(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalled();
  });

  test("invalid scalar fields fall back field-by-field", () => {
    const warn = mock(() => {});
    const config = parseConfig(`
mode: wat
watch:
  include: nope
  ignore: nope
  max_size_kb: -1
debounce_ms: -1
cooldown_ms: nope
built_in_rules:
  typo-rule: true
`, { warn });

    expect(config.mode).toBe(DEFAULT_CONFIG.mode);
    expect(config.watch.include).toEqual(DEFAULT_CONFIG.watch.include);
    expect(config.watch.ignore).toEqual(DEFAULT_CONFIG.watch.ignore);
    expect(config.watch.maxSizeKb).toBe(DEFAULT_CONFIG.watch.maxSizeKb);
    expect(config.debounceMs).toBe(DEFAULT_CONFIG.debounceMs);
    expect(config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
    expect(config.builtInRules).toEqual(DEFAULT_CONFIG.builtInRules);
    expect(warn).toHaveBeenCalled();
  });

  test("invalid custom rules are skipped", () => {
    const warn = mock(() => {});
    const config = parseConfig(`
custom_rules:
  - id: ""
    name: "Bad"
    filePatterns: ["**/*.ts"]
    patterns: ["// Bad"]
    message: "bad"
  - id: "good"
    name: "Good"
    filePatterns: ["**/*.ts"]
    patterns: ["// Good"]
    message: "good"
`, { warn });

    expect(config.customRules.map((rule) => rule.id)).toEqual(["good"]);
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/config-loader.test.ts
```

Expected: FAIL because `lib/config-loader.ts` does not exist.

- [ ] **Step 4.3: Implement env resolver**

Create `pi/agent/extensions/llm-guardrails/lib/env-resolver.ts`:

```ts
const ENV_REF = /^\$([A-Z_][A-Z0-9_]*)(?::(.*))?$/s;

export function resolveValue<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  const match = value.match(ENV_REF);
  if (!match) return value;
  const [, name, fallback] = match;
  return process.env[name] ?? fallback ?? value;
}

export function deepResolve(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepResolve);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) out[key] = deepResolve(nested);
    return out;
  }
  return resolveValue(value);
}
```

- [ ] **Step 4.4: Implement config loader**

Create `pi/agent/extensions/llm-guardrails/lib/config-loader.ts`:

```ts
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { deepResolve, resolveValue } from "./env-resolver.ts";
import { validateRule } from "./rule-registry.ts";
import type { Config, Mode, Rule } from "./types.ts";

export { resolveValue };

type Raw = Record<string, unknown>;

interface Logger {
  warn(message: string): void;
}

export const DEFAULT_CONFIG: Config = Object.freeze({
  mode: "warn",
  watch: Object.freeze({
    include: Object.freeze(["**/*"]),
    ignore: Object.freeze([]),
    maxSizeKb: 500,
  }),
  debounceMs: 200,
  cooldownMs: 30_000,
  builtInRules: Object.freeze({
    "no-linter-suppressions": true,
    "no-type-suppressions": true,
    "no-runtime-suppressions": true,
    "no-compiler-suppressions": true,
  }),
  customRules: Object.freeze([]),
});

function asRaw(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function readNumber(raw: unknown, fallback: number, field: string, logger: Logger): number {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && !raw.startsWith("$") ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < 0) {
    if (raw !== undefined) logger.warn(`llm-guardrail: invalid config field ${field}; using default`);
    return fallback;
  }
  return value;
}

function readStrings(raw: unknown, fallback: readonly string[], field: string, logger: Logger): readonly string[] {
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string" || value.length === 0)) {
    if (raw !== undefined) logger.warn(`llm-guardrail: invalid config field ${field}; using default`);
    return fallback;
  }
  return Object.freeze([...raw]);
}

function readMode(raw: unknown, logger: Logger): Mode {
  if (raw === "warn" || raw === "strict" || raw === "off") return raw;
  if (raw !== undefined) logger.warn("llm-guardrail: invalid config field mode; using default");
  return DEFAULT_CONFIG.mode;
}

function readBuiltInRules(raw: unknown, logger: Logger): Readonly<Record<string, boolean>> {
  const output: Record<string, boolean> = { ...DEFAULT_CONFIG.builtInRules };
  const entries = asRaw(raw);
  for (const [id, value] of Object.entries(entries)) {
    if (!(id in output)) {
      logger.warn(`llm-guardrail: unknown built-in rule ignored: ${id}`);
      continue;
    }
    if (typeof value === "boolean") {
      output[id] = value;
      continue;
    }
    if (typeof value === "string" && !value.startsWith("$")) {
      if (value.toLowerCase() === "true") output[id] = true;
      else if (value.toLowerCase() === "false") output[id] = false;
      else logger.warn(`llm-guardrail: invalid built-in toggle for ${id}; using default`);
      continue;
    }
    logger.warn(`llm-guardrail: invalid built-in toggle for ${id}; using default`);
  }
  return Object.freeze(output);
}

function readCustomRules(raw: unknown, logger: Logger): readonly Rule[] {
  if (raw === undefined) return DEFAULT_CONFIG.customRules;
  if (!Array.isArray(raw)) {
    logger.warn("llm-guardrail: invalid config field custom_rules; using default");
    return DEFAULT_CONFIG.customRules;
  }

  const rules: Rule[] = [];
  for (const entry of raw) {
    const candidate = asRaw(entry);
    const patterns = Array.isArray(candidate.patterns) ? candidate.patterns.map((pattern) => new RegExp(String(pattern), "gi")) : [];
    const rule: Rule = {
      id: String(candidate.id ?? ""),
      name: String(candidate.name ?? ""),
      description: typeof candidate.description === "string" ? candidate.description : undefined,
      filePatterns: Array.isArray(candidate.filePatterns) ? candidate.filePatterns.map(String) : [],
      patterns,
      message: String(candidate.message ?? ""),
      severity: candidate.severity === "error" || candidate.severity === "warning" ? candidate.severity : undefined,
    };
    const result = validateRule(rule);
    if (result.ok) rules.push(rule);
    else logger.warn(`llm-guardrail: custom rule skipped: ${result.reason}`);
  }
  return Object.freeze(rules);
}

export function parseConfig(yamlText: string, logger: Logger = console): Config {
  let raw: Raw;
  try {
    raw = asRaw(deepResolve(parseYaml(yamlText) ?? {}));
  } catch (error) {
    logger.warn(`llm-guardrail: invalid YAML; using default config: ${(error as Error).message}`);
    return DEFAULT_CONFIG;
  }

  const watch = asRaw(raw.watch);
  return Object.freeze({
    mode: readMode(raw.mode, logger),
    watch: Object.freeze({
      include: readStrings(watch.include, DEFAULT_CONFIG.watch.include, "watch.include", logger),
      ignore: readStrings(watch.ignore, DEFAULT_CONFIG.watch.ignore, "watch.ignore", logger),
      maxSizeKb: readNumber(watch.max_size_kb, DEFAULT_CONFIG.watch.maxSizeKb, "watch.max_size_kb", logger),
    }),
    debounceMs: readNumber(raw.debounce_ms, DEFAULT_CONFIG.debounceMs, "debounce_ms", logger),
    cooldownMs: readNumber(raw.cooldown_ms, DEFAULT_CONFIG.cooldownMs, "cooldown_ms", logger),
    builtInRules: readBuiltInRules(raw.built_in_rules, logger),
    customRules: readCustomRules(raw.custom_rules, logger),
  });
}

export function configPath(): string {
  return fileURLToPath(new URL("../config.yml", import.meta.url));
}

export function loadConfig(path = configPath(), logger: Logger = console): Config {
  if (!fs.existsSync(path)) return DEFAULT_CONFIG;
  return parseConfig(fs.readFileSync(path, "utf-8"), logger);
}
```

- [ ] **Step 4.5: Run config tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/config-loader.test.ts tests/rule-registry.test.ts
```

Expected: PASS.

- [ ] **Step 4.6: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/env-resolver.ts pi/agent/extensions/llm-guardrails/lib/config-loader.ts pi/agent/extensions/llm-guardrails/tests/config-loader.test.ts
git commit -m "feat(llm-guardrails): load YAML configuration"
```

Expected: commit succeeds.

---

## Task 5: Implement Messenger

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/messenger.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/messenger.test.ts`

- [ ] **Step 5.1: Write messenger tests**

Create `pi/agent/extensions/llm-guardrails/tests/messenger.test.ts`:

```ts
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

describe("createMessenger", () => {
  beforeEach(() => setSystemTime(new Date("2026-06-15T00:00:00Z")));

  test("sends formatted follow-up when idle", async () => {
    const sendUserMessage = mock(() => {});
    const pi = { sendUserMessage } as unknown as GuardrailsPi;
    const messenger = createMessenger(pi, { cooldownMs: 30_000, logger: console });

    await messenger.sendWarning([match], rule, { isIdle: () => true });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(sendUserMessage.mock.calls[0]?.[0]).toContain("Guardrail violation: No type suppressions");
    expect(sendUserMessage.mock.calls[0]?.[0]).toContain("File: foo.ts:42:13");
    expect(sendUserMessage.mock.calls[0]?.[0]).toContain("Match: `// @ts-ignore`");
    expect(sendUserMessage.mock.calls[0]?.[1]).toEqual({ deliverAs: "followUp" });
  });

  test("dedups repeated warning within cooldown", async () => {
    const sendUserMessage = mock(() => {});
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: console });
    const ctx: GuardrailsContext = { isIdle: () => true };

    await messenger.sendWarning([match], rule, ctx);
    await messenger.sendWarning([match], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    setSystemTime(new Date("2026-06-15T00:00:31Z"));
    await messenger.sendWarning([match], rule, ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
  });

  test("queues when not idle and drains in order", async () => {
    const sendUserMessage = mock(() => {});
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: console });
    await messenger.sendWarning([match], rule, { isIdle: () => false });
    expect(sendUserMessage).toHaveBeenCalledTimes(0);

    await messenger.drain();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
  });

  test("drops queued messages on flush", async () => {
    const sendUserMessage = mock(() => {});
    const logger = { error: mock(() => {}), warn: mock(() => {}), info: mock(() => {}), debug: mock(() => {}) };
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger });

    await messenger.sendWarning([match], rule, { isIdle: () => false });
    messenger.flush();
    await messenger.drain();
    expect(sendUserMessage).toHaveBeenCalledTimes(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("retries sendUserMessage once", async () => {
    let calls = 0;
    const sendUserMessage = mock(() => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });
    const messenger = createMessenger({ sendUserMessage } as unknown as GuardrailsPi, { cooldownMs: 30_000, logger: console, retryDelayMs: 1 });

    await messenger.sendWarning([match], rule, { isIdle: () => true });
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 5.2: Run tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/messenger.test.ts
```

Expected: FAIL because `lib/messenger.ts` does not exist.

- [ ] **Step 5.3: Implement messenger**

Create `pi/agent/extensions/llm-guardrails/lib/messenger.ts`:

```ts
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
      options.logger.error(`llm-guardrail: sendUserMessage failed, retrying: ${(error as Error).message}`);
      await sleep(retryDelayMs);
      try {
        await pi.sendUserMessage(message, { deliverAs: "followUp" });
      } catch (secondError) {
        options.logger.warn(`llm-guardrail: dropping warning after retry failed: ${(secondError as Error).message}`);
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
      if (message) await deliver(message);
    }
  }

  function flush(): void {
    if (queue.length > 0) options.logger.warn(`llm-guardrail: dropped ${queue.length} queued warnings on shutdown`);
    queue.length = 0;
  }

  return { sendWarning, drain, flush };
}
```

- [ ] **Step 5.4: Run messenger tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/messenger.test.ts
```

Expected: PASS.

- [ ] **Step 5.5: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/messenger.ts pi/agent/extensions/llm-guardrails/tests/messenger.test.ts
git commit -m "feat(llm-guardrails): send cooldown-aware warnings"
```

Expected: commit succeeds.

---

## Task 6: Implement Watcher

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/lib/watcher.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/watcher.test.ts`

- [ ] **Step 6.1: Write watcher tests**

Create `pi/agent/extensions/llm-guardrails/tests/watcher.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createWatcher } from "../lib/watcher.ts";

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
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "llm-guardrails-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("invokes callback after a file is created", async () => {
    const onFile = mock(() => {});
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: console });
    await watcher.start(dir, ["**/*"], [], onFile);
    await fs.writeFile(path.join(dir, "foo.ts"), "// @ts-ignore");
    await waitFor(() => onFile.mock.calls.length === 1);
    expect(onFile.mock.calls[0]?.[0]).toBe(path.join(dir, "foo.ts"));
    expect(onFile.mock.calls[0]?.[1]).toBe("// @ts-ignore");
    await watcher.stop();
  });

  test("debounces rapid edits to the same file", async () => {
    const onFile = mock(() => {});
    const watcher = createWatcher({ debounceMs: 50, maxSizeKb: 500, logger: console });
    const file = path.join(dir, "foo.ts");
    await watcher.start(dir, ["**/*"], [], onFile);
    for (let i = 0; i < 5; i += 1) await fs.writeFile(file, String(i));
    await waitFor(() => onFile.mock.calls.length === 1);
    expect(onFile).toHaveBeenCalledTimes(1);
    await watcher.stop();
  });

  test("skips large and binary files", async () => {
    const onFile = mock(() => {});
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 1, logger: console });
    await watcher.start(dir, ["**/*"], [], onFile);
    await fs.writeFile(path.join(dir, "large.ts"), "x".repeat(2048));
    await fs.writeFile(path.join(dir, "binary.bin"), Buffer.from([65, 0, 66]));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(onFile).toHaveBeenCalledTimes(0);
    await watcher.stop();
  });

  test("built-in ignores skip node_modules", async () => {
    const onFile = mock(() => {});
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: console });
    await fs.mkdir(path.join(dir, "node_modules"), { recursive: true });
    await watcher.start(dir, ["**/*"], [], onFile);
    await fs.writeFile(path.join(dir, "node_modules", "foo.ts"), "// @ts-ignore");
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(onFile).toHaveBeenCalledTimes(0);
    await watcher.stop();
  });

  test("start and stop are idempotent", async () => {
    const watcher = createWatcher({ debounceMs: 25, maxSizeKb: 500, logger: console });
    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    await watcher.start(dir, ["**/*"], [], mock(() => {}));
    await watcher.stop();
    await watcher.stop();
  });
});
```

- [ ] **Step 6.2: Run tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/watcher.test.ts
```

Expected: FAIL because `lib/watcher.ts` does not exist.

- [ ] **Step 6.3: Implement watcher**

Create `pi/agent/extensions/llm-guardrails/lib/watcher.ts`:

```ts
import chokidar, { type FSWatcher } from "chokidar";
import * as fs from "node:fs/promises";
import micromatch from "micromatch";

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

const BUILT_IN_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/vendor/**",
  "**/*.{png,jpg,jpeg,gif,webp,pdf}",
  "**/*.{zip,tar,gz}",
  "**/package-lock.json",
  "**/bun.lockb",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
];

function hasNullByte(buffer: Buffer): boolean {
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

export function createWatcher(options: WatcherOptions) {
  let watcher: FSWatcher | undefined;
  const timers = new Map<string, Timer>();

  async function processFile(file: string, onFile: (file: string, content: string) => void | Promise<void>): Promise<void> {
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
      await onFile(file, buffer.toString("utf-8"));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") options.logger.debug?.(`llm-guardrail: file disappeared before read ${file}`);
      else if (code === "EACCES") options.logger.warn(`llm-guardrail: permission denied reading ${file}`);
      else options.logger.warn(`llm-guardrail: failed reading ${file}: ${(error as Error).message}`);
    }
  }

  function schedule(file: string, onFile: (file: string, content: string) => void | Promise<void>): void {
    const existing = timers.get(file);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.delete(file);
      void processFile(file, onFile);
    }, options.debounceMs);
    timer.unref?.();
    timers.set(file, timer);
  }

  async function start(cwd: string, include: readonly string[], ignore: readonly string[], onFile: (file: string, content: string) => void | Promise<void>): Promise<void> {
    if (watcher) return;
    const ignored = [...BUILT_IN_IGNORE, ...ignore];
    watcher = chokidar.watch([...include], {
      cwd,
      ignored: (filePath: string) => micromatch.isMatch(filePath, ignored),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });
    watcher.on("add", (file) => schedule(`${cwd}/${file}`, onFile));
    watcher.on("change", (file) => schedule(`${cwd}/${file}`, onFile));
    watcher.on("error", (error) => options.logger.error(`llm-guardrail: watcher error: ${(error as Error).message}`));
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
```

- [ ] **Step 6.4: Run watcher tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/watcher.test.ts
```

Expected: PASS.

- [ ] **Step 6.5: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/lib/watcher.ts pi/agent/extensions/llm-guardrails/tests/watcher.test.ts
git commit -m "feat(llm-guardrails): watch changed files safely"
```

Expected: commit succeeds.

---

## Task 7: Wire The Pi Extension Entry Point

**Files:**
- Create: `pi/agent/extensions/llm-guardrails/index.ts`
- Create: `pi/agent/extensions/llm-guardrails/tests/integration.test.ts`

- [ ] **Step 7.1: Write integration tests**

Create `pi/agent/extensions/llm-guardrails/tests/integration.test.ts`:

```ts
import { describe, expect, mock, test } from "bun:test";
import extension from "../index.ts";

function createPi() {
  const handlers = new Map<string, Function[]>();
  return {
    handlers,
    events: { on: mock(() => {}) },
    sendUserMessage: mock(() => {}),
    on: mock((event: string, handler: Function) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
  };
}

describe("llm-guardrails extension", () => {
  test("registers lifecycle hooks", () => {
    const pi = createPi();
    extension(pi as any);
    expect(pi.on.mock.calls.map((call) => call[0])).toEqual(["session_start", "agent_end", "session_shutdown"]);
  });

  test("agent_end drains without a started session", async () => {
    const pi = createPi();
    extension(pi as any);
    await pi.handlers.get("agent_end")?.[0]?.({}, {});
  });

  test("session_shutdown is safe before session_start", async () => {
    const pi = createPi();
    extension(pi as any);
    await pi.handlers.get("session_shutdown")?.[0]?.({}, {});
  });
});
```

- [ ] **Step 7.2: Run integration tests to verify failure**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/integration.test.ts
```

Expected: FAIL because `index.ts` does not exist.

- [ ] **Step 7.3: Implement entry point**

Create `pi/agent/extensions/llm-guardrails/index.ts`:

```ts
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

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const config = loadConfig(undefined, logger);
    if (config.mode === "off") return;

    registry = createRuleRegistry(logger);
    for (const rule of BUILT_IN_RULES) {
      if (config.builtInRules[rule.id] === false) logger.info(`llm-guardrail: built-in rule disabled: ${rule.id}`);
      else registry.register(rule);
    }
    for (const rule of config.customRules) registry.register(rule);
    registry.subscribe(pi.events);

    messenger = createMessenger(pi as unknown as GuardrailsPi, { cooldownMs: config.cooldownMs, logger });
    watcher = createWatcher({ debounceMs: config.debounceMs, maxSizeKb: config.watch.maxSizeKb, logger });

    const cwd = typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();
    await watcher.start(cwd, config.watch.include, config.watch.ignore, async (file, content) => {
      const rules = registry?.getAll() ?? [];
      const matches = scan(file, content, rules);
      const byRule = new Map<string, Match[]>();
      for (const match of matches) byRule.set(match.ruleId, [...(byRule.get(match.ruleId) ?? []), match]);
      for (const rule of rules) {
        const ruleMatches = byRule.get(rule.id);
        if (ruleMatches?.length) await messenger?.sendWarning(ruleMatches, rule, ctx);
      }
    });
  });

  pi.on("agent_end", async () => {
    await messenger?.drain();
  });

  pi.on("session_shutdown", async () => {
    await watcher?.stop();
    messenger?.flush();
    registry?.clear();
    watcher = undefined;
    messenger = undefined;
    registry = undefined;
  });
}
```

- [ ] **Step 7.4: Run integration tests**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test tests/integration.test.ts
```

Expected: PASS.

- [ ] **Step 7.5: Run all tests and typecheck**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test
bun run typecheck
```

Expected: all tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 7.6: Commit**

Run:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails/index.ts pi/agent/extensions/llm-guardrails/tests/integration.test.ts
git commit -m "feat(llm-guardrails): wire extension lifecycle"
```

Expected: commit succeeds.

---

## Task 8: Final Verification And Spec Coverage

**Files:**
- Modify: none expected, unless previous tasks exposed type or test issues.
- Test: full extension checks.

- [ ] **Step 8.1: Run full verification**

Run:

```bash
cd pi/agent/extensions/llm-guardrails
bun test
bun run typecheck
```

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 8.2: Verify repo status**

Run:

```bash
cd ~/.config
git status --short
```

Expected: clean working tree, or only intentional uncommitted docs/spec files if the plan/spec were not committed by the executor.

- [ ] **Step 8.3: Manual smoke test in pi**

Run pi with the extension enabled, then make the agent create or edit a `.ts` file containing:

```ts
// @ts-ignore
const x: string = 123;
```

Expected LLM follow-up message contains:

```text
Guardrail violation: No type suppressions
File: <path>:1:1
Match: `// @ts-ignore`
This shortcut hides the real problem. Resolve it at the root, not with a suppression.
```

- [ ] **Step 8.4: Commit any final fixes**

If Step 8.1 or Step 8.3 required fixes, commit them:

```bash
cd ~/.config
git add pi/agent/extensions/llm-guardrails
git commit -m "fix(llm-guardrails): address final verification issues"
```

Expected: commit succeeds. If no fixes were needed, skip this step.

---

## Self-Review Notes

Spec coverage:

- Detection via chokidar: Task 6.
- Warn/strict/off modes: Task 4 and Task 7. `strict` intentionally behaves as `warn` in v1.
- No whitelist/escape hatch: no whitelist exists in any task.
- `pi.sendUserMessage` only: Task 5 and Task 7; no `ctx.ui.notify`.
- Facade with event bus: Task 3 and Task 7.
- Config YAML and env resolver: Task 4.
- String literal and prose avoidance: Task 2.
- Rust attribute suppressions deferred: not implemented, matching spec.
- Built-in rule groups: Task 1 and Task 2.
- Watcher debounce, max size, binary skip, built-in ignores: Task 6.
- Messenger cooldown, queue, retry: Task 5.
- End-to-end lifecycle: Task 7 and Task 8.

Known gaps consciously deferred or corrected:

- Chokidar crash restart-once recovery is not fully implemented in this first plan. The watcher logs errors and keeps extension state alive. If restart recovery is mandatory for v1, add a follow-up task after Task 6; do NOT bury it in the initial watcher implementation.
- TypeBox validation is replaced with focused validation functions to match this repo's existing extension style.
- The spec's `~/.pi/agent/extensions` path is corrected to `pi/agent/extensions` for this repo.
