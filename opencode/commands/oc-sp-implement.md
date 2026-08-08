---
description: Execute one plan with maximum safe file-level parallelism
agent: oc-sp-implementation-controller
---

## Objetivo

Implement the supplied plan end to end with fresh-context subagents, maximum safe parallelism, exclusive file ownership, reviews, fresh verification, and a committed final state inside the unit's single Worktrunk worktree.

## Contexto

Implementation plan:

<plan-path>
$ARGUMENTS
</plan-path>

Project root:

!`pwd`

Project tree:

!`eza --tree --level=5 --git-ignore . 2>&1`

## Workflow

1. Verify the plan exists inside the current Worktrunk unit worktree and is committed.
2. Load phase-relevant skills from `executing-plans`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, and `verification-before-completion`.
3. Verify the current worktree is the isolated unit worktree. Never create another worktree or switch branches.
4. Run setup and the clean baseline before RED.
5. Execute each wave continuously:
   - Dispatch every independent ready RED or GREEN file concurrently in one batch using `oc-sp-implementer`.
   - Give each worker its owned file, contracts, read-only inputs, tests, and exact verification.
   - Never dispatch concurrent writable workers for the same file.
   - Forbid worker Git, Worktrunk, dependency installation, broad formatting, and writes outside ownership.
6. Complete the RED test-file wave first. Verify the exact expected failure before GREEN workers edit production files.
7. At each barrier, inspect results and the shared diff, enforce ownership, validate contracts, run integration checks, and create the wave commit yourself.
8. Retry a failed file with a fresh `oc-sp-fixer` and confirmed evidence; do not repeat unaffected workers.
9. Run independent read-only reviews concurrently with `oc-sp-wave-reviewer`. Resolve Critical and Important findings in file-exclusive waves using `oc-sp-fixer`, then re-review with fresh `oc-sp-wave-reviewer` instances.
10. Run the complete test suite, build, lint, and every plan check with fresh evidence. Request the whole-change review from `oc-sp-final-reviewer` and resolve blocking findings with `oc-sp-fixer`.
11. Verify every requirement line by line, ensure the final implementation state is committed, and preserve the branch and worktree for parent validation.
12. Do not create or close terminal workspaces, tabs, or panes. The parent orchestrator owns that lifecycle.

## Constraints

- The committed plan, frozen contracts, and dependency DAG are authoritative.
- Enforce `1 agent = 1 file`. Every writable worker uses the same unit worktree and may modify only its owned file.
- Never create another worktree, switch branches, integrate the branch, invoke branch completion, or remove the unit worktree. The parent orchestrator owns those actions after validating the terminal marker.
- Workers never use Git or Worktrunk, install dependencies, run broad formatting, or write outside their owned file.
- Use `oc-sp-explorer` for delegated read-only codebase evidence gathering. Never use it for writable work or reviews.
- Use only the role-specific subagents named in this prompt; do not substitute `general`, built-in `explore`, or another agent.
- Reference skills provide process guidance only. Copying or cloning reference functionality is outside scope.

## Output

On verified completion, print one final line:

```text
OC_SP_PHASE_DONE phase=implement branch=<branch> commit=<sha> worktree=<absolute-path> verification=<concise-summary>
```

On failure, print one final line:

```text
OC_SP_PHASE_BLOCKED phase=implement reason=<concise-reason>
```
