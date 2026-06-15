# llm-guardrails

Watches files changed during a pi session and warns the LLM when it writes lint, type, runtime, or compiler suppression directives.

The extension does not edit files and does not block writes in v1. `strict` mode currently behaves like `warn`; blocking is future work.

## Configuration

Edit `config.yml` to change mode, watch globs, cooldowns, built-in rule toggles, or custom rules.

Supported modes:

- `warn`: scan changed files and send a follow-up warning to the LLM.
- `strict`: same as `warn` in v1.
- `off`: load the extension but do not watch or register rules.

Custom rules use this shape:

```yaml
custom_rules:
  - id: "no-todo-comments"
    name: "No TODO comments"
    filePatterns: ["**/*.ts"]
    patterns: ["//\\s*TODO", "//\\s*FIXME"]
    message: "Resolve the TODO at line {line}; do not leave it for later."
    severity: "warning"
```

## Testing

Run from this directory:

```bash
bun install
bun test
bun run typecheck
```
