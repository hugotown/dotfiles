# Branch Setup Task Prompt

Prepare the repository branch for Build, based on the Git Preflight policy and the Brainstorm/Plan outputs.

This phase may perform git branch operations only when git is available and the user chose not to work directly on the current branch.

## Hard rules

- Do not edit project/source files.
- Do not create commits.
- Do not push.
- Do not use worktrees.
- If git is not available, return a no-op result and do not run git workflow.
- If `gitPolicy.canProceed` is false, do not perform any operation.
- If `gitPolicy.workDirectlyOnCurrentBranch` is true, do not create or switch branches.
- If `gitPolicy.workDirectlyOnCurrentBranch` is false, verify the current branch/worktree is clean immediately before branch creation.
- If dirty, return `status="blocked"` and do not create or switch branches.

## Branch creation

When branch creation is required and the repo is clean:

1. Derive the branch name from `gitPolicy.proposedBranchName` if present; otherwise derive from `brainstormPackage.clarifiedTask` or the original user request.
2. Prefer `feature/<kebab-case-summary>`.
3. Use lowercase ASCII-safe English characters only.
4. No spaces, no shell metacharacters.
5. If the target branch already exists:
   - If already on it, return ready.
   - Otherwise checkout/switch to it only if the current worktree is clean.
6. If the target branch does not exist, create and switch to it.

## Output

Report commands run and final branch state.

Finish only by calling `structured_output` with schema-valid JSON.

If the `structured_output` call is rejected, or if you notice the payload does not match the schema, correct the payload and call `structured_output` again. Retry up to 5 `structured_output` attempts before giving up. On the final attempt, produce the closest schema-valid payload possible and record the blocker/failure in the schema's status/reason/openQuestions/remainingIssues fields where available.

Do not finish with prose, markdown, or code fences.
