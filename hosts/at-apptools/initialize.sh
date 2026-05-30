#!/usr/bin/env bash
set -euo pipefail

echo "=== AT Apptools Ubuntu Setup (SSH container) ==="
echo ""

export DEBIAN_FRONTEND=noninteractive

# --- Constraints ---
[ "$(uname -s)" = "Linux" ]            || { echo "Error: must run on Linux" >&2; exit 1; }
[ "$(id -u)" -ne 0 ]                   || { echo "Error: do not run as root" >&2; exit 1; }
command -v sudo >/dev/null 2>&1        || { echo "Error: sudo not found" >&2; exit 1; }
[ -f "$HOME/.config/shell/bootstrap.sh" ] || { echo "Error: dotfiles not cloned — run: git clone https://github.com/hugotown/dotfiles.git ~/.config" >&2; exit 1; }

# ══════════════════════════════════════════════════════════════
# 1. SYSTEM LIBRARIES (apt) — only what brew/mise CAN'T provide
#    Build deps, Playwright browser deps, SSH
# ══════════════════════════════════════════════════════════════
echo "Installing system libraries..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    build-essential pkg-config libssl-dev cmake \
    zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
    libncursesw5-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
    libgtk-3-dev libgtk-4-dev \
    libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev \
    libenchant-2-dev libsecret-1-dev \
    libwebkit2gtk-4.1-dev \
    libevent-2.1-7t64 libflite1 libavif16 \
    xvfb \
    gnupg \
    oathtool \
    procps file rsync

# ══════════════════════════════════════════════════════════════
# 2. STANDALONE INSTALLERS (no dependencies between them)
#    Just download the base tools — no packages yet.
# ══════════════════════════════════════════════════════════════

# Homebrew
if ! command -v brew >/dev/null; then
    echo "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# Rust (via rustup)
if ! command -v rustup >/dev/null; then
    echo "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
fi
source "$HOME/.cargo/env"

# uv (standalone — manages Python)
if ! command -v uv >/dev/null; then
    echo "Installing uv (standalone)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# mise (manages node, go, bun, pnpm)
if ! command -v mise >/dev/null; then
    echo "Installing mise..."
    curl https://mise.run | sh
fi
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

# kubectl + gke-gcloud-auth-plugin (via Google Cloud apt repo)
if ! command -v kubectl >/dev/null || ! command -v gke-gcloud-auth-plugin >/dev/null; then
    echo "Installing kubectl and gke-gcloud-auth-plugin..."
    if [ ! -f /etc/apt/sources.list.d/google-cloud-sdk.list ]; then
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
            sudo gpg --dearmor -o /etc/apt/keyrings/cloud.google.gpg
        echo "deb [signed-by=/etc/apt/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | \
            sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
        sudo apt-get update
    fi
    sudo -n apt-get install -y kubectl google-cloud-cli-gke-gcloud-auth-plugin
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
# 3. RUST ECOSYSTEM (depends on: rustup)
# ══════════════════════════════════════════════════════════════

echo "Installing cargo CLI tools..."
cargo install --locked duckduckgo --features rust-binary
cargo install --locked trunk
cargo install --locked ast-grep

# ══════════════════════════════════════════════════════════════
# 4. PYTHON ECOSYSTEM (depends on: uv)
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

# Playwright: system deps (Linux) + browser binaries
echo "Installing Playwright system deps..."
sudo playwright install-deps 2>/dev/null || true
playwright install chromium 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# 5. MISE ECOSYSTEM (depends on: mise)
#    Installs node, go, bun, pnpm + their dependents
# ══════════════════════════════════════════════════════════════

echo "Installing mise tools (node, go, bun, pnpm)..."
mise install -y

# pi (coding agent — depends on node from mise)
if ! command -v pi >/dev/null; then
    echo "Installing pi..."
    curl -fsSL https://pi.dev/install.sh | sh
fi

# agent-tools: install @google/genai for genai-core (shared tool logic)
echo "Installing agent-tools dependencies..."
(cd "$HOME/.config/agent-tools/genai-core" && mise exec -- bun install)
echo "✓ genai-core ready"

# pnpm global settings — disable lifecycle scripts by default (supply chain hardening)
echo "Configuring pnpm global settings..."
mise exec -- pnpm config set ignore-scripts true --location=global

# ══════════════════════════════════════════════════════════════
# 6. HOMEBREW PACKAGES (depends on: Homebrew)
# ══════════════════════════════════════════════════════════════

echo "Installing Homebrew packages..."
brew install \
    zsh bash fish \
    neovim tmux \
    bat ripgrep fd fzf jq \
    curl wget tree btop ncdu \
    git gh \
    duf git-delta hyperfine \
    gnupg age \
    poppler unzip zip xz \
    glow \
    starship zoxide atuin \
    lazygit lazydocker \
    yazi eza zellij \
    dust procs xh tokei \
    watchexec just tealdeer \
    nushell ouch diffnav television \
    sops duckdb

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# 7. CONFIGURATION & LINKING
# ══════════════════════════════════════════════════════════════

echo "Running shell bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# Host-specific env vars (written to env.local files, gitignored)
echo "Configuring host-specific environment..."
VERTEX_PROJECT="avantech-apptools"
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

# Link ~/.claude → ~/.config/.claude
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

# Link ~/.agents → ~/.config/.agents
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

# graphifyy (uv tool — needs ~/.claude symlink in place)
if ! command -v graphify >/dev/null; then
    echo "Installing graphifyy with office+video extras..."
    uv tool install "graphifyy[office,video]"
    graphify install
fi

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
echo "To update all tools: brew upgrade && mise upgrade && uv self update && uv tool upgrade --all"
