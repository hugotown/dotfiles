# Ghost Commands Created At Runtime

## Definition

A ghost command is a command Markdown file that does not exist when a creator
OpenCode process starts. An embedded shell creates it at runtime, and a newly
started OpenCode process discovers and executes it.

```text
OpenCode A starts
  -> /summon-ghost exists
  -> /new-command does not exist
  -> /summon-ghost shell writes new-command.md
  -> OpenCode A finishes

OpenCode B starts later
  -> scans .opencode/commands
  -> discovers /new-command
  -> executes it with its own frontmatter model
```

Starting a new process is the verified and reliable discovery boundary. Do not
assume a running process hot-reloads its command registry.

## Creator Command

```md
---
description: Materialize a command that did not exist at startup
---

Create the ghost command:

!`mkdir -p .opencode/commands; printf '%s\n' '---' 'description: Perform a Luna-only follow-up' 'model: openai/gpt-5.6-luna' '---' '' 'Read @output-contract.json.' '' 'Create ghost-artifact.json with the required result and validate it.' > .opencode/commands/new-command.md; printf 'created=%s\nmodel=%s\n' '.opencode/commands/new-command.md' 'openai/gpt-5.6-luna'`

Confirm only that the command file was created.
```

For maintainability, a real workflow should render from a checked-in template
or script rather than place a long Markdown document inside one shell line.

## Generated Command

The live generated file contained:

```md
---
description: Perform a Luna-only follow-up on the prior artifact
model: openai/gpt-5.6-luna
---

Read @output-contract.json.

Create ghost-artifact.json in the project root as valid JSON with exactly these
fields:

- source_name: copy name from the source artifact
- source_value: copy value from the source artifact
- activity: one concise, original observation about this dynamic command chain
- model_requested: openai/gpt-5.6-luna

Validate the JSON before finishing. Do not ask questions.
```

## Model Separation

The creator and ghost can intentionally use different models:

```text
/summon-ghost -> GPT-5.6 Sol creates the file
/new-command  -> GPT-5.6 Luna performs the follow-up
```

Putting `model: openai/gpt-5.6-luna` on the creator would force the creator to
Luna. Putting it on `new-command.md` forces the ghost execution to Luna. The
requirement determines which frontmatter should contain the override.

## Verified Evidence

Before creation:

```text
.opencode/commands/new-command.md -> absent
```

After `/summon-ghost`:

```yaml
model: openai/gpt-5.6-luna
```

After opening a new Herdr pane, launching `oc`, and executing `/new-command`,
the TUI displayed:

```text
Build auto · GPT-5.6 Luna OpenAI
```

The ghost created:

```json
{
  "source_name": "delta",
  "source_value": "epsilon zeta",
  "activity": "The chain carries a compact source payload through successive command stages.",
  "model_requested": "openai/gpt-5.6-luna"
}
```

## Important Traps

The creator's argument placeholders are expanded before its shell executes.
Avoid embedding a literal `$1` intended for the future command unless the
dollar sign is generated indirectly.

Command creation is a filesystem side effect. Validate the generated Markdown
before launching the next process:

```bash
test -f .opencode/commands/new-command.md
grep -F 'model: openai/gpt-5.6-luna' \
  .opencode/commands/new-command.md >/dev/null
```

Use unique command names or run directories when concurrent creators may race.
Treat dynamically generated command files as executable configuration: do not
construct them from untrusted text.
