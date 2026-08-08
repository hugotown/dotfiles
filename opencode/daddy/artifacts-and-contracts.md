# Artifacts And Output Contracts

## Why Files Matter

Prompt output is conversational context. Files are persistent coordination
state that can be consumed by:

- A later slash command
- Another OpenCode process
- A deterministic shell validator
- A Herdr orchestration script
- A human or external system

This makes files the practical contract between independent command stages.

## Three Ways To Consume A Prior Artifact

Automatic file reference:

```md
Read @artifacts/output.json and continue.
```

Deterministic shell insertion:

```md
Validated artifact:

!`jq -e -c . artifacts/output.json`
```

Agent-directed read:

```md
Read `artifacts/output.json`, validate it, and continue.
```

The first two prepare context before model reasoning. The third depends on agent
tool use and permissions.

## Shell Then File Reference

Current processing runs embedded shell expansion before resolving `@file`
references. A shell can therefore create a file that is referenced later in the
same expanded template, provided the reference path is static and the shell has
completed successfully.

Do not split creation and consumption across two `!` fragments because those
fragments are concurrent.

## A Minimal Contract

```json
{
  "schema_version": 1,
  "run_id": "20260726-001",
  "status": "success",
  "producer": "analysis-command",
  "payload": {},
  "errors": []
}
```

Recommended fields:

| Field | Purpose |
| --- | --- |
| `schema_version` | Allows intentional format evolution |
| `run_id` | Prevents cross-run confusion |
| `status` | Explicit success or failure state |
| `producer` | Identifies the responsible command |
| `payload` | Domain-specific output |
| `errors` | Machine-readable failure details |

## Require Exact Output

Tell the agent all of the following:

1. Exact output path.
2. Exact required fields.
3. Allowed values and types.
4. Whether extra fields are allowed.
5. Whether existing output may be overwritten.
6. The validator to run before completion.

Example prompt fragment:

```md
Write `artifacts/result.json` with exactly these fields:

- `status`: `success` or `failure`
- `summary`: string
- `findings`: array

Run `jq -e . artifacts/result.json` before finishing. Do not finish until the
file exists and validation passes.
```

## Independent Validation

The model saying "validated" is weaker than an external validator succeeding.

```bash
test -f artifacts/result.json
jq -e '.status and (.findings | type == "array")' artifacts/result.json >/dev/null
```

The orchestrator should perform this check before launching the next command.

## Completion Is Not Artifact Existence Alone

In the experiments, an artifact could appear before the agent finished its own
validation and final response. Therefore:

```text
artifact exists != agent is idle
```

Use both conditions when possible:

```text
1. Artifact exists and validates
2. Herdr reports the agent idle
```

If status detection is unavailable, validate the artifact and use another
observable completion marker written as the final operation.

## Avoid Cross-Run Races

Using one shared `output.json` is unsafe when commands overlap. Prefer:

```text
.artifacts/<run-id>/input.json
.artifacts/<run-id>/output.json
.artifacts/<run-id>/complete
```

Write to a temporary path and rename atomically after validation:

```bash
jq -n --arg status success '{status: $status}' > "$run/output.tmp"
jq -e . "$run/output.tmp" >/dev/null
mv "$run/output.tmp" "$run/output.json"
touch "$run/complete"
```
