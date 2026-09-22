# Captain preferences
<!-- memory tiers: see the stow skill -->

- Talk to the captain in Spanish in chat; keep commits, PRs, briefs, code, and comments in English unless a project says otherwise.
- This home is an isolated container with Docker available; the captain grants broad freedom to install and configure tooling here (the hard rules, merge, and destructive-action boundaries still apply).
- Crew roster is Claude Code, Codex, Kimi (K3 model `kimi-code/k3` only), and OpenCode with MiniMax M3 (`minimax-coding-plan/MiniMax-M3`); never dispatch on Pi (2026-09-22).
- Captain's model ranking, strongest first (2026-09-22; exact rules live in config/crew-dispatch.json): Fable, Astra, Sol, Opus, Kimi K3, Terra, Sonnet, MiniMax M3, Luna, Haiku.
  Roles: Fable = last resort after others failed and design with Lavish (xhigh, never max); Astra = hard and ambiguous; Sol = hard but clear; Opus = firstmate, plus reviewer; Terra = complicated but clear development, building approved Lavish designs into code (chosen over Sonnet; check fidelity on the first one), and the default; Sonnet = medium bounded development; MiniMax M3 = most important of the minor tasks; Luna = trivial mechanical edits; Haiku = quick read-only lookups.
  Kimi K3 only executes a plan deliberately designed for maximum parallelism, with the brief's Firstmate spec opening "Use swarm to resolve this activities:"; a request to do separate tasks in parallel ("resolve issue 2 and 3 in parallel") is NOT Kimi work, each task routes by its own rule.
  A captain-requested code review runs Opus and Sol as two parallel independent reviews; escalate to a third Astra review only when warranted (serious security or data finding, material disagreement, or large fixes). Routine changes rely on their delivery path's own review.
- This home's `data/` and `config/` are deliberate symlinks to `~/.config/fm/data` and `~/.config/fm/config`; keep them, never replace or "repair" them (2026-09-22).
  The startup diagnostics they cause (startup-memory budget refusing the symlinked config dir, contribution observation refusing the symlinked data dir) are expected and need no report; spawn and teardown are unaffected.
- Lavish runs normally on localhost (default port 4387) and the captain opens it through the Coder proxy: always hand over `https://4387--main--dev-fm-at-ap--hugotown.coder.hugoruiz.dev/<path>` instead of the printed `http://127.0.0.1:4387/<path>` (2026-09-22).
  The allowed hosts are localhost and the Coder `hugoruiz.dev` domain via `LAVISH_AXI_ALLOWED_HOSTS` (setup, other harnesses, and recovery in learnings.md); this covers `/bearings lavish` and every Lavish board; never expose the server beyond loopback.
- aplus autonomous merge confirmed knowing every merge to main deploys production via Coolify: merge green work without re-asking; destructive, irreversible, or security-sensitive changes still escalate (2026-09-22).
