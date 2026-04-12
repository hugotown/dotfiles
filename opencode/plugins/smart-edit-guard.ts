import type { Plugin } from "@opencode-ai/plugin"

/**
 * smart-edit-guard — Validates edit/write tool calls before and after execution.
 *
 * Read tracking:
 *  0. Tracks file reads per session to detect "edit without read" early,
 *     before the engine's own filetime.assert() check. This gives a faster,
 *     more actionable error message.
 *
 * Pre-execution guards (tool.execute.before):
 *  1. Read-before-write enforcement (edit + write tools)
 *  2. Identical edit detection (oldString === newString)
 *  3. oldString existence validation with closest-match hint
 *  4. Fresh file read for stale-content prevention (implicit in Guard 3)
 *
 * Post-execution enrichment (tool.execute.after):
 *  5. Stale-file error enrichment — when the engine rejects an edit because
 *     the file was modified since last read, we check the current file state
 *     and tell the agent whether the edit is still viable or not.
 *  6. Generic edit error enrichment — catch-all for other edit failures,
 *     providing actionable recovery instructions.
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
  // Track which files have been read per session.
  // Eviction: entries older than 30 minutes are purged on each read.
  const readTracker = new Map<string, Map<string, number>>()
  const READ_TTL_MS = 30 * 60 * 1000

  function trackRead(sessionID: string, filePath: string): void {
    if (!readTracker.has(sessionID)) readTracker.set(sessionID, new Map())
    readTracker.get(sessionID)!.set(filePath, Date.now())
  }

  function hasRead(sessionID: string, filePath: string): boolean {
    const reads = readTracker.get(sessionID)
    if (!reads) return false
    const ts = reads.get(filePath)
    if (!ts) return false
    // Stale reads don't count
    if (Date.now() - ts > READ_TTL_MS) {
      reads.delete(filePath)
      return false
    }
    return true
  }

  function evictStaleReads(): void {
    const cutoff = Date.now() - READ_TTL_MS
    for (const [sessionID, reads] of readTracker) {
      for (const [fp, ts] of reads) {
        if (ts < cutoff) reads.delete(fp)
      }
      if (reads.size === 0) readTracker.delete(sessionID)
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      // ── Guard 0: Read-before-write enforcement (edit + write) ──
      if (input.tool === "edit" || input.tool === "write") {
        const filePath = output.args?.filePath
        const sessionID = (input as any).sessionID
        if (filePath && sessionID && !hasRead(sessionID, filePath)) {
          // Check if file exists — new files don't need a prior read
          try {
            const stat = await Bun.file(filePath).exists()
            if (stat) {
              throw new Error(
                `[smart-edit-guard] You must read ${filePath} before editing/writing it.\n` +
                  `Action: Use the Read tool to read the file first, then retry your edit.\n` +
                  `This prevents edits based on stale or assumed content.`,
              )
            }
          } catch (err: any) {
            // If the error is our own, re-throw. Otherwise file doesn't exist, skip guard.
            if (err?.message?.includes("[smart-edit-guard]")) throw err
          }
        }
      }

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

    // ── Post-execution: Read tracking + Error enrichment ──
    "tool.execute.after": async (input, output) => {
      // Track file reads for read-before-write enforcement
      if (input.tool === "read") {
        const sessionID = (input as any).sessionID
        const filePath = (input as any).args?.filePath ?? output.args?.filePath
        if (sessionID && filePath) {
          trackRead(sessionID, filePath)
          evictStaleReads()
        }
        return
      }

      // Track successful edits/writes as implicit reads (file content is now known)
      if (input.tool === "edit" || input.tool === "write") {
        const sessionID = (input as any).sessionID
        const filePath = (input as any).args?.filePath ?? output.args?.filePath
        const errorOutput = output.output
        const isError = typeof errorOutput === "string" &&
          (errorOutput.startsWith("Error:") || errorOutput.startsWith("error:"))
        if (sessionID && filePath && !isError) {
          trackRead(sessionID, filePath)
        }
      }

      if (input.tool !== "edit") return

      const errorOutput = output.output
      if (!errorOutput || typeof errorOutput !== "string") return

      // Only enrich error outputs (successful edits don't need enrichment)
      const isError =
        errorOutput.startsWith("Error:") ||
        errorOutput.startsWith("error:")
      if (!isError) return

      const { oldString, filePath } = input.args ?? {}
      if (!filePath) return

      // ── Guard 4: Stale-file error enrichment ──
      if (errorOutput.includes("has been modified since")) {
        let enriched: string
        try {
          const currentContent = await Bun.file(filePath).text()
          const stillExists = oldString && currentContent.includes(oldString)

          if (stillExists) {
            enriched =
              `[smart-edit-guard] File was modified externally since your last read.\n` +
              `Your oldString STILL EXISTS in the current file — your edit is likely still valid.\n` +
              `Action: Re-read the file with the read tool, then retry your exact same edit.\n` +
              `File: ${filePath}`
          } else {
            const closest = oldString
              ? findClosestMatch(currentContent, oldString)
              : null
            const hint = closest
              ? `\nClosest match at line ${closest.lineNum}: '${closest.line.trim().slice(0, 100)}'`
              : ""

            enriched =
              `[smart-edit-guard] File was modified externally and your oldString NO LONGER EXISTS.${hint}\n` +
              `Action: Re-read the file with the read tool to see the current state, then construct a new edit.\n` +
              `File: ${filePath}`
          }
        } catch {
          enriched =
            `[smart-edit-guard] File was modified externally since your last read.\n` +
            `Action: Re-read the file with the read tool before retrying.\n` +
            `File: ${filePath}`
        }

        output.output = enriched
        return
      }

      // ── Guard 5: Generic edit error enrichment ──
      // Catch-all for other edit errors not handled by before-hooks
      // (e.g., engine-level validation that runs after the plugin)
      if (
        errorOutput.includes("oldString not found") ||
        errorOutput.includes("Could not find oldString")
      ) {
        // Before-hook should have caught this, but if the engine throws
        // its own version, enrich it with a closest-match hint
        try {
          const currentContent = await Bun.file(filePath).text()
          const closest = oldString
            ? findClosestMatch(currentContent, oldString)
            : null
          if (closest) {
            output.output =
              `${errorOutput}\n` +
              `[smart-edit-guard] Closest match at line ${closest.lineNum}: '${closest.line.trim().slice(0, 100)}'\n` +
              `Re-read the file and use the exact content for oldString.`
          }
        } catch {
          // Can't read file, leave original error
        }
        return
      }

      if (errorOutput.includes("oldString and newString are identical")) {
        output.output =
          `[smart-edit-guard] No-op edit detected: oldString and newString are identical.\n` +
          `This edit would make no changes. Re-read the file to verify its current state.\n` +
          `File: ${filePath}`
        return
      }
    },
  }
}

export default SmartEditGuard
export { SmartEditGuard }
