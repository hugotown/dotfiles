# Custom Commands And Arguments

## Definition Locations

Project-local command:

```text
.opencode/commands/example.md
```

Global command:

```text
~/.config/opencode/commands/example.md
```

The file name becomes the slash command:

```text
example.md -> /example
```

A command can also be configured under `command` in `opencode.json`, but
Markdown files are convenient for dynamic creation and multi-line prompts.

Equivalent JSON configuration:

```json
{
  "command": {
    "review": {
      "template": "Review $1 and write the result to $2.",
      "description": "Review an input",
      "agent": "build",
      "model": "openai/gpt-5.6-luna",
      "subtask": false
    }
  }
}
```

Custom commands can override built-in slash command names. Avoid collisions
unless replacing the built-in behavior is intentional.

## Frontmatter

```md
---
description: Review a component
agent: build
model: openai/gpt-5.6-luna
subtask: false
---

Review $1 and write the result to $2.
```

Relevant fields:

| Field | Meaning |
| --- | --- |
| `description` | Label shown in command discovery/autocomplete |
| `agent` | Agent that executes the expanded prompt |
| `model` | Model override in `provider/model` format |
| `subtask` | Forces or disables subagent execution behavior |

The Markdown body is the prompt template.

If `agent` names an agent configured as a subagent, OpenCode invokes it as a
subtask by default. `subtask: false` disables that default. `subtask: true`
forces subtask execution even when the selected agent is configured as primary.
Without `agent`, the command uses the current agent.

## Complete Argument String

`$ARGUMENTS` is replaced with everything entered after the command name.

Template:

```md
Create a component named $ARGUMENTS.
```

Invocation:

```text
/component User Profile Card
```

Expanded text:

```text
Create a component named User Profile Card.
```

In the current implementation, `$ARGUMENTS` uses the original argument string,
including quoting typed by the user.

## Positional Arguments

Supported placeholders are `$1`, `$2`, `$3`, and so on.

```md
File: $1
Directory: $2
Content: $3
```

```text
/create-file config.json src "configuration value"
```

Conceptual result:

```text
$1 = config.json
$2 = src
$3 = configuration value
```

The parser recognizes simple single-quoted and double-quoted groups. It removes
the outer quote characters. It is not a general-purpose shell parser.

## Last Positional Placeholder

Source inspection showed an implementation detail: the highest positional
placeholder present in the template receives that position and all remaining
arguments joined by spaces.

If a template contains only `$1`:

```text
/example alpha beta gamma
```

`$1` can become:

```text
alpha beta gamma
```

If the template contains `$1` and `$2`, `$2` is the highest placeholder and can
receive the remainder. Do not depend on this subtly when quoting explicit
arguments is clearer.

## Unsupported Names

These are not separate placeholders:

```text
$ARGUMENTS_1
$ARGUMENTS_2
```

OpenCode performs a textual replacement of the `$ARGUMENTS` substring. Thus:

```text
$ARGUMENTS_1
```

can become:

```text
alpha beta_1
```

Use `$1` and `$2` instead.

## Missing Placeholders

Current implementation behavior: if arguments were supplied but the command
template contains neither positional placeholders nor `$ARGUMENTS`, OpenCode
appends the argument string to the prompt.

Prefer explicit placeholders. They document intent and avoid relying on this
fallback.

## Expansion Order

The verified order is:

```text
1. Parse positional arguments
2. Replace $1, $2, ...
3. Replace $ARGUMENTS
4. Execute !`shell` fragments
5. Insert shell output
6. Resolve @file references
7. Send the prompt to the model/agent
```

Therefore this works:

```md
Changes for $1:

!`git diff -- "$1"`
```

The `$1` value is in the shell command before the shell starts.

## Arguments Intended For A Generated Command

Be careful when one command generates another command. Any literal `$1` in the
creator's template is expanded by the creator before its shell runs, even if it
appears inside shell quotes.

Do not write this in a creator when the generated file must retain `$1`:

```md
!`printf '%s\n' 'Process $1' > .opencode/commands/generated.md`
```

The creator sees `$1` first.

Generate the dollar sign indirectly, or design the generated command around a
known artifact path:

```bash
printf 'Process $%s\n' 1 > .opencode/commands/generated.md
```

Using artifact paths is usually simpler and safer than forwarding arbitrary
argument strings through multiple parsers.
