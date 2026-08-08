# Models And CLI Behavior

## Command Frontmatter Override

```yaml
---
description: Specialized follow-up
model: openai/gpt-5.6-luna
---
```

The `model` field uses `provider/model` format.
Daddy validates every configured model against a strict shell-safe
`provider/model` identifier pattern before typing it into a Herdr pane.

Current source selection order for a command is effectively:

```text
1. model declared by the command
2. model declared by the command's configured agent
3. model supplied by the invocation/session input
4. current session model
```

Therefore a TUI started with GPT-5.5 can execute a command forced to GPT-5.6
Luna. The override applies to that command; it does not mean every subsequent
ordinary prompt permanently changes model.

## Start The TUI With A Model

Verified in an interactive Herdr pane:

```bash
oc --model openai/gpt-5.5
```

The TUI displayed:

```text
Build auto · GPT-5.5 OpenAI
```

The local alias was:

```bash
alias oc='opencode --auto'
```

Thus the real expansion was:

```bash
opencode --auto --model openai/gpt-5.5
```

On a plain `oc` startup, the initial TUI could display an automatically selected
model label. Later slash-command execution displayed the model actually chosen
for that command. Use the execution footer and command configuration as
evidence, not only the initial empty-screen label.

The OpenCode help labels `--auto` as dangerous because it auto-approves
permissions that are not explicitly denied. Use it only in a controlled
workspace with appropriate permission rules.

## Help

Verified:

```bash
oc --help
```

It displayed the OpenCode command list and global options, including:

```text
opencode models [provider]
-m, --model
--auto
```

An output wait looking for `Usage:` timed out because this version's help uses
the heading `Commands:`. Match actual output, not an assumed heading.

## List Models By Provider

Verified working form:

```bash
opencode models openai
```

Observed models:

```text
openai/gpt-5.3-codex-spark
openai/gpt-5.4
openai/gpt-5.4-fast
openai/gpt-5.4-mini
openai/gpt-5.4-mini-fast
openai/gpt-5.5
openai/gpt-5.5-fast
openai/gpt-5.6-luna
openai/gpt-5.6-luna-fast
openai/gpt-5.6-sol
openai/gpt-5.6-sol-fast
openai/gpt-5.6-terra
openai/gpt-5.6-terra-fast
```

## Current `oc models` Caveat

With the current alias:

```bash
alias oc='opencode --auto'
```

This command:

```bash
oc models openai
```

expands to:

```bash
opencode --auto models openai
```

In the live test it printed OpenCode help instead of listing models. Therefore
`oc models openai` is not valid with this exact alias and OpenCode version.

Options:

```bash
opencode models openai
```

Or redefine the alias without injecting `--auto`:

```bash
alias oc=opencode
```

Then request auto approval only when opening a controlled TUI:

```bash
oc --auto --model openai/gpt-5.5
```

## Alias Availability

The alias existed inside the interactive Herdr shell but not in the
non-interactive execution environment used for direct Bash tool calls.

Reliable automation should either:

- Invoke the `opencode` executable directly.
- Explicitly launch a shell that loads the expected aliases.
- Verify with `type oc` before depending on the alias.
