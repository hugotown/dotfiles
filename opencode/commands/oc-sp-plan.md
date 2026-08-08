---
description: Build a file-contract implementation plan for one bug or feature
agent: oc-sp-planner
---

## Objetivo

Turn the supplied feature specification or bug RCA into a committed, TDD-oriented implementation plan designed for maximum safe parallelism inside the unit's single Worktrunk worktree.

## Contexto

Approved input artifact:

<input-artifact-path>
$ARGUMENTS
</input-artifact-path>

Project root:

!`pwd`

Project tree:

!`eza --tree --level=5 --git-ignore . 2>&1`

## Workflow

1. Verify the input artifact exists inside the current unit worktree and is committed.
2. Load and follow `writing-plans`, except for its final execution-choice menu. The parent orchestrator owns the transition.
3. Define exact cross-file contracts before tasks: paths, symbols, signatures, types, effects, errors, and invariants.
4. Build a file dependency DAG and place each file in its earliest safe wave. Maximize wave width and serialize only real dependencies.
5. Every writable task owns exactly one file; concurrent tasks never share a file.
6. All workers use the same unit worktree and never commit, switch branches, operate Worktrunk, install shared dependencies, or write outside ownership.
7. Begin the plan with a file-contract matrix, dependency waves, unit-worktree rules, and exact baseline, RED, integration, and final verification commands.
8. Preserve TDD: complete and verify the RED test-file wave before GREEN workers edit production files.
9. Use a compiler-visible stub or serialize when a consumer physically requires a provider. A prose contract does not remove physical dependencies.
10. Reserve indivisible multi-file generators for a single mechanical integration step with an exact output set and diff verification.
11. Include reviews after waves, controller-owned commits, full-suite verification, and whole-change review.
12. Run the complete `writing-plans` self-review plus ownership, DAG, shared-worktree safety, and TDD checks.
13. Commit only the plan file. Do not start implementation.

## Constraints

- The committed input artifact is the requirements source.
- Enforce `1 agent = 1 file`: every writable worker owns one file and consumes other files only through frozen contracts.
- Plan only for the current unit worktree. Never create or switch worktrees, operate Herdr, integrate branches, or begin implementation.
- Reference skills provide process guidance only. Copying or cloning reference functionality is outside scope.

## Output

On success, print one final line:

```text
OC_SP_PHASE_DONE phase=plan artifact=<absolute-plan-path> commit=<sha>
```

On failure, print one final line:

```text
OC_SP_PHASE_BLOCKED phase=plan reason=<concise-reason>
```
