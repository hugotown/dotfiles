# Learnings
<!-- memory tiers: see the stow skill -->

- Primary runs inside Herdr (config/backend=herdr); tmux is not installed, so never pass `--backend tmux`. <!--a:2026-09-22-->
- quota-axi cannot see OpenCode's stored MiniMax coding-plan credential (reports minimax auth_required), so MiniMax profiles are eligible but unranked; treat that as disclosed uncertainty, not an auth blocker. <!--a:2026-09-22-->
- no-mistakes global pipeline agent is pinned to `[codex, claude]` in ~/.no-mistakes/config.yaml to spare Claude quota. <!--a:2026-09-22-->
- aplus: every push to main auto-deploys production via Coolify, and the repo has no GitHub CI, so a green no-mistakes run is the only gate before a production deploy. <!--a:2026-09-22-->
