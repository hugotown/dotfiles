import { complete, type Model, type Api } from "@mariozechner/pi-ai";
import { convertToLlm, serializeConversation, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // === 1. PLANTILLA ESTRICTA DE COMPACTACIÓN ===
  const customInstructions = `
Actúa como un arquitecto de software documentando el traspaso de un proyecto.
Resume el contexto de la conversación adjunta usando EXACTAMENTE esta estructura en Markdown.
NO agregues introducciones ni conclusiones fuera de esta estructura.

## 1. Objetivo de la Sesión (Session Objective)
[¿Cuál era el objetivo principal original?]

## 2. Intenciones (Intended)
[¿Qué se pretendía lograr exactamente en esta fase?]

## 3. Logros (Achieved)
[Lista concreta de qué tareas, configuraciones o características ya están funcionando]

## 4. Pendientes (Pending)
[¿Qué falta por lograr? Tareas inmediatas a seguir]

## 5. Decisiones Tomadas (Key Decisions)
[Decisiones técnicas, arquitectónicas o de diseño clave y por qué se tomaron]

## 6. Callejones Sin Salida (Dead-ends & Blockers)
[Intentos fallidos, errores recurrentes o enfoques que NO funcionaron para no repetirlos]

## 7. Estado del Entorno (Environment & Key Files)
[Servidores corriendo, dependencias instaladas, puertos, y un resumen rápido de qué hace ahora cada archivo clave modificado]
`;

  // === 2. COMANDO MANUAL (/cc) ===
  pi.registerCommand("cc", {
    description: "Ejecuta una compactación de contexto estructurada (Context-Compact strategy)",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("context-compact", "🧠 Compactando contexto de forma estructurada...");
      ctx.compact({
        customInstructions: customInstructions,
        replaceInstructions: true, // Reemplazamos las instrucciones por defecto de Pi
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

  // === 3. INTERCEPTAR AUTO-COMPACTACIÓN ===
  // Esto se dispara cuando el contexto supera los tokens permitidos.
  pi.on("session_before_compact", async (event, ctx: ExtensionContext) => {
    // Si la compactación ya trae nuestras customInstructions (fue disparada por /cc), dejamos que fluya nativamente
    if (event.customInstructions === customInstructions) {
      return; 
    }

    ctx.ui.notify("🧹 Auto-compactación detectada, aplicando estructura Context-Compact...", "info");

    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    // Usamos el modelo principal seleccionado actualmente
    const model = ctx.modelRegistry.getActive();
    if (!model) {
      ctx.ui.notify("No hay un modelo activo para compactar.", "warning");
      return;
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      ctx.ui.notify("Auth fallida para el modelo, usando compactación default.", "warning");
      return;
    }

    // Unimos los mensajes que necesitan ser resumidos
    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    
    // Convertimos los mensajes a texto plano limpio (serializado)
    const conversationText = serializeConversation(convertToLlm(allMessages));
    const previousContext = previousSummary ? `\n\nResumen previo para contexto:\n${previousSummary}` : "";

    const summaryMessages = [{
      role: "user" as const,
      content: [{
        type: "text" as const,
        text: `${customInstructions}\n\n${previousContext}\n\n<conversation>\n${conversationText}\n</conversation>`
      }],
      timestamp: Date.now(),
    }];

    try {
      // Llamamos al modelo explícitamente para que genere el resumen con nuestra estructura
      const response = await complete(
        model,
        { messages: summaryMessages },
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          maxTokens: 8192,
          signal,
        }
      );

      const summary = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      if (!summary.trim()) return; // Si falla o viene vacío, Pi hará fallback al default

      ctx.ui.notify("✅ Auto-compactación estructurada finalizada.", "success");

      // Devolvemos la compactación customizada y Pi reescribirá el árbol de la sesión
      return {
        compaction: {
          summary,
          firstKeptEntryId,
          tokensBefore,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`❌ Falló auto-compactación customizada: ${message}`, "error");
      return; // Fallback al default de Pi
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Estrategia Context-Compact activa. Usa /cc para compactar.", "info");
  });
}
