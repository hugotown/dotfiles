// server.ts — Server plugin: collectors, classifier, and LLM rewrite
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { BunShell } from "@opencode-ai/plugin/shell"
import {
  classify,
  extractKeywords,
  REWRITE_SYSTEM_PROMPT,
  TECH_INDICATORS,
  type PromptCategory,
} from "./shared.ts"

// ── Logging ──────────────────────────────────────────────────────────
const LOG_DIR = `${process.env.HOME}/.config/opencode/prompt-enhancer`
const LOG_FILE = `${LOG_DIR}/plugin.log`

async function log($: BunShell, level: string, msg: string) {
  try {
    const ts = new Date().toISOString()
    const line = `${ts} [${level}] ${msg}`
    await $`mkdir -p ${LOG_DIR} && echo ${line} >> ${LOG_FILE}`.quiet()
  } catch {
    // Never fail on logging
  }
}

// ── Collectors ───────────────────────────────────────────────────────

async function projectStructure($: BunShell): Promise<string> {
  try {
    const result = await $`eza --tree --git-ignore -D . 2>&1`
      .nothrow()
      .quiet()
      .text()
    if (result.trim()) {
      const lines = result.split("\n")
      if (lines.length > 150) {
        return (
          lines.slice(0, 150).join("\n") +
          `\n... (truncated, ${lines.length} dirs total)`
        )
      }
      return result.trim()
    }
  } catch {
    // eza not available, fallback
  }
  try {
    const fallback =
      await $`find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' | head -100 2>&1`
        .nothrow()
        .quiet()
        .text()
    return fallback.trim()
  } catch {
    return "(could not read project structure)"
  }
}

async function gitState($: BunShell): Promise<string> {
  try {
    const branch = await $`git branch --show-current 2>&1`
      .nothrow()
      .quiet()
      .text()
    const status = await $`git status --short 2>&1`
      .nothrow()
      .quiet()
      .text()
    const diffStat = await $`git diff --stat 2>&1`
      .nothrow()
      .quiet()
      .text()

    const parts: string[] = []
    if (branch.trim()) parts.push(`Branch: ${branch.trim()}`)
    if (status.trim()) parts.push(`Modified files:\n${status.trim()}`)
    if (diffStat.trim()) parts.push(`Diff stat:\n${diffStat.trim()}`)
    return parts.join("\n") || "(clean working tree)"
  } catch {
    return "(git not available)"
  }
}

async function techStack($: BunShell): Promise<string> {
  const detected: string[] = []
  for (const { file, label } of TECH_INDICATORS) {
    try {
      await $`test -f ${file}`.quiet()
      if (!detected.includes(label)) detected.push(label)
    } catch {
      // file doesn't exist
    }
  }
  return detected.length > 0 ? detected.join(", ") : "Unknown"
}

async function relatedFiles(
  $: BunShell,
  keywords: string[],
): Promise<string> {
  if (keywords.length === 0) return "(no keywords to search)"

  const allFiles = new Set<string>()

  for (const keyword of keywords) {
    try {
      const result =
        await $`rg ${keyword} --type-add 'code:*.{ts,tsx,js,jsx,py,go,rs,java,rb,vue,svelte}' -t code -l --max-count 1 2>&1`
          .nothrow()
          .quiet()
          .text()
      for (const line of result.split("\n")) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("ERR")) {
          allFiles.add(trimmed)
        }
      }
    } catch {
      // rg not available or no results for this keyword
    }
  }

  const files = [...allFiles].slice(0, 10)
  return files.length > 0 ? files.join("\n") : "(no related files found)"
}

async function recentChanges($: BunShell): Promise<string> {
  try {
    const result = await $`git log --oneline -10 2>&1`
      .nothrow()
      .quiet()
      .text()
    return result.trim() || "(no recent commits)"
  } catch {
    return "(git not available)"
  }
}

async function conventions($: BunShell): Promise<string> {
  try {
    const parts: string[] = []

    // File naming pattern
    const files = await $`eza --git-ignore -1 src/ 2>&1`
      .nothrow()
      .quiet()
      .text()
    if (files.trim()) {
      const names = files
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 15)
      parts.push(`File names in src/: ${names.join(", ")}`)
    }

    // Test file pattern (search by filename, not content)
    const tests =
      await $`rg --files -g '*.{test,spec}.{ts,tsx,js,jsx}' . 2>&1`
        .nothrow()
        .quiet()
        .text()
    if (tests.trim()) {
      parts.push(`Test files found: ${tests.trim().split("\n").slice(0, 5).join(", ")}`)
    }

    return parts.join("\n") || "(could not detect conventions)"
  } catch {
    return "(could not detect conventions)"
  }
}

// ── Collector orchestrator ───────────────────────────────────────────

interface CollectedContext {
  category: PromptCategory
  tree: string
  git: string
  stack: string
  related: string
  changes?: string
  convs?: string
}

async function collectContext(
  $: BunShell,
  rawPrompt: string,
): Promise<CollectedContext> {
  const category = classify(rawPrompt)
  const keywords = extractKeywords(rawPrompt)

  // Run base collectors in parallel
  const [tree, git, stack] = await Promise.all([
    projectStructure($),
    gitState($),
    techStack($),
  ])

  // Run category-specific collectors
  let related = "(not applicable)"
  let changes: string | undefined
  let convs: string | undefined

  if (
    category === "debug" ||
    category === "code-change" ||
    category === "question" ||
    category === "refactor"
  ) {
    related = await relatedFiles($, keywords)
  }

  if (category === "debug") {
    changes = await recentChanges($)
  }

  if (category === "refactor") {
    convs = await conventions($)
  }

  return { category, tree, git, stack, related, changes, convs }
}

// ── Rewrite prompt builder ───────────────────────────────────────────

function buildRewriteUserPrompt(
  rawPrompt: string,
  ctx: CollectedContext,
): string {
  let prompt = `## Raw prompt\n${rawPrompt}\n\n`
  prompt += `## Project context\nCategory: ${ctx.category}\nTech stack: ${ctx.stack}\n\n`
  prompt += `## Git state\n${ctx.git}\n\n`
  prompt += `## Directory structure\n${ctx.tree}\n\n`
  prompt += `## Related files\n${ctx.related}\n`

  if (ctx.changes) {
    prompt += `\n## Recent changes\n${ctx.changes}\n`
  }
  if (ctx.convs) {
    prompt += `\n## Project conventions\n${ctx.convs}\n`
  }

  return prompt
}

// ── Plugin export ────────────────────────────────────────────────────

const PromptEnhancerServer: Plugin = async ({
  client,
  $,
  directory,
  worktree,
}) => {
  await log($, "INFO", `Server plugin loaded — dir: ${directory}`)

  return {
    tool: {
      enhance_prompt: tool({
        description:
          "Enhance a user prompt with project context. Called by the TUI plugin, not by the LLM directly.",
        args: {
          prompt: tool.schema
            .string()
            .describe("The raw user prompt to enhance"),
          model_provider: tool.schema
            .string()
            .optional()
            .describe("Override provider ID for the rewrite LLM"),
          model_id: tool.schema
            .string()
            .optional()
            .describe("Override model ID for the rewrite LLM"),
        },
        async execute(args, context) {
          const { prompt: rawPrompt, model_provider, model_id } = args

          if (!rawPrompt || rawPrompt.trim().length === 0) {
            return JSON.stringify({ error: "Empty prompt" })
          }

          await log($, "CLASSIFY", `"${rawPrompt.slice(0, 80)}..."`)

          // 1. Collect context
          const ctx = await collectContext($, rawPrompt)
          await log(
            $,
            "COLLECT",
            `category=${ctx.category} keywords=${extractKeywords(rawPrompt).join(",")}`,
          )

          // 2. Build rewrite prompt
          const rewriteUserPrompt = buildRewriteUserPrompt(rawPrompt, ctx)

          // 3. Create ephemeral session for the rewrite
          let tempSessionId: string | undefined
          try {
            const tempSession = await client.session.create({
              body: { title: "[prompt-enhancer] rewrite" },
            })
            tempSessionId = tempSession.data?.id

            if (!tempSessionId) {
              return JSON.stringify({ error: "Failed to create temp session" })
            }

            // 4. Call LLM in the ephemeral session
            const modelOverride =
              model_provider && model_id
                ? { providerID: model_provider, modelID: model_id }
                : undefined

            const result = await client.session.prompt({
              path: { id: tempSessionId },
              body: {
                ...(modelOverride ? { model: modelOverride } : {}),
                parts: [
                  {
                    type: "text" as const,
                    text:
                      REWRITE_SYSTEM_PROMPT + "\n\n---\n\n" + rewriteUserPrompt,
                  },
                ],
              },
            })

            // 5. Extract text from response
            // The result contains parts array; find text parts
            const responseParts = (result as any)?.data?.parts
              ?? (result as any)?.parts
              ?? []

            let enhanced = ""
            for (const part of responseParts) {
              if (part.type === "text" && part.text) {
                enhanced += part.text
              }
            }

            // If structured_output is available (via format), use that instead
            const structuredOutput = (result as any)?.data?.info?.structured_output
            if (structuredOutput?.enhanced_prompt) {
              enhanced = structuredOutput.enhanced_prompt
            }

            if (!enhanced.trim()) {
              return JSON.stringify({
                error: "LLM returned empty response",
              })
            }

            await log(
              $,
              "REWRITE",
              `Enhanced ${rawPrompt.length} → ${enhanced.length} chars`,
            )

            return JSON.stringify({
              enhanced: enhanced.trim(),
              category: ctx.category,
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            await log($, "ERROR", `Rewrite failed: ${msg}`)
            return JSON.stringify({ error: msg })
          } finally {
            // 6. Clean up ephemeral session
            if (tempSessionId) {
              try {
                await client.session.delete({
                  path: { id: tempSessionId },
                })
              } catch {
                // Best effort cleanup
              }
            }
          }
        },
      }),
    },

    // Show toast on session create
    event: async ({ event }: any) => {
      if (event.type === "session.created") {
        try {
          await client.tui.showToast({
            body: {
              message: "prompt-enhancer active (Ctrl+Shift+B)",
              variant: "success",
            },
          })
        } catch {
          // TUI not available
        }
      }
    },
  }
}

export default PromptEnhancerServer
export { PromptEnhancerServer }
