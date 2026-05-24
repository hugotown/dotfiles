# Extensions

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict)
- **Platform:** pi extension API (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`)

## Rules

### SOLID

- **S** — Single Responsibility: each file does ONE thing. Target 70 lines, max 120.
- **O** — Open/Closed: extend via events (`pi.events`), don't modify other extensions.
- **L** — Liskov: if it implements an interface, honor the full contract.
- **I** — Interface Segregation: don't force consumers to depend on methods they don't use.
- **D** — Dependency Inversion: depend on pi's API and events, never import from sibling extensions.

### DRY

- Don't repeat logic across extensions. If two extensions share a pattern, extract to a shared `lib/` within that extension or create a utility extension that exposes an event-based API.
- Within an extension, extract repeated code into `lib/` or `steps/` modules.

### Decoupling

- **Zero cross-extension imports.** Extensions MUST NOT import from each other.
- Communication between extensions is ONLY via `pi.events` (the shared event bus).
- Convention: emit `"<namespace>:<action>"` events (e.g. `"flag:registered"`).
- If an extension disappears, nothing else breaks.

### File size

- Target: **70 lines** per file.
- Max tolerance: **120 lines** (justified — e.g. a single cohesive component).
- If a file exceeds 120, split by responsibility.

### Structure

Single-file extensions go directly in `extensions/`:
```
extensions/flag-autocomplete.ts
```

Multi-file extensions use a directory with `index.ts`:
```
extensions/brainstorm-workflow/
├── index.ts          Entry point (wiring only)
├── orchestrator.ts   Shared state + helpers
├── handlers/         One file per phase/event
├── steps/            TUI interaction modules
├── lib/              Pure utilities (prompts, compression)
├── tools/            Custom tool definitions
├── types.ts          Shared interfaces
└── tests/            Unit tests
```

### Flag registration

Extensions that respond to `--xxx` tokens MUST:

1. Register the flag: `pi.registerFlag("name", { description, type })`
2. **Announce it on the bus, inside a `session_start` handler:**
   ```ts
   pi.on("session_start", () => {
     pi.events.emit("flag:registered", { token: "--name", description });
   });
   ```
   REQUIRED, not optional.
3. Handle their own input: `pi.on("input", ...)` returning `{ action: "handled" }`

**Why step 2 is mandatory:** pi exposes no API to enumerate flags, and `getFlag` only
reads the calling extension's own flags. The `flag:registered` event is the ONLY way other
extensions can discover your flag. Consumers today: `flag-autocomplete` (Tab-completion) and
`subagent` (warns the parent when a delegated agent's prompt contains a flag that will be
intercepted before its model runs). A flag that skips step 2 is invisible to both.

**Why `session_start` and not load time:** the event bus is a plain emitter with no replay
(`core/event-bus.js`), and extensions load sequentially. Emitting at load reaches only the
consumers that already loaded — a consumer loading later (alphabetical order: `subagent`
loads after `hello`) misses it. `session_start` fires once every extension is loaded and
subscribed, so the announcement is order-independent.

### Testing

- Use `bun test` for unit tests.
- Test pure logic (state machines, compression, spec assembly).
- TUI and LLM-driven steps are not unit-tested.
