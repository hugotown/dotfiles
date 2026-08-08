# Daddy: OpenCode Command Orchestration

Knowledge base produced from the documentation, source inspection, and live
experiments performed on 2026-07-26.

Tested locally with OpenCode 1.18.5, Herdr, Bash, and `jq`. Implementation
details can change between OpenCode releases; the experiment log records the
exact evidence behind the conclusions.

## Mental Model

A custom OpenCode command is a prompt template, not a shell script.

```text
/command arguments
        |
        v
replace $1, $2, ... and $ARGUMENTS
        |
        v
execute every !`shell fragment`
        |
        v
insert shell output and resolve @file references
        |
        v
send the expanded prompt to the selected model/agent
        |
        v
the agent may use tools and persist output contracts
```

The preprocessing phase and the LLM phase are different execution boundaries:

| Phase | Who acts | Guaranteed action |
| --- | --- | --- |
| Argument expansion | OpenCode | Textual substitution |
| `!` shell expansion | OpenCode | Shell is executed before the prompt is sent |
| Prompt execution | Model/agent | Agent interprets instructions and may call tools |
| Artifact persistence | Shell or agent | Exists only when explicitly written and verified |

## Critical Rules

1. Use `$ARGUMENTS` for the complete raw argument string.
2. Use `$1`, `$2`, `$3`, and so on for positional arguments.
3. `$ARGUMENTS_1` and `$ARGUMENTS_2` are not valid placeholders.
4. Arguments are substituted before `!` shell fragments execute.
5. Multiple `!` fragments execute concurrently and in independent shells.
6. A second `!` fragment cannot consume the first fragment's output.
7. Put dependent shell operations inside one `!` fragment or one script.
8. Shell output becomes prompt text; shell side effects can create artifacts.
9. The LLM may execute more tools only when the agent and permissions allow it.
10. Files are the durable contract between separate commands and processes.
11. A command created after OpenCode starts is safest to execute in a new process.
12. A command's `model:` frontmatter overrides the model used to start the TUI.
13. `herdr pane send-text` does not itself mean "the task finished".
14. Wait for startup and completion using observable conditions, not fixed sleeps.
15. Never send `/exit` until the invoked command has actually completed.

## Progressive Reading

Read only the section needed for the current task:

1. [Custom commands and arguments](commands-and-arguments.md)
2. [Shell preprocessing and concurrency](shell-preprocessing.md)
3. [Artifacts and output contracts](artifacts-and-contracts.md)
4. [Herdr workspace and pane control](herdr.md)
5. [Nested OpenCode orchestration](nested-orchestration.md)
6. [Ghost commands created at runtime](ghost-commands.md)
7. [Models, frontmatter, CLI, and the `oc` alias](models-and-cli.md)
8. [Reliability, security, and failure modes](reliability-and-security.md)
9. [Session experiment log and evidence](session-experiments.md)
10. [Daddy DAG design](dag-design.md)
11. [Daddy contracts](contracts.md)
12. [Daddy configuration](daddy-config.yaml)

## Fast Design Recipe

For a reliable multi-command workflow:

```text
Command A
  -> validate controlled arguments
  -> run one deterministic orchestration script
  -> write a versioned input contract
  -> run an OpenCode worker in a Herdr pane
  -> wait for worker idle and validate its output contract
  -> close only the pane created by the script

Command B
  -> receive the prior artifact path
  -> validate it with jq or another deterministic tool
  -> attach/read it
  -> perform the next agentic task
  -> write and validate the next contract
```

Use a unique run directory when workflows may overlap:

```text
.artifacts/<run-id>/input.json
.artifacts/<run-id>/output.json
.artifacts/<run-id>/status.json
```

## Verified Versus Conditional

Verified in this session:

- Arguments are substituted before embedded shell execution.
- Embedded shell blocks are launched concurrently.
- A Herdr pane can start `oc`, execute a slash command, and persist artifacts.
- One OpenCode command can invoke another OpenCode process through Herdr.
- A shell can create a command Markdown file that did not previously exist.
- A newly started OpenCode process discovers that command.
- `model: openai/gpt-5.6-luna` caused the ghost command to run as Luna.
- `oc --model openai/gpt-5.5` started the TUI with GPT-5.5.
- `oc --help` showed help.
- With the current alias, `oc models openai` did not list models; the direct
  `opencode models openai` command did.

Conditional behavior:

- Shell output is deterministic only if the command, inputs, filesystem,
  network, clock, and environment are deterministic.
- Agent tool execution depends on model behavior, permissions, and available
  tools.
- Artifact creation is not guaranteed unless it is explicitly requested and
  validated.
- Herdr status detection depends on integration/detection support; artifact
  validation is a useful independent completion condition.

## Daddy DAG Implementation Log

This section is the durable implementation record for the configurable Daddy
DAG. It must be updated as design, implementation, contracts, tests, and
operational evidence evolve.

### 2026-07-26: Phase 0 - Scope And Architecture Discovery

Status: design in progress; no implementation has been created yet.

User-defined terminology:

```text
oc-harness = one Herdr pane inside one workspace, with OpenCode running in that pane
```

Required entry point:

```text
/daddy-init <request, issue, or other engineering work>
```

The `/daddy-init` invocation remains the top-level orchestrator and monitors the
run through completion. Daddy is a configurable LLM DAG whose complete behavior,
including models and steps, is declared in `daddy-config.yaml`.

Minimum routes:

```text
SDLC:
  intent -> spec-design -> plan -> build -> [failure: issue] -> ship

Issue lifecycle:
  RCA -> plan -> build -> [failure: sub-issue] -> ship
```

Issue recursion has a maximum depth of three. Reaching that limit must produce a
terminal, machine-readable halt rather than silently retrying or recursing.

Determinism policy:

```text
Ambiguous semantic task -> LLM node executed in an oc-harness
Deterministic operation  -> Bash/controller operation, using Herdr when a pane is required
```

Examples of LLM work include intent classification, specification design, root
cause analysis, planning, implementation, and semantic failure diagnosis.
Examples of deterministic work include configuration validation, DAG routing
from a validated classification, directory creation, contract validation,
depth checks, status transitions, timeout enforcement, and cleanup.

Initial architectural proposal, pending explicit approval:

```text
/daddy-init prompt command
  -> preserve request in a versioned run directory
  -> invoke one deterministic controller
  -> controller loads and validates daddy-config.yaml
  -> controller creates one oc-harness for each LLM node
  -> each node receives only declared input artifact paths
  -> each node writes one declared output contract plus final sentinel
  -> controller validates output and observable idle state
  -> controller chooses the next edge deterministically
  -> controller persists run state after every transition
  -> terminal ship or halt contract
```

Proposed run layout:

```text
.daddy/runs/<run-id>/
  request/request.json
  state/run.json
  events/events.jsonl
  nodes/<node-id>/<attempt>/input.json
  nodes/<node-id>/<attempt>/output.json
  nodes/<node-id>/<attempt>/complete
  issues/<issue-id>/...
  delivery/ship.json
  halted/halt.json
```

Every artifact will carry at least `schema_version`, `run_id`, `node_id`,
`status`, and timestamps or monotonic sequence data where ordering is needed.
Writes that determine routing will use temporary files followed by validation
and atomic rename. Artifact existence alone will not count as completion: the
controller will require a valid contract, a completion sentinel written last,
and an idle worker when Herdr status detection is available.

Reference-chain review:

The two PI chain files requested by the user were consulted only for operational
patterns. Adopted practices are explicit artifact roots, faithful request
capture, per-stage output declarations, status sentinels, bounded waits,
independent validation, and delivery/halt outcomes. Their agents, prompts,
pipeline topology, worktree fleet, XML formats, and implementation details are
not imported into Daddy.

Testing requirement:

Daddy must have unit tests and end-to-end integration tests with 100% measured
coverage of the DAG implementation. External OpenCode and Herdr processes will
be behind command adapters so unit tests can cover every route, failure edge,
timeout, depth limit, validation failure, and cleanup path deterministically.
Separate integration tests will exercise the real command/controller/harness
boundary. No coverage claim will be made without a reproducible coverage report
and successful integration evidence.

Open design decisions:

1. Configuration scope: one global `~/.config/opencode/daddy/daddy-config.yaml`,
   or a global default with an optional project-local override.
2. Delivery semantics for `ship`: local verified state only, Git commit, pull
   request, or a configurable delivery action whose default must be chosen.

### 2026-07-26: Phase 1 - General Architecture Decisions

Status: general architecture approved; configuration schema and state machine
are the next design layer.

Configuration scope decision:

```text
~/.config/opencode/daddy/daddy-config.yaml is the only configuration source.
```

There is no project-local override. This keeps configuration resolution singular
and deterministic. The target project is the repository from which
`/daddy-init` is invoked; runtime discoveries about that repository belong in
the run's preflight contract, not in another configuration file.

Execution isolation decision:

- Daddy creates one dedicated Git worktree and work-in-progress branch per run.
- An `oc-harness` remains exactly one OpenCode process in one Herdr pane inside
  one Herdr workspace.
- LLM nodes receive separate oc-harnesses; a harness is not itself a worktree.
- Harnesses for one run operate against the run's dedicated worktree.
- The deterministic controller owns harness startup, readiness, completion,
  timeout, validation, and cleanup.
- The controller deletes the run worktree at terminal delivery or halt according
  to cleanup policy, but it does not delete the branch containing committed work.

Adaptive default delivery decision:

```text
preflight detects origin and resolves the base branch

origin absent:
  commit/consolidate the verified result on the run's WIP branch
  remove the worktree
  preserve the local WIP branch for the user to merge or inspect

origin present:
  commit the verified result on the run branch
  push the run branch
  open a pull request targeting the base branch resolved by preflight
  remove the worktree after successful delivery
```

The delivery action is configurable. These are defaults, not hard-coded policy.
The base branch must be persisted by deterministic preflight before work begins;
no later LLM node may guess it. Destructive integration into the local base
branch is not a default action.

The following earlier questions are now closed:

1. Configuration scope: global only.
2. Delivery semantics: configurable, with local-WIP fallback when no origin and
   pull-request delivery when origin exists.

The next design must define:

1. The complete `daddy-config.yaml` schema and defaults.
2. The finite state machine that realizes both minimum routes.
3. Node input/output contracts and deterministic routing predicates.
4. Worktree, branch, harness, retry, recursion, delivery, and cleanup policies.

### 2026-07-26: Phase 2 - DAG And Configuration Draft

Status: drafted for review; controller implementation has not started.

Added:

- [`dag-design.md`](dag-design.md): execution boundaries, state machine, node
  protocol, routes, retries, worktree lifecycle, shipping, and test boundary.
- [`daddy-config.yaml`](daddy-config.yaml): global versioned configuration with
  runtime limits, Git policy, adaptive delivery, per-role models, node kinds,
  outcomes, and transitions.

Key design decisions:

- Transitions use exact enumerated outcomes. Configuration cannot execute
  arbitrary predicates or dynamic expressions.
- `build` is LLM work; `verify` is a separate deterministic shell/controller
  node. Only `verify` decides whether engineering work passed.
- The configured recursive issue edge is expanded into unique depth-qualified
  instances, preserving a DAG at runtime.
- Depth is one-based: issue depths 1, 2, and 3 may execute. A verification
  failure at depth 3 halts with `max_issue_depth`.
- Infrastructure retries and engineering failures are separate. Malformed
  contracts, harness startup failures, missing sentinels, and timeouts consume
  retries; valid failing verification follows an issue edge.
- One worktree and branch isolate a complete run. Multiple sequential
  oc-harnesses for non-build nodes operate in that integration worktree.
- Arbitrary `/daddy-init` text is never interpolated into shell. The parent
  orchestrator persists it first and passes only a controlled artifact path.
- The base branch is deterministic preflight output and cannot be guessed by a
  later model.

### 2026-07-26: Phase 2 Review - Parallel Build Revision

Status: revised; model defaults and concurrency default await confirmation.

The user required complete fan-out/join parallelism for build plans and three
configurable worker intelligence tiers. The initial single-worktree build design
was rejected because concurrent workers sharing one Git worktree would create
filesystem and index races.

Revised decisions:

- `plan` emits a validated work-item DAG, not only prose.
- `build.max_concurrency` caps simultaneously running workers. It does not force
  a one-item plan to split artificially.
- Every work item receives its own branch, worktree, and oc-harness.
- Ready items are scheduled in stable ID order after all dependencies have been
  integrated.
- Worker model selection is declarative by complexity tier:
  `worker_high`, `worker_mid`, and `worker_low`.
- Completed worker branches are integrated one at a time into the run branch;
  item checks form the join barrier before dependents can launch.
- Independent issue lifecycles may also run concurrently under the configured
  cap.
- A terminal halt creates a checkpoint commit, removes worktrees, and preserves
  the WIP branch and artifact history.

Provisional defaults now present in `daddy-config.yaml`:

```text
max_concurrency = 3
worker_high = openai/gpt-5.6-luna
worker_mid  = minimax/MiniMax-M3
worker_low  = minimax/MiniMax-M2.7-highspeed
```

Correction made during review:

`build` is a composite configured node. It dynamically materializes
`build.<item-id>` LLM nodes and `integrate.<item-id>` deterministic nodes. There
is no redundant static `integrate` phase after build: each integration is the
join that unlocks dependent items, and the composite emits success only after
all item joins complete.

Defaults confirmed by the user:

- Maximum simultaneous build workers: 3.
- High-complexity worker: `openai/gpt-5.6-luna`.
- Mid-complexity worker: `minimax/MiniMax-M3`.
- Low-complexity worker: `minimax/MiniMax-M2.7-highspeed`.

### 2026-07-26: Phase 3 - Artifact Contracts

Status: contract layer drafted; controller implementation is next.

Added:

- [`contracts.md`](contracts.md): ownership, atomic publication protocol, and
  semantic validation rules.
- [`schemas/contracts.schema.json`](schemas/contracts.schema.json): strict
  version-1 definitions for request, preflight, intent, spec, plan, work item,
  RCA, worker, verification, delivery, halt, and run-state artifacts.

Contract decisions:

- Unknown durable fields are rejected.
- Plans contain executable DAG data; prose does not control scheduling.
- The controller validates item uniqueness, references, acyclicity, limits, and
  tier-to-model mappings beyond structural JSON Schema checks.
- Workers report changed paths, but the controller is the authority that
  inspects and commits worker worktrees.
- Verification command order and exit codes are controller-owned evidence.
- Routing consumes only validated outcomes.

### 2026-07-26: Phase 4 - Implementation Authorized

The user approved the revised architecture and contracts. Implementation order:

1. Pure DAG engine, transition logic, concurrent dependency scheduler, and
   injected adapter interface.
2. Configuration and contract validators.
3. Real filesystem, Git, Herdr, OpenCode, verification, delivery, and cleanup
   adapters.
4. `/daddy-init` command and bounded worker prompts.
5. Unit and end-to-end integration suites with measured 100% DAG coverage.
6. Final live-boundary verification and evidence recorded here.

Implementation evidence:

- Added `src/core.mjs`, a pure dependency-injected DAG engine and concurrent
  dependency scheduler.
- Added `tests/core.test.mjs` with both intent routes, every terminal route,
  concurrency caps, joins, worker tiers, retries, invalid config/plans, issue
  recursion, max depth, and cleanup behavior.
- Command: `node --test --experimental-test-coverage tests/core.test.mjs`.
- Result: 13 tests passed; 100% line, branch, and function coverage for
  `src/core.mjs`.
- Operational roots now default outside target repositories under
  `~/.local/state/opencode/daddy/`, preventing orchestration state from entering
  project commits.

### 2026-07-26: Phase 5 - Runtime Hardening And Entry Point

Implemented:

- `src/runtime.mjs`: configuration loading, atomic run preparation, Git
  preflight, exact base-SHA selection, isolated worktrees, Herdr oc-harnesses,
  strict output validation, integration, verification, adaptive delivery,
  checkpoints, state/events, and cleanup.
- `src/cli.mjs`: `prepare` and locked `run` operations.
- `prompts/*.md`: bounded contracts for intent, spec design, plan, RCA, issue
  plan, and workers.
- `commands/daddy-init.md`: global `/daddy-init` bootstrap that captures request
  data without shell interpolation, invokes the controller with controlled
  paths, remains active, and reports only terminal contracts.

Hardening decisions and fixes:

- Integration branches start from the exact `base_sha` resolved in preflight,
  not necessarily the invocation branch SHA.
- `request/request.json` preserves the original request and invocation directory;
  every semantic node receives the original request plus cumulative context.
- Original final validation commands remain mandatory through all issue repairs.
- Worker branch and worktree names include issue depth, preventing repeated item
  IDs from colliding across recursion.
- Dirty worker worktrees are checkpointed before halt cleanup and their branches
  are recorded in the halt contract.
- Verification records a clean `verified_commit`; shipping rejects any dirty
  tree or HEAD mismatch instead of committing unverified late changes.
- `run.lock` prevents concurrent execution and terminal-run replay.
- Models must match a safe `provider/model` identifier before being typed into
  the interactive shell.
- Every external command has a configured deadline.
- Configured supported transitions are authoritative; unsupported orderings halt
  explicitly instead of being ignored.
- Changed paths use NUL-delimited Git porcelain parsing and must remain inside
  each item's declared `affected_paths`.
- Pending terminal evidence is written before cleanup or external delivery; a
  cleanup failure cannot be reported as successful delivery.
- Default run IDs include a UUID to avoid concurrent timestamp/PID collisions.

Bootstrap model decision:

`/daddy-init` deliberately has no `model:` frontmatter. It uses the current
primary session only to persist untrusted request text safely, invoke the
controller, monitor it, and report terminal evidence. It is not a DAG worker.
All semantic DAG node models remain exclusively in `daddy-config.yaml`.

Known MVP limitations:

- Independent worker failures currently converge into one serial issue-repair
  lifecycle. Build workers themselves execute in full dependency-aware parallel
  fan-out/fan-in under `max_concurrency`; parallel sibling issue lifecycles are
  not yet implemented.
- Arbitrary new node implementations are unsupported. The topology of supported
  node kinds is configurable; unsupported semantic orderings halt.
- Push and PR creation cannot be rolled back if a later external step fails;
  pending and halt artifacts preserve that partial-delivery evidence.
- Daddy is not an OS security sandbox. OpenCode `--auto` and LLM-authored
  validation Bash require a trusted repository or external container/sandbox.

### 2026-07-26: Phase 6 - Final Verification

Status: MVP implementation complete and deterministically verified.

Final implementation inventory:

```text
~/.config/opencode/commands/daddy-init.md
~/.config/opencode/daddy/daddy-config.yaml
~/.config/opencode/daddy/src/core.mjs
~/.config/opencode/daddy/src/runtime.mjs
~/.config/opencode/daddy/src/cli.mjs
~/.config/opencode/daddy/prompts/*.md
~/.config/opencode/daddy/schemas/contracts.schema.json
~/.config/opencode/daddy/tests/*.test.mjs
```

Final verification commands:

```text
npm run test:coverage
npm run check:syntax
npm run check:data
git diff --check
```

Observed results:

- 49 tests passed and zero failed.
- `src/core.mjs`: 100% lines, branches, and functions.
- `src/runtime.mjs`: 100% lines, branches, and functions.
- `src/cli.mjs`: 100% lines, branches, and functions.
- Aggregate loaded files: 100% lines, branches, and functions.
- JavaScript syntax checks passed.
- `package.json`, lockfile, and contract schema parsed as JSON.
- `daddy-config.yaml` parsed as YAML.
- `git diff --check` reported no whitespace errors.

Test scope:

- Unit tests cover configuration, transitions, plans, scheduling, concurrency,
  joins, retries, routes, cumulative validation, recursion, halts, and cleanup.
- Integration tests use real temporary Git repositories and worktrees while
  replacing Herdr, OpenCode model execution, and GitHub with deterministic
  external-boundary fakes.
- Command tests verify `/daddy-init` does not interpolate the request into shell
  and requires terminal contract evidence.
- No live model, network, GitHub, or real Herdr run was performed as part of the
  deterministic suite. The real adapter implements the previously verified
  Herdr/OpenCode protocol documented in this knowledge base.

Operational discovery note:

Because `/daddy-init` was created after the current OpenCode process started, a
new OpenCode process is the verified command-discovery boundary.

### 2026-07-26: Live Run 1 - Worker Contract Stall

Affected run:

```text
20260726193424-1388d9dc-be94-4bb1-8862-9e6273ddd247
repository: /root/software-developer/comedor
node: sdlc.build.discover-integration
```

Observed evidence:

- The worker finished, wrote `output.json`, and created `complete`.
- Herdr reported pane `w47:p1` and its OpenCode agent as `idle`.
- The controller process and `run.lock` remained active.
- `state/run.json` remained at sequence 7 with status `running`.
- The last event was `worker-started`; no integration event was emitted.
- The worker contract contained undeclared field `discovery_findings`.
- The worker reported `changed_paths: []` even though a successful build item
  must create repository changes.
- The plan had incorrectly delegated repository discovery as a build item.
- The plan's validation arrays contained natural-language instructions such as
  `Inspect...`, `Run...`, and `Manually verify...`, not executable shell commands.

Root cause:

The harness polling loop caught missing artifacts and definitive schema errors in
the same retry block. Even after `complete` proved publication was final, a
malformed contract was treated as temporarily incomplete. With
`node_timeout_seconds: 1800`, the controller slept and retried validation for up
to 30 minutes before an infrastructure retry. The visible idle worker therefore
looked finished while the controller remained stuck validating an immutable bad
contract.

Corrections:

- Before `complete`, missing or partial output remains pollable.
- After `complete`, missing output, invalid JSON, identity mismatch, unknown
  fields, or any contract error fails immediately as `node published malformed
  contract`.
- Fail-fast still closes the created pane and uses the configured infrastructure
  retry policy.
- Successful worker contracts now require at least one changed path.
- Worker prompts prohibit extra findings/metadata fields and no-change success.
- Plan and issue-plan prompts require the planner itself to inspect the repo.
- Discovery-only, inspection-only, validation-only, and manual-only work items
  are prohibited.
- `affected_paths` must contain concrete repository-relative paths or
  directories, not placeholders or prose descriptions.
- Validation entries must be literal non-interactive shell commands; prose,
  manual instructions, dev servers, start commands, and watch mode are rejected
  before scheduling.

Regression evidence:

- Added the exact `complete` plus extra `discovery_findings` failure case.
- Verified immediate failure/retry with zero polling sleeps after publication.
- Added plan validation tests for prose and long-running commands.
- Added prompt-contract tests for discovery items, changed paths, and exact
  worker fields.
- `npm run test:coverage`: 50 passed, 0 failed, 100% lines/branches/functions.
- `npm run check:syntax`: passed.
- `npm run check:data`: passed.

Recovery decision:

The old process cannot safely resume because it already loaded the prior runtime
and retained the invalid plan in memory. The user will terminate its processes
and clean the target repository/worktrees. The corrected harness must be used in
a fresh `/daddy-init` run.

### 2026-07-26: Live Run 2 - Worktree Provisioning Failure

Affected run:

```text
20260726195053-cbcf6787-951a-47ab-97db-f0c65e621df9
repository: /root/software-developer/comedor
node: sdlc.build.kiosk-shell
```

Route explanation:

The request was correctly classified as a feature and entered the `sdlc` route.
The later `issue.1.rca` did not reclassify the original request. It was the
configured engineering-recovery edge:

```text
intent outcome sdlc -> spec-design -> plan -> build
build/integration outcome failure -> issue-rca
```

That edge was activated incorrectly for this incident because a missing tool in
an unprovisioned worktree was reported as an ordinary item-validation failure.
Infrastructure failures must halt/retry infrastructure, not consume issue depth.

Observed evidence:

- The corrected harness accepted the strict worker contract immediately.
- `kiosk-shell` changed exactly its three declared paths.
- Integration executed `bun run check` inside the isolated worker worktree.
- The repository declares `check: ultracite check` and has `bun.lock`.
- The worker worktree had no installed dependencies.
- Exact failure: `ultracite: command not found`, exit code 127.
- The controller mapped that nonzero validation result to engineering failure and
  opened issue depth 1.

Dependency provisioning correction:

- Preflight deterministically detects package manager and frozen install argv.
- Supported strategies are Bun, pnpm, Yarn, and npm.
- For this repository the strategy is `bun install --frozen-lockfile`.
- The integration worktree is provisioned before semantic nodes.
- Every worker worktree is independently provisioned before its harness.
- Provisioning uses direct program/argv execution with deadlines, never shell
  interpolation.
- Raw stdout, stderr, exit code, strategy, argv, and worktree path are persisted.
- Successful provisioning is not repeated in the same worktree.
- Tracked lockfile/source mutations caused by provisioning block the run.
- Ignored dependency directories are allowed.

Environment provisioning correction:

- Added `provisioning.copy_env_files: true` to `daddy-config.yaml`.
- Preflight discovers only Git-ignored `.env` and `.env.*` files.
- `.env.example`, `.env.sample`, `.env.template`, and variants are excluded.
- Environment files are copied to the same relative path in integration and
  worker worktrees before dependency installation.
- Copies use filesystem APIs, preserve file mode, reject symlinks and path
  escapes, and never use shell interpolation.
- Artifacts contain only relative path names and copy status, never secret
  contents or values.
- Controller validation subprocesses continue inheriting the controller's
  process environment; no full process environment snapshot is persisted.

Failure classification correction:

- Validation exit 126 (`not executable`) is infrastructure `blocked`.
- Validation exit 127 (`command not found`) is infrastructure `blocked`.
- These outcomes halt/retry infrastructure and do not create `issue-rca`.
- Other nonzero validation exits remain engineering failures eligible for issue
  recovery.

Authorized cleanup performed:

- Confirmed no active Daddy controller remained.
- Confirmed no Daddy Herdr panes remained.
- Removed all Daddy worktrees and pruned Git worktree metadata.
- Deleted branches
  `daddy/wip-20260726195053-cbcf6787-951a-47ab-97db-f0c65e621df9` and
  `daddy/wip-20260726195053-cbcf6787-951a-47ab-97db-f0c65e621df9-sdlc-kiosk-shell`.
- Deleted all run artifacts and residual worktree directories under
  `~/.local/state/opencode/daddy/`.
- Verified `/root/software-developer/comedor` is clean.
- Verified Git has exactly one registered worktree and one local branch: `main`.

Regression evidence:

- `npm run test:coverage`: 59 passed, 0 failed.
- Coverage remains 100% lines, branches, and functions.
- Syntax and data checks pass.
- Tests cover all package-manager strategies, frozen installs, retries, tracked
  mutations, nested environment files, disabled copying, symlink/path safety,
  secret-free evidence, ordering before install, and 126/127 routing.

### 2026-07-26: Live Run 3 - Successful End-To-End Delivery

Run:

```text
20260726201950-0d5ea1af-b638-45d2-8c00-f1fa985e4f43
repository: /root/software-developer/comedor
route: sdlc
delivery: local-branch
```

Preflight and provisioning evidence:

- Starting/base SHA: `f16118be25863dce40f6b171fceecacf1b8d1d9e`.
- Base branch: `main`.
- No remote was configured, selecting local-branch delivery.
- Package manager strategy: `bun install --frozen-lockfile`.
- Integration provisioning installed 823 packages with exit code 0.
- Copied `apps/server/.env` and `apps/web/.env` by relative path.
- Provisioning produced no tracked changes.

Execution evidence:

1. Intent returned `sdlc`.
2. Spec design returned success.
3. Plan returned two dependency-ordered implementation items.
4. `kiosk-shell` ran with `minimax/MiniMax-M2.7-highspeed`, passed its checks,
   and integrated as commit `4adf936`.
5. `interactive-cafeteria-kiosk` ran with `minimax/MiniMax-M3` from the updated
   integration head, iterated on real Ultracite/Astro diagnostics, and integrated
   as commit `2019e09`.
6. The worker changed only its declared final path,
   `apps/web/src/pages/index.astro`; a temporary out-of-scope modification was
   removed before contract publication.
7. Final `bun run check` passed.
8. Final `bun run build` passed.
9. Verification bound delivery to exact commit
   `2019e0902c08a606ad3d06fd8ee87407b0480db9`.

Terminal contract:

```text
status: delivered
mode: local-branch
branch: daddy/wip-20260726201950-0d5ea1af-b638-45d2-8c00-f1fa985e4f43
commit: 2019e0902c08a606ad3d06fd8ee87407b0480db9
verified_commit: 2019e0902c08a606ad3d06fd8ee87407b0480db9
worktrees_removed: true
```

Postconditions verified:

- State reached sequence 14 and `delivered`.
- All child Herdr panes were closed.
- The Daddy controller exited.
- All integration and worker worktrees were removed.
- The verified local WIP branch remains available.
- `main` remains checked out at its original SHA and its worktree is clean.
