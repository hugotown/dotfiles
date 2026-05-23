import { complete, type Model, type Api } from "@earendil-works/pi-ai";
import { convertToLlm, serializeConversation, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { customInstructions } from "./lib/template";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("cc", {
    description: "Ejecuta una compactación de contexto estructurada (Context-Compact strategy)",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("context-compact", "🧠 Compactando contexto de forma estructurada...");
      ctx.compact({
        customInstructions,
        replaceInstructions: true,
        onComplete: () => {
          ctx.ui.setStatus("context-compact", "");
          ctx.ui.notify("✅ Contexto compactado exitosamente bajo la nueva estructura.", "success");
        },
        onError: (error) => {
          ctx.ui.setStatus("context-compact", "");
          ctx.ui.notify(`❌ Falló la compactación: ${error.message}`, "error");
        }
      });
    }
  });

  pi.on("session_before_compact", async (event, ctx: ExtensionContext) => {
    if (event.customInstructions === customInstructions) return;

    ctx.ui.notify("🧹 Auto-compactación detectada, aplicando estructura Context-Compact...", "info");

    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    const model = ctx.model;
    if (!model) { ctx.ui.notify("No hay un modelo activo para compactar.", "warning"); return; }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) { ctx.ui.notify("Auth fallida, usando compactación default.", "warning"); return; }

    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    const conversationText = serializeConversation(convertToLlm(allMessages));
    const previousContext = previousSummary ? `\n\nResumen previo para contexto:\n${previousSummary}` : "";

    const summaryMessages = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `${customInstructions}\n\n${previousContext}\n\n<conversation>\n${conversationText}\n</conversation>` }],
      timestamp: Date.now(),
    }];

    try {
      const response = await complete(model, { messages: summaryMessages }, {
        apiKey: auth.apiKey, headers: auth.headers, maxTokens: 8192, signal,
      });
      const summary = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("\n");
      if (!summary.trim()) return;
      ctx.ui.notify("✅ Auto-compactación estructurada finalizada.", "success");
      return { compaction: { summary, firstKeptEntryId, tokensBefore } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`❌ Falló auto-compactación customizada: ${message}`, "error");
      return;
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Estrategia Context-Compact activa. Usa /cc para compactar.", "info");
  });
}
