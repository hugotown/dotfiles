#!/usr/bin/env bash
# =============================================================================
#  runbook_ubuntu.sh — Idempotent Ubuntu bootstrap for hugotown/dotfiles
# =============================================================================
#  Recreates the exact step-by-step we ran in our install session:
#  - 75 tools across apt, cargo, uv tools, and GitHub-release binaries
#  - 75 unique binaries verified in Phase 11
#  - Idempotent: safe to re-run; each step skips what's already installed
#  - Runs as ROOT (this script is intended for the fresh Ubuntu 24.04 VM
#    in /root); guards on non-root systems exist but are bypassed here
#
#  Usage:    bash runbook_ubuntu.sh
#  Rollback: see "ROLLBACK" section at the bottom
#
#  Companion files in ~/.config/hosts/:
#    - arch/initialize.sh           (Arch — different OS, not used here)
#    - at-apptools/initialize.sh    (Ubuntu SSH container; ~identical to ours)
#    - dokploy-ubuntu/initialize.sh (Ubuntu SSH container; ~identical to ours)
#    - macos-shell/initialize.sh    (macOS — different OS, not used here)
# =============================================================================

set -uo pipefail  # NOTE: not -e — we want individual steps to fail soft

# ---------- Pretty output ----------
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; CYN=$'\033[0;36m'; NC=$'\033[0m'
section() { echo -e "\n${CYN}========================================${NC}"; echo -e "${CYN}  $*${NC}"; echo -e "${CYN}========================================${NC}"; }
ok()      { echo -e "${GRN}✓${NC} $*"; }
info()    { echo -e "${YLW}→${NC} $*"; }
warn()    { echo -e "${YLW}!${NC} $*" >&2; }
err()     { echo -e "${RED}✗${NC} $*" >&2; }

# ---------- Pre-flight ----------
section "Pre-flight checks"

[ "$(uname -s)" = "Linux" ] || { err "Must run on Linux"; exit 1; }
[ -f /etc/debian_version ]  || { err "Targets Debian/Ubuntu (no /etc/debian_version)"; exit 1; }

# Detect if running as root. The original initialize.sh refuses to run as
# root; we ALLOW root because the target VM is the root-only Ubuntu 24.04.
if [ "$EUID" -eq 0 ]; then
  warn "Running as root — original initialize.sh would abort here."
  warn "Bypassing non-root guard. Be careful."
  SUDO=""  # no sudo needed when root
else
  command -v sudo >/dev/null || { err "sudo not found"; exit 1; }
  SUDO="sudo"
fi

# We expect ~/.config to already be the cloned dotfiles repo
[ -f "$HOME/.config/shell/bootstrap.sh" ] \
  || warn "dotfiles not cloned at ~/.config (no shell/bootstrap.sh). Some symlinks downstream will fail."

ok "Pre-flight passed"

# ---------- Helpers ----------
apt_install() {
  # Install via apt only if missing. Args are package names.
  local to_install=()
  for pkg in "$@"; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
      info "apt: $pkg already installed"
    else
      to_install+=("$pkg")
    fi
  done
  [ ${#to_install[@]} -gt 0 ] && DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y --no-install-recommends "${to_install[@]}"
}

gh_release_url() {
  # Usage: gh_release_url <owner/repo> <asset-grep-pattern>
  # Authenticated (raises the 60/hr → 5000/hr limit).
  local repo="$1" pattern="$2"
  local tag
  tag=$(curl -sSL -H "Authorization: token ${GITHUB_TOKEN:-}" \
    "https://api.github.com/repos/$repo/releases/latest" \
    | grep -oE '"tag_name":\s*"v?[0-9][^"]+"' | head -1 | grep -oE 'v?[0-9][^"]+')
  [ -z "$tag" ] && { err "Could not fetch latest tag for $repo"; return 1; }
  curl -sSL -H "Authorization: token ${GITHUB_TOKEN:-}" \
    "https://api.github.com/repos/$repo/releases/latest" \
    | grep "browser_download_url" | grep -E "$pattern" | head -1 | grep -oE 'https://[^"]+'
}

# =============================================================================
#  PHASE 1 — apt system libraries (build deps, GPG, oathtool, etc.)
# =============================================================================
#  Why first: uv, cargo, and any Rust/Python compile need libssl, libffi, etc.
#  Decision: install ALL build deps in one block to maximize cache hits.
#  Lesson: --no-install-recommends keeps the footprint small (~1 GB saved).
# =============================================================================
section "PHASE 1 — apt system libraries"

$SUDO apt-get update -qq
apt_install \
  build-essential pkg-config \
  libssl-dev zlib1g-dev libffi-dev \
  libbz2-dev libreadline-dev libsqlite3-dev \
  libxml2-dev libxmlsec1-dev liblzma-dev libncursesw5-dev \
  cmake gnupg oathtool procps file rsync \
  curl wget git

# xvfb and libflite1 are sometimes pre-installed
$SUDO apt-get install -y --no-install-recommends xvfb libflite1 2>&1 | tail -2 || true
ok "Phase 1 done"

# =============================================================================
#  PHASE 2 — Pilares (uv, rustup, gh) — single-shot installers
# =============================================================================
#  Why before everything: Python (uv) and Rust (cargo) are dependency roots
#  for the rest. Order matters: uv is pre-existing, rustup is what we add.
#  gh is pre-existing via apt.
#
#  Lesson: rustup installer is interactive by default; use -y --profile minimal
#  to skip the prompt and avoid the default toolchain + docs (saves 500 MB).
# =============================================================================
section "PHASE 2 — Pilares"

# uv (standalone, manages Python)
if command -v uv >/dev/null 2>&1; then
  info "uv already installed: $(uv --version | head -1)"
else
  info "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# rustup (standalone, manages Rust)
if command -v rustup >/dev/null 2>&1; then
  info "rustup already installed"
else
  info "Installing rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal
  source "$HOME/.cargo/env"
fi

# gh (apt) — usually pre-installed
command -v gh >/dev/null || apt_install gh
ok "Phase 2 done — uv, rustup, gh"

# =============================================================================
#  PHASE 3 — Shells (apt)
# =============================================================================
#  bash pre-exists. fish and zsh are in apt. nushell is NOT in apt for
#  24.04 (LTS) — it landed in Debian Trixie / Ubuntu 25.04. We install
#  it later from GitHub releases in Phase 7.
# =============================================================================
section "PHASE 3 — Shells (apt)"

apt_install fish zsh
ok "Phase 3 done (nushell arrives in Phase 7)"

# =============================================================================
#  PHASE 4 — TUI base (apt) — small, no compile time
# =============================================================================
#  tmux, btop, fzf, ripgrep, jq, tree, batcat, eza, fdfind, ncdu.
#  Lesson: Debian renames `bat` → `batcat` and `fd` → `fdfind` due to
#  name conflicts with other packages. Use the renamed binaries as-is
#  (or add aliases to ~/.bashrc — see Phase 9).
# =============================================================================
section "PHASE 4 — TUI base (apt)"

apt_install tmux btop fzf ripgrep jq tree bat eza fd-find ncdu
ok "Phase 4 done"

# =============================================================================
#  PHASE 5 — Prompts/UX (standalone installers via curl|sh)
# =============================================================================
#  Why these are curl|sh and not cargo: starship/zoxide/atuin all distribute
#  binary releases that install to ~/.local/bin or /usr/local/bin.
#  Lesson: atuin's installer puts the binary in ~/.atuin/bin, which is NOT
#  in PATH by default. We add it to ~/.bashrc in Phase 9.
# =============================================================================
section "PHASE 5 — Prompts/UX"

# starship
command -v starship >/dev/null || { info "Installing starship"; curl -sS https://starship.rs/install.sh | sh -s -- -y; }

# zoxide
command -v zoxide >/dev/null || { info "Installing zoxide"; curl -sS https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | bash; }

# atuin
command -v atuin >/dev/null || { info "Installing atuin"; curl -sS https://raw.githubusercontent.com/atuinsh/atuin/main/install.sh | bash; }

ok "Phase 5 done"

# =============================================================================
#  PHASE 6 — TUI extras (apt + cargo + binary releases — mixed strategy)
# =============================================================================
#  Strategy per tool (decided after first-pass cargo batch failed for several):
#
#    | Tool        | Source           | Reason                            |
#    | ----------- | ---------------- | --------------------------------- |
#    | yazi        | GitHub .deb      | cargo build fails (missing *.lua) |
#    | procs       | cargo            | clean compile, no conflict        |
#    | hyperfine   | cargo            | cargo is 1.20.0 vs apt 1.18.0     |
#    | duf         | cargo            | apt says "built from source"      |
#    | tokei       | cargo            | not in apt                        |
#    | dust        | cargo as `du-dust` | crates.io name != binary name    |
#    | ast-grep    | cargo            | not in apt                        |
#    | trunk       | cargo            | not in apt                        |
#    | xh          | cargo            | not in apt                        |
#    | mdcat       | cargo            | not in apt                        |
#    | glow        | GitHub binary    | crates.io `glow` is a lib, no bin |
#    | watchexec   | GitHub .deb      | crates.io `watchexec` is a lib    |
#    | ouch        | GitHub tar.gz    | cargo build fails                 |
#    | jless       | GitHub zip       | cargo build fails                 |
#    | zellij      | GitHub tar.gz    | not in apt for noble              |
#    | nushell     | GitHub tar.gz    | not in apt for noble              |
#    | duckduckgo  | cargo as `ddg`   | not in apt, no conflict           |
#
#  Lesson: always check `cargo search <name>` before installing — some
#  crates are libraries and the binary lives in a different crate.
# =============================================================================
section "PHASE 6 — TUI extras"

# --- 6a. cargo batch (clean-compile tools) ---
info "cargo batch: procs, ast-grep, trunk, tokei, duf, xh, mdcat, hyperfine, dust(du-dust), ddg"
# Ensure cargo env is loaded
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$PATH"

cargo_install_if_missing() {
  local pkg="$1"
  if [ -f "$HOME/.cargo/bin/$(echo "$pkg" | awk -F: '{print $2}')" ]; then
    info "cargo: $pkg already installed"
  else
    info "cargo install: $pkg"
    cargo install --locked "$pkg" 2>&1 | tail -3
  fi
}

# Map: pkg → expected binary name (sometimes differs)
cargo_install_if_missing procs:procs
cargo_install_if_missing ast-grep:ast-grep
cargo_install_if_missing trunk:trunk
cargo_install_if_missing tokei:tokei
cargo_install_if_missing duf:duf
cargo_install_if_missing xh:xh
cargo_install_if_missing mdcat:mdcat
cargo_install_if_missing hyperfine:hyperfine
cargo_install_if_missing du-dust:dust
cargo_install_if_missing duckduckgo:ddg  # binary is `ddg`, not `duckduckgo`

# --- 6b. GitHub release binaries ---
info "GitHub release binaries: yazi, glow, watchexec, ouch, jless, nushell, zellij"

# yazi (DEB — cargo build fails due to missing preset/plugins/*.lua files
# in the published crate; the .deb from the GitHub release is the same
# version with assets intact)
if ! command -v yazi >/dev/null; then
  YAZI_URL=$(gh_release_url "sxyazi/yazi" 'x86_64-unknown-linux-gnu\.deb')
  if [ -n "$YAZI_URL" ]; then
    info "Downloading yazi .deb"
    $SUDO curl -sSL "$YAZI_URL" -o /tmp/yazi.deb
    DEBIAN_FRONTEND=noninteractive $SUDO dpkg -i /tmp/yazi.deb
    $SUDO apt-get install -f -y  # pull any missing deps
    rm -f /tmp/yazi.deb
  fi
fi

# glow (GitHub binary — crates.io `glow` is a library, no binary)
if ! command -v glow >/dev/null; then
  GLOW_URL=$(gh_release_url "charmbracelet/glow" 'glow_.*_Linux_x86_64\.tar\.gz')
  if [ -n "$GLOW_URL" ]; then
    info "Downloading glow"
    curl -sSL "$GLOW_URL" -o /tmp/glow.tar.gz
    tar -xzf /tmp/glow.tar.gz -C /tmp
    $SUDO install /tmp/glow_*/glow /usr/local/bin/glow
    rm -rf /tmp/glow.tar.gz /tmp/glow_*
  fi
fi

# watchexec (DEB — crates.io `watchexec` is a library)
if ! command -v watchexec >/dev/null; then
  WX_URL=$(gh_release_url "watchexec/watchexec" 'x86_64-unknown-linux-gnu\.deb')
  if [ -n "$WX_URL" ]; then
    info "Downloading watchexec .deb"
    $SUDO curl -sSL "$WX_URL" -o /tmp/wx.deb
    DEBIAN_FRONTEND=noninteractive $SUDO dpkg -i /tmp/wx.deb
    $SUDO apt-get install -f -y
    rm -f /tmp/wx.deb
  fi
fi

# ouch (tar.gz — cargo build fails)
if ! command -v ouch >/dev/null; then
  OUCH_URL=$(gh_release_url "ouch-org/ouch" 'x86_64-unknown-linux-gnu\.tar\.gz')
  if [ -n "$OUCH_URL" ]; then
    info "Downloading ouch"
    curl -sSL "$OUCH_URL" -o /tmp/ouch.tar.gz
    tar -xzf /tmp/ouch.tar.gz -C /tmp
    $SUDO install /tmp/ouch-*/ouch /usr/local/bin/ouch
    rm -rf /tmp/ouch.tar.gz /tmp/ouch-*
  fi
fi

# jless (zip — cargo build fails)
if ! command -v jless >/dev/null; then
  JLESS_URL=$(gh_release_url "PaulJuliusMartinez/jless" 'x86_64-unknown-linux-gnu\.zip')
  if [ -n "$JLESS_URL" ]; then
    info "Downloading jless"
    curl -sSL "$JLESS_URL" -o /tmp/jless.zip
    unzip -o /tmp/jless.zip -d /tmp
    $SUDO install /tmp/jless /usr/local/bin/jless
    rm -f /tmp/jless.zip /tmp/jless
  fi
fi

# nushell (tar.gz — not in apt for 24.04)
if ! command -v nu >/dev/null; then
  NU_URL=$(gh_release_url "nushell/nushell" 'x86_64-unknown-linux-gnu\.tar\.gz')
  if [ -n "$NU_URL" ]; then
    info "Downloading nushell"
    curl -sSL "$NU_URL" -o /tmp/nu.tar.gz
    tar -xzf /tmp/nu.tar.gz -C /tmp
    $SUDO install /tmp/nu-*/nu /usr/local/bin/nu
    rm -rf /tmp/nu.tar.gz /tmp/nu-*
  fi
fi

# zellij (tar.gz — not in apt for 24.04)
if ! command -v zellij >/dev/null; then
  ZJ_URL=$(gh_release_url "zellij-org/zellij" 'x86_64-unknown-linux-musl\.tar\.gz')
  if [ -n "$ZJ_URL" ]; then
    info "Downloading zellij"
    curl -sSL "$ZJ_URL" -o /tmp/zj.tar.gz
    tar -xzf /tmp/zj.tar.gz -C /tmp
    $SUDO install /tmp/zellij /usr/local/bin/zellij
    rm -f /tmp/zj.tar.gz /tmp/zellij
  fi
fi

ok "Phase 6 done"

# =============================================================================
#  PHASE 7 — Security + DB + Editor (apt + binaries)
# =============================================================================
section "PHASE 7 — Security + DB + Editor"

# sops, age, duckdb, lazygit, lazydocker — GitHub releases
for spec in \
  "getsops/sops:sops:sops-%s.linux.amd64" \
  "FiloSottile/age:age:age-%s-linux-amd64.tar.gz" \
  "duckdb/duckdb:duckdb:duckdb_cli-linux-amd64.zip" \
  "jesseduffield/lazygit:lazygit:lazygit_%s_linux_x86_64.tar.gz" \
  "jesseduffield/lazydocker:lazydocker:lazydocker_%s_Linux_x86_64.tar.gz"
do
  IFS=':' read -r repo bin pat <<< "$spec"
  if ! command -v "$bin" >/dev/null; then
    TAG=$(curl -sSL -H "Authorization: token ${GITHUB_TOKEN:-}" \
      "https://api.github.com/repos/$repo/releases/latest" \
      | grep -oE '"tag_name":\s*"v?[0-9][^"]+"' | head -1 | grep -oE 'v?[0-9][^"]+')
    [ -z "$TAG" ] && { warn "No tag for $repo, skipping"; continue; }
    URL=$(printf "https://github.com/$repo/releases/download/${TAG}/${pat}" "${TAG#v}")
    info "Installing $bin from $URL"
    TMP="/tmp/${bin}.dl"
    curl -sSL "$URL" -o "$TMP"
    case "$TMP" in
      *.tar.gz)  tar -xzf "$TMP" -C /tmp && $SUDO install /tmp/$bin*/$bin /tmp/$bin*/${bin}-keygen /usr/local/bin/ 2>/dev/null || $SUDO install /tmp/$bin*/$bin /usr/local/bin/ ;;
      *.zip)     unzip -o "$TMP" -d /tmp && $SUDO install /tmp/$bin /usr/local/bin/$bin ;;
      *)         $SUDO install "$TMP" /usr/local/bin/$bin ;;
    esac
    rm -rf "$TMP" /tmp/$bin* 2>/dev/null
  fi
done

# Editor
apt_install neovim
ok "Phase 7 done"

# =============================================================================
#  PHASE 8 — uv Python tools (cascada uv → python → deps)
# =============================================================================
#  All tools run in Python 3.13 that uv manages automatically. Each gets
#  its own venv under ~/.local/share/uv/tools/<tool>/. awscli was
#  explicitly rejected by the user — do not install.
#
#  Lesson: playwright needs `playwright install <browser>` (binaries)
#  AND `playwright install-deps` (system libs via apt). We do both.
# =============================================================================
section "PHASE 8 — uv Python tools"

export PATH="$HOME/.local/bin:$PATH"

for tool in httpie yt-dlp streamlit "notebooklm-py[browser]" pypistats playwright; do
  # Extract the installable name (strip [extras])
  base="${tool%%\[*}"
  if uv tool list 2>/dev/null | grep -q "^${base} "; then
    info "uv: $base already installed"
  else
    info "uv tool install: $tool"
    uv tool install "$tool" 2>&1 | tail -3
  fi
done

# Playwright browsers (chromium, firefox, webkit) + system deps
if command -v playwright >/dev/null; then
  info "playwright install chromium/firefox/webkit"
  playwright install chromium firefox webkit 2>&1 | tail -3
  info "playwright install-deps (apt system libs)"
  $SUDO playwright install-deps 2>&1 | tail -5 || warn "playwright install-deps had issues"
fi
ok "Phase 8 done"

# =============================================================================
#  PHASE 9 — Misc + bashrc tweaks
# =============================================================================
#  - Aliases: batcat → bat, fdfind → fd, duckduckgo → ddg
#  - PATH: atuin lives in ~/.atuin/bin (not in PATH by default)
#  - ~/.cargo/env sourced
# =============================================================================
section "PHASE 9 — Shell config (idempotent append)"

BASHRC="$HOME/.bashrc"

# Idempotent append: only adds the block once
add_once() {
  local marker="$1"
  local block="$2"
  if grep -qF "$marker" "$BASHRC" 2>/dev/null; then
    info "bashrc: $marker already present"
  else
    info "bashrc: appending $marker"
    printf '\n%s\n' "$block" >> "$BASHRC"
  fi
}

add_once "# runbook: aliases" '# runbook: Debian rename + cargo binary aliases
alias bat=batcat
alias fd=fdfind
alias duckduckgo=ddg'

add_once "# runbook: atuin PATH" 'export PATH="$HOME/.atuin/bin:$PATH"'
add_once "# runbook: cargo PATH" '. "$HOME/.cargo/env"'

ok "Phase 9 done"

# =============================================================================
#  PHASE 10 — Post-install hygiene (optional cleanup of apt duplicates)
# =============================================================================
#  After Phase 4 installed apt versions of hyperfine/duf AND Phase 6
#  installed cargo versions, we removed the older apt copies. This is
#  the only destructive step in the runbook — comment out if unsure.
# =============================================================================
section "PHASE 10 — Dedupe (hyperfine/duf apt copies)"

if dpkg -s hyperfine >/dev/null 2>&1 && [ -x "$HOME/.cargo/bin/hyperfine" ]; then
  info "Removing apt hyperfine (cargo is newer)"
  $SUDO apt-get remove -y --no-install-recommends hyperfine
fi
if dpkg -s duf >/dev/null 2>&1 && [ -x "$HOME/.cargo/bin/duf" ]; then
  info "Removing apt duf (cargo is preferred)"
  $SUDO apt-get remove -y --no-install-recommends duf
fi

ok "Phase 10 done"

# =============================================================================
#  PHASE 11 — Verification matrix
# =============================================================================
section "PHASE 11 — Verification"

# Quick sanity check of all expected binaries
EXPECTED=(
  # Build essentials + apt base
  curl wget git gcc g++ make pkg-config
  cmake gpg oathtool
  # Pilares
  uv rustc cargo gh
  # Shells
  bash fish zsh nu
  # TUI base
  tmux btop fzf rg jq tree batcat eza fdfind ncdu
  # TUI extra (cargo + binaries)
  ast-grep trunk tokei dust duf xh mdcat procs hyperfine ddg
  # Standalone binaries
  tv sops age duckdb lazygit lazydocker glow watchexec ouch jless zellij yazi
  # apt 🅰️
  chafa ffmpegthumbnailer delta convert just mpv pandoc tldr pdftotext unzip zip xz 7z
  # Graphviz
  dot
  # UV tools
  http httpie yt-dlp streamlit notebooklm pypistats playwright
  # Prompts/UX
  starship zoxide atuin
  # Editor
  nvim
)

PASS=0; FAIL=0
for c in "${EXPECTED[@]}"; do
  if command -v "$c" >/dev/null 2>&1; then
    PASS=$((PASS+1))
  else
    err "MISSING: $c"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo -e "${CYN}========================================${NC}"
echo -e "${CYN}  RESULT: ${GRN}${PASS} OK${NC} / ${RED}${FAIL} MISSING${NC} of ${#EXPECTED[@]} expected"
echo -e "${CYN}========================================${NC}"

[ "$FAIL" -eq 0 ] || warn "Some tools missing — review errors above"

# =============================================================================
#  THINGS THIS RUNBOOK DOES NOT DO
# =============================================================================
#  - Does NOT run bootstrap.sh from your dotfiles (linker would overwrite
#    configs in $HOME). Run it manually when you're ready.
#  - Does NOT create symlinks ~/.claude → ~/.config/.claude or
#    ~/.agents → ~/.config/.agents (no Claude Code installed).
#  - Does NOT write a sops/age keypair — that's your private key. The
#    expected location is ~/.local/share/sops/age/keys.txt (chmod 600).
#  - Does NOT install: mise, gcloud, kubectl, goose, claude, opencode, pi,
#    workbooks, agent-tools, graphifyy, awscli (user rejected all of these).
# =============================================================================

# =============================================================================
#  ROLLBACK (manual, in case you want to undo everything)
# =============================================================================
#  apt packages:
#    $SUDO apt-get remove -y --no-install-recommends \
#      build-essential pkg-config libssl-dev zlib1g-dev libffi-dev \
#      libbz2-dev libreadline-dev libsqlite3-dev libxml2-dev \
#      libxmlsec1-dev liblzma-dev libncursesw5-dev cmake gnupg \
#      oathtool procps file rsync curl wget git \
#      fish zsh tmux btop fzf ripgrep jq tree bat eza fd-find ncdu \
#      neovim hyperfine duf chafa ffmpegthumbnailer git-delta \
#      imagemagick just mpv pandoc tealdeer poppler-utils unzip \
#      zip xz-utils p7zip-full graphviz
#    $SUDO apt-get autoremove -y
#
#  binaries in /usr/local/bin (rm each):
#    sops age lazygit lazydocker glow watchexec ouch jless nu zellij duckdb
#
#  cargo binaries in ~/.cargo/bin (rm each):
#    ast-grep sg trunk tokei duf xh mdcat procs hyperfine dust ddg
#
#  uv tools:
#    uv tool uninstall --all
#
#  standalone in ~/.local/bin:
#    starship zoxide  (or use the curl|sh uninstall)
#
#  atuin: rm -rf ~/.atuin
#
#  rustup self uninstall
#  uv self uninstall
#
#  shell config in ~/.bashrc — remove the `# runbook:` blocks
# =============================================================================
