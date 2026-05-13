import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ============================================================================
// 1. EL ESTADO COMPARTIDO (Single Source of Truth)
// ============================================================================
export interface GatewayState {
  tier: "auto" | "simple" | "standard" | "complex";
  thinking: string | null;
  isInteractive: boolean;
  shouldRoute: boolean;
  systemInjections: string[];
  cleanPrompt: string;
  fullContext: string;
  [key: string]: any; // Abierto a extensión para otros módulos
}

// ============================================================================
// 2. EL CONTRATO SOLID (Interface para los módulos)
// ============================================================================
export interface IFlagHandler {
  /**
   * String: Busca la flag exacta o texto en el prompt.
   * Function: Lógica custom. Si retorna truthy, ejecuta el handler y le pasa el valor.
   * Si no se define, el handler se ejecuta SIEMPRE (ej. Ejecutores finales).
   */
  match?: string | ((prompt: string, pi: ExtensionAPI) => any);
  
  /** Mayor prioridad = Se ejecuta al final del pipeline (Sobrescribe a los de menor) */
  priority: number;
  
  /** Lógica de mutación del estado o side-effects */
  execute: (state: GatewayState, ctx: ExtensionContext, pi: ExtensionAPI, matchData?: any) => Promise<void> | void;
}

// ============================================================================
// 3. PLUGIN REGISTRY — Facade preserves encapsulation via Mediator pattern
// ============================================================================
//
// Why this is non-trivial:
//   `~/.pi` is a symlink to `~/.config/pi`. Pi auto-loads this file via the
//   symlinked path, while consumer extensions doing `import("./flags-gateway.js")`
//   resolve through the canonical path. jiti caches them as DIFFERENT module
//   instances, each with its own module-scoped state. That means two siblings
//   of "this file" coexist in memory and don't share `handlers`.
//
// The fix preserves the Facade pattern's encapsulation by NOT leaking state to
// globalThis. Instead it uses `pi.events` (the host's singleton event bus) as a
// Mediator: consumers send registration intents through the bus, and the single
// instance whose `default()` was actually invoked by pi (the one wired into
// `before_agent_start`) listens on the bus and absorbs the registrations into
// its own closure. The bus is owned by pi itself and is identical across
// module instances, so coordination is reliable regardless of duplication.
//
// Ordering is handled by a REPLAY signal emitted by the listening instance on
// boot: any consumer that registered "too early" re-emits when prompted.
// ============================================================================

const REGISTER_EVENT = "flags-gateway:register";
const REPLAY_EVENT = "flags-gateway:replay";

/**
 * Register a flag handler with the Facade.
 *
 * Takes `pi` so the call routes through the host's shared event bus, sidestepping
 * any module-instance fragmentation in the loader. Consumers should always import
 * this function from `./flags-gateway.js` and pass their own `pi` reference.
 */
export function registerFlagHandler(pi: ExtensionAPI, handler: IFlagHandler): void {
  pi.events.emit(REGISTER_EVENT, handler);
  // Re-emit on demand so a consumer that registered before the Facade was
  // ready can be replayed once it comes online.
  pi.events.on(REPLAY_EVENT, () => pi.events.emit(REGISTER_EVENT, handler));
}

export default function (pi: ExtensionAPI) {
  // Closure-encapsulated state: only THIS instance (the one pi actually wired
  // up via the symlinked path) owns the handlers list.
  const handlers: IFlagHandler[] = [];
  const registered = new Set<IFlagHandler>();

  // Mediator subscription: anyone in the process can register via pi.events.
  pi.events.on(REGISTER_EVENT, (handler: IFlagHandler) => {
    if (registered.has(handler)) return; // Idempotent — replays don't duplicate
    registered.add(handler);
    handlers.push(handler);
    handlers.sort((a, b) => a.priority - b.priority);
  });

  // Ask any consumer that registered before us to replay their intent.
  // Loaders may fire consumer factories before this Facade's, so this catches
  // the early birds.
  pi.events.emit(REPLAY_EVENT, undefined);

  pi.on("before_agent_start", async (event, ctx: ExtensionContext) => {
    // 1. Construir el contexto histórico para quienes lo necesiten
    const branch = ctx.sessionManager.getBranch();
    let fullContext = "";
    for (const entry of branch) {
      if (entry.type === "message" && entry.message.role === "user") {
        fullContext += entry.message.content + "\n";
      }
    }
    fullContext += event.prompt;

    // 2. Inicializar el Estado Maestro
    const state: GatewayState = {
      tier: "auto",
      thinking: null,
      isInteractive: false,
      shouldRoute: false,
      systemInjections: [],
      cleanPrompt: event.prompt,
      fullContext: fullContext
    };

    // 3. Ejecutar el Pipeline (Chain of Responsibility)
    for (const handler of handlers) {
      let matched = false;
      let matchData: any = null;
      
      if (!handler.match) {
        // Handler maestro que corre siempre
        matched = true;
      } else if (typeof handler.match === "string") {
        if (pi.getFlag(handler.match) || state.cleanPrompt.includes(handler.match)) {
          matched = true;
          state.cleanPrompt = state.cleanPrompt.replace(handler.match, "").trim();
        }
      } else if (typeof handler.match === "function") {
        matchData = handler.match(state.cleanPrompt, pi);
        if (matchData) {
          matched = true;
        }
      }

      // Si aplica, mutar el estado
      if (matched) {
        await handler.execute(state, ctx, pi, matchData);
      }
    }

    // 4. Retornar las modificaciones al Core de Pi
    const responseOptions: any = {};
    if (state.cleanPrompt !== event.prompt) {
      responseOptions.prompt = state.cleanPrompt;
    }
    if (state.systemInjections.length > 0) {
      responseOptions.systemPrompt = event.systemPrompt + "\n\n" + state.systemInjections.join("\n\n");
    }

    return Object.keys(responseOptions).length > 0 ? responseOptions : undefined;
  });
}
