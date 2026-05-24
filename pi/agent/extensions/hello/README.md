# hello

Typing `--hello` anywhere in a chat message short-circuits the main agent: the
message never reaches the main LLM. Instead the extension spawns an **isolated
`pi` subprocess** whose system prompt forces it to answer with exactly one word —
`world` — with thinking turned off and no tools, so it neither reasons nor acts.

The subagent's reply is then shown back in the session.

## Usage

```
--hello
--hello do whatever you want
```

Either way the answer is `world`.

## How it works

- `index.ts` — registers the `--hello` flag and an `input` event handler. When the
  text contains `--hello`, it strips the flag, runs the subagent, prints the
  result, and returns `{ action: "handled" }` so no main-agent turn is triggered.
- `subagent.ts` — re-spawns `pi` with
  `--mode json -p --no-session --thinking off --append-system-prompt <instruction>`,
  then parses the JSON stream for the final assistant text.

No `node_modules` is required: `pi` resolves `@earendil-works/*` imports from the
running binary via its extension loader aliases.
