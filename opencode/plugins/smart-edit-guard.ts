import type { Plugin } from "@opencode-ai/plugin"

/**
 * smart-edit-guard — Validates edit tool calls before execution.
 *
 * Guards:
 *  1. Identical edit detection (oldString === newString)
 *  2. oldString existence validation with closest-match hint
 *  3. Fresh file read for stale-content prevention (implicit in Guard 2)
 */

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
            `No change needed. Re-read the file to verify current state before editing.`,
        )
      }

      // ── Guard 2: oldString existence validation (fresh read) ──
      let fileContent: string
      try {
        fileContent = await Bun.file(filePath).text()
      } catch (err: any) {
        throw new Error(
          `[smart-edit-guard] Cannot read file: ${filePath}. ` +
            `Error: ${err?.message ?? "unknown"}. Verify the file path exists.`,
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
            `Re-read the file and use the exact content for oldString.`,
        )
      }
    },
  }
}

export default SmartEditGuard
export { SmartEditGuard }
