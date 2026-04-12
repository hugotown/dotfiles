# `smart-edit-guard` Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an OpenCode plugin that intercepts `edit` tool calls and prevents common errors (identical edits, missing oldString, stale content) before they reach the engine.

**Architecture:** A single TypeScript plugin file using `tool.execute.before` hook to apply 3 sequential validation guards. Reads files via `Bun.file()` API. Throws descriptive errors on validation failure. Coexists with existing `agent-file-lock.ts` plugin.

**Tech Stack:** TypeScript, `@opencode-ai/plugin` types, Bun runtime APIs.

---

## File Structure

- **Create:** `~/.config/opencode/plugins/smart-edit-guard.ts` — the complete plugin

---

### Task 1: Create the plugin with Guard 1 (Identical Edit Detection)

**Files:**
- Create: `~/.config/opencode/plugins/smart-edit-guard.ts`

- [ ] **Step 1: Create the plugin file with Guard 1**

Create `~/.config/opencode/plugins/smart-edit-guard.ts`:

```typescript
import type { Plugin } from "@opencode-ai/plugin"

/**
 * smart-edit-guard — Validates edit tool calls before execution.
 *
 * Guards:
 *  1. Identical edit detection (oldString === newString)
 *  2. oldString existence validation with closest-match hint
 *  3. Fresh file read for stale-content prevention (implicit in Guard 2)
 */
const SmartEditGuard: Plugin = async ({ client }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit") return

      const { oldString, newString, filePath } = output.args ?? {}

      // Skip if args are missing (let the engine handle it)
      if (!oldString || !filePath) return

      // ── Guard 1: Identical edit detection ──
      if (oldString === newString) {
        throw new Error(
          `[smart-edit-guard] Edit blocked: oldString and newString are identical. ` +
          `No change needed. Re-read the file to verify current state before editing.`
        )
      }
    },
  }
}

export default SmartEditGuard
export { SmartEditGuard }
```

- [ ] **Step 2: Verify the plugin loads without errors**

Restart OpenCode (or start a new session) and check that no plugin loading errors appear. The plugin should coexist with `agent-file-lock.ts`.

Run:
```bash
opencode run "say hello" --dir /tmp 2>&1 | head -20
```

Expected: No plugin errors in output. Session starts normally.

- [ ] **Step 3: Commit**

```bash
git add plugins/smart-edit-guard.ts
git commit -m "feat: add smart-edit-guard plugin with identical edit detection"
```

---

### Task 2: Add Guard 2 (oldString Existence Validation)

**Files:**
- Modify: `~/.config/opencode/plugins/smart-edit-guard.ts`

- [ ] **Step 1: Add the findClosestMatch helper function**

Add this function BEFORE the `SmartEditGuard` const:

```typescript
/**
 * Find the line in content that has the longest common substring
 * with the search string. Returns { lineNum, line, score }.
 */
function findClosestMatch(
  content: string,
  search: string,
): { lineNum: number; line: string; score: number } | null {
  const lines = content.split("\n")
  // Use first 60 chars of search for matching (performance bound)
  const needle = search.slice(0, 60).trim()
  if (!needle) return null

  let bestScore = 0
  let bestLine = ""
  let bestLineNum = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Check overlapping substrings of decreasing length
    for (let len = needle.length; len >= Math.min(10, needle.length); len--) {
      for (let start = 0; start <= needle.length - len; start++) {
        const sub = needle.slice(start, start + len)
        if (line.includes(sub) && len > bestScore) {
          bestScore = len
          bestLine = line
          bestLineNum = i + 1 // 1-indexed
          break
        }
      }
      if (bestScore >= len) break
    }
  }

  // Only return if we found something meaningful (at least 10 chars match)
  if (bestScore < Math.min(10, needle.length)) return null
  return { lineNum: bestLineNum, line: bestLine, score: bestScore }
}
```

- [ ] **Step 2: Add Guard 2 to the before hook**

Inside the `tool.execute.before` handler, AFTER Guard 1, add:

```typescript
      // ── Guard 2: oldString existence validation (fresh read) ──
      let fileContent: string
      try {
        fileContent = await Bun.file(filePath).text()
      } catch (err: any) {
        throw new Error(
          `[smart-edit-guard] Cannot read file: ${filePath}. ` +
          `Error: ${err?.message ?? "unknown"}. Verify the file path exists.`
        )
      }

      if (!fileContent.includes(oldString)) {
        const closest = findClosestMatch(fileContent, oldString)
        const hint = closest
          ? `\nClosest match at line ${closest.lineNum}: '${closest.line.trim().slice(0, 100)}'`
          : "\nNo similar content found."

        throw new Error(
          `[smart-edit-guard] oldString not found in ${filePath}. ` +
          `The file content does not contain the exact text you specified.${hint}\n` +
          `Re-read the file and use the exact content for oldString.`
        )
      }
```

- [ ] **Step 3: Verify the complete file compiles**

Read the full file and verify:
1. Imports are correct
2. `findClosestMatch` is defined before `SmartEditGuard`
3. Guard 1 and Guard 2 are in sequence inside `tool.execute.before`
4. Exports are at the bottom

- [ ] **Step 4: Commit**

```bash
git add plugins/smart-edit-guard.ts
git commit -m "feat(smart-edit-guard): add oldString existence validation with closest-match hints"
```

---

### Task 3: Integration test with OpenCode

**Files:**
- Read: `~/.config/opencode/plugins/smart-edit-guard.ts`

- [ ] **Step 1: Test Guard 1 — Identical edit detection**

Create a test file and attempt an identical edit:

```bash
echo "hello world" > /tmp/test-edit-guard.txt
opencode run --dir /tmp "Use the edit tool to edit /tmp/test-edit-guard.txt. Set oldString to 'hello world' and newString to 'hello world' (identical). Report what happens." 2>&1
```

Expected: The edit should be blocked by the plugin with message containing `[smart-edit-guard] Edit blocked: oldString and newString are identical`.

- [ ] **Step 2: Test Guard 2 — oldString not found**

```bash
opencode run --dir /tmp "Use the edit tool to edit /tmp/test-edit-guard.txt. Set oldString to 'this text does not exist in the file' and newString to 'replacement'. Report what happens." 2>&1
```

Expected: The edit should be blocked with message containing `[smart-edit-guard] oldString not found` and a closest-match hint.

- [ ] **Step 3: Test normal edit still works**

```bash
opencode run --dir /tmp "Use the edit tool to edit /tmp/test-edit-guard.txt. Change 'hello world' to 'goodbye world'. Report what happens." 2>&1
```

Expected: The edit should succeed normally (plugin passes through).

- [ ] **Step 4: Clean up test file**

```bash
rm /tmp/test-edit-guard.txt
```

- [ ] **Step 5: Final commit**

```bash
git add plugins/smart-edit-guard.ts
git commit -m "feat(smart-edit-guard): complete plugin with all guards verified"
```
