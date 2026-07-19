---
name: herdr-headless
description: Control herdr (terminal workspace manager) headlessly through its Unix socket — create or select workspaces, create panes, launch and drive AI agents (pi, claude), read their output, and clean up, all WITHOUT attaching the TUI. USE WHEN you need to spawn or orchestrate an agent in a herdr session from a different terminal, run a command in a fresh non-nested shell, observe a running pane you can't see, open a workspace in a project path, or reset a herdr session programmatically. Triggers include "herdr", "conectarme al socket", "abrir un panel sin ver la TUI", "abrir un workspace en PROYECTO", "crear workspace en RUTA", "ejecutar un agente en background", "inyectar o leer un pane".
---

# herdr headless (socket control)

Drive a running `herdr` server entirely from the CLI. Every `herdr <noun> <verb>` subcommand talks to the server's Unix socket — no TUI attach needed. The user won't see anything on screen; you operate blind and use `pane read` to observe.

## Mental model

```
herdr server (headless, already running) — socket: ~/.config/herdr/herdr.sock
  session "default"
    └─ workspace (wN)
         └─ tab (wN:tM)
              └─ pane (wN:pK)
                   └─ agent (pi, claude, …)
```

ID hierarchy: `session → workspace (wN) → tab (wN:tM) → pane (wN:pK) → terminal (term_…)`.
**IDs are ephemeral — never hardcode them. Always `herdr pane list` first to get the real `pane_id`.**

## Core workflow

1. **Confirm server is up** — `herdr status` → needs `server: status: running`. If not running, no socket command works.
2. **Recon** — `herdr pane list` (and `session list --json`, `workspace list`, `agent list`) to grab live IDs.
3. **Create a pane** — `herdr pane split <pane_id> --direction right --focus` → prints the new `pane_id`.
4. **Run something** — depends on what the pane holds:
   - Plain shell → `herdr pane run <pane_id> '<cmd>'` (types command **and** presses Enter).
   - Live TUI already running (e.g. `pi` at its `>` prompt) → `herdr pane send-text <pane_id> '<text>'` then `herdr pane send-keys <pane_id> Enter`.
5. **Observe** — `herdr pane read <pane_id> --source recent --lines 40 --format text`.
6. **Wait for completion** — `herdr agent wait <pane_id> --status idle --timeout 60000` instead of manual polling.
7. **Clean up** — `herdr pane close <pane_id>`; closing the last pane removes its workspace automatically. But if a client is attached, herdr auto-respawns one empty workspace (see gotchas) — that lone empty shell is the clean baseline.

## Critical gotchas

- **Run agents in a herdr pane, NOT nested in your own shell.** A herdr pane is an *independent* server-side shell. Launching `pi` nested inside another agent's context crashes the `pi-rewind-hook` (`ctx stale after session replacement`) and breaks `--rethrow`. A fresh pane avoids this — this is the whole reason to use this technique.
- **`pane run` = command + auto-Enter. `send-text` = literal text, no Enter** (you send Enter separately with `send-keys`). For agents there's also `herdr agent send <target> <text>`.
- **IDs change between sessions.** Re-run `pane list` every time.
- **Attaching opens the TUI** — `herdr agent attach <target>` / `herdr session attach default` defeat the headless purpose. Only use to hand control to a human.
- **Can't reach `workspaces: []` while a client is attached** — closing the last pane respawns a fresh empty workspace. That single empty shell is "clean"; use `herdr session stop default` only if you truly want the session gone.

## Full command reference

See `reference.md` (all flags, remote servers, the exact reproducible flow, session teardown).
