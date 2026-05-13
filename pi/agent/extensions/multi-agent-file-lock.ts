import { join, resolve, dirname } from "node:path";
import { mkdirSync, rmdirSync, statSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

// ============================================================================
// SISTEMA DE LOCKING POR ARCHIVO (CENTRALIZADO EN .pi/locks)
// ============================================================================
function getLockPath(ctx: ExtensionContext, targetFilePath: string): string {
  const absolutePath = resolve(ctx.cwd, targetFilePath);
  // Transformamos la ruta absoluta en un nombre de carpeta seguro
  const safeName = absolutePath.replace(/[^a-zA-Z0-9]/g, "_") + ".lock";
  return join(ctx.cwd, ".pi", "locks", safeName);
}

function tryAcquireLock(lockPath: string): boolean {
  try {
    mkdirSync(lockPath, { recursive: false });
    return true; 
  } catch (e: any) {
    if (e.code === 'EEXIST') {
      try {
        // Anti Stale-Locks: Si tiene más de 30s de antigüedad, lo rompemos
        const stats = statSync(lockPath);
        const ageInMs = Date.now() - stats.mtimeMs;
        if (ageInMs > 30000) { 
          rmdirSync(lockPath);
          return tryAcquireLock(lockPath);
        }
      } catch (err) {}
      return false; 
    }
    if (e.code === 'ENOENT') {
      mkdirSync(dirname(lockPath), { recursive: true });
      return tryAcquireLock(lockPath);
    }
    throw e;
  }
}

function releaseLock(lockPath: string) {
  try { rmdirSync(lockPath); } catch (e) {}
}

export default function (pi: ExtensionAPI) {
  const activeLocks = new Set<string>();

  pi.on("session_start", async (_event, ctx) => {
    try { mkdirSync(join(ctx.cwd, ".pi", "locks"), { recursive: true }); } catch (e) {}
  });

  // 1. INTERCEPTAR ANTES DE EJECUTAR
  pi.on("tool_call", async (event, ctx) => {
    let targetPath: string | null = null;

    if (isToolCallEventType("edit", event)) targetPath = event.input.path;
    if (isToolCallEventType("write", event)) targetPath = event.input.path;

    if (targetPath) {
      const lockPath = getLockPath(ctx, targetPath);
      
      const success = tryAcquireLock(lockPath);
      if (success) {
        activeLocks.add(lockPath);
      } else {
        ctx.ui.notify(`⚠️ Multi-Agent: El archivo ${targetPath} está ocupado por otro proceso.`, "warning");

        return { 
          block: true, 
          reason: `SYSTEM ALERT: The file "${targetPath}" is currently LOCKED by another agent or process. ` +
                  `DO NOT attempt to write or edit it right now. Please continue with another task, ` +
                  `or read/analyze a different file, and try editing this one later in the conversation.`
        };
      }
    }
  });

  // 2. LIBERAR DESPUÉS DE EJECUTAR
  pi.on("tool_result", async (event, ctx) => {
    let targetPath: string | null = null;

    if (event.toolName === "edit" || event.toolName === "write") {
      targetPath = (event.input as any).path;
    }

    if (targetPath) {
      const lockPath = getLockPath(ctx, targetPath);
      if (activeLocks.has(lockPath)) {
        releaseLock(lockPath);
        activeLocks.delete(lockPath);
      }
    }
  });

  // 3. LIMPIEZA EN CASO DE SALIDA (Ctrl+C o fin de proceso)
  pi.on("session_shutdown", async () => {
    for (const lockPath of activeLocks) {
      releaseLock(lockPath);
    }
    activeLocks.clear();
  });
}
