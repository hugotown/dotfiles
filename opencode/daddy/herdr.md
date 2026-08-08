# Herdr Workspace And Pane Control

## Core Objects

Herdr manages persistent terminal UI objects:

| Object | Role |
| --- | --- |
| Workspace | Top-level isolated terminal workspace |
| Tab | Container within a workspace |
| Pane | Terminal process surface where commands are typed |
| Agent status | Detected/reported state such as idle or working |

The CLI returns JSON for creation and inspection commands, which makes it
suitable for shell orchestration.

Relevant command surfaces discovered through `--help`:

```text
herdr workspace list|create|get|focus|rename|close
herdr pane list|current|get|read|process-info|send-text|send-keys|run|close
herdr wait output|agent-status
herdr agent list|get|read|send|wait|start
```

Other Herdr areas exposed by the top-level help include worktrees, tabs,
sessions, notifications, integrations, configuration, API inspection, and
server lifecycle commands.

## Create A Workspace And Capture The Pane

```bash
created=$(herdr workspace create \
  --cwd "$CWD" \
  --label sdlc-brainstorm \
  --no-focus)

pane=$(printf '%s' "$created" |
  jq -r '.result.root_pane.pane_id // empty')

test -n "$pane"
```

The verified JSON path is:

```text
.result.root_pane.pane_id
```

## Start OpenCode

`send-text` writes literal input. `send-keys` sends terminal keys.

```bash
herdr pane send-text "$pane" oc
herdr pane send-keys "$pane" Enter
```

The shell in a Herdr pane was interactive and loaded this alias:

```text
oc is aliased to `opencode --auto'
```

Do not assume aliases exist in non-interactive scripts. `command -v oc` from a
non-interactive shell did not find it, while `type oc` inside the pane did.

## Wait For Startup

Avoid a fixed `sleep 25`:

```bash
herdr wait output "$pane" \
  --match 'Ask anything' \
  --source visible \
  --lines 40 \
  --timeout 30000
```

This waits for an observable TUI readiness marker.

## Execute A Slash Command

```bash
herdr pane send-text "$pane" '/produce alpha "beta gamma"'
herdr pane send-keys "$pane" Enter
```

Slash-command autocomplete can consume the first Enter by selecting the command
without executing it. This happened with `/summon-ghost`, `/new-command`, and
`/exit` in the live tests.

Inspect the pane before blindly sending more keys:

```bash
herdr pane read "$pane" \
  --source visible \
  --lines 40 \
  --format text
```

If the command is still visible in the input field, send another Enter:

```bash
herdr pane send-keys "$pane" Enter
```

## Wait For Completion

Verified working status wait:

```bash
herdr wait agent-status "$pane" \
  --status idle \
  --timeout 300000
```

An attempted wait for `done` timed out in one test, while waiting for `idle`
returned an `agent_status_changed` event. Use `idle` for this tested setup.

`herdr integration status` reported that the OpenCode integration plugin was
not installed in this environment, yet Herdr still detected an OpenCode agent
and emitted an `idle` event. Treat this as observed fallback detection, not a
guarantee for every installation.

Combine status with artifact validation:

```bash
for _ in $(seq 1 300); do
  if test -f output.json && jq -e . output.json >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

herdr wait agent-status "$pane" --status idle --timeout 300000
jq -e . output.json >/dev/null
```

## Inspect Process State

```bash
herdr pane process-info --pane "$pane"
```

The live response identified `opencode` as a foreground process and later
identified `/bin/bash` after OpenCode exited.

## `pane run` Versus Explicit Input

`herdr pane run` can type a command plus Enter, but a slash command may still be
left selected in OpenCode autocomplete. The most transparent pattern is:

```bash
herdr pane send-text "$pane" "$text"
herdr pane send-keys "$pane" Enter
```

Then inspect or wait for an observable state.

## Exit And Close

Only exit after the command is complete:

```bash
herdr pane send-text "$pane" /exit
herdr pane send-keys "$pane" Enter
sleep 1
herdr pane send-keys "$pane" Enter
```

Verify that OpenCode is gone before closing the pane:

```bash
info=$(herdr pane process-info --pane "$pane")

if ! printf '%s' "$info" |
  jq -e '.result.process_info.foreground_processes[]? |
         select(.name == "opencode")' >/dev/null; then
  herdr pane close "$pane"
fi
```

Use a trap so errors do not leak panes:

```bash
pane=""

cleanup() {
  if test -n "$pane"; then
    herdr pane close "$pane" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT
```

Close only the pane/workspace created by the orchestration. Never close an
unrelated user workspace.
