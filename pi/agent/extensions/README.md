# Pi Extensions — Architecture & Operating Manual

This directory holds the user's custom Pi extensions. Pi loads every `.ts` file
here on startup via [jiti](https://github.com/unjs/jiti) and runs each module's
default export as a factory function with `pi: ExtensionAPI`.

The extensions cooperate to provide:

- **Deterministic flag dispatch** (`flags-gateway.ts`) — facade for parsing
  flags out of the user prompt before the LLM ever sees them
- **Multi-agent orchestration** (`subagents.ts`, `chains.ts`, `bmad-runner.ts`)
  — spawn child Pi/Claude/Opencode processes, run sequential pipelines, and
  drive a story-status state machine for BMAD
- **Cross-platform agent discovery** (`agent-repository.ts`) — read agent
  definitions from `~/.pi`, `~/.claude`, `~/.gemini`, `~/.codex` and merge
- **Declarative safety rails** (`safety-rules.ts`) — YAML-driven block/ask
  decisions on tool calls
- **Smart routing & cognitive flags** (`smart-model-router.ts`) — picks model
  per-turn based on prompt complexity
- **Lock coordination** (`multi-agent-file-lock.ts`) — filesystem-level mutex
  for concurrent file edits across subagents
- **Custom compaction strategy** (`context-compact.ts`) — replaces Pi's default
  summarization with a structured 7-section template
- **TUI feedback** (`agent-feedback.ts`) — inline `:( :| :)` widget after each
  turn

If you only read one section, read **The Symlink Trap** below — it's the most
non-obvious gotcha in this codebase.

---

## Table of Contents

- [The Symlink Trap (read this first)](#the-symlink-trap-read-this-first)
- [Design Patterns at a Glance](#design-patterns-at-a-glance)
- [Adding a New Flag Handler](#adding-a-new-flag-handler)
- [Adding a New Extension](#adding-a-new-extension)
- [Quirks & Workarounds](#quirks--workarounds)
- [Logs & Debugging Guide](#logs--debugging-guide)
- [Subagent Executor Strategies](#subagent-executor-strategies)
- [State & Persistence](#state--persistence)
- [Quick Reference Commands](#quick-reference-commands)
- [Per-File Reference](#per-file-reference)
- [Known Limitations](#known-limitations)

---

## The Symlink Trap (read this first)

`~/.pi` is a symlink to `~/.config/pi`. Pi auto-loads extensions via the
symlinked path (`file:///Users/.../.pi/agent/extensions/...`). When one of
those extensions does a relative dynamic import like:

```ts
import("./flags-gateway.js")
```

jiti resolves the path through the canonical filesystem location
(`file:///Users/.../.config/pi/agent/extensions/...`). The two URLs differ as
strings, so jiti caches them as **two distinct module instances** even though
they're the same file on disk.

Concretely, this means:

- `flags-gateway.ts` may exist in memory **twice** (or more): once for pi's
  load, once per dynamic-import path resolution
- Module-scoped state (e.g. a `const handlers: IFlagHandler[] = []`) is **not**
  shared between those instances
- The instance whose `default()` factory pi actually invoked is the one whose
  `pi.on("before_agent_start", ...)` listener fires — but if other extensions
  register handlers into a *different* instance's `handlers` array, those
  handlers are invisible to the listening instance

**Symptom of this bug:** flag handlers register successfully (logs say so) but
never fire when the flag is typed. Pi sends the raw prompt to the LLM, which
treats `--my-flag` as gibberish.

**The Fix:** never store cross-extension state in module scope. Use
`pi.events` (the host-owned event bus) as a Mediator. The Facade encapsulates
state in a closure, and consumers communicate via the bus. See
`flags-gateway.ts` for the canonical pattern (`REGISTER_EVENT` / `REPLAY_EVENT`).

If you need shared state across extensions, **either**:

1. Pass `pi` to your function and route through `pi.events`
2. Use a `WeakMap<typeof pi, State>` keyed by the pi reference (it's a
   singleton at runtime so the WeakMap has at most one entry)

Do **not** use `globalThis`. It works but it pollutes the namespace and breaks
encapsulation — the Facade should hide its registry, not expose it globally.

---

## Design Patterns at a Glance

| Pattern | Where | Purpose |
|---|---|---|
| **Facade** | `flags-gateway.ts` | One entry point (`registerFlagHandler`) hiding parsing, priority sort, dispatch |
| **Chain of Responsibility** | `flags-gateway.ts` `for (const handler of handlers)` | Each handler decides if it matches and short-circuits or continues |
| **Mediator** | `pi.events` between Facade and consumers | Decouples cross-extension communication from module identity |
| **Strategy** | `subagents.ts` `IExecutor` (pi / claude-cli / opencode-cli) | Per-agent CLI delegation pluggable via frontmatter |
| **Repository** | `agent-repository.ts` `AgentRepository` | Hides "where do agents come from" from consumers |
| **Strategy (loaders)** | `agent-repository.ts` `IAgentLoader` | One loader per source path/format |
| **Specification** | `safety-rules.ts` `Specification` interface | Each safety rule is an isolated, testable predicate |
| **Pipes & Filters** | `chains.ts` `executeChain` | Output of step N becomes `$INPUT` of step N+1 |
| **Composite** | `subagents.ts` `SubagentGridWidget` | Container of N card components rendered as a unit |
| **Observer** | `subagents.ts` `LiveProgressBus` | Subscribe-once, multi-listener pattern for grid re-renders |
| **Singleton (lazy)** | `agent-repository.ts`, `chainRepo` | Module-scoped instance with explicit `reload()` |
| **Template Method** | `chains.ts` `expandVariables` (`$INPUT`, `$ORIGINAL`, `$@`, `$N`) | Shared variable-substitution convention |

---

## Adding a New Flag Handler

If you want a deterministic, LLM-bypassed flag like `--my-flag <args>`:

```ts
// my-extension.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface ParsedMyFlag {
  cleanPrompt: string;
  args: string[];
}

function parseMyFlag(prompt: string): ParsedMyFlag | null {
  const m = prompt.match(/(^|\s)--my-flag\s+(\S.*)$/);
  if (!m) return null;
  return {
    cleanPrompt: prompt.slice(0, m.index ?? 0).trim(),
    args: m[2].split(/\s+/),
  };
}

export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return; // Recursion guard

  import("./flags-gateway.js").then(({ registerFlagHandler }) => {
    registerFlagHandler(pi, {
      // String match: literal substring detection in the prompt
      // Function match: returns truthy → match data passed to execute
      match: (prompt: string) => parseMyFlag(prompt),
      priority: 700, // lower = earlier; existing handlers: 5, 10, 50, 800, 850, 900, 1000
      execute: async (state, ctx, _pi, parsed: ParsedMyFlag) => {
        state.cleanPrompt = parsed.cleanPrompt;
        // Do work here. Use ctx for UI, ctx.cwd, ctx.sessionManager, etc.
        // Push to state.systemInjections to feed results to the parent LLM.
        state.systemInjections.push("## My Flag Result\n\n...");
      },
    });
  });
}
```

**Critical rules:**

- `registerFlagHandler` MUST receive `pi` as first argument (Mediator routing)
- The function must be called from inside (or via the `.then` of) the dynamic
  import — synchronous calls before the import resolves are dropped
- If your handler consumes the entire prompt (`cleanPrompt === ""`), inject a
  directive in `state.cleanPrompt` telling the LLM what to do, otherwise it
  may wander (run `ls`, `grep`, etc., looking for context)

**Priority cheatsheet** (lower runs first):

| Priority | Handler | Notes |
|---|---|---|
| 5 | `--smart-router-default`, `--smart-router-ask` | Router toggles |
| 10 | `--*-think` (minimal/low/medium/high/xhigh) | Thinking-level flags |
| 50 | `--dispatch-only` | Forbid direct tool use this turn |
| 700 | (free) | Reserved for future early-stage handlers |
| 800 | `--sub` | Subagent dispatch |
| 850 | `--chain <name>` | Chain orchestration |
| 900 | `--bmad-workflow` | BMAD story runner |
| 1000 | (no `match`) Smart router engine | Always-runs final stage |

---

## Adding a New Extension

A pi extension is any `.ts` file in this directory that exports a default
function `(pi: ExtensionAPI) => void | Promise<void>`. Pi calls it once at
load.

**Library modules** (files that only export utilities, no extension behavior)
must still export a no-op default:

```ts
// my-utils.ts
export function helper(): string { return "ok"; }

// pi rejects extensions without a valid default factory, so add this:
export default function () { /* library module — no extension behavior */ }
```

**Recursion guard** — the FIRST line of your extension factory should be:

```ts
if (process.env.PI_SUBAGENT_CHILD === "1") return;
```

Subagents inherit this env var. Skipping registration prevents fork bombs and
keeps child output streams clean of unrelated UI noise.

**Idiomatic structure:**

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// 1. Types & constants
// 2. Pure helpers (no side effects)
// 3. State (closure-scoped, NOT module-scoped if shared)
// 4. UI components (if any)
// 5. Default export factory:
export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  // pi.registerTool(...)
  // pi.registerCommand(...)
  // pi.registerFlag(...)
  // pi.on("event", ...)
  // import("./other-extension.js").then(...) for cross-extension wiring
}
```

---

## Quirks & Workarounds

### `yaml` package isn't reachable from extensions

Pi's `yaml` dep lives in `pi-coding-agent/node_modules/yaml/`, but jiti's
module resolver doesn't reach into that scope from `~/.pi/agent/extensions/`.
Static `import "yaml"` fails. Dynamic `require("yaml")` fails the same way.

**Workaround:** `yaml-mini.ts` — a 150-LOC YAML subset parser that handles:
mappings, sequences (`- item` and `- key: value`), inline arrays
(`[a, b, c]`), block scalars (`|` literal, `>` folded), quoted strings, and
comments. Sufficient for the chain/safety/sprint-status YAML shapes we use.

If you need a feature it doesn't support, extend yaml-mini rather than
adding a `yaml` dependency.

### `@sinclair/typebox` vs `typebox`

The current pi version (v0.64.0) ships `@sinclair/typebox`. Newer pi-mono
docs reference `typebox` (the v1 rename). Use **`@sinclair/typebox`** for now
— if you upgrade pi and it breaks, change all imports together.

### Pi auto-loads via the symlinked path

If you need to know which path pi is using, log `import.meta.url` from the
top of your file. See "The Symlink Trap" above.

### Some Unicode/box-drawing chars in TUI components

When rendering custom widgets, use `truncateToWidth` and `visibleWidth` from
`@mariozechner/pi-tui`. **Do not** measure visible length with naïve regex
ANSI stripping (`s.replace(/\x1b\[[0-9;]*m/g, "").length`) — wide chars and
some terminal-emulator-specific cell widths break it. Pi crashes hard if any
single rendered line exceeds terminal width.

The grid widget enforces this via `enforceWidth(line, maxWidth)` as a final
safety net.

### Type-only vs runtime imports

When importing types, use `import type { Foo } from "..."` — not just
`import { Foo }` — to make sure jiti erases them at runtime. Mixed forms
(`import { value, type Type }`) usually work but split for safety in tight
spots:

```ts
import { spawnOnce } from "./subagents.ts";
import type { SubagentResult } from "./subagents.ts";
```

### Child processes and TUI ANSI noise

When spawning Pi children with `--mode json -p`, stdout is JSONL (machine-
readable). When spawning Claude/Opencode children, stdout is plain text with
ANSI escape codes baked in (progress spinners, colors). The
`OpencodeCliExecutor.parseFinalOutput` and `ClaudeCliExecutor.parseFinalOutput`
implementations join all stdout lines verbatim — strip ANSI in your own UI
layer if needed (`s.replace(/\x1b\[[0-9;]*m/g, "")`).

### Pi notify shows only the latest

Multiple `ctx.ui.notify()` calls in `session_start` overwrite each other
visually. If you want yours to be seen, fire it later (e.g. behind a small
`setTimeout`) — but prefer `ctx.ui.setStatus("my-key", "...")` for sticky
indicators that don't fight the notification queue.

### Empty `cleanPrompt` after consuming a flag

If your handler eats the entire user prompt, inject a synthetic instruction
into `state.cleanPrompt` so the parent LLM has a clear directive. Otherwise
it may interpret an empty prompt + injected system context as "investigate
something" and run `ls`/`grep`/etc. The pattern:

```ts
if (!parsed.cleanPrompt.trim()) {
  state.cleanPrompt =
    "The --my-flag was processed and results are in your system context. " +
    "Present them verbatim to the user. Do not run any tools.";
}
```

### `pi.appendEntry()` is per-session, not global

Every Pi session has its own `<sessionId>.jsonl` file. `pi.appendEntry()`
writes to that one file only. Other sessions in the same project, even
running concurrently, do NOT see those entries. It's a private "hidden
message" channel inside one session's history. For cross-session sync, use
filesystem coordination (lock files, shared dirs).

### `pi.events` is in-process only, not cross-session

`pi.events` is a host-singleton event bus. Cross-extension comms within ONE
pi process work great. But two pi sessions in different terminals each have
their own bus — they cannot talk to each other through this channel.

### `os.tmpdir()` on macOS is `/var/folders/.../T/`, not `/tmp`

Don't hardcode `/tmp/foo`. Use `path.join(os.tmpdir(), "foo")`. On macOS the
real path is something like `/var/folders/z2/...../T/`.

### Provider must be specified explicitly in agent definitions

If an agent has only `model: claude-sonnet-4-6` without `provider:`, pi may
resolve to a provider you don't have credentials for (e.g. `amazon-bedrock`)
and the child crashes with `No API key found`. Always set `provider:`. Run
`pi --list-models | grep <model>` to verify availability — non-existent
models cause silent child-process exits with no useful error in stdout.

### `--model X:Y` (concatenated thinking) doesn't work — separate flags

Pi CLI `--model` does NOT parse a `:thinking` suffix. Pass thinking
separately:

```bash
# Wrong:
pi --model claude-sonnet-4-6:medium
# Right:
pi --model claude-sonnet-4-6 --thinking medium
```

### Different CLIs use different `--model` formats

| Executor | Model arg format | Example |
|---|---|---|
| pi | separate flags | `--provider google --model gemini-3-pro-preview --thinking high` |
| claude | bare name | `--model sonnet` or `--model claude-sonnet-4-6` |
| opencode | `provider/model` | `-m opencode/minimax-m2.5-free` |

Each `IExecutor.buildSpawn()` handles its CLI's convention. Check
`subagents.ts` before adding a new one.

### Spawn children with array args, not shell strings

Always use `spawn(command, argsArray, options)`. Never build a single
shell-string and pipe through `bash -c`. Array args skip shell parsing →
no command-injection surface, no quoting bugs.

### Pi child processes need `--mode json -p` for structured output

`--mode json` makes pi emit JSONL events on stdout (machine-readable). `-p`
(`--print`) makes pi exit after one prompt. Both are required when a
parent process wants to parse the child's stream — forgetting either gives
you a hung process or unparseable output.

### Live status keys must be unique across concurrent subagents

The grid widget keys cards by status label. If you spawn 3 `@build` and use
`agentName` directly as the key, later updates **overwrite earlier ones**
in the `Map` — only ONE card shows. Always suffix with index when there
are multiple tasks (already done in `subagents.ts` `runOne` via
`statusLabel`).

### Pi `/reload` doesn't always pick up code changes

Sometimes jiti caches a module despite the file being edited. If your
changes don't apply after `/reload`, fully exit pi (Ctrl+C) and restart.
Especially common after editing `flags-gateway.ts` or any file consumed
through dynamic imports.

### Skills from `.claude/skills/` need explicit settings

Pi auto-discovers skills only from `~/.pi/agent/skills/` and
`<cwd>/.pi/skills/`. Claude/Gemini/Codex paths require:

```json
// <cwd>/.pi/settings.json or ~/.pi/agent/settings.json
{ "skills": ["../.claude/skills"] }
```

Restart pi (or `/reload`) after editing settings.

### `event.prompt` may have file content already inlined

Pi's `@<file>` syntax inlines file content into the prompt BEFORE
`before_agent_start` fires. Your flag regex should be tolerant of multi-KB
prompts.

### Status notifications stack but only the latest is visible

Multiple `ctx.ui.notify()` in quick succession (e.g. all at session_start)
overwrite each other. For visible feedback at startup, prefer
`ctx.ui.setStatus("my-key", "...")` for sticky footers, or stagger with
`setTimeout`.

### Frontmatter parsing is single-line-only

`agent-repository.ts`'s `parseFrontmatter`:

- Requires `---\n...\n---` delimiters at line starts
- Each metadata line MUST be `key: value` on a single line — no nested
  objects, no multi-line values
- Quotes (single/double) stripped automatically
- Inline arrays `[a, b, c]` flattened to comma-separated strings
- Lines without `:` silently skipped
- Body after closing `---` becomes the system prompt verbatim

For richer YAML in agent files, use a separate config referenced from the
body, not the frontmatter.

### Custom file-mutating tools must use `withFileMutationQueue`

If your custom tool writes files, wrap the write in
`withFileMutationQueue(absolutePath, async () => { ... })` from
`@mariozechner/pi-coding-agent`. Without this, your tool can race with
built-in `edit` and one of the writes loses changes.

### macOS sandbox / SIP can silently block writes

Writing to `~/Documents`, `~/Desktop`, or `~/Library` without explicit user
grant may silently fail on macOS. Test in `/tmp/...` first.

### Recursion guard via `PI_SUBAGENT_CHILD`

`subagents.ts` and `chains.ts` set `PI_SUBAGENT_CHILD=1` on spawned
children. EVERY extension that registers cross-process state should guard
with:

```ts
if (process.env.PI_SUBAGENT_CHILD === "1") return;
```

Prevents fork bombs (subagents calling `spawn_subagent` recursively), UI
noise in child stdout, and lock contention from children creating locks
under their cwd that the parent doesn't see.

### Session JSONL file location

Per-session storage:
```
~/.pi/agent/sessions/<encoded-cwd>/<sessionId>.jsonl
```

Subagents spawned via `subagents.ts` get nested storage:
```
~/.pi/agent/sessions/<encoded-cwd>/<parentSessionId>/<runId>/<agentName>.jsonl
```

This makes post-mortem easy: open parent session, see which subagents it
spawned, drill into each child JSONL. `/sublist` and `/subcont <runRef>`
use these paths.

---

## Logs & Debugging Guide

The extensions ship in **clean mode** — no diagnostic file logs by default.
Add temporary logging only when chasing a specific bug, then remove it.

### Where Pi itself writes logs

| File | Contents |
|---|---|
| `~/.pi/agent/pi-crash.log` | Stack traces from pi-tui render crashes (line-too-wide, etc.). Most useful when extensions break the TUI |
| `~/.pi/agent/sessions/<encoded-cwd>/<sessionId>.jsonl` | Full conversation history of one session (user prompts, assistant messages, tool calls, results, custom entries) |
| `~/.pi/agent/sessions/<encoded-cwd>/<parentId>/<runId>/<agent>.jsonl` | Subagent session JSONL — one file per spawned child |

`pi-crash.log` rotates per crash. Delete it occasionally if it grows too
large.

### When you need temporary diagnostics

`console.error()` and `console.log()` from extensions are **NOT visible** in
the TUI — pi captures stdout for its own rendering. To trace what's
happening, write to a log file:

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const DBG_LOG = path.join(os.tmpdir(), "my-extension.log");
function dbg(msg: string): void {
  try {
    fs.appendFileSync(DBG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* must never throw */ }
}

dbg("module loaded");

export default function (pi: ExtensionAPI) {
  dbg("factory called");
  // ... use dbg() at every interesting checkpoint
}
```

Tail with:

```bash
tail -f "$(node -e 'console.log(require("os").tmpdir())')/my-extension.log"
```

When the bug is fixed, **remove every `dbg()` call** before committing.
Keep the codebase clean.

### What to log when chasing each bug class

| Symptom | Log these checkpoints |
|---|---|
| Flag handler doesn't fire | `module loaded at ${import.meta.url}` (top-level), inside `match` and `execute` callbacks of your handler, plus add similar logging to `flags-gateway.ts`'s `before_agent_start` listener showing `handlers.length` |
| Subagent spawn fails | Inside `spawnOnce`, log the resolved `command` + `args` array (NOT joined as string), the env vars set, the cwd, and on `proc.error` the full error |
| Chain step output not piped | Log `result.output.length` after each step, plus the resolved prompt after `expandVariables` |
| Agent definition not found | Log every `loaderName + dirpath + filename` from each `IAgentLoader.discover()`, plus the final `repository.list()` result |
| YAML parsing fails | `console.error(parseYaml(input))` to see the parsed object shape, OR test in isolation: `node --experimental-strip-types -e "import { parseYaml } from './yaml-mini.ts'; ..."` |
| Lock not coordinating | Add `dbg` to `multi-agent-file-lock.ts` `tryAcquireLock` and `releaseLock`, watch the lock dir with `watch -n 0.05 ls -la <cwd>/.pi/locks/` in another terminal |

### Verifying extension load order

Pi loads extensions alphabetically by filename. To see the actual order,
add this at the top of EACH extension file (only when investigating):

```ts
import * as fs from "node:fs";
import * as path from "node:path";
fs.appendFileSync(path.join(require("os").tmpdir(), "load-order.log"),
  `${new Date().toISOString()} ${import.meta.url}\n`);
```

The order matters when extensions wire up via `pi.events` (see Symlink Trap
section).

### Reading a session's full event stream

```bash
# Find your latest session
ls -t ~/.pi/agent/sessions/<encoded-cwd>/*.jsonl | head -1

# Pretty-print every event
cat <session>.jsonl | jq -c '{type, role: .message.role, content: .message.content}'

# See only tool calls
cat <session>.jsonl | jq -c 'select(.type == "tool_execution_start")'

# See only assistant text
cat <session>.jsonl | jq -c 'select(.type == "message_end" and .message.role == "assistant") | .message.content[] | select(.type == "text") | .text'
```

`jq` queries on the JSONL stream are the fastest way to reconstruct what
happened in a long-running session without re-running anything.

### Subagent forensics

After a `--bmad-workflow` or `--sub` run, every spawned child has its OWN
session JSONL. Use this to see what each child actually did:

```bash
# Tree of subagent sessions for the most recent parent
find ~/.pi/agent/sessions -newer /tmp/recent -type f -name "*.jsonl" | sort
```

The directory layout `<parentId>/<runId>/<agent>.jsonl` makes it trivial
to correlate a parent call with its children.

### Live monitoring during a run

```bash
# In another terminal: watch new sessions appear in real time
fswatch ~/.pi/agent/sessions | head -50
```

(Requires `fswatch`; `brew install fswatch`.) Useful for confirming that
spawn is happening when you expect.

### Common "silent failure" patterns

1. **Extension throws during load** — pi shows a load error notification
   but it's transient. Check stderr where pi was launched, OR add a
   top-level `dbg("module loaded")` to confirm the file is being parsed.

2. **Async work in `default()` factory not awaited** — pi's loader doesn't
   know the work is still pending. Use an `async function` factory and
   `return Promise.all([...])` if you have multiple async setup tasks.

3. **`registerFlagHandler` called before flags-gateway loaded** — the
   REPLAY mechanism handles this, but if your handler still doesn't fire,
   verify with the diagnostic pattern in "Flag handler doesn't fire" above.

4. **Child process spawned but produces no output** — usually a model
   doesn't exist, an API key is missing, or the agent prompt is empty.
   Capture stderr in your spawn handler and surface it in the result's
   `error` field.

5. **YAML parse "succeeds" but data is wrong** — `yaml-mini` is lenient.
   It may interpret your file as a malformed shape rather than throwing.
   Always log the parsed shape when results don't match expectations.

---

## Subagent Executor Strategies

Each agent definition (`~/.pi/agent/agents/<name>.md`) can declare which CLI
to delegate to via frontmatter:

```yaml
---
name: my-agent
executor: pi              # default — spawns pi child with --mode json -p
# OR
executor: claude-cli      # spawns: claude -p "<task>" --dangerously-skip-permissions ...
# OR
executor: opencode-cli    # spawns: opencode run "<system + task>" -m provider/model
provider: ...
model: ...
thinking: ...             # only respected by pi executor
tools: read,grep,...      # only respected by pi executor
executorArgs: --foo --bar # appended raw to whatever CLI is spawned
---
System prompt body...
```

**Trade-offs by executor:**

| Capability | pi | claude-cli | opencode-cli |
|---|---|---|---|
| Live tool count in grid widget | ✓ (parses JSONL events) | ✗ (plain text only) | ✗ (plain text only) |
| Persistent session / `/subcont` | ✓ | ✗ (Claude has its own session model) | ✗ |
| `safety-rules.ts` enforcement | ✓ | ✗ (Claude does its own perms) | ✗ |
| `multi-agent-file-lock.ts` coordination | ✓ | ✗ (separate process tree) | ✗ |
| Restrict `tools:` via frontmatter | ✓ | ✗ | ✗ |
| Final stdout captured as result | ✓ | ✓ | ✓ |

Use claude-cli or opencode-cli when that CLI is genuinely better for the task
(e.g. `minimax-m2.5-free` is only on opencode). Don't use them when you need
the integration with the rest of this extension stack.

**Adding a new executor** (e.g. for Cursor CLI, Aider, etc.):

1. Implement `IExecutor` in `subagents.ts` with `buildSpawn()` and
   `parseFinalOutput()`
2. Add it to the `EXECUTORS` map and the `ExecutorKind` union in
   `agent-repository.ts`
3. Document in this README's table

---

## State & Persistence

Where state lives, by extension:

| Extension | State location | Survives restart? |
|---|---|---|
| `flags-gateway.ts` | Closure of `default()` factory invocation | No — rebuilt on each session |
| `subagents.ts` | `PersistedRunRegistry` (module singleton) | No (in-memory) — sessions written to disk under `~/.pi/agent/sessions/<parent>/<runId>/` so child JSONL files persist for `/subcont` resume |
| `chains.ts` | `chainRepo` (module singleton) | No — reloaded from `~/.pi/agent/chains/*.yaml` and `<cwd>/.pi/chains/*.yaml` on each `reload()` |
| `agent-repository.ts` | Singleton + `reload(cwd)` | No — discovered fresh from disk |
| `bmad-runner.ts` | None — uses `<cwd>/docs/implementation-artifacts/sprint-status.yaml` directly | YAML is the state file (BMAD owns it) |
| `safety-rules.ts` | `evaluator` rebuilt from `~/.pi/agent/safety.yaml` and `<cwd>/.pi/safety.yaml` | No — re-read with `/safety reload` |
| `multi-agent-file-lock.ts` | Filesystem locks at `<cwd>/.pi/locks/*.lock` (mkdir-as-mutex) | Locks released on shutdown |
| `agent-feedback.ts` | Module flag `expectingFeedback` | No |
| `context-compact.ts` | Stateless | N/A |
| `smart-model-router.ts` | `currentModelId`, lazy-loaded `modelsDevDb`/`openRouterDb` | No |

**Important:** because `flags-gateway.ts` rebuilds its registry on every
session, consumer extensions MUST re-register their handlers on every load.
The dynamic-import-then-register pattern in `default()` does this correctly.

---

## Quick Reference Commands

Built-in slash commands these extensions expose. Use these for inspection
without writing temporary diagnostics.

| Command | Purpose |
|---|---|
| `/agents` | List all discovered agents (pi/claude/gemini/codex), grouped by source. If your expected agent isn't here, the loader couldn't parse it — check frontmatter syntax. |
| `/sublist` | Show all subagent runs from this session with their `runRef` for use with `/subcont`. |
| `/subcont <runRef> <prompt>` | Resume a previously-spawned subagent's conversation (uses its persisted JSONL session file). |
| `/subkill <runRef\|all>` | Kill a running subagent or terminate all. |
| `/subgrid <1-4>` | Set the column count for the live grid widget. |
| `/chains` | List all chain definitions found in `~/.pi/agent/chains/` and `<cwd>/.pi/chains/`. |
| `/chain <name> <task>` | Run a chain directly without going through the LLM. |
| `/bmad-status` | Snapshot of `sprint-status.yaml`: counts per state and next stories to process. |
| `/safety` / `/safety reload` | Inspect or reload safety rules from YAML. |
| `/cc` | Manually trigger a structured Context-Compact summarization. |

### Verify a YAML parses (one-liner)

```bash
node --experimental-strip-types -e "
import { parseYaml } from '/Users/$USER/.config/pi/agent/extensions/yaml-mini.ts';
import { readFileSync } from 'fs';
console.log(JSON.stringify(parseYaml(readFileSync('/path/to/file.yaml', 'utf-8')), null, 2));
"
```

### Confirm the symlink is in place

```bash
ls -la ~/.pi  # must show: ~/.pi -> /Users/.../.config/pi
```

If missing, all module-identity assumptions break. Re-create with
`ln -s ~/.config/pi ~/.pi`.

### Inspect what models pi can actually use

```bash
pi --list-models | grep -iE "<model-name>"
```

Models that don't exist cause silent child-process exits. Always verify
before referencing in agent definitions.

---

## Per-File Reference

### `flags-gateway.ts` (Facade)

Single registration point for prompt-level flag handlers. Uses Mediator
(pi.events) to coordinate across module instances. Read this file before
modifying any flag-handling logic in other extensions.

### `subagents.ts` (Engine + UI)

Spawn pi/claude/opencode children. Exports `spawnOnce()` for one-shot
launches and `spawnSubagents()` for parallel/sequential batches. Owns the
grid widget and the `/subcont` `/sublist` `/subkill` `/agents` `/subgrid`
commands.

### `chains.ts` (Pipes & Filters)

Loads chain definitions (sequential agent pipelines) from
`~/.pi/agent/chains/*.yaml` and `<cwd>/.pi/chains/*.yaml`. Reuses
`spawnOnce()` from subagents.ts. Variable substitution: `$INPUT` (previous
step output), `$ORIGINAL` (user task), `$@` / `$ARGUMENTS` (full task),
`$1` `$2` ... (positional words).

### `bmad-runner.ts` (BMAD orchestrator)

Reads `<cwd>/docs/implementation-artifacts/sprint-status.yaml` as a state
machine and runs the 3-step BMAD chain (`bmad-create-story` →
`bmad-dev-story` → `bmad-code-review`) for each pending story. Status
transitions are owned by BMAD's own skills; the runner only dispatches and
verifies. Bail-fast on any step failure.

### `agent-repository.ts` (Repository)

Discovers agent definitions across pi/.claude/.gemini/.codex paths (project
+ global). Priority: lower number wins on name conflict. Used by subagents,
chains, and bmad-runner.

### `safety-rules.ts` (Specification)

Reads YAML at `~/.pi/agent/safety.yaml` (and project-local
`<cwd>/.pi/safety.yaml`) and intercepts `tool_call` events. Supports four
rule types: `zeroAccessPaths`, `readOnlyPaths`, `noDeletePaths`,
`bashToolPatterns`. Reload with `/safety reload`.

### `smart-model-router.ts`

Auto-selects a model per turn based on prompt complexity. Provides
`--smart-router-default`, `--smart-router-ask`, and `--*-think` flags.

### `multi-agent-file-lock.ts`

Filesystem mutex for concurrent file edits across subagents. Locks live in
`<cwd>/.pi/locks/`. Stale locks (>30s) are reclaimed automatically.

### `context-compact.ts`

Replaces Pi's default summarization. Provides `/cc` command and intercepts
auto-compaction with a 7-section structured template.

### `agent-feedback.ts`

Inline `:( :| :)` feedback widget shown after each `agent_end`. Matches
keypresses `1`/`2`/`3` or the literal emoticons.

### `yaml-mini.ts` (Library)

Minimal YAML parser. Used because the `yaml` npm package isn't reachable
from extensions (see Quirks).

### `agent-repository.ts` (Library + extension)

Has both named exports (`getAgentRepository`, `parseFrontmatter`) AND a
no-op default factory so pi accepts it as an extension. The named exports
are what consumers actually use.

---

## Known Limitations

- **No persistent state across pi restarts**: subagent registry, chain repo
  cache, etc. all rebuild on session_start. If you need durable state, write
  to disk explicitly.
- **Grid widget is pi-executor only**: live tool count and last-tool-name
  fields stay empty for claude-cli / opencode-cli children because we don't
  parse their plain-text stdout for events.
- **`--dispatch-only` is advisory**: it injects a strong system-prompt
  directive but doesn't enforce at the API level (pi's `setActiveTools` is
  sticky across turns). A determined LLM can still call read/write/edit.
- **Safety rules don't apply to non-pi children**: claude-cli and
  opencode-cli enforce their own permission models — your `safety.yaml` is
  invisible to them.
- **`bmad-runner` assumes BMAD-style YAML schema**: keys flat under
  `development_status`, status values from a fixed vocabulary. Doesn't yet
  support epic-level rollups.
- **No retry logic in chain steps**: if step N fails, the chain bails. Add
  retry-once-then-fail at the chain level if you want it.
- **`yaml-mini` is a subset parser**: anchors (`&` / `*`), tags (`!!`), flow
  mappings (`{a: b}`), and multi-document streams (`---`) are not supported.

---

## License & Attribution

These extensions are personal config — not packaged, not versioned beyond
git history in `~/.config`. Patterns and ideas were informed by:

- [`disler/pi-vs-claude-code`](https://github.com/disler/pi-vs-claude-code)
  — chains, agent-team grid, cross-agent discovery
- [`nicobailon/pi-subagents`](https://github.com/nicobailon/pi-subagents) —
  full subagent stack (we adopted env-var identity, hierarchical sessions,
  drain timeouts, frontmatter-based agents conceptually)
- [`badlogic/pi-mono`](https://github.com/badlogic/pi-mono) — Pi itself

If a pattern here is worth upstreaming, send a PR to the relevant project.
