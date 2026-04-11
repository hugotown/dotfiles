/** @jsxImportSource @opentui/solid */
import type {
  TuiPlugin,
  TuiPluginApi,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"

// ── Timeout utility ──────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Enhancement timed out")), ms),
    ),
  ])
}

// ── Enhancement flow ─────────────────────────────────────────────────

async function triggerEnhance(
  api: TuiPluginApi,
  options: Record<string, unknown> | undefined,
) {
  // 1. Read current prompt by getting it through the state/client
  //    We clear + append as the replacement mechanism
  //    First, we need the current text — but the SDK client does not
  //    expose a "getPrompt" method. We use a workaround:
  //    The prompt is available through our captured ref (see slot below).

  // This function is called from the component which passes the current text
  throw new Error("triggerEnhance must be called from EnhanceButton component")
}

async function doEnhance(
  api: TuiPluginApi,
  currentPrompt: string,
  sessionId: string,
  options: Record<string, unknown> | undefined,
): Promise<string> {
  if (!currentPrompt.trim()) {
    api.ui.toast({
      variant: "warning",
      message: "Nothing to enhance — write a prompt first",
      duration: 2000,
    })
    throw new Error("Empty prompt")
  }

  // Create an ephemeral session for the rewrite
  const tempSession = await api.client.session.create({
    body: { title: "[prompt-enhancer] rewrite" },
  })
  const tempId = tempSession.data?.id ?? (tempSession as any)?.id

  if (!tempId) {
    throw new Error("Failed to create temp session")
  }

  try {
    // Build the model override if configured
    const modelOverride =
      options?.model &&
      typeof options.model === "object" &&
      "providerID" in (options.model as any)
        ? (options.model as { providerID: string; modelID: string })
        : undefined

    // We need to collect context + rewrite. Since the TUI plugin doesn't
    // have Bun $ shell access, we call the server's custom tool endpoint.
    // However, custom tools are invoked BY the LLM, not programmatically.
    //
    // Alternative: We send the raw prompt to the ephemeral session with
    // instructions to rewrite it, and the LLM uses its built-in tools
    // (read, bash, glob) to gather context and produce the enhanced version.
    //
    // This is actually MORE powerful — the LLM itself decides what context
    // to gather rather than our heuristic collectors.

    const rewriteInstruction = `You are a prompt engineer. Your ONLY job is to rewrite the user's rough prompt into a clear, specific, actionable prompt for an AI coding assistant.

BEFORE rewriting, use your available tools to gather project context:
1. Use bash to run: eza --tree --git-ignore -D . 2>&1 (or ls -R if eza unavailable)
2. Use bash to run: git status --short && git branch --show-current
3. Use bash to run: git diff --stat
4. If the prompt mentions specific concepts, use bash to run: rg "keyword" -t code -l --max-count 1
5. Check package.json or similar files for tech stack

After gathering context, rewrite the prompt following these rules:
- Preserve the user's INTENT completely
- Add specificity: which files, which functions, which patterns
- Add constraints: error handling, types, edge cases, existing patterns
- Reference specific files you discovered
- Keep the language of the original prompt (if Spanish, write in Spanish)
- Keep it concise — longer is not better, SPECIFIC is better

CRITICAL: Your FINAL message must contain ONLY the enhanced prompt text. No explanations, no markdown, no wrapping. Just the improved prompt.

---

The user's raw prompt to enhance:
${currentPrompt}`

    const result = await api.client.session.prompt({
      path: { id: tempId },
      body: {
        ...(modelOverride ? { model: modelOverride } : {}),
        parts: [{ type: "text" as const, text: rewriteInstruction }],
      },
    })

    // Extract text from the LLM response
    const responseParts =
      (result as any)?.data?.parts ?? (result as any)?.parts ?? []

    let enhanced = ""
    for (const part of responseParts) {
      if (part.type === "text" && part.text) {
        enhanced += part.text
      }
    }

    if (!enhanced.trim()) {
      throw new Error("LLM returned empty response")
    }

    return enhanced.trim()
  } finally {
    // Clean up ephemeral session
    try {
      await api.client.session.delete({ path: { id: tempId } })
    } catch {
      // Best effort
    }
  }
}

// ── UI Components ────────────────────────────────────────────────────

function EnhanceButton(props: {
  api: TuiPluginApi
  session_id: string
  options: Record<string, unknown> | undefined
  promptRef: { current: { input: string } } | undefined
}) {
  const [busy, setBusy] = createSignal(false)
  const theme = () => props.api.theme.current

  async function handleClick() {
    if (busy()) return

    // Read current prompt text
    const currentText = props.promptRef?.current?.input ?? ""
    if (!currentText.trim()) {
      props.api.ui.toast({
        variant: "warning",
        message: "Write a prompt first, then enhance it",
        duration: 2000,
      })
      return
    }

    setBusy(true)
    props.api.ui.toast({
      variant: "info",
      message: "Enhancing prompt...",
      duration: 3000,
    })

    try {
      const enhanced = await withTimeout(
        doEnhance(
          props.api,
          currentText,
          props.session_id,
          props.options,
        ),
        30000,
      )

      // Replace the prompt: clear then append the enhanced text
      await props.api.client.tui.clearPrompt()
      await props.api.client.tui.appendPrompt({
        body: { text: enhanced },
      })

      props.api.ui.toast({
        variant: "success",
        message: "Prompt enhanced — review and press Enter to send",
        duration: 3000,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg !== "Empty prompt") {
        props.api.ui.toast({
          variant: "error",
          message: `Enhancement failed: ${msg}`,
          duration: 4000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <box onMouseDown={handleClick} paddingLeft={1}>
      <text
        fg={busy() ? theme().textMuted : theme().accent}
        bold={!busy()}
      >
        {busy() ? "..." : "⚡"}
      </text>
    </box>
  )
}

// ── Plugin entry ─────────────────────────────────────────────────────

const tui: TuiPlugin = async (api, options, meta) => {
  // Shared state: capture prompt ref across slot registrations
  let capturedPromptRef: any = undefined

  // Register slots
  api.slots.register({
    order: 50,
    slots: {
      // Capture the prompt ref from session_prompt
      session_prompt(_ctx, props) {
        // Store the ref callback so we can capture the prompt ref
        const originalRef = props.ref
        props.ref = (ref: any) => {
          capturedPromptRef = ref
          originalRef?.(ref)
        }
        // Return null — we don't replace the prompt, just intercept the ref
        return null as any
      },

      // Render the enhance button to the right of the prompt
      session_prompt_right(ctx, props) {
        return (
          <EnhanceButton
            api={api}
            session_id={props.session_id}
            options={options}
            promptRef={capturedPromptRef}
          />
        )
      },
    },
  })

  // Register the keybind command
  const keybindValue =
    typeof options?.keybind === "string" ? options.keybind : "ctrl+shift+b"

  api.command.register(() => [
    {
      title: "Enhance Prompt",
      value: "plugin.prompt-enhancer.enhance",
      description: "Rewrite the current prompt with project context (⚡)",
      keybind: keybindValue,
      category: "Plugin",
      onSelect: async () => {
        const currentText = capturedPromptRef?.current?.input ?? ""
        if (!currentText.trim()) {
          api.ui.toast({
            variant: "warning",
            message: "Write a prompt first, then enhance it",
            duration: 2000,
          })
          return
        }

        // Get current session from route
        const route = api.route.current
        const sessionId =
          route.name === "session"
            ? (route.params as any)?.sessionID ?? ""
            : ""

        if (!sessionId) {
          api.ui.toast({
            variant: "warning",
            message: "Open a session first",
            duration: 2000,
          })
          return
        }

        api.ui.toast({
          variant: "info",
          message: "Enhancing prompt...",
          duration: 3000,
        })

        try {
          const enhanced = await withTimeout(
            doEnhance(
              api,
              currentText,
              sessionId,
              options,
            ),
            30000,
          )

          await api.client.tui.clearPrompt()
          await api.client.tui.appendPrompt({
            body: { text: enhanced },
          })

          api.ui.toast({
            variant: "success",
            message: "Prompt enhanced — review and press Enter",
            duration: 3000,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg !== "Empty prompt") {
            api.ui.toast({
              variant: "error",
              message: `Enhancement failed: ${msg}`,
              duration: 4000,
            })
          }
        }
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "prompt-enhancer",
  tui,
}

export default plugin
