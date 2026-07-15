#!/usr/bin/env bash
set -euo pipefail

echo "=== macOS (Homebrew) Setup ==="
echo ""

# --- Constraints ---
[ "$(uname -s)" = "Darwin" ]           || { echo "Error: must run on macOS" >&2; exit 1; }
[ "$EUID" -ne 0 ]                      || { echo "Error: do not run as root" >&2; exit 1; }
command -v git >/dev/null 2>&1         || { echo "Error: git not found (install Xcode Command Line Tools)" >&2; exit 1; }
[ -f "$HOME/.local/share/sops/age/keys.txt" ] || { echo "Error: age key not found at ~/.local/share/sops/age/keys.txt" >&2; exit 1; }
[ -f "$HOME/.config/shell/bootstrap.sh" ]    || { echo "Error: dotfiles not cloned — run: git clone https://github.com/hugotown/dotfiles.git ~/.config" >&2; exit 1; }

# ══════════════════════════════════════════════════════════════
# 1. STANDALONE INSTALLERS (no dependencies between them)
#    Just download the base tools — no packages yet.
# ══════════════════════════════════════════════════════════════

# Homebrew
if ! command -v brew >/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null

# Rust (via rustup)
echo "Installing Rust..."
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"

# uv (standalone — manages Python)
if ! command -v uv >/dev/null; then
    echo "Installing uv (standalone)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# mise (manages node, go, bun, pnpm)
echo "Installing mise..."
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"

# Goose
if ! command -v goose >/dev/null; then
    echo "Installing Goose CLI..."
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

# Google Cloud SDK
if [ ! -d "$HOME/google-cloud-sdk" ]; then
    echo "Installing Google Cloud SDK..."
    curl -s https://sdk.cloud.google.com | bash -s -- --disable-prompts
fi
if ! command -v gke-gcloud-auth-plugin >/dev/null; then
    echo "Installing gke-gcloud-auth-plugin..."
    "$HOME/google-cloud-sdk/bin/gcloud" components install gke-gcloud-auth-plugin --quiet
fi

# Claude Code
if ! command -v claude >/dev/null; then
    echo "Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
fi

# Opencode
if ! command -v opencode >/dev/null; then
    echo "Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
fi

# Workbooks
if ! command -v wb >/dev/null; then
    echo "Installing Workbooks..."
    curl -fsSL https://get.workbooks.dev | sh
fi


# ══════════════════════════════════════════════════════════════
# 2. RUST ECOSYSTEM (depends on: rustup)
# ══════════════════════════════════════════════════════════════

echo "Installing Rust cross-compilation targets..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

echo "Installing cargo CLI tools..."
cargo install --locked duckduckgo --features rust-binary
cargo install --locked trunk
cargo install --locked ast-grep

# tdf (terminal PDF viewer) - not on crates.io, install from git
if ! command -v tdf >/dev/null; then
    echo "Installing tdf (terminal PDF viewer)..."
    cargo install --git https://github.com/itsjunetime/tdf
fi

# ══════════════════════════════════════════════════════════════
# 3. PYTHON ECOSYSTEM (depends on: uv)
# ══════════════════════════════════════════════════════════════

echo "Installing Python via uv..."
uv python install 3.14 --default
uv python install 3.12

echo "Installing Python CLI tools via uv tool..."
uv tool install awscli
uv tool install streamlit
uv tool install "notebooklm-py[browser]"
uv tool install pypistats
uv tool install playwright
uv tool install httpie
uv tool install yt-dlp
playwright install chromium firefox webkit 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# 4. MISE ECOSYSTEM (depends on: mise)
#    Installs node, go, bun, pnpm + their dependents
# ══════════════════════════════════════════════════════════════

echo "Installing mise tools (node, go, bun, pnpm)..."
"$HOME/.local/bin/mise" install -y

# pi (coding agent — depends on node from mise)
if ! command -v pi >/dev/null; then
    echo "Installing pi..."
    curl -fsSL https://pi.dev/install.sh | sh
fi

# herdr (terminal-native agent runtime — tmux-style persistence + agent state)
if ! command -v herdr >/dev/null; then
    echo "Installing herdr..."
    curl -fsSL https://herdr.dev/install.sh | sh
fi

# agent-tools: install @google/genai for genai-core (shared tool logic)
echo "Installing agent-tools dependencies..."
(cd "$HOME/.config/agent-tools/genai-core" && "$HOME/.local/bin/mise" exec -- bun install)
echo "✓ genai-core ready"

# pnpm global settings — disable lifecycle scripts by default (supply chain hardening)
echo "Configuring pnpm global settings..."
"$HOME/.local/bin/mise" exec -- pnpm config set ignore-scripts true --location=global

# ══════════════════════════════════════════════════════════════
# 5. HOMEBREW PACKAGES (depends on: Homebrew)
# ══════════════════════════════════════════════════════════════

echo "Installing Homebrew packages..."
brew install --cask wezterm
brew install --cask ghostty
brew install --cask font-jetbrains-mono-nerd-font

brew install --cask chromedriver
brew install geckodriver

brew install \
  ffmpeg sevenzip poppler fd ripgrep fzf zoxide resvg imagemagick pngpaste yazi \
  fish nushell cocoapods \
  atuin starship sops age oath-toolkit \
  neovim kitty tmux gh \
  bat eza jq yq git-delta dust duf television \
  procs xh tealdeer \
  hyperfine tokei watchexec \
  curl wget tree btop ncdu just lazygit lazydocker \
  glow mdcat chafa ouch jless mpv ffmpegthumbnailer pandoc \
  duckdb iperf3 rsync \
  kubernetes-cli \
  dlvhdr/formulae/diffnav

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# 6. CONFIGURATION & LINKING
# ══════════════════════════════════════════════════════════════

echo "Running shell bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# Host-specific env vars (written to env.local files, gitignored)
echo "Configuring host-specific environment..."
VERTEX_PROJECT="aplus-c967d"
VERTEX_LOC="global"

cat > "$HOME/.config/shell/env.local.zsh" <<EOF
# Host-specific environment (not tracked in git)
export GOOGLE_CLOUD_PROJECT=$VERTEX_PROJECT
export VERTEX_LOCATION=$VERTEX_LOC
EOF

cat > "$HOME/.config/shell/env.local.fish" <<EOF
# Host-specific environment (not tracked in git)
set -gx GOOGLE_CLOUD_PROJECT $VERTEX_PROJECT
set -gx VERTEX_LOCATION $VERTEX_LOC
EOF

cat > "$HOME/.config/shell/env.local.nu" <<EOF
# Host-specific environment (not tracked in git)
\$env.GOOGLE_CLOUD_PROJECT = "$VERTEX_PROJECT"
\$env.VERTEX_LOCATION = "$VERTEX_LOC"
EOF

# Link ~/.claude → ~/.config/.claude (after claude install + dotfiles clone)
CLAUDE_TARGET="$HOME/.config/.claude"
CLAUDE_LINK="$HOME/.claude"
mkdir -p "$CLAUDE_TARGET"
if [ -L "$CLAUDE_LINK" ] && [ "$(readlink "$CLAUDE_LINK")" = "$CLAUDE_TARGET" ]; then
    echo "✓ ~/.claude already linked to ~/.config/.claude"
elif [ -e "$CLAUDE_LINK" ] || [ -L "$CLAUDE_LINK" ]; then
    backup="$CLAUDE_LINK.backup.$(date +%s)"
    echo "Backing up existing ~/.claude → $backup"
    mv "$CLAUDE_LINK" "$backup"
    ln -s "$CLAUDE_TARGET" "$CLAUDE_LINK"
    echo "✓ Linked ~/.claude → ~/.config/.claude"
else
    ln -s "$CLAUDE_TARGET" "$CLAUDE_LINK"
    echo "✓ Linked ~/.claude → ~/.config/.claude"
fi

# Link ~/.agents → ~/.config/.agents (Claude agents skills directory)
AGENTS_TARGET="$HOME/.config/.agents"
AGENTS_LINK="$HOME/.agents"
mkdir -p "$AGENTS_TARGET"
if [ -L "$AGENTS_LINK" ] && [ "$(readlink "$AGENTS_LINK")" = "$AGENTS_TARGET" ]; then
    echo "✓ ~/.agents already linked to ~/.config/.agents"
elif [ -e "$AGENTS_LINK" ] || [ -L "$AGENTS_LINK" ]; then
    backup="$AGENTS_LINK.backup.$(date +%s)"
    echo "Backing up existing ~/.agents → $backup"
    mv "$AGENTS_LINK" "$backup"
    ln -s "$AGENTS_TARGET" "$AGENTS_LINK"
    echo "✓ Linked ~/.agents → ~/.config/.agents"
else
    ln -s "$AGENTS_TARGET" "$AGENTS_LINK"
    echo "✓ Linked ~/.agents → ~/.config/.agents"
fi

# graphifyy (uv tool — provides /graphify skill; needs ~/.claude symlink in place)
if ! command -v graphify >/dev/null; then
    echo "Installing graphifyy with office+video extras..."
    uv tool install "graphifyy[office,video]"
    graphify install
fi

# Nushell on macOS uses ~/Library/Application Support/nushell/ instead of ~/.config/nushell/
echo "Setting up macOS-specific configs..."
NU_MACOS="$HOME/Library/Application Support/nushell"
mkdir -p "$NU_MACOS"
echo 'source ~/.config/nushell/env.nu' > "$NU_MACOS/env.nu"
echo 'source ~/.config/nushell/config.nu' > "$NU_MACOS/config.nu"
echo "nushell: macOS config redirected to ~/.config/nushell/"

# Enable Safari's built-in WebDriver (WebKit)
safaridriver --enable 2>/dev/null || true

touch "$HOME/.hushlogin"

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
