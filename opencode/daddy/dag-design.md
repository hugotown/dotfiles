# Daddy DAG Design

## Execution Model

Daddy is a deterministic controller around bounded LLM nodes. The configured
graph is a template. At runtime, issue recursion is expanded into distinct node
instances, so the materialized execution graph remains acyclic.

```text
request capture
  -> repository probe
  -> intent
     -> sdlc: spec-design -> plan -> parallel build/integrate -> verify
     -> issue: RCA -> plan -> parallel build/integrate -> verify
  -> verify success: ship
  -> verify failure: create issue child and run issue route
  -> issue verify failure below depth limit: create sub-issue
  -> issue verify failure at depth limit: halt
```

The controller, not an LLM, resolves transitions from validated outcomes using
`nodes.<node>.outcomes`. An edge that names a declared but unsupported semantic
ordering halts explicitly; it is never replaced by a hard-coded edge.

## Deterministic And LLM Boundaries

Controller operations:

- Parse and validate configuration.
- Allocate run IDs and artifact paths.
- Probe Git state, remotes, and base branch.
- Create and remove worktrees.
- Start, monitor, and close oc-harnesses.
- Validate contracts and sentinels.
- Execute configured verification commands.
- Enforce retries, deadlines, and issue depth.
- Resolve transitions from exact outcome strings.
- Commit, push, and open a pull request according to delivery policy.
- Persist state and terminal delivery or halt contracts.

LLM operations:

- Classify intent as `sdlc` or `issue`.
- Design a specification.
- Produce an implementation plan.
- Perform root cause analysis.
- Produce dependency-aware work-item plans.
- Build or repair one bounded work item in an isolated worker worktree.

An LLM may run tools inside its worktree, but it cannot select an undeclared
next node or declare deterministic verification successful.

## Node Protocol

Every node instance has a unique ID. Examples:

```text
intent
sdlc.spec-design
sdlc.plan
sdlc.build.<item-id>
sdlc.integrate.<item-id>
sdlc.verify
issue.1.rca
issue.1.plan
issue.1.build
issue.1.verify
issue.2.rca
```

Before execution, the controller writes `input.json` atomically. An LLM node is
given only absolute paths to its input and output contracts plus its explicit
instructions. It must write `output.json.tmp`, validate it, rename it to
`output.json`, then create `complete` as its last operation.

The controller accepts completion only when:

1. `output.json` exists.
2. The output validates against the node contract.
3. `complete` exists.
4. The oc-harness is idle when status detection is available.

Each common node output contains:

```json
{
  "schema_version": 1,
  "run_id": "run-id",
  "node_id": "issue.1.rca",
  "status": "success",
  "outcome": "success",
  "summary": "Concise result",
  "artifacts": []
}
```

Node-specific payloads are validated separately. Unknown fields and unknown
outcomes are rejected by default.

## State Machine

Run states:

```text
created -> preflight -> running -> shipping -> delivered
                                  -> halted
```

Node states:

```text
pending -> starting -> running -> validating -> succeeded
                                           -> failed
                                           -> timed_out
```

After every state transition, the controller atomically replaces
`state/run.json` and appends one event to `events/events.jsonl`. The state file
is the latest snapshot; the event stream is the ordered audit trail.

## Intent Route

The intent node has exactly these outcomes:

| Outcome | Next node |
| --- | --- |
| `sdlc` | `spec-design` |
| `issue` | `issue RCA` at depth 1 |
| `blocked` | terminal halt |

Features, greenfield work, refactors, documentation work, and other planned
changes use `sdlc`. Defects, regressions, and failing existing behavior use
`issue`. The classifier records both its route and concise evidence.

## SDLC Route

```text
spec-design -> plan -> build -> verify
```

`spec-design` and `plan` are LLM nodes. The plan emits a work-item DAG. `build`
is a deterministic composite scheduler that runs each work item in an LLM oc-harness,
bounded by `build.max_concurrency`. Every worker has its own branch and worktree.
The scheduler selects `worker_high`, `worker_mid`, or `worker_low` from the
item's declared complexity tier. Completed items are integrated serially into
the run branch, and their declared checks run before dependent items become
ready. Final `verify` executes the complete commands established in the plan
contract. Success routes to `ship`; failure creates an issue at depth 1 with
the command, exit code, and captured diagnostics as immutable input.

## Issue Route

```text
RCA -> plan -> build -> verify
```

RCA and plan are LLM nodes. Issue plans use the same parallel work-item scheduler
and worker tiers. Per-item integration and final verification are deterministic. Failure
creates a child issue with depth incremented by one. Depth values are 1, 2, and
3; another failure at depth 3 produces a terminal `max_issue_depth` halt.

A successful issue verification routes to the run-level `ship` node. The full
ancestry remains in issue contracts and events.

## Retry Policy

Process failures and semantic failures are different:

- Harness startup failure, malformed output, missing sentinel, and timeout are
  infrastructure failures. They use the configured node retry count.
- A valid `verify` result with failing commands is an engineering failure. It
  follows the issue edge and does not consume an infrastructure retry.
- Exhausted infrastructure retries halt the run with an exact reason.
- Validation exit codes 126 and 127 are infrastructure blocks for
  non-executable or missing tools. They halt instead of invoking issue RCA;
  other nonzero validation exits remain engineering failures.

Retries create a new attempt directory and never overwrite prior evidence.

## Repository And Worktree Policy

Preflight runs against the invocation repository and records:

- Repository root and starting SHA.
- Exact resolved `base_sha` used as the integration branch start point.
- Current branch.
- Whether `origin` exists.
- Base branch, resolved from explicit configuration, origin HEAD, or current
  branch in that order.
- Whether the worktree can be created safely.
- Dependency provisioning as an argv contract. A recognized `packageManager`
  declaration takes precedence; otherwise lockfiles are checked in the stable
  order Bun, pnpm, Yarn, then npm. The exact commands are `bun install
  --frozen-lockfile`, `pnpm install --frozen-lockfile`, `yarn install
  --immutable`, and `npm ci`. No recognized declaration or lockfile means
  `none`; the controller never guesses another command.
- Ignored project-local environment file paths discovered directly with
  `git ls-files --others --ignored --exclude-standard -z`. Only `.env` and
  `.env.*` basenames are selected, with example, sample, and template variants
  excluded. Preflight records relative path names only.

The controller creates one integration branch and worktree from `base_sha`. Every
parallel build item receives another branch and worktree based on the current
integration head. Worker branches and paths include issue depth, so repeated
item IDs cannot collide. Non-build LLM nodes use the integration worktree. A build
worker never shares a worktree with another worker.

Immediately after each worktree is created, and before dependency installation
or any semantic node or worker harness starts, the controller copies selected
environment files to the same relative paths when
`provisioning.copy_env_files` is true. Copies use filesystem APIs, preserve mode
where practical, reject symlinks and path escapes, and expose only path/status
evidence. The controller then provisions that worktree with the preflight argv
contract. Integration and worker dependencies are independent;
a successful install is cached only for that worktree. Worker infrastructure
retries reuse the same isolated worktree and retry provisioning only until it
succeeds. Install commands use the bounded direct process adapter, never a shell.
After a successful command the controller runs tracked-only Git status; any
tracked mutation blocks the run, while ignored or untracked dependencies are
allowed. A partially created worktree is registered before provisioning so halt
and cleanup can still account for it.

Run artifacts and worktrees default to `~/.local/state/opencode/daddy/`, outside
the target repository. Daddy therefore does not add its operational state to a
project, alter project ignore rules, or risk committing orchestration artifacts.

## Parallel Build Scheduler

The plan contract contains work items with unique IDs, a complexity tier, exact
dependencies, acceptance behavior, affected surface, and item-level validation
commands. The controller rejects missing dependencies, duplicate IDs, cycles,
unknown tiers, and plans exceeding configured item limits.

Ready items are those whose dependencies have been integrated successfully. The
scheduler launches ready items in stable item-ID order until
`build.max_concurrency` is reached. A plan may contain one item; the setting is
an upper bound, not a requirement to invent parallel work.

```text
complexity high -> models.worker_high
complexity mid  -> models.worker_mid
complexity low  -> models.worker_low
```

When an item finishes, its contract and commit are validated. The composite
`build` node materializes a deterministic `integrate.<item-id>` subnode.
Integration into the run branch is always serial. Item checks run after
integration. Only then is the item marked integrated and may its dependents
start. This is the join barrier. Independent ready items may continue running
while another completed item is being integrated. When every item has joined,
the composite `build` node emits `success` and routes to final verification.

An integration conflict or failing item check is an engineering failure, not an
infrastructure retry. It produces an issue contract tied to that item. Multiple
independent failures may run their issue lifecycles concurrently, still bounded
by the same global maximum unless configuration provides a lower issue limit.

## Shipping Policy

Shipping starts only after deterministic verification succeeds on a clean tree.
Verification records the exact integration HEAD. Shipping requires that same
HEAD and another clean-tree check; it never creates a post-verification commit.

When `origin` does not exist, the adaptive default:

1. Confirms the verified commit is still the clean integration HEAD.
2. Records the WIP branch and commit in `delivery/ship.json`.
3. Removes all worker worktrees and the integration worktree.
4. Preserves the local branch for the user.

When `origin` exists, the adaptive default:

1. Confirms the verified commit is still the clean integration HEAD.
2. Pushes the run branch without force.
3. Opens a pull request toward the preflight base branch.
4. Records branch, commit, remote, base, and PR URL.
5. Removes all worker worktrees and the integration worktree only after the
   delivery contract validates.

Configuration can select `local-branch`, `pull-request`, or `none` explicitly.
An incompatible explicit mode, such as `pull-request` without its configured
remote, halts rather than silently changing delivery semantics.

Before external delivery or terminal cleanup, the controller publishes a
durable pending marker. On halt it checkpoints dirty integration and worker
worktrees, records every preserved branch and SHA, then removes worktrees.
Cleanup failure blocks successful delivery and retains the pending evidence.
Retries remain bounded and do not erase the original halt reason.

## Parent Orchestrator

`/daddy-init` is an OpenCode prompt command and remains active for the complete
run. Since arbitrary command arguments cannot safely be interpolated into shell,
the orchestrator first writes the request contract verbatim using file tools,
then invokes the controller with only the controlled request path. It monitors
the controller's state and reports the terminal delivery or halt artifact.

The bootstrap command uses the current primary OpenCode session and does not
declare a frontmatter model. It is not an LLM DAG worker. Models for intent,
design, planning, RCA, and build workers are all resolved from
`daddy-config.yaml` by the controller.

The request itself is never inserted into a shell command. This is mandatory to
avoid textual-placeholder shell injection.

## Test Boundary

The controller exposes adapters for filesystem, process execution, clock, ID
generation, Herdr, OpenCode, Git, and pull-request operations. Unit tests replace
those adapters and cover every state and edge. Integration tests use temporary
Git repositories and fake Herdr/OpenCode executables for complete deterministic
runs. A separately marked live integration test exercises real Herdr and
OpenCode without contributing unverifiable branches to the deterministic
coverage claim.
