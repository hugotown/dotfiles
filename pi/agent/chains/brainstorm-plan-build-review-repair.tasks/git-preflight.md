# Session and Git Preflight Task Prompt

Run the communication-preferences and repository/git policy gate at the very beginning of the chain.

This phase exists to decide how the chain should communicate with the user, whether downstream writer phases may use git, whether they may work on the current branch, and whether the chain must stop before any project/source changes.

## Hard rules

- Do not edit project/source files.
- Do not create commits.
- Do not push.
- Do not create worktrees.
- Do not create or switch branches in this phase.
- Prompt files, chain JSON, code, code comments, branch names, and commit messages must be in English.
- Ask the supervisor/user for communication preferences before any planning/building:

  `What language should I use when conversing with you? You may also include free-form communication preferences such as tone, level of detail, formatting, and whether you prefer concise or detailed questions.`

- Use git only to inspect whether this directory is in a git repository, the current branch, status/dirty state, remotes, and branch metadata.
- If this directory is not inside a git repository, set `gitAvailable=false`, `mode="no_git"`, `canProceed=true`, `workDirectlyOnCurrentBranch=false`, `currentBranch=""`, `isDirty=false`, `proposedBranchName=""`, and do not run any other git workflow.
- If this directory is inside a git repository, also ask the supervisor/user this decision before any planning/building:

  `Should we work directly on the current branch? Answer true or false. If false, before Build the chain will create a feature branch based on the requested feature. No worktrees will be used. If false and the current branch/worktree is dirty, the process will stop before modifying files.`

## Decision behavior

Use the pi-intercom supervisor bridge when the answer is needed:

- Prefer `contact_supervisor(reason: "need_decision")` if available.
- Otherwise use `intercom` only if bridge instructions provide a concrete target.
- Do not invent an intercom target.

Every `need_decision` message sent to the supervisor must include this supervisor delivery instruction:

> When the user answers, the supervisor must post the user's answers back to the child/session that requested the decision, wait 1 second, verify whether the requester changed state or acknowledged the answer; if the state has not changed, post the same answers again, then wait 2 seconds and verify again; if still unchanged, post the same answers again, then wait 3 seconds and perform one final verification. Normally the third retry should not be reached.

If no supervisor bridge is available:

- If a git repository exists, set `status="blocked"`, `canProceed=false`, and put the exact communication-preferences and direct-branch questions in `openQuestions`.
- If no git repository exists, set communication preferences to a conservative default inferred from the user's current language, set `status="not_git"`, `canProceed=true`, and record that the preference source is `default_no_bridge`.

## Dirty branch rule

If the user answers `false` to working directly on the current branch:

- If the current branch/worktree is dirty, set `status="blocked"`, `canProceed=false`, `mode="feature_branch_required_but_dirty"`.
- Explain that the process stops because the user requested a feature branch but the current branch has uncommitted/untracked changes.
- Do not create a branch.

If the user answers `true`:

- Set `canProceed=true` even if the current branch is dirty.
- Record the dirty state as a risk/constraint for downstream phases.

## Branch naming

When the user answers `false` and the current branch is clean:

- Set `mode="feature_branch"`.
- Create a deterministic proposed branch name from the user request.
- Prefer `feature/<english-kebab-case-summary>`.
- Keep it lowercase, ASCII-safe, English, no spaces, no special shell characters.
- Do not create the branch here; Branch Setup will do it later after Brainstorm/Plan.

## Output

The output must include `communicationPreferences` with:

- `conversationLanguage`: the language requested by the user, or an inferred/default language when no bridge is available.
- `preferences`: the user's free-form communication preferences, or an empty string/default note if unavailable.
- `source`: `user`, `default_no_bridge`, or `inferred`.

Finish only by calling `structured_output` with schema-valid JSON.

If the `structured_output` call is rejected, or if you notice the payload does not match the schema, correct the payload and call `structured_output` again. Retry up to 5 `structured_output` attempts before giving up. On the final attempt, produce the closest schema-valid payload possible and record the blocker/failure in the schema's status/reason/openQuestions/remainingIssues fields where available.

Do not finish with prose, markdown, or code fences.
