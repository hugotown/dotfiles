# claude-cli (pi extension)

Spiritual sibling of `~/.config/opencode/plugins/claude-cli-provider.ts`, but
in-process instead of HTTP.

Exposes the local `claude` CLI as a Pi model provider so pi can route chat
completions through your Claude Code subscription instead of hitting the
Anthropic API directly with a key.

## What it does

- Registers a pi provider named `claude-local-cli` via `pi.registerProvider`,
  using `streamSimple` to call the `claude` CLI **in-process** — no HTTP
  server, no port, no localhost loopback.
- Each Pi turn spawns `claude -p <prompt> --model <id>
  --dangerously-skip-permissions --verbose --output-format stream-json`.
- The subprocess's JSONL stream is parsed as it arrives and translated into
  Pi's `AssistantMessageEvent` stream (`text_start` / `text_delta` /
  `text_end`, plus `thinking_*` for the CLI's reasoning blocks).
- Three models are registered: `claude-opus-4-7`, `claude-sonnet-4-6`,
  `claude-haiku-4-5-20251001`.

## Usage

```bash
pi --provider claude-local-cli --model claude-opus-4-7
pi --provider claude-local-cli --model claude-sonnet-4-6
pi --provider claude-local-cli --model claude-haiku-4-5-20251001
```

Or set as default in `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "claude-local-cli",
  "defaultModel": "claude-opus-4-7"
}
```

## Known tradeoffs (intentional, see source header)

- `--dangerously-skip-permissions` is on. The subprocess `claude` can run
  bash/edit/write inside `cwd` without confirmation.
- Pi's tool definitions are **not** forwarded to the CLI. The CLI runs its own
  internal tools (Bash/Edit/Read/...); surfacing them as Pi `toolCall` events
  would break Pi's round-trip contract.
- Messages are flattened to a single text prompt (claude `-p` is one-shot, no
  multi-turn structure preserved on the CLI side).
- Images in user messages are replaced with `[Image Omitted]`.

## Verify

After `/reload` (or starting pi fresh), select the provider/model and chat.
You should see text appear block-by-block as the CLI emits assistant events;
thinking blocks (if any) are surfaced as Pi `thinking_*` events.
