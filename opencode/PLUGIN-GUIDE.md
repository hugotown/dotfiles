# OpenCode Plugin Development Guide

Guia basada en errores reales y soluciones verificadas durante el desarrollo del plugin `file-lock-manager`.

## 1. Estructura de archivos

```
.opencode/
  package.json                  # Dependencias del plugin
  plugins/
    my-plugin.ts                # Plugin file (auto-loaded at startup)
```

OpenCode carga automaticamente todos los archivos en `.opencode/plugins/` al iniciar. No necesitas registrar nada manualmente.

## 2. package.json

```json
{
  "name": "opencode-plugins",
  "private": true,
  "dependencies": {
    "@opencode-ai/plugin": "1.2.17"
  }
}
```

OpenCode ejecuta `bun install` automaticamente al startup. No necesitas hacerlo manualmente.

## 3. Anatomia de un plugin

### CORRECTO - Plugin como async function

```typescript
import type { Plugin } from "@opencode-ai/plugin"

const MyPlugin: Plugin = async ({ client, directory, project, worktree, $ }) => {
  // Initialization code runs once at startup

  return {
    "tool.execute.before": async (input, output) => {
      // Hook logic
    },
  }
}

export default MyPlugin
```

### INCORRECTO - Objeto plano (causa error "fn is not a function")

```typescript
// MAL - Esto NO funciona
export default {
  name: "my-plugin",
  hooks: {
    "tool.execute.before": (output) => { ... }
  }
} satisfies Plugin
```

### INCORRECTO - Solo named export sin default

```typescript
// RIESGOSO - Puede no cargar dependiendo de la version
export const MyPlugin: Plugin = async (ctx) => { ... }
// Falta: export default MyPlugin
```

### Regla de oro

Siempre usa `export default` apuntando a una funcion async que reciba el contexto y retorne los hooks.

## 4. Contexto del plugin (ctx)

```typescript
const MyPlugin: Plugin = async ({ client, directory, project, worktree, $ }) => {
  // client    - SDK client para logging y API calls
  // directory - Directorio de trabajo actual (usa esto en vez de __dirname)
  // project   - Info del proyecto
  // worktree  - Git worktree path
  // $         - Bun shell API para ejecutar comandos
}
```

**IMPORTANTE:** No uses `__dirname` para paths. Usa `directory` que OpenCode pasa en el contexto.

## 5. Hooks disponibles

### tool.execute.before

Se ejecuta ANTES de que una herramienta (edit, write, bash, read) se ejecute.

```typescript
"tool.execute.before": async (input, output) => {
  // input (read-only):
  //   input.tool      - Nombre de la herramienta: "edit", "write", "bash", "read"
  //   input.sessionID - ID unico del sub-agente que ejecuta
  //   input.callID    - ID unico de esta llamada especifica

  // output (mutable):
  //   output.args     - Argumentos de la herramienta (puedes modificarlos)
  //     output.args.file_path - Path del archivo (para edit/write/read)
  //     output.args.command   - Comando (para bash)

  // Para BLOQUEAR la ejecucion:
  throw new Error("Razon del bloqueo")

  // Para MODIFICAR argumentos:
  output.args.command = sanitize(output.args.command)
}
```

### tool.execute.after

Se ejecuta DESPUES de que una herramienta termine.

```typescript
"tool.execute.after": async (input, output) => {
  // input: misma estructura que before (tool, sessionID, callID)
  // output.args: puede estar en output.args O en (input as any).args
  //   IMPORTANTE: siempre intenta ambos:
  const args = output.args ?? (input as any).args ?? {}
}
```

**Gotcha critico:** En `after`, el `file_path` puede estar en `output.args` o en `input.args` dependiendo de la herramienta. Siempre haz fallback a ambos.

### experimental.session.compacting

Se ejecuta cuando OpenCode compacta el contexto de la sesion.

```typescript
"experimental.session.compacting": async (_input, output) => {
  // output.context - Array donde puedes push() informacion
  //   Esta info se inyecta en el prompt post-compactacion
  output.context.push("Info que el agente debe recordar")

  // output.prompt - Reemplaza el prompt de compactacion completo
  output.prompt = "Custom compaction prompt..."
}
```

**IMPORTANTE:** `output.context` y `output.prompt` SOLO existen en este hook. No en `tool.execute.before/after`.

### shell.env

```typescript
"shell.env": async (input, output) => {
  output.env.MY_API_KEY = "secret"
}
```

### event

```typescript
"event": async ({ event }) => {
  // Eventos del sistema: message.part.updated, session.deleted, session.idle
}
```

## 6. Logging

Usa `client.app.log()` en vez de `console.log`:

```typescript
const MyPlugin: Plugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "my-plugin",    // Nombre para filtrar en logs
      level: "info",           // "debug" | "info" | "warn" | "error"
      message: "Que paso",
      extra: { key: "value" }, // Datos estructurados opcionales
    },
  })
}
```

### Donde ver los logs

```bash
# Log mas reciente
tail -f ~/.local/share/opencode/log/$(ls -t ~/.local/share/opencode/log/ | head -1)

# Filtrar por tu plugin
grep "my-plugin" ~/.local/share/opencode/log/$(ls -t ~/.local/share/opencode/log/ | head -1)
```

**IMPORTANTE:** OpenCode crea un nuevo log file cada vez que inicia. Si reiniciaste y no ves logs nuevos, verifica que realmente se creo un archivo nuevo:

```bash
ls -lt ~/.local/share/opencode/log/ | head -3
```

## 7. Identificar sub-agentes

Cada sub-agente tiene un `sessionID` unico en `input`:

```typescript
"tool.execute.before": async (input, output) => {
  const agentId = (input as any).sessionID  // "ses_341418cd9ffeNmjY..."
  // Usar esto para distinguir sub-agentes dentro del mismo proceso
  // NO usar process.pid — es el mismo para todos los sub-agentes
}
```

**Leccion aprendida:** `process.pid` es identico para todos los sub-agentes porque corren en el mismo proceso OpenCode. Siempre usa `input.sessionID`.

## 8. Errores comunes y soluciones

### Error: "fn is not a function (fn is an instance of Object)"

**Causa:** El plugin exporta un objeto plano en vez de una funcion async.

**Solucion:**
```typescript
// Asegurate de exportar una FUNCION, no un objeto
const MyPlugin: Plugin = async (ctx) => {
  return { /* hooks */ }
}
export default MyPlugin
```

### El hook after no se ejecuta / no encuentra el file path

**Causa:** En `tool.execute.after`, los args pueden estar en una ubicacion diferente.

**Solucion:**
```typescript
"tool.execute.after": async (input, output) => {
  const args = output.args ?? (input as any).args ?? {}
  const filePath = args.file_path ?? args.filePath ?? args.path ?? args.file
}
```

### Los sub-agentes no se bloquean entre si

**Causa:** Usas `process.pid` como identificador — es el mismo para todos.

**Solucion:** Usa `input.sessionID` que es unico por sub-agente.

### El plugin no carga despues de modificarlo

**Causa:** OpenCode cachea plugins al startup.

**Solucion:** Debes cerrar y abrir OpenCode completamente. Verifica con:
```bash
grep "my-plugin" ~/.local/share/opencode/log/$(ls -t ~/.local/share/opencode/log/ | head -1)
```

### throw Error mata al sub-agente sin reintentar

**Causa:** `throw Error` en `tool.execute.before` cancela la herramienta permanentemente.

**Solucion:** Si quieres que el agente espere, usa un loop con sleep DENTRO del hook:
```typescript
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

"tool.execute.before": async (input, output) => {
  while (resourceIsBusy()) {
    await sleep(500)  // Espera 500ms y reintenta
  }
  // Continua cuando el recurso este libre
}
```

## 9. Checklist antes de probar un plugin

1. [ ] El plugin exporta una funcion async con `export default`
2. [ ] Usa `directory` del contexto, no `__dirname`
3. [ ] El `package.json` existe en `.opencode/` con las dependencias
4. [ ] Reiniciaste OpenCode completamente
5. [ ] Verificaste en los logs que el plugin cargo (`grep "mi-plugin" ...log`)
6. [ ] Los hooks usan `async (input, output)` — no `(output)` solo
7. [ ] En `after` hook, buscas args en `output.args` Y `(input as any).args`
8. [ ] Usas `input.sessionID` para identificar sub-agentes, no `process.pid`

## 10. Template minimo funcional

```typescript
import type { Plugin } from "@opencode-ai/plugin"

const activeLocks = new Map<string, string>()
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const MyPlugin: Plugin = async ({ client }) => {
  await client.app.log({
    body: { service: "my-plugin", level: "info", message: "Plugin loaded" },
  })

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit") return

      const filePath = output.args?.file_path
      if (!filePath) return

      const agentId = (input as any).sessionID ?? "unknown"

      // Wait if file is locked by another agent
      while (activeLocks.has(filePath) && activeLocks.get(filePath) !== agentId) {
        await sleep(500)
      }

      activeLocks.set(filePath, agentId)
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit") return

      const args = output.args ?? (input as any).args ?? {}
      const filePath = args.file_path
      if (!filePath) return

      const agentId = (input as any).sessionID ?? "unknown"
      if (activeLocks.get(filePath) === agentId) {
        activeLocks.delete(filePath)
      }
    },
  }
}

export default MyPlugin
```

Este template es copy-paste ready. Funciona a la primera.
