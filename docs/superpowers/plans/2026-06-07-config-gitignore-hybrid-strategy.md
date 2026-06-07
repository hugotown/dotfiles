# .config gitignore hybrid strategy — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `~/.config/.gitignore` with defensive globals and add per-folder allowlists to 5 sensitive folders, without destracking any of the 2,255 currently tracked files.

**Architecture:** Three-layer hybrid (per spec): root denylist with hardened globals + per-folder allowlists for `secrets/`, `atuin/`, `fish/`, `hosts/`, `gh-dash/`. Existing per-folder gitignores stay untouched.

**Tech Stack:** git, ripgrep (`rg`), eza. All work happens in `~/.config` on branch `main`. Local commits only — push at the very end after full verification.

**Spec:** `docs/superpowers/specs/2026-06-07-config-gitignore-strategy-design.md`

**Pre-flight invariants (verify before starting):**
- `cd ~/.config && git branch --show-current` → `main`
- `git ls-files | wc -l` → `2255`
- `git status --short` → only `?? docs/superpowers/specs/` and `?? docs/superpowers/plans/` (the spec and this plan)

---

## Task 0: Commit the spec and plan first

**Files:**
- Create: (none — already exist on disk)
- Modify: (none)
- Test: `git log -1 --stat`

- [ ] **Step 0.1: Verify pre-flight invariants**

Run:
```bash
cd ~/.config
git branch --show-current
git ls-files | wc -l
git status --short
```

Expected:
- branch = `main`
- count = `2255`
- status shows only `?? docs/superpowers/specs/` and `?? docs/superpowers/plans/`

If any invariant fails, STOP and report.

- [ ] **Step 0.2: Stage and commit spec + plan together**

Run:
```bash
cd ~/.config
git add docs/superpowers/specs/2026-06-07-config-gitignore-strategy-design.md
git add docs/superpowers/plans/2026-06-07-config-gitignore-hybrid-strategy.md
git status --short
```

Expected: two `A` lines for the spec and plan, nothing else.

- [ ] **Step 0.3: Commit**

Run:
```bash
cd ~/.config
git commit -m "docs(gitignore): add hybrid strategy spec and implementation plan"
```

Expected: commit succeeds, working tree clean.

- [ ] **Step 0.4: Verify clean state**

Run:
```bash
cd ~/.config
git status --short
git ls-files | wc -l
```

Expected:
- status empty
- count = `2257` (spec + plan added)

---

## Task 1: Harden root `.gitignore` with defensive globals

**Files:**
- Modify: `~/.config/.gitignore` (insert into global-patterns section, after the existing "Misc tool state" block)

- [ ] **Step 1.1: Pre-change verification — confirm no tracked file matches the new patterns**

Run:
```bash
cd ~/.config
git ls-files | rg '(^|/)\.env($|\.local|\.development|\.production|\.staging)' | rg -v '\.(example|template)$'
git ls-files | rg '\.(pem|p12|pfx|key)$'
git ls-files | rg '(service-account|gcp-key)'
```

Expected: all three commands return zero output. If anything matches, STOP — the new pattern would destrack a real file and the spec needs to be revisited.

- [ ] **Step 1.2: Read the current root gitignore to locate insertion point**

Run:
```bash
cd ~/.config
grep -n "^configstore/" .gitignore
```

Expected: a single match, e.g. `46:configstore/`. The new block goes after this line and the blank line that follows.

- [ ] **Step 1.3: Insert the hardened-globals block into root .gitignore**

Use the `edit` tool. Replace this exact block:

```
# Misc tool state
configstore/


# ------------------------------------------------------------
# Fully-ignored top-level folders
```

with:

```
# Misc tool state
configstore/

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


# ------------------------------------------------------------
# Fully-ignored top-level folders
```

- [ ] **Step 1.4: Post-change verification — no file got destracked**

Run:
```bash
cd ~/.config
git status --short
git ls-files | wc -l
```

Expected:
- status shows ` M .gitignore` (modified) and NOTHING with `D ` (deleted) prefix.
- count = `2257` (unchanged from end of Task 0).

If any `D ` line appears, STOP, run `git checkout .gitignore`, and report.

- [ ] **Step 1.5: Verify new globals actually catch synthetic risky files**

Run:
```bash
cd ~/.config
git check-ignore -v atuin/.env.local
git check-ignore -v fish/secret.pem
git check-ignore -v hosts/macos-shell/service-account-prod.json
git check-ignore -v gh-dash/foo.key
```

Expected: each command prints a `.gitignore:LINE:PATTERN` line confirming the file is ignored by the new rules.

- [ ] **Step 1.6: Verify legitimate exceptions still tracked**

Run:
```bash
cd ~/.config
git check-ignore -v agents/skills/gstack/.env.example
git check-ignore -v nixos/.envrc
```

Expected:
- `.env.example` → NOT ignored (negated by `!.env.example`); command exits 1 with empty output.
- `.envrc` → NOT ignored by our new rule (we used specific `.env.*` patterns). Note: it MAY be ignored by `nixos/.gitignore` line 21 (`.envrc`); that's a pre-existing intentional ignore inside the `nixos/` folder.

To explicitly confirm `nixos/.envrc` is only affected by `nixos/.gitignore` and not by our new root rule, check it returns that source:
```bash
cd ~/.config && git check-ignore -v nixos/.envrc
```
Expected output: `nixos/.gitignore:21:.envrc<TAB>nixos/.envrc` (the existing rule, not the new root rule).

- [ ] **Step 1.7: Stage and commit**

Run:
```bash
cd ~/.config
git add .gitignore
git diff --cached --stat
```

Expected: `1 file changed, ~25 insertions(+)`.

Then:
```bash
cd ~/.config
git commit -m "chore(gitignore): harden root with .env, private key, and service-account globals"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 2: Add `secrets/.gitignore` (allowlist — yaml only)

**Files:**
- Create: `~/.config/secrets/.gitignore`

- [ ] **Step 2.1: Verify the current tracked set in `secrets/`**

Run:
```bash
cd ~/.config
git ls-files secrets/
```

Expected output (12 files, all `*.yaml`):
```
secrets/cloud_opencode_postgresql_cn.yaml
secrets/context7_api_key.yaml
secrets/di_host.yaml
secrets/di_key.yaml
secrets/di_login.yaml
secrets/di_port.yaml
secrets/di_sec.yaml
secrets/gemini_api_key.yaml
secrets/google_api_key.yaml
secrets/hcrd_stitch_api_key.yaml
secrets/minimax_api_key.yaml
secrets/opencode_api_key.yaml
```

If you see any non-`.yaml` file, STOP and update the allowlist before proceeding.

- [ ] **Step 2.2: Create the file**

Create `~/.config/secrets/.gitignore` with exactly this content:

```gitignore
# Allowlist: only SOPS-encrypted yaml files are tracked here.
# Any new file format (e.g. plain .txt, .env, .json) is rejected
# to prevent accidentally committing an unencrypted secret.
*
!.gitignore
!*.yaml
```

- [ ] **Step 2.3: Verify no file got destracked**

Run:
```bash
cd ~/.config
git status --short
```

Expected: only `?? secrets/.gitignore` (the new file). NO `D secrets/...` lines.

If any `D ` line appears under `secrets/`, STOP, run `rm secrets/.gitignore`, and report.

- [ ] **Step 2.4: Verify the allowlist behaves as intended**

Run:
```bash
cd ~/.config
git check-ignore -v secrets/leaked.txt
git check-ignore -v secrets/.env
git check-ignore -v secrets/new_api_key.yaml
```

Expected:
- `secrets/leaked.txt` → ignored by `secrets/.gitignore:5:*`.
- `secrets/.env` → ignored by `secrets/.gitignore:5:*` (and would also match the root `.env` rule from Task 1; either source is acceptable).
- `secrets/new_api_key.yaml` → NOT ignored (command exits 1, empty output). The `!*.yaml` negates it.

- [ ] **Step 2.5: Stage and commit**

Run:
```bash
cd ~/.config
git add secrets/.gitignore
git commit -m "chore(secrets): add allowlist gitignore (SOPS yaml only)"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 3: Add `atuin/.gitignore` (allowlist — config.toml only)

**Files:**
- Create: `~/.config/atuin/.gitignore`

- [ ] **Step 3.1: Verify the current tracked set in `atuin/`**

Run:
```bash
cd ~/.config
git ls-files atuin/
```

Expected output (1 file):
```
atuin/config.toml
```

If you see anything else, STOP and expand the allowlist before proceeding.

- [ ] **Step 3.2: Create the file**

Create `~/.config/atuin/.gitignore` with exactly this content:

```gitignore
# Allowlist: only the static config file is tracked.
# atuin client writes history and runtime state here — reject everything else.
*
!.gitignore
!config.toml
```

- [ ] **Step 3.3: Verify no file got destracked**

Run:
```bash
cd ~/.config
git status --short
```

Expected: only `?? atuin/.gitignore`. NO `D atuin/...` lines.

- [ ] **Step 3.4: Verify the allowlist behaves as intended**

Run:
```bash
cd ~/.config
git check-ignore -v atuin/history.db
git check-ignore -v atuin/sessions.json
git check-ignore -v atuin/config.toml
```

Expected:
- `atuin/history.db` → ignored by `atuin/.gitignore:4:*`.
- `atuin/sessions.json` → ignored by `atuin/.gitignore:4:*` (also matches root `*session*` rule — either is fine).
- `atuin/config.toml` → NOT ignored.

- [ ] **Step 3.5: Stage and commit**

Run:
```bash
cd ~/.config
git add atuin/.gitignore
git commit -m "chore(atuin): add allowlist gitignore (config.toml only)"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 4: Add `fish/.gitignore` (allowlist)

**Files:**
- Create: `~/.config/fish/.gitignore`

- [ ] **Step 4.1: Verify the current tracked set in `fish/`**

Run:
```bash
cd ~/.config
git ls-files fish/
```

Expected output (6 files):
```
fish/completions/wt.fish
fish/conf.d/fish_frozen_key_bindings.fish
fish/config.fish
fish/fish_variables
fish/functions/wt.fish
fish/functions/y.fish
```

If you see anything outside `config.fish`, `fish_variables`, `conf.d/`, `functions/`, `completions/`, STOP and expand the allowlist.

- [ ] **Step 4.2: Create the file**

Create `~/.config/fish/.gitignore` with exactly this content:

```gitignore
# Allowlist: only the configuration surface is tracked.
# fish writes runtime state (history, etc.) here — reject everything else.
*
!.gitignore
!config.fish
!fish_variables
!conf.d/
!conf.d/**
!functions/
!functions/**
!completions/
!completions/**
```

- [ ] **Step 4.3: Verify no file got destracked**

Run:
```bash
cd ~/.config
git status --short
```

Expected: only `?? fish/.gitignore`. NO `D fish/...` lines.

If any `D fish/...` appears, STOP, `rm fish/.gitignore`, and report.

- [ ] **Step 4.4: Verify the allowlist behaves as intended**

Run:
```bash
cd ~/.config
git check-ignore -v fish/fish_history
git check-ignore -v fish/sessions/abc.json
git check-ignore -v fish/config.fish
git check-ignore -v fish/functions/y.fish
git check-ignore -v fish/conf.d/new_binding.fish
```

Expected:
- `fish/fish_history` → ignored (root `*history*` may also catch it; either source is fine).
- `fish/sessions/abc.json` → ignored.
- `fish/config.fish` → NOT ignored.
- `fish/functions/y.fish` → NOT ignored.
- `fish/conf.d/new_binding.fish` → NOT ignored (a new file in an allowed subfolder should track).

- [ ] **Step 4.5: Stage and commit**

Run:
```bash
cd ~/.config
git add fish/.gitignore
git commit -m "chore(fish): add allowlist gitignore (config + conf.d + functions + completions + fish_variables)"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 5: Add `hosts/.gitignore` (allowlist)

**Files:**
- Create: `~/.config/hosts/.gitignore`

- [ ] **Step 5.1: Verify the current tracked set in `hosts/`**

Run:
```bash
cd ~/.config
git ls-files hosts/
```

Expected output (6 files):
```
hosts/arch/initialize.sh
hosts/at-apptools/docker-compose.yml
hosts/at-apptools/initialize.sh
hosts/dokploy-ubuntu/docker-compose.yml
hosts/dokploy-ubuntu/initialize.sh
hosts/macos-shell/initialize.sh
```

If you see anything else, STOP and expand the allowlist.

- [ ] **Step 5.2: Create the file**

Create `~/.config/hosts/.gitignore` with exactly this content:

```gitignore
# Allowlist: only per-host bootstrap scripts and compose files are tracked.
# Per-host runtime state, secrets, and local overrides are rejected.
*
!.gitignore
!*/
!*/initialize.sh
!*/docker-compose.yml
```

- [ ] **Step 5.3: Verify no file got destracked**

Run:
```bash
cd ~/.config
git status --short
```

Expected: only `?? hosts/.gitignore`. NO `D hosts/...` lines.

- [ ] **Step 5.4: Verify the allowlist behaves as intended**

Run:
```bash
cd ~/.config
git check-ignore -v hosts/arch/initialize.sh
git check-ignore -v hosts/macos-shell/.env
git check-ignore -v hosts/arch/foo.log
git check-ignore -v hosts/new-host/initialize.sh
```

Expected:
- `hosts/arch/initialize.sh` → NOT ignored.
- `hosts/macos-shell/.env` → ignored (by root or by `hosts/.gitignore`; either source is fine).
- `hosts/arch/foo.log` → ignored (root `*.log` global).
- `hosts/new-host/initialize.sh` → NOT ignored (a new host with the standard bootstrap script tracks automatically).

- [ ] **Step 5.5: Stage and commit**

Run:
```bash
cd ~/.config
git add hosts/.gitignore
git commit -m "chore(hosts): add allowlist gitignore (per-host initialize.sh + docker-compose.yml)"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 6: Add `gh-dash/.gitignore` (allowlist — config.yml only)

**Files:**
- Create: `~/.config/gh-dash/.gitignore`

- [ ] **Step 6.1: Verify the current tracked set in `gh-dash/`**

Run:
```bash
cd ~/.config
git ls-files gh-dash/
```

Expected output (1 file):
```
gh-dash/config.yml
```

- [ ] **Step 6.2: Create the file**

Create `~/.config/gh-dash/.gitignore` with exactly this content:

```gitignore
# Allowlist: only the static config file is tracked.
# gh-dash may add caches or session state — reject everything else.
*
!.gitignore
!config.yml
```

- [ ] **Step 6.3: Verify no file got destracked**

Run:
```bash
cd ~/.config
git status --short
```

Expected: only `?? gh-dash/.gitignore`. NO `D gh-dash/...` lines.

- [ ] **Step 6.4: Verify the allowlist behaves as intended**

Run:
```bash
cd ~/.config
git check-ignore -v gh-dash/cache.json
git check-ignore -v gh-dash/config.yml
```

Expected:
- `gh-dash/cache.json` → ignored.
- `gh-dash/config.yml` → NOT ignored.

- [ ] **Step 6.5: Stage and commit**

Run:
```bash
cd ~/.config
git add gh-dash/.gitignore
git commit -m "chore(gh-dash): add allowlist gitignore (config.yml only)"
git status --short
```

Expected: commit succeeds, status clean.

---

## Task 7: Final verification gate

**Files:** (read-only verification — no changes)

- [ ] **Step 7.1: Confirm no file was destracked across the whole change**

Run:
```bash
cd ~/.config
git ls-files | wc -l
```

Expected: `2262` (2255 original + 1 spec + 1 plan + 5 new gitignores = 2262). If different, investigate which files vanished.

Compare against pre-change baseline:
```bash
cd ~/.config
git log --oneline main~7..main
```

Expected: 7 new commits (docs + 6 chores).

- [ ] **Step 7.2: Confirm the working tree is clean**

Run:
```bash
cd ~/.config
git status --short
```

Expected: empty output.

- [ ] **Step 7.3: Spot-check synthetic risky files in folders WITHOUT their own .gitignore**

Run:
```bash
cd ~/.config
git check-ignore -v alacritty/.env
git check-ignore -v wezterm/private.pem
git check-ignore -v sketchybar/service-account-prod.json
git check-ignore -v yazi/foo.p12
```

Expected: all four files ignored by the root `.gitignore` rules added in Task 1.

- [ ] **Step 7.4: Confirm legitimate currently-tracked files still resolve**

The key invariant: every file from the pre-change `git ls-files` must still appear in the post-change `git ls-files`. We already proved this in Step 7.1 (count = 2262 = 2255 + 7 new). This step is a sanity check on specific high-value files using a different tool path.

Run:
```bash
cd ~/.config
for f in \
  secrets/minimax_api_key.yaml \
  atuin/config.toml \
  fish/fish_variables \
  hosts/arch/initialize.sh \
  gh-dash/config.yml \
  shell/scripts/add-secret; do
  if git check-ignore -q "$f"; then
    echo "FAIL: $f is now ignored (should be tracked)"
  else
    echo "OK:   $f is NOT ignored"
  fi
done
```

Expected: 6 lines all starting with `OK:`. Any `FAIL:` line means a previously-tracked file is now ignored — STOP and investigate which rule introduced the regression.

Note on `nixos/.envrc`: it IS ignored by the pre-existing `nixos/.gitignore:21:.envrc` rule and was already ignored before our changes — verify by confirming it appears in `git ls-files`:
```bash
cd ~/.config && git ls-files nixos/.envrc
```
Expected: `nixos/.envrc` (still tracked despite being matched by a `.gitignore` — `.gitignore` rules only apply to untracked files, never to already-tracked ones).

- [ ] **Step 7.5: Show the commit log to user for review**

Run:
```bash
cd ~/.config
git log --oneline main~7..main
git diff main~7..main --stat
```

Expected: 7 commits, stat shows ~6 files changed (`.gitignore` + 5 new gitignores + spec + plan).

- [ ] **Step 7.6: ASK USER before pushing**

Do NOT push automatically. Show the verification output above and ask:

> "Local verification passed. 7 commits ready to push to `origin/main`. Want me to push now, or do you want to review the diff first?"

Wait for explicit approval before running `git push`.

- [ ] **Step 7.7: Push (only after user approval)**

Run:
```bash
cd ~/.config
git push origin main
```

Expected: push succeeds. The 7 commits are now in the public remote.

---

## Rollback procedure (if anything goes wrong)

**Before push (local only):**
```bash
cd ~/.config
git reset --hard origin/main
```
This discards all 7 commits and returns to the pre-task state.

**After push:**
```bash
cd ~/.config
git revert <commit-sha>  # revert one specific commit
# or
git revert main~7..main  # revert the whole range
git push origin main
```
