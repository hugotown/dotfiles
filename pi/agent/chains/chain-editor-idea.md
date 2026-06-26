# Idea: Chain JSON Editor for Pi

## Goal

Build a Pi extension that opens an interactive editor/panel for `.chain.json` files, so editing saved subagent chains is safer and less awkward than manually editing raw JSON.

## Command

```text
/chain-edit plan-build-review-repair
/chain-edit /absolute/path/to/file.chain.json
```

## MVP

- Open a TUI panel/editor for the selected `.chain.json`.
- Validate JSON structure while editing.
- Show validation errors in a side panel.
- Save only when the file is valid.
- Support cancel without writing changes.
- Support format/prettify JSON.

## Desired Panel Layout

```text
┌ Chain: plan-build-review-repair ───────────────┬ Validation ─────────────┐
│ {                                              │ ✓ JSON valid             │
│   "name": "...",                             │ ✓ chain[0].as unique     │
│   "chain": [ ... ]                            │ ✗ chain[3]: outputs.foo  │
│ }                                              │                          │
├────────────────────────────────────────────────┴──────────────────────────┤
│ Ctrl+S save • Ctrl+R reload • Ctrl+F format • Esc cancel                  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Validation Rules

- JSON parses successfully.
- Top-level object has expected fields:
  - `name`
  - `description`
  - `chain[]`
- Each step is one of:
  - normal agent step: `agent`, `task`
  - static parallel step: `parallel`
  - dynamic fanout step: `expand`, `parallel`, `collect`
- `as` names are unique.
- `{outputs.name}` references point to prior steps.
- `expand.from.output` points to a prior structured output.
- `expand.maxItems` exists.
- `reads` paths exist on disk.
- `outputSchema` is valid enough for structured output use.
- Agent names exist in discovered subagents.
- Dynamic fanout is not nested.

## Suggested Extension Structure

```text
~/.pi/agent/extensions/chain-editor/
  index.ts
  validator.ts
  ChainEditorPanel.ts
```

## Implementation Notes

- Use `pi.registerCommand("chain-edit", ...)`.
- Resolve a chain by name from `~/.pi/agent/chains/**/*.chain.json` and project `.pi/chains/**/*.chain.json`.
- Use `ctx.ui.custom()` for the full panel version.
- A simpler first version can use `ctx.ui.editor()` plus validation after edit.
- Prefer live validation with debounce in the panel version.
- Keep writes atomic: write to temp file, validate, then rename.

## Future Enhancements

- Step tree view.
- Add/remove/reorder steps from UI.
- Autocomplete known agents.
- Autocomplete `{outputs.name}` references.
- Open external `reads` task files from the editor.
- Explain validation errors with suggested fixes.
