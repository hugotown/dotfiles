# Reliability And Security

## Deterministic Boundaries

Defined behavior:

- Placeholder replacement order
- Embedded shell execution before the model prompt
- Concurrent launch of multiple embedded shell blocks
- Command model selection from frontmatter

Potentially nondeterministic behavior:

- Clock, network, filesystem, Git state, and external services
- Concurrent shell side effects
- Model reasoning and tool choice
- Timing of TUI rendering and autocomplete
- Agent status integration/detection

Describe shell preprocessing as controlled or deterministic only when its
inputs and environment are controlled.

## Shell Injection

Argument replacement is textual and occurs before shell interpretation.

```md
!`program $ARGUMENTS`
```

Untrusted input can introduce shell operators such as `;`, `&&`, `$()`, pipes,
redirections, or quote termination.

Quotes help with ordinary spaces but are not a complete sanitizer:

```md
!`program "$1"`
```

Preferred controls:

1. Accept only controlled arguments.
2. Validate against an allowlist.
3. Pass one artifact path instead of free-form text.
4. Use `--` before paths when supported.
5. Build JSON with `jq --arg`, not string concatenation.
6. Keep destructive operations out of dynamically constructed shell commands.

## Dynamic Command Files Are Executable Configuration

A generated `.opencode/commands/*.md` file can:

- Select a model or agent
- Execute embedded shell at expansion time
- Attach files
- Instruct an agent to modify the workspace

Treat command generation like code generation. Validate destination paths,
content, frontmatter, and provenance. Never let untrusted data freely create
embedded shell fragments.

## Timeouts

Every external wait needs a deadline:

```bash
herdr wait output "$pane" --match 'Ask anything' --timeout 30000
herdr wait agent-status "$pane" --status idle --timeout 300000
```

Polling loops also need a fixed limit. A custom command's embedded shell can
otherwise block the parent prompt indefinitely.

Daddy applies `runtime.command_timeout_seconds` to Git, Herdr workspace/pane
operations, `gh`, dependency provisioning, and configured `bash -lc`
validation. Provisioning is always a direct program-plus-argv invocation with
the worktree as `cwd`; only plan validation commands use `bash -lc`
intentionally for deterministic Bash semantics.

Controller subprocesses inherit `process.env`, preserving process-level
variables without serializing them. Daddy does not snapshot the process
environment or secrets into artifacts. Configured project-local `.env*` copies
instead provision files that package tools and applications expect in each
isolated worktree.

## Worktree Dependencies

Git worktrees do not copy ignored dependency directories such as
`node_modules` or ignored project-local `.env*` files. When enabled, preflight
discovers only non-template `.env` basenames with Git's NUL-delimited ignored
file listing, and every integration and worker worktree receives guarded
filesystem copies before installation. Absolute and traversal paths, symlink
sources or destination components, and realpath escapes block provisioning.
Artifacts retain only relative path names and copy statuses, never contents.

Preflight also persists one deterministic frozen-install
strategy from a recognized `packageManager` declaration or lockfile. Every
integration and worker worktree is provisioned independently before its first
harness. A successful worktree is not installed again, but a failed worker
provision may be retried in that same isolated worktree under the bounded
infrastructure retry policy.

The install's raw output and exit code are durable run evidence. Provisioning
success is accepted only after `git status --porcelain --untracked-files=no`
confirms that no tracked file changed. This permits ignored dependency output
without allowing a supposedly frozen install to silently rewrite a lockfile.
Worktrees are registered for cleanup before the install starts, so failures do
not orphan untracked controller resources.

## Trust Boundary

Daddy is not a security sandbox. OpenCode `--auto` permits agent-approved tool
use, and LLM-authored plans can contain shell validation commands. Run Daddy
only in a trusted workspace and inside an appropriate OS/container sandbox when
the repository, prompts, or generated commands are not fully trusted. Model
identifiers are restricted to a safe `provider/model` token before terminal
input, but this does not sandbox model behavior or shell execution.

## Cleanup

Use `trap` and scope cleanup to resources created by the current run:

```bash
cleanup() {
  test -z "${pane:-}" || herdr pane close "$pane" >/dev/null 2>&1 || true
}
trap cleanup EXIT
```

Do not close pre-existing Herdr panes or workspaces. Capture IDs directly from
the create response rather than selecting by ambiguous labels.

## Completion Protocol

A robust worker completion protocol uses all available evidence:

```text
1. Child process started
2. TUI readiness marker observed
3. Slash command confirmed as executed, not merely autocompleted
4. Output artifact exists
5. Artifact schema validation passes
6. Agent becomes idle
7. Optional completion marker exists
8. OpenCode exits or pane is safely closed
```

## Known Failure Modes From The Session

| Symptom | Cause | Correction |
| --- | --- | --- |
| Second shell cannot see first result | `!` blocks run concurrently in separate shells | Use one block/script |
| `$ARGUMENTS_1` behaves strangely | Only `$ARGUMENTS` and `$N` exist | Use `$1`, `$2` |
| `/exit` remains in the input | First Enter selected autocomplete | Inspect and send another Enter |
| Slash command file was not created | Creator command had not actually executed | Confirm input state and Enter again |
| `wait agent-status ... done` timed out | Observed setup reported idle instead | Wait for `idle` and validate artifact |
| `/exit` sent too soon | Artifact/task completion was not awaited | Wait for artifact and idle first |
| `oc models openai` showed help | Alias expands to `opencode --auto models openai` | Use `opencode models openai` |
| `command -v oc` found nothing | Alias only loaded in interactive pane shell | Use executable or verify `type oc` in pane |
| Help wait timed out | Wait expected `Usage:` but help used `Commands:` | Match actual output |
| Artifact exists while agent still works | File creation precedes final validation/response | Require artifact plus idle/completion marker |

## Version Sensitivity

The source implementation inspected on 2026-07-26 used:

- A positional argument regex supporting simple quoted groups
- Textual `$ARGUMENTS` replacement
- A shell matcher equivalent to `!` followed by backtick-delimited text
- `Promise.all` for shell fragment execution
- Command state initialized per OpenCode instance

Re-check source and rerun the experiment suite after upgrading OpenCode.
