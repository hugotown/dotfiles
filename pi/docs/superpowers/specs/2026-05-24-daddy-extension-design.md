# daddy — Deterministic, Agentic-Driven Development (You Lead)

**Status:** Adversarial review incorporated. Pending final user sign-off before implementation planning.
**Date:** 2026-05-24 (rev. 2 — event-driven execution after adversarial review)
**Target:** A standalone pi.dev extension at `~/.config/pi/agent/extensions/daddy/`.

---

## 1. Motivation

The driving rationale is the token analysis in
`obsidian/Documents/ai-driven-development/agent-utilities/pi-dev-dynamic-skills-token-analysis.md`:
converting a skill from *"the LLM orchestrates everything"* to *"the extension orchestrates,
the LLM only creates"* yields ~84% fewer tokens and higher quality, because each LLM turn
receives only the context it needs and deterministic steps cost zero tokens.

`daddy` applies that thesis to a general, reusable workflow tool:

- A **visual node-flow designer** (keyboard-driven TUI panel) to author flows modeled as
  **Value Stream Mapping (VSM) → SIPOC chains → nodes**.
- A **deterministic execution engine** invoked by `--daddy-workflow <name>` that runs the
  flow as a dependency graph. The main LLM never orchestrates; a recursive wave engine does.

Inspired by Archon (DAG workflows) but living **inside** pi as one integrated ecosystem: the
same panel both designs and observes runs.

## 2. The two orthogonal axes of a node

Every node is described by two independent dimensions:

- **Action** — what the node does: `bash`, `flag`, `ask`, or `llm`.
- **`aiAssisted: boolean`** — whether an LLM reasons inside the node, or it runs deterministically.

`aiAssisted` is a uniform field on **every** node. Its valid values are constrained per action,
and it is the field that decides whether a node spends tokens and whether it spawns an LLM:

| Action | `aiAssisted: false` (deterministic, 0 tokens) | `aiAssisted: true` (LLM in the loop) |
|---|---|---|
| **bash** | run the exact command | — (invalid; bash is always exact) |
| **flag** | fire a registered flag with fixed args | — (invalid; flag firing is deterministic) |
| **ask**  | render authored questions, block for the user's answer | LLM receives the *why*, reasons, and asks adaptively |
| **llm**  | — (invalid; an llm node is the AI) | spawn an isolated subagent that produces output |

So `aiAssisted` is a free choice **only for `ask`**; for the other actions it is fixed
(`bash`/`flag` → false, `llm` → true) but still present for a uniform model.

## 3. Goals / Non-goals

**Goals**
- Author flows in a TUI panel; persist them as human-readable YAML.
- Four node actions (`bash`, `flag`, `ask`, `llm`) crossed with the `aiAssisted` axis.
- Execute via `--daddy-workflow <name>`, intercepted in `pi.on("input")` returning
  `{ action: "handled" }` so the main LLM is never invoked for orchestration.
- A recursive **wave executor**: nodes whose dependencies are all satisfied run in parallel;
  waves run in sequence.
- **Context economy**: each LLM node receives only the upstream outputs it explicitly
  references (`$node.output`), never the full state.
- **Structured output without native structured-output**: an internal `append_node` tool
  validates each LLM node's result; the LLM retries until it conforms.
- Persist the run's state machine in the current session folder for live view, audit, resume.
- Resume an interrupted run by re-invoking `--daddy-workflow <name>`; restart with
  `--daddy-fresh`. The node is the atomic unit — an interrupted node re-runs from the start.

**Non-goals (YAGNI for v1)**
- No browser canvas / drag-and-drop. The designer is a keyboard TUI.
- No global workflow directory in v1 — workflows are project-local (`.pi/daddy/workflows/`).
- No reuse of, or import from, the `subagent` extension. `daddy` copies the dependency-graph
  pattern but is fully standalone.
- No human-approval gate nodes beyond the `ask` action.

## 4. Terminology

- **VSM** — Value Stream Mapping: the top-level container of a flow.
- **SIPOC chain** — Supplier, Input, Process, Output, Customer: a mid-level container grouping
  nodes into one process segment. SIPOC fields are **documentation metadata**; they do not
  constrain execution.
- **Node** — a unit of work, described by its action + `aiAssisted` (§2).
- **State machine** — the runtime JSON tree (VSM > SIPOC > nodes) the engine assembles and
  persists. Owned by the engine (parent), never injected whole into any LLM.

## 5. Architecture overview

```
pi session (has UI)
  └─ daddy extension (index.ts)
       ├─ registerFlag("daddy-workflow" + "daddy-design" + "daddy-fresh")  # --help + event bus
       ├─ pi.on("input")      → intercept --daddy-workflow <name> [--daddy-design|--daddy-fresh]
       │                         parsed manually (hello pattern); guard source==="extension"
       │                         → { action: "handled" } → continueRun(state)  (0 orch. tokens)
       │           ├─ bash node          → exec exact command                    │ awaitable
       │           ├─ flag node          → spawn `pi -p --mode json --no-session` │ (no pi turn):
       │           ├─ ask (aiAssisted=false) → authored form in MAIN UI          │ run inline,
       │           └─ llm  node          → spawn isolated `pi` (DADDY_NODE=1)     │ then loop
       │           └─ ask (aiAssisted=true)  → setModel+tools, sendUserMessage → SUSPEND (return)
       ├─ pi.on("agent_end")  → AI-ask turn done: capture text, append, restoreDefaults, resume
       ├─ pi.on("context")    → trim main window to post-marker during an AI-ask delegation
       └─ panel (double-press ← trigger)
             ├─ design mode  → edit the VSM>SIPOC>node tree, write YAML
             └─ run mode     → live status + active subagent log, read from state machine
```

The child `pi` spawned for an `llm` node runs with env `DADDY_NODE=1`. In that mode the daddy
extension registers **only** the `append_node` tool and does **not** install the panel nor
intercept `--daddy-workflow` (prevents infinite recursion and keeps the child minimal).

## 6. Data model

### 6.1 Workflow definition (design-time, YAML)

Resolved by name from `.pi/daddy/workflows/<name>.yaml`. Written by the panel; human-editable.

```yaml
name: auth-feature
description: Plan and implement authentication.
vsm:
  - sipoc: discovery                 # SIPOC chain (container)
    supplier: repository             # SIPOC metadata (documentation only)
    customer: implementation
    nodes:
      - id: scope
        action: ask
        aiAssisted: true             # LLM reasons about WHY and asks adaptively
        prompt: "Clarify the auth scope before designing."   # the WHY handed to the LLM
        depends_on: []

      - id: scout
        action: llm
        aiAssisted: true
        provider: github-copilot
        model: claude-sonnet-4.6
        variant: medium              # low | medium | high  → pi --thinking
        instructions: "You are a scout. Report only file:line ranges."
        prompt: "Locate the auth code. CONTEXT: $scope.output"   # only this $ref is injected
        provides: "file:line ranges of the auth code"           # SIPOC Output (author criterion)
        depends_on: [scope]
        output_schema:               # optional: forces structured output for this node (§8)
          type: object
          properties:
            ranges: { type: array, items: { type: string } }
          required: [ranges]

  - sipoc: implementation
    supplier: discovery
    customer: developer
    nodes:
      - id: confirm
        action: ask
        aiAssisted: false            # authored questions, no LLM
        questions:                   # rendered verbatim by the engine
          - { id: go, type: select, label: "Proceed to build?",
              options: ["yes", "no"], default: "yes", reasoning: "Spec looks complete." }
        depends_on: [scout]

      - id: build
        action: bash
        aiAssisted: false
        command: "bun test"          # EXACT command, run verbatim
        depends_on: [confirm]

      - id: greet
        action: flag
        aiAssisted: false
        flag: "--hello"              # main flag selects the tool
        args: "whoever you are"      # sub-flags / parameters
        depends_on: []
```

**Containment vs edges.** `vsm > sipoc > nodes` is real three-level containment for the map.
The execution DAG is formed by `depends_on`, and edges **may cross SIPOC chains**.

**Two independent concerns per node:**
- `depends_on` — controls **ordering** (when the node may run).
- `$node.output` references inside `prompt`/`context` — control **what data is injected**.

They can differ: a node may depend on another purely for ordering without injecting its output.

### 6.2 State machine (runtime, JSON)

The engine assembles this tree, mirroring the definition, and persists it. It is the audit
record and the panel's data source. It is **never injected whole into any LLM**.

```json
{
  "workflow": "auth-feature",
  "arguments": "<text typed after --daddy-workflow auth-feature>",
  "startedAt": "2026-05-24T...Z",
  "vsm": [
    { "sipoc": "discovery", "nodes": [
        { "id": "scout", "action": "llm", "aiAssisted": true, "status": "ok",
          "provides": "file:line ranges of the auth code",
          "output": "<the node's produced result>",
          "depends_on": ["scope"], "startedAt": "...", "endedAt": "..." }
    ]}
  ]
}
```

Per-node `status`: `pending | running | ok | failed | skipped`.

## 7. Data passing and context economy

This is the core efficiency mechanism and an explicit requirement from the brainstorm.

| Concern | What it holds | Who reads it |
|---|---|---|
| **Persisted state** (`.daddy.json`) | Every node's output | Engine (parent), panel, resume — never an LLM whole |
| **Injected node context** | Only the `$ref` outputs that node names | The node's isolated subagent |

For an `llm` node (and an `ask` node with `aiAssisted: true`), before running the node the
engine resolves every `$node.output` reference in `prompt`/`context` by reading the persisted
state and substituting the upstream output text inline. `$ARGUMENTS` resolves to the text
typed after the workflow name. The node therefore sees only what it asked for — a node at step
7 does not see steps 1–6 unless it references them. Unknown references are caught before the
run starts (§11).

## 8. The `append_node` tool gate (structured output without native structured-output)

LLMs are unreliable at native structured output. Instead, `daddy` uses the **tool-call
validation loop** as the forcing function, for `llm` nodes.

- `append_node` is registered **only inside the child** (`DADDY_NODE=1`).
- It receives **one node's result**, not the whole tree:

  ```ts
  {
    node_id: string,                 // must equal the node being executed
    status: "ok" | "failed",
    output: string,                  // the produced result; downstream $refs read this
    structured?: unknown             // present iff the node declared output_schema
  }
  ```

- Validation in `execute()`:
  - `node_id` must match the expected node → else throw.
  - If the node declared `output_schema`, validate `structured` against it → else throw with
    the schema violation as the message.
  - On any thrown error pi returns it to the model, which **retries** until valid. This is the
    mechanism that "makes the LLM get smart" to form the required structure.
- On success the child's `append_node` returns `{ ..., terminate: true }` so the child's turn
  ends (no further LLM loop). The child also emits the validated result as a custom message
  (`pi.sendMessage({ customType: "daddy-node-result", content: <json>, display: false })`); the
  parent captures it from the child's JSON stream (the `hello` pattern), appends it to the
  state machine, and persists.

The full state machine is the contract being **assembled**, but it is built one `append_node`
call at a time by the engine — never handed whole to a child.

> **VERIFIED (adversarial review traced pi's agent loop):** a thrown error from a tool's
> `execute()` becomes a tool result with `isError: true` (`createErrorToolResult`) and is fed
> back to the model, which is re-prompted while `hasMoreToolCalls` holds; the loop stops only
> when a result returns `terminate: true`. So "throw to force a retry, return `terminate` to
> finish" works as designed. **Guard:** cap retries (e.g. 5 `append_node` attempts) so a model
> that never satisfies `output_schema` fails the node instead of burning tokens forever.

## 9. Execution engine — resumable wave driver

The adversarial review proved a synchronous recursion cannot work for the AI-assisted `ask`
node: a delegated main-agent turn does not complete inside the `input` handler's call stack —
its result arrives later via the `agent_end` event (verified against the sibling `dev-pipeline`
extension, which daddy **copies the pattern from but does not import**). So the engine has two
control-flow regimes:

- **Self-contained nodes** (`bash`, `flag`, `llm`, `ask` with `aiAssisted:false`) are
  awaitable: a child subprocess (`spawn`) or a `ctx.ui` form — nobody waits on a pi *turn*, so
  the engine can `await` them directly.
- **`ask` with `aiAssisted:true`** needs the **main agent**, whose turn ends asynchronously via
  `agent_end`. This node **suspends** the run.

### 9.1 The driver

`--daddy-workflow <name> [args]` →

1. Parse the input manually (hello pattern): extract `<name>`, the trailing args, and any
   modifier (`--daddy-design`, `--daddy-fresh`). Guard `event.source === "extension"` → ignore
   (never self-trigger on injected messages). Route by mode (§12). For execution:
2. Load and parse `<name>.yaml`; validate the graph (§11). On any error, notify and stop.
3. Resolve the state machine (§12): resume an existing run unless `--daddy-fresh`.
4. Kick off `continueRun(state)` (awaited from the handler; the handler returns `handled`).

```
continueRun(state):                       # re-entrant: called from the input handler AND from agent_end
  loop:
    toSkip = pending nodes with any dependency "failed"/"skipped"  → mark "skipped"; persist
    ready  = pending nodes whose every dependency is "ok"
    subprocess = ready nodes that are self-contained (bash | flag | llm | ask aiAssisted:false)
    aiAsk      = ready nodes that are ask + aiAssisted:true
    if subprocess not empty:
      run them ALL in parallel (bounded by a semaphore); await; append+persist each; continue loop
    else if aiAsk not empty:
      pick ONE; mark it "running"; persist; delegate to the main agent (§10); RETURN (suspend)
    else:
      return                              # no pending nodes → run complete
```

When the delegated turn finishes, `pi.on("agent_end")` reads the agreed text
(`lastAssistantText(event.messages)`, the `dev-pipeline` helper — copied), appends it as that
node's `output`, persists, restores the user's model/tools (§10), and calls `continueRun(state)`
again. The on-disk state machine is the single source of truth across the suspend/resume
boundary, so it survives both `agent_end` and full cancellation.

### 9.2 Concurrency rules (from the review)

- **AI-`ask` is a wave barrier:** it never shares a wave with subprocess nodes (subprocess
  nodes are drained first) and **at most one AI-`ask` runs at a time** — because there is one
  main agent / one conversation, two simultaneous delegated interactions would interleave into
  a single turn. If the DAG makes two AI-`ask` nodes ready at once, they are serialized in
  deterministic id order across successive suspensions.
- Self-contained nodes keep the original semantics: **parallel within a wave, sequential across
  waves**, failed dependencies skip dependents transitively.

## 10. Node execution by action

- **bash** — `exec` the exact `command`; `output` = stdout (truncated); non-zero exit → `failed`.
- **flag** — spawn `pi -p --mode json --no-session "<flag> <args>"`. The flag's owning
  extension intercepts it headlessly (e.g. `--hello` → "world"), exactly as `hello.ts`
  documents for nested use. `--no-session` keeps it from littering the sessions dir. `output` =
  the captured custom-message content. No main-LLM turn.
- **ask, `aiAssisted: false`** — the engine (which has UI) renders the authored `questions`
  via the `ask_user_question` form in the **main UI**, awaits the user's answer, and sets
  `output` = the formatted answers. No LLM, no tokens, no suspension (it is awaitable, §9).
- **ask, `aiAssisted: true`** — **delegated to the main agent (event-driven, §9).** The engine:
  1. `captureDefaults` (save the user's current model + active tools), then `setModel` +
     `setActiveTools([... , "ask_user_question"])` for the interaction.
  2. Resolve `$refs` into the node's `prompt` (the *why*), inject a hidden context marker, and
     `sendUserMessage(prompt)` to trigger a turn — instruction: *loop `ask_user_question`
     (assumptions + adaptive questions, each round including a "proceed?" gate) until you have
     no more doubts OR the user selects "proceed"; then state the agreed decisions.* Then
     **return** (the run suspends).
  3. On `agent_end`, take the agreed text as `output`, append+persist, **`restoreDefaults`**
     (put the user's model + tools back), and call `continueRun` (§9).
  - **Termination is "either OK":** the loop ends as soon as the LLM sets `done` OR the user
    picks "proceed" — whichever comes first.
  - A `pi.on("context")` filter trims the main window to messages after the marker during the
    interaction (the `dev-pipeline` technique), so the delegation stays lean.
- **llm** — spawn an isolated `pi` (`--mode json -p --no-session --thinking <variant>
  --append-system-prompt <instructions>` + resolved prompt) with `DADDY_NODE=1`. In that mode
  the daddy extension registers **only** `append_node` and **installs no `input` handler** (so
  a node prompt that happens to contain `--daddy-*` text cannot re-trigger anything). `output` =
  the result committed via `append_node`.

## 11. Validation rules (before any node runs)

- Unique `id` across the whole flow.
- No self-dependency; no cycles (DAG).
- Every `depends_on` target exists.
- Every `$node.output` reference targets an existing node the referrer transitively depends on.
- Field requirements per action: `bash` → `command`; `flag` → `flag`; `llm` → `provider`,
  `model`, `variant`, `prompt`; `ask` → `prompt` when `aiAssisted: true`, else `questions`.
- `aiAssisted` consistency: must be `false` for `bash`/`flag`, `true` for `llm`, free for `ask`.
- Workflow `name` is a single token (no spaces) so manual flag parsing (§12.3) is unambiguous;
  it is also the persisted file name (§12.1).
- AI-`ask` serialization: it is legal for the DAG to make several AI-`ask` nodes ready at once,
  but the engine runs them one at a time (§9.2). Validation only warns if it detects this so
  the author knows they will be serialized.

## 12. Persistence, resume, and the flag surface

### 12.1 Persistence

State is written to the current project's session folder, **keyed by workflow name** (not by
session id) so a resume survives a pi restart:

```
~/.config/pi/agent/sessions/<cwd-encoded>/<workflow-name>.daddy.json
```

- `<cwd-encoded>` directory is obtained from **`ctx.sessionManager.getSessionDir()`** (the real
  pi API), NOT by re-implementing pi's `/`→`-` encoding by hand — so it cannot drift if pi
  changes the scheme. (The observed convention is `--Users-hugoruiz-.config-pi--`, but we do not
  hard-code it.)
- `<workflow-name>` = the workflow's `name`. Because the file is named by workflow (not by the
  ephemeral session id), re-invoking `--daddy-workflow <name>` from any later session finds it.
- Written **after each node commit** (each `append_node` / deterministic node completion), not
  only after each wave — so a cancel mid-wave preserves every node that already committed.
- **Atomic writes:** write to `<workflow-name>.daddy.json.tmp` then `rename()` over the real
  file (atomic on the same filesystem). A SIGKILL mid-write therefore never truncates the state
  file, which the whole resume feature depends on.
- **Concurrent-run guard:** the state carries a `pid` + `heartbeat` timestamp. On start, if the
  existing file shows a `running` node with a live PID / recent heartbeat, daddy warns and
  refuses rather than letting two sessions in the same cwd corrupt one file (name-keying makes
  this collision possible; this is the accepted mitigation).

### 12.2 Resume semantics (node is atomic)

The node is the atomic unit of progress. A node commits its `output` only at its final step
(an `llm` node via `append_node`; a deterministic node when it finishes). Therefore:

- On `--daddy-workflow <name>` (no `--daddy-fresh`), if a state file exists with pending work,
  the engine **auto-resumes**: only `ok` nodes are kept and skipped. Any node left `running`
  (started but never committed) **and** any node that committed `failed` is reset to `pending`
  and **re-runs from the start** — a resume is an explicit "try again." There is no intra-node
  checkpoint — partial work inside an interrupted node is lost and redone.
- `--daddy-fresh` discards the persisted state and runs from the beginning.

> **GOTCHA (no intra-node idempotency):** because an interrupted node re-runs whole, a `bash`
> node with external side effects (e.g. `git commit`, `rm`, a paid API call) executes again on
> resume. Pure commands (`bun test`) are fine; side-effecting commands should be written to be
> idempotent or split so the irreversible part is its own small node.

### 12.3 Flag surface

The flag is for **execution**; the panel (double-press `←`) is for **design**.

| Invocation | Behavior |
|---|---|
| `--daddy-workflow <name>` | **Execute** (default). Auto-resume if an incomplete run exists, else run from the start. If `<name>.yaml` does not exist, open the panel to create it. |
| `--daddy-workflow <name> --daddy-fresh` | Execute from scratch, discarding prior state. |
| `--daddy-workflow <name> --daddy-design` | Jump straight into the panel **editing** that workflow (convenience shortcut). |
| `--daddy-workflow` (no name) | Open the panel's workflow picker (list / new). |
| Double-press `←` (no flag) | Open the panel (design / monitor), as for the `subagent` panel. |

Design notes:
- **Execution is the default** (you design once, run many times); there is no `--exec` (YAGNI).
- Modifiers are **namespaced** (`--daddy-fresh`, `--daddy-design`) because pi cannot enumerate
  flags, so a bare `--design`/`--fresh` could collide with another extension.
- All three flags (`daddy-workflow`, `daddy-design`, `daddy-fresh`) are registered for `--help`
  and announced on the `flag:registered` bus for autocomplete; the actual parsing is manual in
  the `input` handler (the `hello` pattern).

## 13. The panel (designer + live viewer)

A master-detail overlay, opened by double-pressing the trigger key (`←` by default) **only**
when the editor is empty — identical gating to the `subagent` panel (a raw-input watcher, not
`registerShortcut`, because arrows are reserved). Two modes:

**Design mode**
- Left: the `VSM > SIPOC > node` tree.
- Right: a detail form for the selected element. For a node: `action` selector, an
  `aiAssisted` toggle (enabled only for `ask`), action-specific fields, a `depends_on`
  multi-select of upstream nodes, `provides`, and (for `llm`) an optional `output_schema`.
- Keys: add VSM / SIPOC / node, edit, delete, connect (set `depends_on`), and — when a
  dependency is added to an LLM node — a key to insert `$dep.output` into its prompt.
- Save writes the YAML file.

**Run mode** (during `--daddy-workflow`)
- Same layout; left list shows per-node status markers (`* running, + ok, x failed,
  - skipped, . pending`) read from the state machine; right pane tails the active subagent's
  streamed log. The `ask` form surfaces here (or via the main UI for the delegated case).

## 14. Module layout (single responsibility per file)

```
daddy/
  index.ts            # registerFlag + input interception + agent_end dispatcher + context
                      #   filter + panel trigger; DADDY_NODE branch (child: append_node only,
                      #   NO input handler)
  schema.ts           # TypeBox: workflow definition + append_node parameter schema
  types.ts            # shared types (Action, Status, Node, StateMachine, …)
  lib/
    load-workflow.ts  # resolve <name> → parse + normalize YAML
    validate.ts       # graph + reference + per-action field validation (§11)
    driver.ts         # continueRun: re-entrant wave driver (§9); resume from agent_end
    run-node.ts       # dispatch self-contained nodes by action
    run-llm-node.ts   # spawn isolated child + append_node capture (hello pattern)
    run-flag-node.ts  # spawn headless flag invocation (--no-session) + capture
    run-bash-node.ts  # exec exact command
    run-ask-node.ts   # authored form (engine UI, awaitable)
    delegate-ask.ts   # AI-ask: capture/restore model+tools, marker + sendUserMessage (§10)
    resolve-refs.ts   # substitute $node.output / $ARGUMENTS into prompt/context
    append-tool.ts    # the append_node tool (child only); per-node output validation + retry cap
    state-store.ts    # build / merge / atomic-persist (tmp+rename) / load; getSessionDir path
    semaphore.ts      # bounded concurrency (intentional copy of subagent's; no import)
  panel/
    trigger.ts open.ts view.ts layout.ts design-render.ts run-render.ts editor.ts
  config.yml          # keymap + theme (Tokyo Night defaults)
  package.json tsconfig.json
  tests/              # pure-logic unit tests
```

## 15. Testing strategy

Pure-logic units, no SDK, runnable with `bun test`:
- `driver`: ready-set selection per wave, parallel set vs. AI-`ask` partition, AI-`ask` is a
  barrier (never shares a wave; one at a time), skip propagation, suspend/resume re-entry
  (calling `continueRun` again after an injected `agent_end` result advances correctly),
  completion.
- `validate`: cycles, unknown deps, unknown `$refs`, missing per-action fields, `aiAssisted`
  consistency, single-token name.
- `resolve-refs`: substitution of `$node.output` and `$ARGUMENTS`, unknown-ref error.
- `state-store`: merge a node result, atomic persist/reload round-trip, resume (keep `ok`,
  reset `running` AND `failed` → `pending`), `--daddy-fresh` discards prior state, corrupted
  `.tmp` left over does not clobber the real file.
- `editor`: add/connect/delete operations on the tree (no rendering).
- `append-tool`: accepts a valid node result, rejects mismatched `node_id` and `output_schema`
  violations, and fails the node after the retry cap.

## 16. Phasing

- **Phase 1 (MVP):** flag interception, load + validate, wave engine, the deterministic actions
  (`bash`, `flag`, `ask` with `aiAssisted:false`), `llm` nodes with the `append_node` gate,
  persistence, and the **run-mode** panel (read-only live view).
- **Phase 2:** the `ask` action with `aiAssisted:true` (event-driven main-agent delegation +
  the "either OK" loop), then the **design-mode** panel editor (interactive authoring).

Rationale: the engine + deterministic nodes + plain LLM nodes deliver the token-saving value
first. The AI-assisted interactive node carries the only event-driven (`agent_end`) control
flow, so it lands as its own phase once the simpler regime is proven. Flows can be authored by
hand in YAML meanwhile.

## 17. Open assumptions and resolved findings

**Resolved by the adversarial review (no longer open):**
- The `append_node` retry mechanism is **verified** against pi's agent loop (§8).
- The `ask`+`aiAssisted` delegation must be **event-driven via `agent_end`**, not a synchronous
  `waitForIdle` (which is not on the `input` handler's context). §9–§10 reflect this; the
  pattern is copied (not imported) from `dev-pipeline`.

**Still open / accepted for v1:**
1. `provides` is documentation-only (read by no execution path); keep it labeled as such or cut.
2. `output_schema` uses a JSON-Schema subset compiled to a TypeBox validator at child startup.
3. Workflows are project-local (`.pi/daddy/workflows/`); no global directory in v1.
4. `flag` nodes do not receive injected `$refs` in v1 (deterministic args only) — confirm the
   `flag` action earns its place in the MVP given this limitation.
5. The concurrent-run guard (§12.1) is best-effort (PID/heartbeat), not a hard lock.
