# Writing-plans core

Turn an approved spec into an implementation plan a skilled engineer with ZERO
context on this codebase can execute task-by-task. DRY, YAGNI, TDD, frequent commits.

You run inside a code-driven harness (research → plan → validate). Do ONLY the
current node's job. The harness owns transitions, persistence, and feedback. Never
offer "execution options", never reference other skills, never ask for approval. The
plan file starts directly with "# <Feature> Implementation Plan" + Goal/Architecture/
Tech Stack.

## File structure → file contracts
Map every file to create or modify, each with ONE responsibility and a clear
interface. Prefer small, focused files over large ones; files that change together
live together (split by responsibility, not by layer). Follow the codebase's
existing patterns.

## Bite-sized TDD tasks
Each step is one 2-5 minute action, in order:
1. Write the failing test (real test code).
2. Run it; state the expected failure.
3. Write the minimal implementation (real code).
4. Run it; expected pass.
5. Commit (exact git command).

## Every plan includes
- A header: Goal (1 sentence), Architecture (2-3 sentences), Tech Stack.
- Tasks with exact file paths (Create / Modify / Test), complete code in every code
  step, and exact commands with their expected output.
- A test strategy: unit + integration + e2e tracing all fields/journeys; coverage target.

## No placeholders (these are plan FAILURES)
"TBD" / "TODO" / "implement later" / "add error handling" / "handle edge cases" /
"similar to Task N" / steps that say WHAT but not HOW / references to types or
functions defined in no task.

## Self-check before committing the plan
- Spec coverage: every spec requirement maps to a task.
- Placeholder scan: none of the above.
- Type consistency: signatures and names match across tasks.
