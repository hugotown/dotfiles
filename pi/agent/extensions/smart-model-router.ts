import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Model, Api } from "@mariozechner/pi-ai";

// ============================================================================
// 1. CLASIFICACIÓN DINÁMICA DE MODELOS
// ============================================================================

// Clasifica cualquier modelo disponible en 3 categorías basado en su nombre
// y la lógica de Quality Scoring de Manifest (adaptada a los modelos disponibles en Pi)
function getModelTier(modelId: string): "simple" | "standard" | "complex" {
  const id = modelId.toLowerCase();
  
  // Modelos con nombre "mini", "haiku", "flash", "nano", "lite" son inherentemente simples (velocidad/costo)
  if (/\b(mini|haiku|flash|nano|lite|micro)\b/.test(id)) {
    // A menos que sean las nuevas versiones flash de razonamiento que ya caen en standard
    if (/gemini-(?:2\.5|3|3\.1)-flash/.test(id) && !/lite/.test(id)) return "standard";
    return "simple";
  }
  
  // Modelos "pesados", de razonamiento, opus o versiones frontier explícitas
  if (/\b(opus|max|reason|glm|minimax|kimi|pro-preview)\b/.test(id)) return "complex";
  if (/^gpt-5$/.test(id) || /^gpt-5\.4$/.test(id) || /o[1-4]/.test(id)) return "complex";
  if (/\b(sonnet-4-6|claude-opus)\b/.test(id)) return "complex";

  // Modelos balanceados: Sonnet, Pro, GPT-4, versiones base sin prefijo "mini" o "max"
  return "standard";
}

// Preferencia de proveedores (Menor número = Más preferido como fallback)
function getProviderPriority(provider: string): number {
  const priorities: Record<string, number> = {
    "github-copilot": 1,
    "opencode": 2,
    "google": 3,
    "anthropic": 4,
    "openai": 5,
    "opencode-go": 6
  };
  return priorities[provider] || 99;
}

// ============================================================================
// DATOS EXTERNOS Y CACHE
// ============================================================================
let modelsDevDb: any = null;
let openRouterDb: any = null;

// Obtener el precio total (input + output) ponderado
function getModelPrice(model: Model<Api>): number {
  let inputCost = 0;
  let outputCost = 0;
  let found = false;

  // 1. Intentar con OpenRouter primero (tiene precios actualizados de la API abierta)
  if (openRouterDb && openRouterDb.data) {
    // Buscamos un string matching (ej. anthropic/claude-3-haiku)
    const orModel = openRouterDb.data.find((m: any) => m.id.includes(model.id) || m.id.includes(model.id.replace("-latest", "")));
    if (orModel && orModel.pricing) {
      inputCost = parseFloat(orModel.pricing.prompt) * 1_000_000 || 0; // Costo por millon
      outputCost = parseFloat(orModel.pricing.completion) * 1_000_000 || 0;
      found = true;
    }
  }

  // 2. Fallback a models.dev si no lo encontramos en OpenRouter
  if (!found && modelsDevDb) {
    const providerData = modelsDevDb[model.provider];
    if (providerData && providerData.models) {
      const modelData = providerData.models[model.id];
      if (modelData && modelData.cost) {
        inputCost = modelData.cost.input || 0;
        outputCost = modelData.cost.output || 0;
        found = true;
      }
    }
  }

  if (!found) return 999; // Si no hay BD, lo mandamos al fondo

  // Calculamos un costo hipotético de 1 millon de tokens (800k in / 200k out)
  return (inputCost * 0.8) + (outputCost * 0.2);
}

// Valida si un modelo realmente soporta herramientas (Function Calling) usando las DBs de caché
function supportsTools(model: Model<Api>): boolean {
  // 1. Verificamos en OpenRouter (Buscamos "tools" dentro del array "supported_parameters")
  if (openRouterDb && openRouterDb.data) {
    const orModel = openRouterDb.data.find((m: any) => m.id.includes(model.id) || m.id.includes(model.id.replace("-latest", "")));
    if (orModel && Array.isArray(orModel.supported_parameters)) {
      if (orModel.supported_parameters.includes("tools")) return true;
      if (orModel.supported_parameters.includes("tool_choice")) return true;
    }
  }

  // 2. Verificamos en Models.dev (Tiene la llave explícita "tool_call: true")
  if (modelsDevDb) {
    const providerData = modelsDevDb[model.provider];
    if (providerData && providerData.models) {
      const modelData = providerData.models[model.id];
      if (modelData && modelData.tool_call === true) return true;
    }
  }

  // REGLAS HEURÍSTICAS DE SEGURIDAD (Si las DBs fallan o mienten como en el caso de Google Gemma nativo)
  const idLower = model.id.toLowerCase();
  
  // Por el momento, la API nativa de Google Vertex tira error 400 con Gemma al usar tools
  if (model.provider === "google" && idLower.includes("gemma")) return false;

  // Asumimos que los modelos top frontier de proveedores pesados SIEMPRE tienen tools por defecto 
  if (/(gpt|claude|gemini(?!.*gemma)|opus|sonnet|haiku)/.test(idLower)) return true;

  // Ante la duda total para un modelo muy exótico que no esté en la DB, preferimos no romper el agente.
  return true;
}

// Arma el árbol de tiers dinámicamente con los modelos disponibles
function getDynamicTiers(availableModels: Model<Api>[]) {
  const tiers: Record<string, Model<Api>[]> = {
    simple: [],
    standard: [],
    complex: []
  };

  for (const model of availableModels) {
    // Si sabemos categóricamente que no soporta tools, lo descartamos del routing
    if (!supportsTools(model)) continue;

    const tier = getModelTier(model.id);
    tiers[tier].push(model);
  }

  // Ordena por PRECIO ascendente (Más barato primero), 
  // En caso de precio igual o desconocido (ej. GitHub Copilot, que tiene costo 0),
  // ordena por prioridad de proveedor.
  for (const tier in tiers) {
    tiers[tier].sort((a, b) => {
      const priceA = getModelPrice(a);
      const priceB = getModelPrice(b);
      
      // Si ambos tienen el mismo precio (o son gratis como copilot)
      if (priceA === priceB) {
        const pA = getProviderPriority(a.provider);
        const pB = getProviderPriority(b.provider);
        if (pA !== pB) return pA - pB;
        return b.id.localeCompare(a.id); 
      }
      
      // Ordenar por precio ascendente
      return priceA - priceB;
    });
  }

  return tiers;
}

// ============================================================================
// 2. MOTOR DE SCORING (Basado en Manifest)
// ============================================================================
function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

// Dimensiones Estructurales
function scoreTokenCount(text: string): number {
  const estimatedTokens = text.length / 4;
  if (estimatedTokens < 50) return -0.5;
  if (estimatedTokens <= 200) return lerp(estimatedTokens, 50, 200, -0.5, 0);
  if (estimatedTokens <= 500) return lerp(estimatedTokens, 200, 500, 0, 0.3);
  return 0.5;
}

function scoreCodeToProse(text: string): number {
  if (text.length === 0) return 0;
  let codeChars = 0;
  const fencePattern = /```[\s\S]*?(?:```|$)/g;
  let match;
  while ((match = fencePattern.exec(text)) !== null) {
    codeChars += match[0].length;
  }
  if (codeChars === 0) return 0;
  const ratio = codeChars / text.length;
  return Math.min(0.9, ratio * 1.5);
}

function scoreConditionalLogic(text: string): number {
  const patterns = [/\bif\b.*?\bthen\b/gi, /\botherwise\b/gi, /\bunless\b/gi, /\bdepending on\b/gi];
  let count = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  if (count === 0) return 0;
  if (count === 1) return 0.3;
  if (count === 2) return 0.6;
  return 0.9;
}

// Dimensiones de Keywords (Simplificadas)
function scoreKeywords(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Tareas simples (Bajan el score)
  if (/hola|buenos dias|resume|traduce|explica brevemente|qué es|gracias|ayuda/.test(lowerText)) {
    score -= 0.4;
  }
  // Tareas complejas (Suben el score)
  if (/refactoriza|arquitectura|concurrencia|algoritmo|optimiza|prueba unitaria|regex|escalabilidad|diseño|despliegue|memoria/.test(lowerText)) {
    score += 0.5;
  }
  
  return score;
}

// Función principal de evaluación
function determineTier(historyText: string): string {
  let rawScore = 0;
  
  // Pesos basados en Manifest
  rawScore += scoreTokenCount(historyText) * 0.05;
  rawScore += scoreCodeToProse(historyText) * 0.02;
  rawScore += scoreConditionalLogic(historyText) * 0.03;
  rawScore += scoreKeywords(historyText) * 0.15; // Peso agregado para keywords en MVP

  // Umbrales de Manifest (Boundaries)
  if (rawScore <= -0.1) return "simple";
  if (rawScore <= 0.08) return "standard";
  return "complex";
}

// ============================================================================
// 3. PLUGIN DE PI
// ============================================================================
export default function (pi: ExtensionAPI) {
  pi.registerFlag("smart-router-default", {
    description: "Cambia de modelo automáticamente según la complejidad sin preguntar",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("smart-router-ask", {
    description: "Pregunta al usuario antes de cambiar el modelo mostrando 3 opciones",
    type: "boolean",
    default: false,
  });

  let currentModelId = "unknown";

  // Rastrear el modelo actual para no preguntar si ya estamos en él
  pi.on("model_select", async (event) => {
    currentModelId = event.model.id;
  });

  // ============================================================================
  // REGISTRO DE MANEJADORES EN EL GATEWAY
  // ============================================================================
  // Usamos import estático o asíncrono válido. En Node.js top-level await está permitido, 
  // pero dentro de una función regular (export default function) no. 
  // La mejor forma de interactuar con el gateway es escuchar a sus eventos si necesitamos desacoplarlo al máximo,
  // pero para no complicar, usaremos un require o simplemente registraremos el módulo.
  
  import("./flags-gateway.js").then(({ registerFlagHandler }) => {
    // Micro-Flag: Ruteo Silencioso
    registerFlagHandler(pi, {
      match: "--smart-router-default",
      priority: 5,
      execute: (state) => { state.shouldRoute = true; }
    });

    // Micro-Flag: Ruteo Interactivo
    registerFlagHandler(pi, {
      match: "--smart-router-ask",
      priority: 5,
      execute: (state) => { state.isInteractive = true; }
    });

    // Micro-Flags: Niveles Cognitivos (Atrapa cualquier nivel de pensamiento)
    registerFlagHandler(pi, {
      match: (prompt, piAPI) => {
        const thinkingFlags = ["minimal", "low", "medium", "high", "xhigh"];
        for (const level of thinkingFlags) {
          if (piAPI.getFlag(`--${level}-think`) || prompt.includes(`--${level}-think`)) {
            return level;
          }
        }
        return null;
      },
      priority: 10,
      execute: (state, ctx, piAPI, level: string) => {
        state.tier = "complex";
        state.thinking = level;
        state.shouldRoute = true;
        state.cleanPrompt = state.cleanPrompt.replace(`--${level}-think`, "").trim();
      }
    });

    // ============================================================================
    // EL MOTOR DE RUTEO (Prioridad 1000 - Corre al final de todo el pipeline)
    // ============================================================================
    registerFlagHandler(pi, {
      priority: 1000,
      execute: async (state, ctx) => {
        // 1. Decidir Tier
        const targetTier = state.tier === "auto" ? determineTier(state.fullContext) : state.tier;
        const forcedThinking = state.thinking;

        // 2. Buscar modelos
        let availableModels = ctx.modelRegistry.getAvailable();
        if (forcedThinking) {
          availableModels = availableModels.filter(m => m.reasoning === true);
        }

        const dynamicTiers = getDynamicTiers(availableModels);
        const candidates = dynamicTiers[targetTier] || [];
        
        if (forcedThinking) {
          candidates.sort((a, b) => getModelPrice(b) - getModelPrice(a)); 
        }
        
        const targetModel = candidates.length > 0 ? candidates[0] : null;

        // 3. Ejecutar Switch
        if (targetModel && (targetModel.id !== currentModelId || forcedThinking)) {
          let finalModel = targetModel;
          let performRoute = state.shouldRoute;

          if (!forcedThinking && state.isInteractive && !state.shouldRoute) {
            const top3 = candidates.slice(0, 3).map(m => `${m.id} (${m.provider})`);
            top3.push("Cancelar Ruteo");

            const choice = await ctx.ui.select(
              `La complejidad es [${targetTier.toUpperCase()}]. ¿Qué modelo deseas usar?`,
              top3
            );

            if (choice && choice !== "Cancelar Ruteo") {
              const chosenId = choice.split(" ")[0];
              const foundModel = candidates.find(m => m.id === chosenId);
              if (foundModel) {
                finalModel = foundModel;
                performRoute = true;
              }
            }
          }

          if (performRoute) {
            const success = await pi.setModel(finalModel);
            if (success) {
              if (forcedThinking) {
                pi.setThinkingLevel(forcedThinking as any);
                ctx.ui.setStatus("smart-router", `🧠 Rutado a ${finalModel.id} [${forcedThinking.toUpperCase()}]`);
              } else {
                ctx.ui.setStatus("smart-router", `🔀 Rutado a ${finalModel.id}`);
              }
              setTimeout(() => ctx.ui.setStatus("smart-router", ""), 5000);
            } else {
              ctx.ui.setStatus("smart-router", "❌ Falló el ruteo");
              setTimeout(() => ctx.ui.setStatus("smart-router", ""), 5000);
            }
          }
        }
      }
    });
  }).catch(() => {
    // Silencioso, si el gateway no existe no rompemos la app
  });

  let modelsDevDb: any = null;

  // Carga asíncrona de los precios en background al iniciar
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Smart Model Router activado 🔀", "info");
    
    // Lanzar fetches en background sin bloquear la UI
    Promise.allSettled([
      fetch("https://models.dev/api.json").then(res => res.json()),
      fetch("https://openrouter.ai/api/v1/models").then(res => res.json())
    ]).then(results => {
      if (results[0].status === "fulfilled") modelsDevDb = results[0].value;
      if (results[1].status === "fulfilled") openRouterDb = results[1].value;
      
      ctx.ui.setStatus("smart-router", "Precios sincronizados 💰");
      setTimeout(() => ctx.ui.setStatus("smart-router", ""), 3000);
    }).catch(err => {
      console.error("Error cargando precios", err);
    });
  });
}
