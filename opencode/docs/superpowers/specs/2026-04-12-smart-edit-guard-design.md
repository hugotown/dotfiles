# `smart-edit-guard` — OpenCode Plugin for Edit Error Prevention

**Date:** 2026-04-12
**Status:** Design approved, pending implementation

## Problem Statement

The `edit` tool has an 11.41% error rate (515 errors out of 4,515 calls), which is in the CRITICAL zone (>10%). The top 3 error categories are:

1. **177 errors** — `oldString` and `newString` are identical (no actual change)
2. **96 errors** — `oldString` not found in the file
3. **20+ errors** — File modified since last read (stale content)

These errors waste tokens (the LLM generates the full edit call before failing), break agent flow, and accumulate significant overhead across sessions.

## Solution

A plugin (`smart-edit-guard.ts`) that intercepts `edit` tool calls via `tool.execute.before` and applies 3 sequential validation guards before the edit executes. If any guard fails, it throws a descriptive error that helps the LLM self-correct.

## Architecture

```
LLM generates: edit(filePath, oldString, newString)
    │
    ▼
tool.execute.before (load order)
    │
    ├── 1. agent-file-lock.ts  → concurrency/locking (existing)
    │
    ├── 2. smart-edit-guard.ts → content validation (NEW)
    │       │
    │       ├── Guard 1: Identical edit check
    │       ├── Guard 2: oldString existence + closest match
    │       └── Guard 3: Fresh file read for validation
    │
    ▼
edit tool executes (only if all guards pass)
```

### Load Order

Plugins in `~/.config/opencode/plugins/` load alphabetically. `agent-file-lock.ts` (a) loads before `smart-edit-guard.ts` (s). This is correct: lock checks first, then content validation.

### Coexistence with agent-file-lock

- If `agent-file-lock` redirects an edit (conflict), it mutates `output.args` to a dummy value. `smart-edit-guard` will see the mutated args and either pass or catch the dummy — either way, the edit is already neutralized.
- No state sharing between plugins. Each operates independently.

## Guard Details

### Guard 1: Identical Edit Detection

**Trigger:** `output.args.oldString === output.args.newString`

**Action:** `throw new Error("[smart-edit-guard] Edit blocked: oldString and newString are identical. No change needed. Re-read the file to verify current state before editing.")`

**Impact:** Eliminates ~177 errors (34% of all edit errors)

### Guard 2: oldString Existence Validation

**Trigger:** `oldString` not found in file content

**Process:**
1. Read file via `Bun.file(filePath).text()`
2. Check if `content.includes(oldString)`
3. If not found, find closest matching line:
   - Split file into lines
   - For each line, check if any substring of `oldString` (first 40 chars) appears in the line
   - Pick the line with the longest common substring
4. Throw with helpful context:
   ```
   [smart-edit-guard] oldString not found in {filePath}.
   Closest match at line {N}: '{first 80 chars of line}'
   Re-read the file and use the exact content for oldString.
   ```
5. If file doesn't exist: `throw new Error("[smart-edit-guard] File not found: {filePath}")`

**Impact:** Reduces ~96 errors by giving the LLM actionable context to self-correct

### Guard 3: Fresh File Read (Stale Prevention)

**Implementation:** Guard 2 already reads the file fresh. Guard 3 is not a separate step — it's the fact that Guard 2 always reads current content, which means the validation is against the REAL file state, not cached state.

**Note:** This cannot prevent the OpenCode engine's own "file modified since last read" timestamp check, which happens at a different layer. However, Guard 2's pre-validation catches most cases where the content has drifted from what the LLM expects.

**Impact:** Reduces ~20+ stale-read errors indirectly

## File Location

`~/.config/opencode/plugins/smart-edit-guard.ts`

## Dependencies

- `@opencode-ai/plugin` (already installed in `~/.config/opencode/package.json`)
- `Bun.file()` for file reading (available in the Bun runtime)

## Error Handling

- All guards use `throw new Error(message)` for failures
- Error messages are prefixed with `[smart-edit-guard]` for easy identification
- Messages include actionable guidance for the LLM (what to do next)
- File read failures (permissions, missing file) are caught and reported cleanly

## Performance Considerations

- Guard 1 is O(1) — string comparison
- Guard 2 reads the file from disk on every edit call. For large files, the closest-match search is O(lines × substring_length). This is bounded by only checking the first 40 chars of oldString against each line.
- File reads are fast (local SSD, files are typically <10KB for code files)
- Total overhead per edit call: <10ms expected

## Success Metrics

Measured via `/oc-observe` after 1 week of usage:
- Edit error rate should drop from 11.41% to <5% (target: <3%)
- "identical edit" errors should drop to near 0
- "oldString not found" errors should decrease by >50%
