# .config gitignore strategy — design

**Date:** 2026-06-07
**Repo:** `~/.config` (https://github.com/hugotown/dotfiles)
**Author:** Hugo + pi
**Status:** approved, ready for implementation plan

## 1. Context and problem

The user described the current strategy as: *"a base .gitignore that discards everything by default; to track a file we have to add it manually"*. Auditing the actual repo contradicted this:

- The root `.gitignore` is a **denylist** (deny-by-pattern + deny-by-folder), not an allowlist.
- Only `agents/.gitignore` and `gemini/.gitignore` apply a true allowlist (`*` + `!file` opt-in).
- 25 of the 40 top-level folders have no per-folder `.gitignore` and rely entirely on root globals.
- The root globals are name-based (`*token*`, `*secret*`, `*password*`, `*history*`, `*cookie*`); a sensitive file that doesn't contain one of those tokens in its name (e.g. `MINIMAX_KEY.txt`) would slip through.
- 2,255 files are currently tracked; 12 of them live in `secrets/` and are SOPS+age encrypted (verified — header reads `ENC[AES256_GCM...]`).

The repo is public, so the cost of leaking a secret is high.

## 2. Decisions taken before this spec

Captured via `question` tool in the brainstorming session:

1. **Strategy = hybrid** (root denylist with hardened globals + per-folder allowlists for sensitive folders).
2. **Scope = plan + apply in this session**, with atomic commits per folder.
3. **Treatment of folders without their own `.gitignore` = audit one by one**.
4. **Hardened globals = only patterns that do not collide with currently tracked files**; collisions found during audit forced these refinements:
   - Drop `*api[-_]key*` (would untrack 6 legitimate SOPS yaml under `secrets/`).
   - Drop `*[-_]secret*` (would untrack `shell/scripts/add-secret`).
   - Drop `*credentials*` (no current collisions, but the protection it offered is already covered in Layer 2 via `secrets/` allowlist; keep root cleaner).
   - Use specific `.env` patterns instead of `.env*` (the latter would untrack `nixos/.envrc`, a legitimate direnv file).

## 3. Final design — three layers

### Layer 1 — Root (`.config/.gitignore`)

Stays a **denylist**, with the existing rules kept verbatim. **Add** to the global-patterns section:

```gitignore
# Unencrypted credentials / secrets (defensive catch-all)
.env
.env.local
.env.local.*
.env.development
.env.development.*
.env.production
.env.production.*
.env.staging
.env.staging.*
!.env.example
!.env.template

# Private keys and certificates
*.pem
*.p12
*.pfx
*.key

# Cloud service-account credentials
service-account*.json
gcp-key*.json
```

**Rationale for what was rejected:**
- `*credentials*`, `*api[-_]key*`, `*[-_]secret*` were rejected because they collide with current tracked files. The risk they covered is now handled in Layer 2 by making `secrets/` an allowlist of `*.yaml` only — any future plain-text file inside `secrets/` is automatically rejected.
- `.env*` was rejected in favor of specific subnames because `.envrc` is a legitimate direnv file.

**Verification (must pass before commit):**
```bash
cd ~/.config
git ls-files | rg '(^|/)\.env($|\.local|\.development|\.production|\.staging)' | rg -v '\.(example|template)$'
git ls-files | rg '\.(pem|p12|pfx|key)$'
git ls-files | rg '(service-account|gcp-key)'
# all three should return zero matches
```

### Layer 2 — Sensitive folders that need their own `.gitignore` (allowlist)

| Folder | New `.gitignore` contents | Why |
|---|---|---|
| `secrets/` | `*` + `!.gitignore` + `!*.yaml` | Encrypted SOPS yaml only. Any new plain-text file rejected. |
| `atuin/` | `*` + `!.gitignore` + `!config.toml` | atuin client writes history into this folder; only `config.toml` should be tracked. |
| `fish/` | `*` + `!.gitignore` + `!config.fish` + `!conf.d/` + `!conf.d/**` + `!functions/` + `!functions/**` + `!completions/` + `!completions/**` + `!fish_variables` | fish writes universal variables (`fish_variables`) and other runtime state here. Lock the tracked set. |
| `hosts/` | `*` + `!.gitignore` + `!*/` + `!*/initialize.sh` + `!*/docker-compose.yml` | Host bootstrap scripts only. Folder can grow with per-host runtime state otherwise. |
| `gh-dash/` | `*` + `!.gitignore` + `!config.yml` | Only the config file; gh-dash may add caches over time. |

### Layer 3 — Folders that keep their existing `.gitignore` (no change)

`agents/` (allowlist, correct), `gemini/` (allowlist, correct), `nixos/` (exhaustive SOPS-aware denylist), `agent-tools/` (monorepo denylist), `pi/`, `opencode/`, `shell/`, `tmux/`, `nvim/`, `hammerspoon/`, `karabiner/`, `agent-session-analyzer/`. No changes; they all pass review.

### Layer 4 — Folders that consciously do NOT get their own `.gitignore`

Covered by root rules; one or two stable config files each, low risk of capturing runtime state:

`alacritty`, `wezterm`, `yabai`, `skhd`, `hypr`, `lazygit`, `mise`, `nushell`, `ghostty`, `zellij`, `sketchybar`, `uv`, `yazi`, `television`, `docs`, `configstore` (empty tracked set), `flutter` (empty tracked set), `gh` (fully ignored at root), `gcloud` (fully ignored at root), `chromium` (fully ignored at root), `direnv`, `ibus`, `wofi`, `environment.d` (last four are linux-only, ignored at root).

## 4. Execution plan (atomic commits)

1. `chore(gitignore): harden root with .env / private key / service-account globals`
2. `chore(secrets): add allowlist .gitignore (yaml only)`
3. `chore(atuin): add allowlist .gitignore (config.toml only)`
4. `chore(fish): add allowlist .gitignore (config + conf.d + functions + completions + fish_variables)`
5. `chore(hosts): add allowlist .gitignore (per-host initialize.sh + docker-compose.yml)`
6. `chore(gh-dash): add allowlist .gitignore (config.yml only)`

**After every commit:** `git status --short` must be clean. If `deleted:` lines appear, the commit is wrong — `git reset --hard HEAD~1` and rewrite the rule.

**Final verification gate (after commit 6):**
- `git ls-files | wc -l` must remain `2255` (no file was destracked).
- `git check-ignore -v` against synthetic paths must return the expected ignore source:
  - `secrets/leaked.txt` → ignored by `secrets/.gitignore`
  - `atuin/history.db` → ignored by `atuin/.gitignore`
  - `random/.env.local` → ignored by root
  - `random/api.pem` → ignored by root

## 5. Out of scope (YAGNI)

- No changes to `agents/`, `gemini/`, `nixos/`, or other working per-folder gitignores.
- No new `.gitignore` in the 17 "stable" folders (`alacritty`, `wezterm`, etc.) that have one config file each.
- No cleanup of the 28 MB of test fixtures under `agents/skills/`.
- No changes to `.gitattributes` or SOPS configuration.
- No file moves, renames, or restructuring.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Allowlist mis-typed → file destracked | Per-commit `git status --short` check; clean = OK, deleted = revert. |
| Global pattern hides something we wanted to track | Pre-commit `git ls-files \| rg <pattern>` for every new pattern; must return zero matches. |
| Affecting other machines | Changes are `.gitignore` only — no file content changes. Revertable with `git revert`. |
| Hidden interaction with `agents/`, `gemini/` allowlists | Their rules are scoped (`*` in subfolder negated by `!file`), independent of root. Verified manually: root denylist + subfolder allowlist do not conflict because subfolder rules take precedence inside that subtree. |

## 7. Open follow-ups (not in this spec)

- Audit the 28 MB test fixtures under `agents/skills/gstack/browse/test/` and `agents/skills/huashu-design/assets/` — separate session.
- Consider migrating `agent-tools/`, `pi/`, `opencode/` from denylist to allowlist for consistency with `agents/` and `gemini/` — separate session.
- Consider `git-secrets` or `gitleaks` pre-commit hook for defense-in-depth — separate session.
