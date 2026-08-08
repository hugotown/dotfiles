# Daddy Contracts

The normative structural definitions are in
[`schemas/contracts.schema.json`](schemas/contracts.schema.json). Runtime
validators also enforce semantic invariants that JSON Schema cannot express
concisely.

## General Rules

- All JSON contracts use `schema_version: 1`.
- Unknown fields are rejected for durable contracts.
- IDs and paths are data; they are never evaluated as shell fragments.
- Routing reads only a validated `outcome`.
- Every semantic input carries the immutable original request and cumulative
  prior context.
- The controller writes deterministic contracts. LLMs write only their declared
  node outputs.
- Every LLM output is written to a temporary file, validated, atomically renamed,
  and followed by a `complete` sentinel.

## Semantic Validation

The plan validator additionally enforces:

- Unique item IDs.
- Every dependency references an item in the same plan.
- No self-dependencies.
- No dependency cycles.
- Item count does not exceed `build.max_items`.
- Every item is reachable through dependency scheduling.
- Complexity maps to a configured worker model.

The preflight validator additionally enforces:

- `remote` is non-null exactly when `has_remote` is true.
- Explicit pull-request delivery requires the configured remote.
- The base branch exists locally or as a remote tracking branch.
- `base_sha` is the exact resolved commit used to create the integration
  branch; `starting_sha` is retained only as invocation evidence.
- `provisioning` contains exactly `strategy`, `program`, and `args`. It is an
  argv contract, not a shell string. `none` uses a null program and empty args.
- `environment_files` contains only validated repository-relative path names
  selected from ignored `.env` and `.env.*` files. It never contains file
  contents or environment values.
- A valid recognized `packageManager` declaration wins over lockfiles. Without
  one, lockfile precedence is `bun.lock`, `bun.lockb`, `pnpm-lock.yaml`,
  `yarn.lock`, then `package-lock.json`.

The worker validator additionally enforces:

- `item_id` equals the scheduled item.
- `node_id` equals the attempt's materialized node ID.
- Changed paths are relative and remain inside the worker worktree.
- Git changes are parsed from NUL-delimited porcelain output and every path must
  match an exact declared file or a declared directory prefix ending in `/`.
- The worker does not choose or report its own commit as authoritative; the
  controller inspects and commits the worktree after validation.

The verification validator additionally enforces:

- Every configured command has exactly one result in original order.
- `success` requires every exit code to be zero.
- Exit codes 126 and 127 yield infrastructure `blocked`; other non-zero exit
  codes yield engineering `failure` unless execution itself was blocked.
- A failure at issue depth 3 is converted deterministically to `max-depth`.
- The first plan's final commands are an immutable baseline. Repair plans may
  append commands; every later verification runs the stable de-duplicated union.
- Successful verification records the clean integration HEAD as
  `verified_commit`; delivery requires the same clean HEAD.

## Plan As Executable DAG Data

The plan's prose artifact explains the approach. The `items` array is the only
input to scheduling. Each item declares:

```text
id
title
objective
complexity: high | mid | low
depends_on: item IDs
acceptance_criteria
affected_paths
validation_commands
```

Array order is not execution order. The scheduler computes readiness from
dependencies and uses lexical item-ID order only as a stable tie-breaker.

## Artifact Ownership

| Contract | Writer | Consumer |
| --- | --- | --- |
| `request/request.json` | Controller before execution | Every semantic node |
| `preflight/preflight.json` | Controller | All later stages and ship |
| `preflight/integration-provisioning.json` | Controller | Infrastructure diagnosis |
| `nodes/<worker-node>/<attempt>/provisioning.json` | Controller | Worker retry and infrastructure diagnosis |
| `nodes/<worker-node>/<attempt>/item-validation.json` | Controller | Item validation infrastructure diagnosis |
| Intent output | Intent oc-harness | Controller router |
| Spec output | Spec oc-harness | Plan oc-harness |
| Plan output | Plan oc-harness | Parallel build scheduler |
| Worker output | Worker oc-harness | Controller integration join |
| Verification output | Controller | Router and issue RCA |
| RCA output | RCA oc-harness | Issue plan oc-harness |
| `state/run.json` | Controller | Parent orchestrator and operators |
| `events/events.jsonl` | Controller | Audit and recovery |
| `delivery/ship.json` | Controller | Parent orchestrator and user |
| `halted/halt.json` | Controller | Parent orchestrator and user |

The controller writes `delivery/pending.json` before external delivery or
cleanup and `halted/pending.json` before checkpointing or cleanup. Final
contracts are published only afterward. Halt contracts include recoverable
worker branch checkpoints as well as the integration checkpoint.

Provisioning evidence records copied environment file path names and statuses,
then the selected strategy, program, argv, cwd, raw
`stdout`, raw `stderr`, and `exitCode`. Successful commands also record the raw
tracked-only Git status result. Non-zero commands, Git status failures, and
tracked mutations are infrastructure blocks with the exact evidence retained.
Environment file evidence never records contents or values; copy and safety
failures are persisted as infrastructure blocks with controlled reasons.
Item validation exits 126 and 127 persist the command result in
`item-validation.json`; final validation persists the same classification in
the verification output. Neither class routes to issue RCA.
