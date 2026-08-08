# Shell Preprocessing

## Embedded Shell Syntax

Inside a custom command template:

```md
Current status:

!`git status --short`
```

OpenCode executes the shell fragment before sending the prompt to the model and
replaces the complete `!` expression with its textual output.

This differs from a normal prompt that merely says:

```text
Run git status.
```

The first is automatic preprocessing. The second asks the model to decide
whether and how to use a tool.

## Direct TUI Bash

At the beginning of a TUI message:

```text
!git status
```

This runs a user shell command and adds its output to the conversation as a tool
result. It is related but not identical to `!` embedded in command templates.

## Arguments Are Expanded First

Template:

```md
!`jq -e . "$1"`
```

Invocation:

```text
/validate output.json
```

Executed shell:

```bash
jq -e . "output.json"
```

This ordering was confirmed by source inspection and live artifact tests.

## Multiple Shell Blocks Are Concurrent

Current implementation collects all embedded shell matches and launches them
with `Promise.all`.

```md
Result A: !`command-a`
Result B: !`command-b`
```

Consequences:

- Both commands can run at the same time.
- They execute in separate shell processes.
- Variables assigned by one are not available in the other.
- Result B cannot consume Result A as a variable.
- A filesystem dependency between them creates a race.
- Outputs are inserted back into their original template positions after all
  executions settle, regardless of which process finishes first.

This does not work as a dependency:

```md
A: !`A=$(command-a); printf '%s' "$A"`
B: !`command-b "$A"`
```

`$A` in the second process is unrelated to the first process.

## Dependent Operations Belong Together

Use one shell fragment:

```md
!`A=$(command-a) && command-b "$A"`
```

To preserve both outputs:

```md
!`A=$(command-a); printf 'A:\n%s\nB:\n' "$A"; command-b "$A"`
```

For substantial logic, call one script:

```md
!`bash .opencode/scripts/orchestrate.sh "$1" "$2"`
```

One script provides sequential control flow, functions, traps, temporary
variables, status checks, and understandable error handling.

## Working Directory And Environment

Documentation states command shell fragments run from the project root. Live
tests created files in the OpenCode project's root directory.

The result still depends on:

- Current files and Git state
- Environment variables
- Installed executables
- Network and external services
- Clock and random values
- Concurrent processes

The preprocessing mechanism is defined. That does not make every command's
output deterministic.

## Exit Status And Output

Current source invokes embedded commands in a non-throwing mode and inserts the
captured text. Do not assume a failed shell command automatically stops the
entire workflow in every version.

Make failure explicit in an orchestration script:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

Validate required output before returning:

```bash
test -f output.json
jq -e . output.json >/dev/null
```

Redirect stderr when it must become prompt context:

```md
!`npm test 2>&1`
```

## Multi-Line Fragments And Backticks

The current matcher captures characters until the next backtick. Newlines can
occur inside the capture, but nested backticks terminate it and make templates
fragile. Prefer a script file for anything longer than a short pipeline.

## Shell Side Effects

An embedded shell can both return prompt text and modify the filesystem:

```md
!`printf '{"status":"ready"}\n' > input.json; jq -c . input.json`
```

The prompt receives the compact JSON, and `input.json` remains as a durable
artifact. This dual behavior enabled the command chains and ghost command test.
