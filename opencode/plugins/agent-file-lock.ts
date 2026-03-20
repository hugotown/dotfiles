import type { Plugin } from "@opencode-ai/plugin"

interface LockInfo {
  sessionID: string
  tool: string
  acquiredAt: number
}

const activeLocks = new Map<string, LockInfo>()

// Auto-expire stale locks after 60s (safety net for crashed agents)
const LOCK_TTL_MS = 60_000

function isLockStale(lock: LockInfo): boolean {
  return Date.now() - lock.acquiredAt > LOCK_TTL_MS
}

function cleanStaleLocks(): void {
  for (const [filePath, lock] of activeLocks) {
    if (isLockStale(lock)) {
      activeLocks.delete(filePath)
    }
  }
}

// Track which tool calls had lock conflicts so we can handle them in after hook
const conflictedCalls = new Set<string>()

const LOG_FILE = `${process.env.HOME}/.config/opencode/test-file-lock/plugin.log`

const AgentFileLock: Plugin = async ({
  client,
  project,
  directory,
  worktree,
  $,
}) => {
  // Helper: write to our own log file via $ (bun shell)
  const log = async (level: string, msg: string) => {
    const ts = new Date().toISOString()
    const line = `${ts} [${level}] ${msg}`
    await $`echo ${line} >> ${LOG_FILE}`.quiet()
  }

  await log("INFO", `Plugin loaded — dir: ${directory}, worktree: ${worktree}`)

  let toastShown = false

  return {
    event: async ({ event }: any) => {
      if (event.type === "session.created" && !toastShown) {
        toastShown = true
        await client.tui.showToast({
          body: {
            message: "agent-file-lock plugin active",
            variant: "success",
          },
        })
      }
    },

    "tool.execute.before": async (input, output) => {
      const sid = (input.sessionID ?? "?").slice(0, 12)
      await log(
        "DEBUG",
        `[before] tool=${input.tool} session=${sid} args_keys=${JSON.stringify(Object.keys(output.args ?? {}))}`,
      )

      if (
        input.tool !== "edit" &&
        input.tool !== "write" &&
        input.tool !== "patch"
      )
        return

      const filePath =
        output.args?.file_path ?? output.args?.filePath ?? output.args?.path
      if (!filePath) return

      const sessionID = input.sessionID ?? "unknown"

      // Clean up any stale locks first
      cleanStaleLocks()

      const existingLock = activeLocks.get(filePath)

      // If locked by the same agent, refresh timestamp and proceed
      if (existingLock && existingLock.sessionID === sessionID) {
        existingLock.acquiredAt = Date.now()
        await log("DEBUG", `Lock refreshed: ${filePath} by ${sid}`)
        return
      }

      // If locked by another agent — redirect instead of blocking
      if (existingLock && existingLock.sessionID !== sessionID) {
        const ownerSid = existingLock.sessionID.slice(0, 12)
        const age = Math.round((Date.now() - existingLock.acquiredAt) / 1000)

        await log(
          "CONFLICT",
          `${sid} tried to ${input.tool} ${filePath} — locked by ${ownerSid} since ${age}s ago`,
        )

        // Track this call as conflicted for the after hook
        conflictedCalls.add(input.callID)

        // Inject a noReply message so the agent understands on its next iteration
        await client.session.prompt({
          path: { id: input.sessionID },
          body: {
            noReply: true,
            parts: [
              {
                type: "text",
                text:
                  `[agent-file-lock] File "${filePath}" is currently locked by another agent. ` +
                  `This edit will be skipped. Continue working on other files and come back to "${filePath}" later.`,
              },
            ],
          },
        })

        // Mutate args so the tool executes but does nothing harmful
        if (input.tool === "edit") {
          output.args.oldString = `__agent_file_lock_conflict_${input.callID}__`
          output.args.newString = `__agent_file_lock_conflict_${input.callID}__`
        } else if (input.tool === "write") {
          output.args.content = ""
          output.args.file_path = `/dev/null`
          if (output.args.filePath) output.args.filePath = `/dev/null`
          if (output.args.path) output.args.path = `/dev/null`
        } else if (input.tool === "patch") {
          output.args.patch = ""
        }

        return
      }

      // No lock exists — acquire it
      activeLocks.set(filePath, {
        sessionID,
        tool: input.tool,
        acquiredAt: Date.now(),
      })

      await log("LOCK", `Acquired: ${filePath} by ${sid} (${input.tool})`)
    },

    "tool.execute.after": async (input, output) => {
      if (
        input.tool !== "edit" &&
        input.tool !== "write" &&
        input.tool !== "patch"
      )
        return

      const sid = (input.sessionID ?? "?").slice(0, 12)
      const callID = input.callID ?? ""

      // If this was a conflicted call, override the output
      if (conflictedCalls.has(callID)) {
        conflictedCalls.delete(callID)
        const args = (input as any).args ?? {}
        const filePath =
          args.file_path ??
          args.filePath ??
          args.path ??
          args.file ??
          "unknown"
        output.output = `[agent-file-lock] Skipped — file "${filePath}" is locked by another agent. Work on other files and retry later.`
        await log("SKIPPED", `${sid} edit to ${filePath} was no-op'd`)
        return
      }

      // Normal flow — release the lock
      const args = output.args ?? (input as any).args ?? {}
      const filePath =
        args.file_path ?? args.filePath ?? args.path ?? args.file
      if (!filePath) return

      const sessionID = input.sessionID ?? "unknown"
      const lock = activeLocks.get(filePath)

      if (lock && lock.sessionID === sessionID) {
        activeLocks.delete(filePath)
        const duration = Date.now() - lock.acquiredAt
        await log(
          "RELEASE",
          `${filePath} by ${sid} (held ${duration}ms)`,
        )
      }
    },
  }
}

export default AgentFileLock
export { AgentFileLock }
