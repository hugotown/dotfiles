# herdr headless — full reference

All commands talk to the running server over `~/.config/herdr/herdr.sock`. No TUI attach required.

## 1. Verify the server is alive

```bash
herdr status              # client + server + socket status
```
Look for `server: status: running`. If it isn't running, no socket command will work.

## 2. Discover what's inside (recon)

```bash
herdr session list --json          # which sessions exist (usually just "default")
herdr workspace list               # workspaces in the session
herdr pane list                    # every pane (pane_id, cwd, terminal_id, agent)
herdr agent list                   # running agents (pi, claude, …)
```
These `list` calls give you the IDs (`w4`, `w4:t1`, `w4:p1`…) needed for everything else.

## 3. Create a pane to work in

Split an existing pane:
```bash
herdr pane split w4:p1 --direction right --focus
#                └pane    └right|down          └focus it
```
Returns the new `pane_id` (e.g. `w4:p2`). Also accepts `--ratio 0.5`, `--cwd PATH`, `--env KEY=VALUE`, `--no-focus`.

New containers:
```bash
herdr tab create        [--workspace ID] [--cwd PATH] [--label TEXT] [--focus]
herdr workspace create  [--cwd PATH] [--label TEXT] [--env KEY=VALUE] [--focus]
```

## 4. Run things inside the pane

**a) Pane is a plain shell** → `pane run` (writes command **and** presses Enter):
```bash
herdr pane run w4:p2 'pi "/boomerang dime hola 3 veces --rethrow 3"'
```

**b) Pane already has a live TUI** (e.g. `pi` waiting at its `>` prompt) → send text and Enter separately:
```bash
herdr pane send-text w4:p2 '/boomerang dime hola 3 veces --rethrow 3'
herdr pane send-keys w4:p2 Enter
```

Rule of thumb: `pane run` = shell command + auto-Enter. `send-text` = literal text, no Enter. For agents there is also `herdr agent send <target> <text>`.

## 5. Read output (without seeing the screen)

```bash
herdr pane read w4:p2 --source recent --lines 40 --format text
#                       └visible|recent|recent-unwrapped   └text|ansi
```
`--source recent` includes recent scrollback; `visible` is only what fits on screen.

## 6. Wait for an agent to finish

```bash
herdr agent wait w4:p2 --status idle --timeout 60000
#                        └idle|working|blocked|unknown   └ms
```
Blocks until the pane's agent reaches the status (or the timeout expires). Beats manual polling.

## 7. Clean up

```bash
herdr pane close w4:p2         # close a pane
herdr pane close w4:p1
# closing the last pane removes its workspace automatically
herdr workspace close w4       # ("workspace_not_found" if it already vanished)
```
Verify it's clean:
```bash
herdr workspace list           # → workspaces: []
herdr pane list                # → panes: []
herdr session list --json      # → "default" still running but empty
```
Kill the whole session (more aggressive):
```bash
herdr session stop default
```

## Exact reproducible flow

```bash
# 1. recon
herdr status
herdr session list --json
herdr pane list

# 2. create pane
herdr pane split w4:p1 --direction right --focus     # → w4:p2 is born

# 3. launch the agent and give it the task
herdr pane run w4:p2 'pi "/boomerang dime hola 3 veces --rethrow 3"'

# 4. observe
herdr pane read w4:p2 --source recent --lines 40 --format text

# 5. (second pass) resend the prompt to the already-live TUI
herdr pane send-text w4:p2 '/boomerang dime hola 3 veces --rethrow 3'
herdr pane send-keys w4:p2 Enter
herdr agent wait w4:p2 --status idle --timeout 60000
herdr pane read w4:p2 --source recent --lines 45 --format text

# 6. full teardown
herdr pane close w4:p2
herdr pane close w4:p1
herdr workspace list && herdr pane list          # confirm empty
```

## Example: drive an interactive agent conversation

Launch `pi`, read the question it asks, answer it, and read its reply — a full back-and-forth, all headless. Note that after `pane run` starts `pi`, the pane holds a **live TUI**, so every further turn uses `send-text` + `send-keys Enter` (not `pane run`).

```bash
# 0. if the session is empty, create a workspace (gives you a pane)
herdr workspace create --focus                      # → w7:p1

# 1. launch the agent with an opening prompt
herdr pane run w7:p1 'pi "preguntame cualquier cosa del mundial fifa 2026"'

# 2. wait, then read what it asked
herdr agent wait w7:p1 --status idle --timeout 60000
herdr pane read w7:p1 --source recent --lines 35 --format text
#   → "¿Quién crees que ganará el Mundial FIFA 2026 y por qué?"

# 3. answer + chain a follow-up (TUI is live → send-text + Enter)
herdr pane send-text w7:p1 'Creo que ganará Argentina. Ahora dime un chiste del mundial 2026'
herdr pane send-keys w7:p1 Enter

# 4. wait + read the reply
herdr agent wait w7:p1 --status idle --timeout 60000
herdr pane read w7:p1 --source recent --lines 40 --format text
#   → "¿Por qué el Mundial FIFA 2026 llevará calculadora?
#      Porque con 48 selecciones, hasta el VAR va a necesitar hacer cuentas."
```

Key point: `pane read` is how you "hear" the agent when you can't see the screen. Loop steps 3–4 for each conversational turn.

## Notes / gotchas

- **IDs change.** Never hardcode `w4:p2`; run `herdr pane list` first to get the real `pane_id`.
- **Closing the last pane while a client is attached auto-respawns an empty workspace.** If a herdr client is focused on the session, closing the final pane spawns a fresh empty workspace+pane (so the client isn't left blank) — you'll see `pane list` return a *new* `wN:p1` instead of `[]`. That single empty shell IS the clean baseline. To truly empty the session (`workspaces: []`), no client can be attached, or use `herdr session stop default` to shut it down entirely.
- **Why this works where nested `pi` fails:** the pane is a shell independent of the herdr server, not nested inside your agent, so `--rethrow` doesn't hit the `pi-rewind-hook` crash. Run it nested and it blows up.
- **Remote:** works against a server on another machine with `herdr --remote <ssh-target> --session <name>`.
- **Watch live:** `herdr agent attach <target>` (or `herdr session attach default`) drops you into the TUI — the opposite of headless; only for handing control to a human.
