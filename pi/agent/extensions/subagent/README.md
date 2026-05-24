# subagent

Registers a `subagent` tool that runs an **array of agents**, each in its own isolated
`pi` subprocess (`--mode json -p --no-session`). Per-agent `dependsOn` defines a
**dependency graph**: independent agents run in parallel; a dependent agent starts only
after its dependencies finish and receives their outputs as context.

## Parameters

`agents: AgentSpec[]` — at least one. Each `AgentSpec`:

| Field | Required | Maps to | Notes |
|-------|----------|---------|-------|
| `name` | yes | — | Unique id; referenced by other agents' `dependsOn`. |
| `instructions` | yes | `--append-system-prompt` | The agent's directive (its system prompt). |
| `provider` | yes | `--provider` | e.g. `github-copilot`, `anthropic`, `openai`. |
| `model` | yes | `--model` | Model id within the provider, e.g. `claude-sonnet-4.6`. |
| `variant` | yes | `--thinking` | Reasoning effort: `low` \| `medium` \| `high`. The caller decides it per agent. |
| `context` | no | user message | Supporting material. Pass ONLY when it adds value (token discipline). |
| `blockedTools` | no | `--tools` (inverted) | Denylist. Agent gets every main-agent tool MINUS these. `ask_user_question` is always blocked. |
| `dependsOn` | no | scheduling | Names of agents that must succeed first; their outputs feed this agent. |

> `pi` has no native block flag, so a blocklist is enforced by passing an allowlist of
> `(all available tools − blockedTools − ask_user_question)`. Every agent's system prompt
> also gets an explicit prohibition against asking the user questions.

## Execution

- Independent agents (no `dependsOn`) run concurrently, bounded to 4 at a time.
- A dependent agent's `dependsOn` outputs are prepended to its task as
  `## Result from dependency "<name>"`, followed by its own `context`.
- If any dependency does not succeed, the dependent is **skipped** (propagates transitively).
- The graph is validated up front: duplicate names, self-dependencies, unknown
  dependencies, and cycles are rejected before anything runs.

## Example call

```json
{
  "agents": [
    { "name": "scout", "provider": "github-copilot", "model": "claude-haiku-4-5",
      "variant": "low", "instructions": "Find the auth code and report file:line ranges." },
    { "name": "review", "provider": "github-copilot", "model": "claude-sonnet-4.6",
      "variant": "high", "dependsOn": ["scout"], "blockedTools": ["bash", "write", "edit"],
      "instructions": "Review the files reported by scout for security issues." }
  ]
}
```

`scout` runs first; `review` waits for it and receives its findings.

## Live panel

A master-detail overlay shows the subagents while they work. Open it by pressing the
trigger key **twice quickly** (default `←`), but ONLY when the editor is empty (you are
not typing) AND at least one subagent is running. Otherwise the key passes through
untouched (so `←` still moves the editor cursor normally while you type).

- Left list: the current run's agents with a status marker (`* running, + ok, x failed,
  - skipped, . pending`). Navigate with `↑`/`↓` or `k`/`j`.
- Right pane: the selected agent's streaming log (tool calls + text), tailing the newest
  output like the main screen.
- Close with `escape`, `q`, `h`, or `←`.

### config.yml

Behavior and colors are configurable in `config.yml` (next to this extension); restart
pi to apply. Omit `theme` (or any single color) to use the Tokyo Night defaults.

```yaml
keymap:
  trigger: { key: left, windowMs: 300 }   # double-press of `key` within windowMs
  nav:
    up: [up, k]
    down: [down, j]
    close: [escape, q, h, left]
# theme:                  # optional; omitted values fall back to Tokyo Night
#   panelBg: "#16161e"
#   selectedBg: "#292e42"
#   blue: "#7aa2f7"
```

Panel colors default to the official Tokyo Night palette
(`agent/themes/tokyo-night.json`) and render over an opaque background.

**Why a raw-input watcher and not a shortcut:** `registerShortcut("left")` is rejected by
pi (arrows are reserved editor keybindings). `ctx.ui.onTerminalInput` lets us *conditionally*
consume the key, so the gesture never breaks normal cursor movement.

**Design split:** subagent run state is a small state machine we own (`lib/store.ts`);
"is there a conversation" is queried from pi's `sessionManager` (`lib/gate.ts`) so it can
never drift on fork/switch/resume/compaction.

## Tests

```bash
bun test        # graph scheduling + double-press + keymap + store + layout (pure logic)
tsc --noEmit    # type check
```
