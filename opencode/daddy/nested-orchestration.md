# Nested OpenCode Orchestration

## Proven Architecture

An embedded shell in a parent OpenCode command can synchronously orchestrate a
separate OpenCode process through Herdr:

```text
Parent slash command
  -> embedded !`bash orchestrator.sh ...`
  -> Herdr creates child workspace/pane
  -> child pane starts OpenCode
  -> child executes another slash command
  -> child writes and validates an artifact
  -> orchestrator returns compact output
  -> parent prompt receives that output
  -> parent model continues
```

Because the parent embedded shell waits for its process to finish, the parent
prompt is not sent to its model until child orchestration returns.

## Parent Command

```md
---
description: Run a child OpenCode command through Herdr
---

The child returned:

!`bash .opencode/scripts/run-child.sh "$1" "$2"`

Check the returned artifact summary and continue.
```

Use one embedded shell block. Multiple embedded blocks would run concurrently.

## Child Orchestrator Skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail

name=${1:?missing name}
value=${2:?missing value}
root=$(pwd)
pane=""

cleanup() {
  if test -n "$pane"; then
    herdr pane close "$pane" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

created=$(herdr workspace create \
  --cwd "$root" \
  --label nested-opencode \
  --no-focus)

pane=$(printf '%s' "$created" |
  jq -r '.result.root_pane.pane_id // empty')
test -n "$pane"

herdr pane send-text "$pane" oc
herdr pane send-keys "$pane" Enter

herdr wait output "$pane" \
  --match 'Ask anything' \
  --source visible \
  --lines 40 \
  --timeout 30000 >/dev/null

herdr pane send-text "$pane" "/produce $name \"$value\""
herdr pane send-keys "$pane" Enter

for _ in $(seq 1 300); do
  if test -f output-contract.json &&
     jq -e . output-contract.json >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

herdr wait agent-status "$pane" \
  --status idle \
  --timeout 300000

jq -e . output-contract.json >/dev/null
jq -c . output-contract.json
```

The skeleton intentionally leaves graceful `/exit` to cleanup policy. If a
graceful transcript-preserving exit is required, send `/exit`, account for
autocomplete, verify the process changed back to Bash, and then close the pane.

## Why The Original Immediate Exit Was Unsafe

This sequence is incorrect:

```bash
herdr pane send-text "$pane" "/other-command $ARGUMENTS"
herdr pane send-keys "$pane" Enter
herdr pane send-text "$pane" /exit
```

The second `send-text` does not wait for model reasoning, tool execution,
artifact writes, or validation. It can type into a busy TUI or exit too early.

Correct sequence:

```text
send command
-> confirm it actually executed
-> wait for valid artifact
-> wait for agent idle
-> request exit
-> verify process exit
-> close pane
```

## Safer Argument Transport

Forwarding raw `$ARGUMENTS` through Markdown expansion, shell parsing, Herdr,
and OpenCode argument parsing is fragile and unsafe for untrusted input.

Preferred design:

```text
Parent writes input JSON
-> child command receives one controlled artifact path
-> child reads JSON
```

Example:

```bash
jq -n \
  --arg name "$name" \
  --arg value "$value" \
  '{name: $name, value: $value}' > "$run/input.json"

herdr pane send-text "$pane" "/worker $run/input.json"
herdr pane send-keys "$pane" Enter
```

## Parent Receives Child Output

At the end of the child script:

```bash
printf 'child artifact: '
jq -c . output-contract.json
```

The embedded shell replaces itself with this output. The parent model receives
it as ordinary prompt context.

This behavior was verified with:

```json
{"name":"delta","value":"epsilon zeta","processed_by":"opencode"}
```
