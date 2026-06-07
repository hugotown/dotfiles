# ~/.config — Hugo's dotfiles

Public repository (https://github.com/hugotown/dotfiles) tracking the configuration of a multi-tool development environment. Because it is public, the `.gitignore` strategy is the primary defense against leaking secrets.

## Quick start

```bash
# Inspect everything that is currently tracked
git ls-files | wc -l

# Check whether a path is ignored and by which rule
git check-ignore -v <path>

# Look at the current per-folder gitignore policy
cat <folder>/.gitignore
```

## Gitignore strategy — hybrid by layer

Defined in `docs/superpowers/specs/2026-06-07-config-gitignore-strategy-design.md`. Implementation: `docs/superpowers/plans/2026-06-07-config-gitignore-hybrid-strategy.md`.

Three layers, each with a single responsibility:

```
Layer 1 — Root .gitignore                  → denylist with hardened globals
   ↓
Layer 2 — Sensitive folders (allowlist)    → "*" + "!explicit-file" opt-in
   ↓
Layer 3 — Code/runtime folders (denylist)  → block node_modules, .env, build/, etc.
```

### Layer 1 — Root `.gitignore`

Stays a denylist (deny-by-pattern + deny-by-folder). The hardened globals catch the most common ways a secret slips into a commit:

| Pattern | Reason |
|---|---|
| `.env`, `.env.local`, `.env.local.*`, `.env.development*`, `.env.production*`, `.env.staging*` | Dotenv files in any folder |
| `!.env.example`, `!.env.template` | Allow shareable templates |
| `*.pem`, `*.p12`, `*.pfx`, `*.key` | Private keys and certificates |
| `service-account*.json`, `gcp-key*.json` | Cloud service-account credentials |
| `*token*`, `*session*`, `*history*`, `*cookie*`, `*password*` (pre-existing) | Name-based catch-all |

Plus full-folder denials for sensitive caches (`gh/`, `gcloud/`, `chromium/`, `flutter/`, …).

### Layer 2 — Sensitive folders (allowlist)

Each of these folders contains a `.gitignore` that starts with `*` (block everything) and opts in only the files we want to track. Adding a new file inside any of these folders requires either matching an existing pattern or explicitly editing the local `.gitignore`.

| Folder | What is tracked |
|---|---|
| `secrets/` | `*.yaml` only (all encrypted with SOPS+age) |
| `atuin/` | `config.toml` only (atuin client writes history + runtime state here) |
| `fish/` | `config.fish`, `fish_variables`, `conf.d/`, `functions/`, `completions/` |
| `hosts/` | `*/initialize.sh`, `*/docker-compose.yml` per host directory |
| `gh-dash/` | `config.yml` only |
| `agents/` | `AGENTS.md`, `skills/**`, `.skill-lock.json` |
| `gemini/` | `config/config.json`, `config/mcp_config.json`, `antigravity-cli/settings.json`, `antigravity-cli/keybindings.json` |

### Layer 3 — Code / runtime folders (denylist)

Folders that act like small monorepos or have well-defined runtime cruft. Their `.gitignore` blocks the specific noise (`node_modules/`, build outputs, lock files, runtime state). They are NOT allowlists — anything else in the folder tracks normally.

`agent-session-analyzer/`, `agent-tools/`, `hammerspoon/`, `karabiner/`, `nixos/`, `nvim/`, `opencode/`, `pi/`, `shell/`, `tmux/`.

### Layer 4 — Folders without their own `.gitignore`

Each of these has 0-3 stable config files and is fully covered by the root rules. Adding state-capturing files here would track them unless they match the root globals — keep an eye on:

`alacritty`, `claude` (cubierta por `claude/*` + `!settings.json` en root), `configstore`, `docs`, `flutter`, `gcloud` (fully ignored at root), `gh` (fully ignored), `ghostty`, `hypr`, `lazygit`, `mise`, `nushell`, `sketchybar`, `skhd`, `television`, `uv`, `wezterm`, `yabai`, `yazi`, `zellij`.

## Quirks

Counter-intuitive behaviors documented during the audit on 2026-06-07. Future-you and other agents should read this before touching `.gitignore` files.

- **The "Linux-only partial ignores" comment in root `.gitignore` is misleading.** The rules under that header (e.g. `claude/*` + `!claude/settings.json`) are NOT conditional on the OS — they apply on macOS too. The header only describes the original intent ("these folders only exist on Linux"). Verified with `git check-ignore -v claude/projects/foo.json` returning `.gitignore:95:claude/*`.

- **`.gitignore` rules never untrack already-tracked files.** A `.gitignore` rule only affects which untracked files git considers when staging. `nixos/.envrc` matches `nixos/.gitignore:21:.envrc` but remains tracked because it was added to the index before the rule. To actually untrack you need `git rm --cached <file>`.

- **`git check-ignore -v` exit codes are inverted from intuition.** Exit `0` means "yes, ignored" (and prints the matching rule). Exit `1` means "no, not ignored" (and prints nothing). Scripts that test for tracked status should use `if git check-ignore -q "$f"; then echo "IGNORED"; fi`.

- **Negation rules can keep showing up in `git check-ignore -v`.** For an allowlisted file like `secrets/new.yaml`, the command prints `secrets/.gitignore:6:!*.yaml secrets/new.yaml` and exits 1. The line refers to the negation rule that brought the file back, not to an active ignore. The exit code is the ground truth.

- **Inline comments on a `.gitignore` pattern line are part of the pattern.** `*.key # private keys` is interpreted as "ignore files literally named `*.key # private keys`", not as `*.key`. Always put comments on their own line above the pattern.

- **Subfolder allowlist requires `!subfolder/` AND `!subfolder/**` separately.** `!subfolder/` un-ignores the directory entry; `!subfolder/**` un-ignores its contents. Forgetting the second line silently leaves all files inside ignored even though the folder itself is "allowed". The `fish/.gitignore` is the canonical example.

- **`secrets/*.yaml` are encrypted with SOPS+age, safe to commit.** Each file begins with `KEY: ENC[AES256_GCM,data:...,iv:...,tag:...]` and ends with a SOPS metadata block. If you ever see a yaml in this folder that does NOT start with `ENC[...]`, it is plaintext — `git rm --cached` it immediately and re-encrypt with `sops --encrypt --in-place`.

- **`fish/fish_variables` is tracked on purpose.** Fish writes its universal variables file here. As of 2026-06-07 it only contains a harmless `__fish_initialized` counter. If fish ever starts capturing env vars with secrets, this file will leak them. The fish allowlist intentionally keeps it tracked so that a `git diff` after using fish surfaces any new variable — gives a chance to react.

- **The repo lives at `~/.config` and the git root is also `~/.config`.** Running git commands from inside a subfolder works, but `git check-ignore` always resolves paths relative to the git root, not your cwd.

## Gotchas (mistakes that will bite future-you)

- **Adding a new top-level folder does not require editing the root `.gitignore`** — the root is a denylist, not an allowlist. New folders track normally. Only worry if the folder will capture runtime state, secrets, or credentials; then create a per-folder allowlist following the pattern of `secrets/.gitignore` or `gh-dash/.gitignore`.

- **A new `secret`/`api_key` global pattern in the root WILL destrack legitimate files.** The patterns `*api[-_]key*`, `*[-_]secret*`, `*credentials*` were considered and rejected during the 2026-06-07 audit because they collide with `secrets/*_api_key.yaml` (SOPS yaml we DO want to commit) and `shell/scripts/add-secret` (a legitimate script). Don't re-add them without a per-file exception (`!secrets/*_api_key.yaml`) and a `git ls-files | rg <pattern>` collision check first.

- **`.env*` (with wildcard) catches `.envrc`.** `nixos/.envrc` is a legitimate direnv file. Use the explicit `.env.local*`, `.env.development*`, `.env.production*`, `.env.staging*` patterns instead.

- **Per-folder allowlists supersede the root denylist inside their subtree.** If `secrets/.gitignore` says `!*.yaml`, a hypothetical root rule like `**/*.yaml` would still NOT ignore yamls inside `secrets/`. Plan accordingly when adding strict root rules.

- **Before committing a new global pattern, always run:**
  ```bash
  git ls-files | rg '<pattern>'
  ```
  Empty output is the only safe answer. Any match means a tracked file is about to be destracked.

- **After every commit that touches `.gitignore`, run `git status --short`.** A `D <file>` line means git stopped tracking a file because of the new rule — that is almost never what you want, and almost always a sign the new pattern is too greedy. Revert with `git checkout <file>` (if uncommitted) or `git revert HEAD` (if committed).

- **The whole repo is public.** Anything pushed lives on GitHub forever, even after a force-push. Use `git push origin main` only after `git status` is clean, `git ls-files | wc -l` matches expectations, and an `rg -i 'API[-_]?KEY|SECRET|PASSWORD|TOKEN|-----BEGIN' $(git diff origin/main..main --name-only)` returns empty for any new content.

## Related documentation

- `docs/superpowers/specs/2026-06-07-config-gitignore-strategy-design.md` — full design rationale and rejected alternatives
- `docs/superpowers/plans/2026-06-07-config-gitignore-hybrid-strategy.md` — step-by-step implementation log with verification commands
- `nixos/` — SOPS+age configuration and per-host nix flakes
- `secrets/` — encrypted secret store consumed by `sops` and `shell/scripts/add-secret`
