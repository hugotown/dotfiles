# `llm-guardrails` pi extension — design

**Date:** 2026-06-15
**Repo:** `~/.pi/agent/extensions/llm-guardrails/` (part of `~/.config`)
**Author:** Hugo + pi
**Status:** design, pending user review

## 1. Context and problem

Code agents (LLM-driven coding assistants) tend to take the easy path: when a linter, type checker, or runtime warning surfaces, they add a suppression directive (`// eslint-disable`, `// @ts-ignore`, `# noqa`, `//nolint`, etc.) to silence it, instead of fixing the root cause. This produces code that compiles and lints clean but hides real problems.

The user wants a pi extension that:

1. **Detects** suppression directives in files written by the agent.
2. **Pressures the agent** to resolve the underlying issue instead of suppressing it.
3. **Is extensible** — other extensions or the user's config can add new rules over time.

The user described the philosophy: *"no haya caminos fáciles para el LLM, si no que el problema se resuelva totalmente de fondo"*. A facade pattern lets us add rules over time without changing the core.

## 2. Decisions taken before this spec

Captured via `question` tool in the brainstorming session:

1. **Name**: `llm-guardrails` (suggested by the user, fits the facade + "guardrails" theme).
2. **Detection mechanism**: chokidar filesystem watcher. Not `tool_call` interception (the LLM could bypass via bash; chokidar catches everything written to disk).
3. **Behavior on detection** (configurable via `mode`):
   - `warn` (default) — allow the file to be written, then send a `pi.sendUserMessage` to the LLM identifying the file, line, column, and the offending directive.
   - `strict` — same as `warn` in v1; in v2 will block the `tool_call` before write. Documented now so configs don't need to change later.
   - `off` — extension loaded but inactive.
4. **No whitelist, no escape hatch**: even with a justification comment, the warning always fires. Pure dogmatism.
5. **Surface for the LLM**: `pi.sendUserMessage` only. No `ctx.ui.notify`, no banner in the TUI. The warning reaches the LLM as a follow-up; the human does not see a visible notification.
6. **Architecture**: facade with event bus. The core extension provides the watcher, scanner, and messenger. Other extensions can register rules at runtime via `pi.events.emit("llm-guardrail:register", rule)`. The user's `config.yml` can also declare inline rules.
7. **Default config style**: same YAML + env-var resolver as `~/.pi/agent/extensions/curl/config.yml` (`$ENV`, `$ENV:default`).
8. **String literals do not match**: `const x = "// eslint-disable"` is metadata, not a real directive. The scanner should not flag it. URLs and code-documentation comments are likewise not flagged.
9. **Rust `#[allow(...)]` is deferred to v1.1**: detecting attribute suppressions requires AST parsing (syn/rust-analyzer), not regex. Out of scope for v1. Documented as debt.

## 3. Architecture

Three layers, top-down:

```
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 1: Rule definition                                           │
│  ─────────────────────────                                           │
│  • rules/built-in.ts    → built-in rules (linter/type/runtime/...) │
│  • config.yml          → user-defined rules + toggles               │
│  • Other extensions    → pi.events.emit("llm-guardrail:register", …)│
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Facade (lib/)                                            │
│  ────────────────────────                                            │
│  • rule-registry.ts  → Map<id, Rule>, dedup, bus listener          │
│  • config-loader.ts  → YAML → typed Config, env-var resolver        │
│  • scanner.ts        → (file, content) → Match[] applying rules    │
└────────────────────┬───────────────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 3: Detection + communication                                │
│  ──────────────────────────────────                                  │
│  • watcher.ts        → chokidar wrapper, per-file debounce          │
│  • messenger.ts      → sendUserMessage wrapper, cooldown + dedup    │
└────────────────────────────────────────────────────────────────────┘
```

**One-line flow**: `chokidar event → debounce → readFile → scanner.run(rules, content) → matches[] → messenger.sendUserMessage(formatted)`.

**What the facade does not do** (v1):

- It does not block `tool_call` (that's v2 strict mode).
- It does not edit files. It only reads and warns.
- It does not install git hooks. It only watches the filesystem.
- It does not call `ui.notify`. It only calls `sendUserMessage`.

## 4. Components

### 4.1 `index.ts` — Entry point

- `default function (pi)`.
- `pi.on("session_start", …)` → load config, register built-in rules, subscribe to bus, subscribe to `agent_end` (so the messenger can drain its queue when the LLM goes idle), start watcher.
- `pi.on("session_shutdown", …)` → stop chokidar, clear timers, flush pending messages.
- No global state. All state lives in `lib/`.

### 4.2 `lib/types.ts`

```ts
export type Mode = "warn" | "strict" | "off";

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly filePatterns: string[];
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
    readonly include: string[];
    readonly ignore: string[];
    readonly maxSizeKb: number;
  };
  readonly debounceMs: number;
  readonly cooldownMs: number;
  readonly builtInRules: Record<string, boolean>;
  readonly customRules: ReadonlyArray<Rule>;
}
```

### 4.3 `lib/config-loader.ts`

- Reads `config.yml` from the extension directory (sibling of `package.json`).
- Supports env-var resolution: `$ENV_VAR`, `$ENV_VAR:default` (mirrors `curl/lib/settings.ts`).
- Validates against a TypeBox schema. On failure: log + fall back to `DEFAULT_CONFIG` (fail-open).
- Returns an immutable `Config`.

### 4.4 `lib/rule-registry.ts`

- Internal `Map<id, Rule>`.
- `register(rule)`: validates with `validateRule()`. If the id already exists, the new rule overwrites the old one and a log line is emitted (`"llm-guardrail: rule overwritten: <id>"`).
- `unregister(id)`: removes the rule.
- `getAll()`: returns an immutable snapshot.
- Subscribes to `pi.events.on("llm-guardrail:register", rule => registry.register(rule))`. Takes effect immediately, no restart needed.
- `validateRule()`: id non-empty, name non-empty, ≥1 pattern, all patterns compile, filePatterns non-empty.

### 4.5 `lib/scanner.ts`

- `scan(file: string, content: string, rules: ReadonlyArray<Rule>): Match[]`.
- Filters out rules whose `filePatterns` do not match the file path (via `micromatch`).
- For each remaining rule, runs each `pattern` as a global regex against the content, looping to find every occurrence, with `pattern.lastIndex` reset between iterations.
- Converts byte offset to (line, column) by counting `\n` characters.
- Returns `Match[]` sorted by (line, column).
- **String-literal avoidance**: a match candidate is rejected if it sits inside a string literal on the same line. The heuristic: if the match position is between an unmatched pair of `"`, `'`, or `` ` `` on that line, skip it. (Acceptable false-positive risk: a multi-line template literal can hide a directive. Acceptable for v1.)
- **Prose avoidance**: directives are anchored to the START of the comment content (immediately after `//` or `/*` and optional whitespace). This rejects prose like `// a comment about eslint-disable` (the "a comment" prefix blocks the match) but accepts `// eslint-disable-line` (no prose between `//` and the directive). The LLM almost never writes inline comments that start with the directive name in prose form; if it does, the false positive is acceptable.

### 4.6 `lib/watcher.ts`

- One chokidar instance per session. `start` / `stop` are idempotent.
- `ignored` list combines the user's `ignore` patterns with the built-in ignore (see §6.2).
- `awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }` to avoid reading half-written files.
- Manual per-file debounce: stores a `setTimeout` per path; subsequent events for the same path cancel and re-schedule the timer.
- On debounce fire: `fs.promises.readFile`. If size > `maxSizeKb * 1024`, skip with a debug log. If the first 8KB contain `\0`, treat as binary and skip silently.
- Listens to chokidar's `error` event for recovery (see §7).

### 4.7 `lib/messenger.ts`

- `sendWarning(matches: ReadonlyArray<Match>, rule: Rule, ctx: ExtensionContext)`.
- Message format:

  ```
  Guardrail violation: <rule.name>
  File: <file>:<line>:<column>
  Match: `<matchedText>`
  Rule: <rule.description or rule.message>

  This shortcut hides the real problem. Resolve it at the root, not with a suppression.
  ```

- Dedup: `Map<"${file}:${line}:${ruleId}", number>` (timestamp). If the same key exists and is younger than `cooldownMs`, skip. The map is LRU-bounded at 10,000 entries.
- Calls `pi.sendUserMessage(formatted, { deliverAs: "followUp" })`.
- If `ctx.isIdle() === false` (the LLM is streaming), the message is queued. `index.ts` subscribes to the `agent_end` event and calls `messenger.drain()` to flush the queue in order. If the session closes before the queue drains, the pending messages are dropped with a log line.

### 4.8 `rules/built-in.ts`

Four built-in rules, each grouping several directives from the same conceptual category:

| Rule ID | Directives covered | File patterns |
|---|---|---|
| `no-linter-suppressions` | `eslint-disable*`, `stylelint-disable*`, `rubocop:disable`, `@phpstan-ignore-line`, `@psalm-suppress` | `**/*.{js,ts,jsx,tsx,vue,svelte,rb,php,css,scss}` |
| `no-type-suppressions` | `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `# type: ignore` | `**/*.{ts,tsx,js,jsx,py}` |
| `no-runtime-suppressions` | `@bun-ignore`, `//nolint`, `//nolint:all`, `# noqa` | `**/*.{ts,tsx,js,jsx,go,py}` |
| `no-compiler-suppressions` | `@SuppressWarnings`, `#pragma warning disable`, `#pragma GCC diagnostic` | `**/*.{java,cs,c,cpp,h,hpp}` |

All patterns are case-insensitive (`/i` flag) and global (`/g` flag), and are anchored to the START of the comment content to avoid matching prose. Variants that the LLM might use to evade are explicitly covered:

- Whitespace tolerance: `/\/\/\s*eslint-(disable|enable)/i` matches `// eslint-disable`, `//   eslint   disable`, `//  eslint - disable` (whitespace and hyphens between `eslint` and the keyword are normalized).
- Block-comment form: `/\/\*\s*eslint-(disable|enable)/i` matches `/* eslint-disable */`.
- Per-rule directives: `eslint-disable-next-line`, `eslint-disable-line`, `eslint-disable react-hooks/exhaustive-deps` are all matched by the same pattern (the suffix is optional).
- The `disable`/`enable` alternation rejects prose like `// I disabled the lint warning` (uses past tense `disabled`, not directive `disable`).

The LLM receives a single, generic message: "This shortcut hides the real problem. Resolve it at the root."

## 5. Data flow

### 5.1 Normal session — the LLM writes a file with a shortcut

```
T=0ms       LLM emits tool_call "write" with content containing "// eslint-disable-next-line"
T=5ms       chokidar detects the change on disk → emits 'change' event
T=5ms       watcher.ts schedules a 200ms debounce for that path
T=205ms     (no more events) debounce fires → fs.readFile
T=210ms     scanner.scan(file, content, registry.getAll())
              → filter by filePatterns: ts ✓
              → run regex of no-linter-suppressions
              → match found at line 42, col 13
              → returns Match{ruleId, file, line:42, col:13, matchedText:"// eslint-disable-next-line"}
T=211ms     messenger.sendWarning([match], rule, ctx)
              → format OK
              → dedup check: not in cooldown set
              → ctx.isIdle() === true → pi.sendUserMessage(msg, { deliverAs: "followUp" })
T=212ms     LLM (next turn) sees the message → rewrites the file without the directive
T=220ms     chokidar detects the fix → debounce → scanner.run → 0 matches → nothing
```

### 5.2 External rule registration

```
T=0         Another extension's index.ts runs:
              pi.events.emit("llm-guardrail:register", {
                id: "no-empty-catch",
                name: "No empty catch blocks",
                filePatterns: ["**/*.ts", "**/*.js"],
                patterns: [/catch\s*\([^)]*\)\s*\{\s*\}/g],
                message: "Empty catch blocks hide errors."
              });
T=0+ε       rule-registry.ts listener catches it → validateRule() ✓ → registry.register()
              → log "llm-guardrail: rule registered: no-empty-catch"
              → APPLICABLE IMMEDIATELY (no restart required)
T=N         Next change to a .ts file → scanner already includes the new rule
```

### 5.3 Cooldown / dedup

```
T=0         foo.ts changes → match at line 42
T=0+5ms     messenger sends "guardrail violation" to the LLM
T=0+10ms    Cooldown map: {"foo.ts:42:no-linter-suppressions": <timestamp>} (TTL 30s)
T=2s        LLM rewrites foo.ts, reintroduces the same directive
T=2s+5ms    scanner detects match → messenger → dedup HIT → skip silently
T=2s+10ms   debug log "llm-guardrail: suppressed duplicate warning"
T=30s+2s    TTL expires → next occurrence warns again
```

### 5.4 Disabled built-in rule

```
config.yml:
  built_in_rules:
    no-runtime-suppressions: false

→ config-loader marks it as disabled
→ rule-registry does NOT register it at startup
→ scanner NEVER evaluates it (zero overhead)
→ log info "llm-guardrail: built-in rule disabled: no-runtime-suppressions"
```

### 5.5 Session lifecycle

```
session_start (reason: "startup"):
  1. config-loader reads YAML, applies defaults
  2. rule-registry.register(...builtInRules.filter(enabled))
  3. rule-registry.register(...customRules from YAML)
  4. rule-registry.subscribe(pi.events)
  5. pi.on("agent_end", () => messenger.drain()) — drains the queue when the LLM goes idle
  6. watcher.start(cwd, include, ignore, onChange callback)

session_shutdown:
  1. watcher.stop() → chokidar.close() (await)
  2. messenger.flush() → drain pending queue, or drop on session-close
  3. timers.clearAll()
  4. registry.clear()
```

## 6. Configuration

### 6.1 `config.yml` schema

```yaml
# ─── Operation mode ───────────────────────────────────────────────
# "warn"  (default) → send sendUserMessage with the violation
# "strict"         → in v1 identical to "warn". In v2 will block tool_call.
#                    The field is documented now so configs don't need to change later.
# "off"            → does nothing (useful for debugging pi itself)
mode: "$LLM_GUARDRAILS_MODE:warn"

# ─── Watcher ──────────────────────────────────────────────────────
watch:
  # micromatch globs for files to watch. Default: everything.
  include:
    - "**/*"

  # Globs to ignore (applied IN ADDITION to the built-in ignore list).
  ignore:
    - "**/*.log"
    - "**/*.lock"
    - "**/tmp/**"

  # Files larger than this are not read (silent skip).
  max_size_kb: "$LLM_GUARDRAILS_MAX_SIZE_KB:500"

# ─── Timing ───────────────────────────────────────────────────────
# Per-file debounce: if chokidar emits several events for the same
# path within this interval, only the last is processed.
debounce_ms: "$LLM_GUARDRAILS_DEBOUNCE_MS:200"

# Per-(file, line, ruleId) cooldown: do not re-warn the same match
# within this interval. Prevents loops if the LLM insists.
cooldown_ms: "$LLM_GUARDRAILS_COOLDOWN_MS:30000"

# ─── Built-in rules ───────────────────────────────────────────────
# Each id can be:
#   • omitted     → enabled by default
#   • true        → forced enabled
#   • false       → disabled (not registered, zero overhead)
built_in_rules:
  no-linter-suppressions:    "$LLM_GUARDRAILS_RULE_LINTER:true"
  no-type-suppressions:      "$LLM_GUARDRAILS_RULE_TYPE:true"
  no-runtime-suppressions:   "$LLM_GUARDRAILS_RULE_RUNTIME:true"
  no-compiler-suppressions:  "$LLM_GUARDRAILS_RULE_COMPILER:true"

# ─── Inline custom rules ──────────────────────────────────────────
# Same shape as rules registered by event bus. Supports {match} and
# {line} substitution in the message.
custom_rules: []
# Example:
# - id: "no-todo-comments"
#   name: "No TODO comments"
#   filePatterns: ["**/*.ts"]
#   patterns: ["//\\s*TODO", "//\\s*FIXME"]   # compiled to RegExp with /gi flags
#   message: "Resolve the TODO at line {line}, don't leave it for later."
#   severity: "warning"
```

### 6.2 Hardcoded defaults

```ts
const DEFAULT_CONFIG: Config = {
  mode: "warn",
  watch: {
    include: ["**/*"],
    ignore: [],
    maxSizeKb: 500,
  },
  debounceMs: 200,
  cooldownMs: 30_000,
  builtInRules: {
    "no-linter-suppressions": true,
    "no-type-suppressions": true,
    "no-runtime-suppressions": true,
    "no-compiler-suppressions": true,
  },
  customRules: [],
};
```

### 6.3 Built-in ignore (hardcoded, not configurable)

Applied ALWAYS, in this order, before the user's `ignore`:

- `**/node_modules/**`
- `**/.git/**`
- `**/dist/**`
- `**/build/**`
- `**/.next/**`
- `**/coverage/**`
- `**/vendor/**`
- `**/*.png`, `**/*.jpg`, `**/*.jpeg`, `**/*.gif`, `**/*.webp`, `**/*.pdf`
- `**/*.zip`, `**/*.tar`, `**/*.gz`
- `**/package-lock.json`, `**/bun.lockb`, `**/yarn.lock`, `**/pnpm-lock.yaml`

These are untouchable. The user cannot enable the watcher on `node_modules` or anything that could flood events.

### 6.4 Env-var resolution

Mirrors `~/.pi/agent/extensions/curl/lib/settings.ts`:

- `$FOO` → required, throws if unset
- `$FOO:default` → uses `default` if unset
- Literal (no `$`) → used verbatim

### 6.5 Validation on load

- `mode` must be one of `"warn" | "strict" | "off"`.
- `debounceMs`, `cooldownMs`, `maxSizeKb` must be ≥ 0.
- `customRules` validated with `validateRule()`. If one fails: log + skip (do not abort the rest).
- Unique IDs across built-in + custom. On collision: custom overwrites built-in, log a warning.

## 7. Error handling

Philosophy: **fail-open**. The extension must never crash the pi session because of an internal error. If something breaks, log + continue.

### 7.1 Error categories

| Category | Detection | Response |
|---|---|---|
| Invalid YAML | yaml parser throws | log error, use `DEFAULT_CONFIG`, continue |
| Config schema invalid | TypeBox validate fails | log path of invalid field, use default for that field, continue |
| Invalid rule (empty id, bad regex, etc.) | `validateRule()` | log, skip that rule, continue with the rest |
| Invalid external registration | bad rule emitted on bus | log with rule.id, do not add to registry |
| Chokidar permission denied / ENOENT | watcher try/catch | log warn, skip that path, keep watching others |
| Chokidar global crash | emitter `error` | log + attempt restart once. If that fails → disable watcher, leave registry+messenger loaded (in case another extension uses them manually) |
| File too large | `stat.size > maxSizeKb * 1024` | log debug, skip, do not scan |
| File binary | first 8KB contain `\0` | log debug, skip silently |
| readFile race (file deleted between stat and read) | ENOENT on read | log debug, skip, next write is processed |
| readFile EACCES | permission denied | log warn once per path, do not flood |
| Regex catastrophic backtracking | ReDoS in user-provided regex | prevention: `validateRule()` runs each pattern via `safe-regex` with a 50ms timeout. Patterns that exceed it are rejected |
| `sendUserMessage` throws | pi unresponsive | log error, retry once after 500ms. If it still fails → drop, log warn |
| Cooldown map grows unbounded | many distinct paths | bounded: LRU eviction at 10,000 entries |
| Bus listener throws | buggy external extension | try/catch around the listener call. Log + continue |

### 7.2 Fatal errors (extension is disabled entirely)

Only two cases kill the whole extension:

1. **chokidar fails to load at startup** (package not installed, native module broken). The watcher never starts. Registry and messenger remain loaded in case other extensions use them. Log: `"llm-guardrail: watcher disabled (chokidar failed to load)"`.
2. **`session_start` itself throws** (unlikely; would be a pi bug). pi catches and disables the extension.

### 7.3 Logging

- `error` — failures that affect functionality (watcher crash, sendUserMessage fail).
- `warn` — things the user probably wants to see (config invalid, rule invalid).
- `info` — expected events (rule registered, rule overwritten).
- `debug` — the rest (file skipped, dedup hit, file too large).

Implemented with `console.error` / `console.warn` / `console.log` directly. v1 does not use `pi.events.emit("log", …)` because pi does not expose a logging API (verified in `core/extensions/types.d.ts`).

### 7.4 `strict` mode in v1

Documented in the `mode` field, but behaves identically to `warn`. When v2 lands, `strict` will require switching the detection mode from chokidar to `tool_call` interception. v2 is future work, not part of this spec.

### 7.5 `off` mode

Trivial: `session_start` completes without registering rules and without starting the watcher. The extension exists but is invisible. Useful for debugging pi itself or for A/B comparisons.

### 7.6 Chokidar recovery

```ts
watcher.on("error", async (err) => {
  log.error("llm-guardrail: watcher error", err);
  if (!retryScheduled) {
    retryScheduled = true;
    setTimeout(async () => {
      try {
        await watcher.restart();
        log.info("llm-guardrail: watcher recovered");
      } catch (e) {
        log.error("llm-guardrail: watcher unrecoverable, disabling", e);
        await watcher.stop();
      } finally {
        retryScheduled = false;
      }
    }, 2000);
  }
});
```

## 8. Testing strategy

### 8.1 Stack

- **Runtime**: `bun test` (built-in, no extra deps).
- **Assertions**: built-in `expect` / `toBe` / `toEqual`.
- **Mocks**: `mock()` for `pi`, `fs`, `pi.events`, `pi.sendUserMessage`.
- **Fixtures**: real files under `tests/fixtures/`, not in-memory strings (shortcuts are contextual to the file path).

### 8.2 Coverage by module

#### `lib/scanner.test.ts`

For each built-in pattern, the canonical example must match:

- `// eslint-disable-next-line` → `no-linter-suppressions` ✓
- `// eslint-disable-next-line react-hooks/exhaustive-deps` → ✓
- `/* eslint-disable */` → ✓
- `// @ts-ignore` → `no-type-suppressions` ✓
- `// @ts-nocheck` → ✓
- `// @ts-expect-error` → ✓
- `// @bun-ignore` → `no-runtime-suppressions` ✓
- `//nolint` → ✓
- `//nolint:all` → ✓
- `# noqa` → ✓
- `# type: ignore` → `no-type-suppressions` ✓
- `// @SuppressWarnings("unchecked")` → `no-compiler-suppressions` ✓
- `#pragma warning disable 414` → ✓
- `#pragma GCC diagnostic ignored "-Wunused"` → ✓
- `/* stylelint-disable */` → `no-linter-suppressions` ✓
- `@phpstan-ignore-line` → ✓
- `@psalm-suppress PropertyNotSetInConstructor` → ✓
- `# rubocop:disable Style/Documentation` → ✓

Evasion variants that must still match:

- Extra spaces: `//   eslint-disable`
- Mixed case: `// ESLINT-DISABLE`
- Mixed spacing and case: `//EsLint-Disable-next-Line`
- Block comment: `/*eslint-disable*/`
- Block with rule: `/* eslint-disable react-hooks/exhaustive-deps */`

False positives to avoid (must NOT match):

- `// I disabled the lint warning` — past-tense `disabled`, not directive `disable` ✓
- `// this is a comment about eslint-disable, not using it` — the prose prefix "this is a comment about" is between `//` and `eslint-disable`, so the start-of-comment anchor blocks the match ✓
- `const x = "// eslint-disable"` — string literal, must not match (string-literal heuristic)
- `https://eslint-disable-docs.com` — URL, must not match (no `//` comment prefix at the start of the line)

Other scanner tests:

- `filePatterns` filter: `no-linter-suppressions` with `**/*.ts` applied to `foo.py` → 0 matches.
- `filePatterns` filter: `no-linter-suppressions` with `**/*.ts` applied to `foo.ts` → matches.
- Multi-match: file with 3 distinct directives → 3 `Match` objects with correct line numbers.
- Offset-to-(line, column): match at line 42, col 13 → `Match.line === 42, Match.column === 13`.
- Performance: 1MB file with 1 match at the end → scanned in < 100ms.

#### `lib/rule-registry.test.ts`

- `register()` adds a new rule.
- `register()` with duplicate id → overwrites + log.
- `register()` with empty id → reject.
- `register()` with invalid regex → reject.
- `register()` with empty `filePatterns` → reject.
- `getAll()` returns an immutable snapshot (external mutation has no effect).
- Bus subscription: `emit("llm-guardrail:register", rule)` → registry adds it.
- Bus subscription: `emit("llm-guardrail:register", badRule)` → log error, NOT added.
- `unregister(id)` removes.
- `unregister(id)` with unknown id → silent no-op.

#### `lib/config-loader.test.ts`

- Valid YAML → typed `Config`.
- YAML with env vars resolved (`$FOO`, `$FOO:default`).
- YAML with required env var unset → throw + log.
- Invalid YAML (syntax) → `DEFAULT_CONFIG` + log.
- YAML with invalid field (mode = "wat") → use default for that field + log.
- `customRules` with invalid rule → skip + log, rest loads OK.
- ID collision between custom and built-in → custom overwrites + log.
- YAML file does not exist → `DEFAULT_CONFIG` (no error).
- `built_in_rules` with unknown id (typo) → log warn, ignored.

#### `lib/watcher.test.ts`

- `start()` with real chokidar watching a temp dir.
- Create a file → after `debounceMs` → callback invoked.
- Edit the same file 5 times rapidly → callback invoked ONCE (debounce works).
- Create a 10MB file → skipped (max_size_kb).
- Create a binary file (`Buffer` with `\0`) → silently skipped.
- Delete a file between stat and read → skipped, no crash.
- Chokidar emits `error` → restart attempted.
- Restart fails → `watcher.stop()`, log.
- `stop()` is idempotent (multiple calls OK).
- Create a file under `**/node_modules/**` → no callback (built-in ignore works).

#### `lib/messenger.test.ts`

- `sendWarning(matches, rule, ctx)` calls `pi.sendUserMessage` with the correct format.
- Format contains: `rule.name`, `file:line:col`, `matchedText`, `rule.description`.
- Cooldown: 2nd call with same (file, line, ruleId) within `cooldownMs` → no `sendUserMessage` call (2nd skipped).
- Cooldown: 2nd call after `cooldownMs` → call happens.
- `ctx.isIdle() === false` → message queued.
- LLM goes idle → queued message is sent.
- LLM never goes idle (session closed) → drop + log.
- `sendUserMessage` throws → retry once after 500ms.
- 2nd throw → drop + log.
- LRU eviction: 10,001 entries → oldest entry removed.

#### `index.ts` integration test

- Boot the extension with a mocked `pi`.
- Simulate `session_start` → config loads, registry has the 4 built-ins, watcher starts.
- Write a `.ts` file containing `// eslint-disable` → after debounce, `pi.sendUserMessage` was called.
- Simulate `session_shutdown` → watcher closed, timers cleared.
- `mode: "off"` → `session_start` loads everything, but the watcher does NOT start and the registry has NO built-ins.

#### `rules/built-in.test.ts`

- Each rule has a unique id.
- Each rule has ≥1 pattern.
- Each rule has non-empty `filePatterns`.
- All patterns compile (no invalid regex).
- All patterns are case-insensitive (`pattern.flags.includes("i")`).
- Snapshots of patterns: if someone changes a pattern, the test fails and the snapshot must be updated intentionally.

### 8.3 End-to-end manual test

- Script `tests/manual/run.ts` boots the extension with real pi, writes a test file, and verifies the warning appears.
- Not run in CI. Only for human validation.

### 8.4 CI

- `bun test` on every push.
- Coverage target: ≥ 90% in `lib/`. `index.ts` and `rules/` are harder to cover; ~80% is acceptable.

### 8.5 Fixtures

```
tests/fixtures/
├── ts-with-eslint-disable.ts    # contains // eslint-disable-next-line
├── ts-with-ts-ignore.ts          # contains // @ts-ignore
├── py-with-noqa.py               # contains # noqa
├── go-with-nolint.go             # contains //nolint
├── java-with-suppress.java       # contains @SuppressWarnings
├── binary.bin                    # contains \0
├── huge.ts                       # 10MB (generated in beforeAll)
└── clean.ts                      # no shortcuts, 0 matches expected
```

## 9. Open debt / future work

### v1.1

- **Rust `#[allow(...)]`**: requires AST parsing (`syn` or `rust-analyzer`). Add a new built-in rule `no-attribute-suppressions` with a Rust-aware parser.
- **String-literal heuristic refinement**: the v1 single-line heuristic misses multi-line template literals. Consider a proper tokenizing approach if false positives become a problem.
- **Per-session rule toggles via TUI command** (`/guardrails list`, `/guardrails disable <id>`) instead of editing `config.yml`.
- **Stats command** (`/guardrails stats`): how many violations, which file, which rule, which LLM turn.

### v2

- **`strict` mode actually blocks**: switch detection from chokidar to `tool_call` interception. Mutate `event.input` to strip the offending directive, or set `block: true` with a `reason`.
- **Defense in depth**: keep chokidar running in `strict` mode as a backstop.
- **Per-rule severity routing**: `error` rules block in `warn` mode; `warning` rules only notify.

## 10. Implementation notes

### 10.1 File layout

```
~/.pi/agent/extensions/llm-guardrails/
├── package.json            # deps: chokidar, micromatch, safe-regex
├── config.yml              # default config shipped to user (or empty)
├── index.ts                # entry point
├── lib/
│   ├── types.ts
│   ├── config-loader.ts
│   ├── env-resolver.ts
│   ├── rule-registry.ts
│   ├── scanner.ts
│   ├── watcher.ts
│   └── messenger.ts
├── rules/
│   └── built-in.ts
├── tests/
│   ├── lib/
│   │   ├── scanner.test.ts
│   │   ├── rule-registry.test.ts
│   │   ├── config-loader.test.ts
│   │   ├── watcher.test.ts
│   │   └── messenger.test.ts
│   ├── rules/
│   │   └── built-in.test.ts
│   ├── integration.test.ts
│   ├── fixtures/
│   │   └── ...
│   └── manual/
│       └── run.ts
├── tsconfig.json
└── README.md
```

### 10.2 Dependencies

Runtime:

- `chokidar` ^3.6.0 — filesystem watcher
- `micromatch` ^4.0.5 — glob matching
- `safe-regex` ^2.1.1 — ReDoS prevention at registration

Dev:

- `typescript` ^5.4
- `@types/bun` — for `bun:test`
- `@types/micromatch`
- `@types/safe-regex`

### 10.3 `package.json` (excerpt)

```json
{
  "name": "llm-guardrails",
  "version": "0.1.0",
  "type": "module",
  "main": "index.ts",
  "scripts": {
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "micromatch": "^4.0.5",
    "safe-regex": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/bun": "latest",
    "@types/safe-regex": "^2.1.0"
  }
}
```

### 10.4 `tsconfig.json`

Standard bun-compatible config. `strict: true`, `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`.

### 10.5 README

Short — purpose, install (`cp -r llm-guardrails ~/.pi/agent/extensions/`), config example, `/reload` in pi, link to this spec.
