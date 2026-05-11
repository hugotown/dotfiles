#!/usr/bin/env bash
set -euo pipefail

echo "=== Dokploy Ubuntu Setup (SSH container) ==="
echo ""

export DEBIAN_FRONTEND=noninteractive

# --- Constraints ---
[ "$(uname -s)" = "Linux" ]            || { echo "Error: must run on Linux" >&2; exit 1; }
[ "$(id -u)" -ne 0 ]                   || { echo "Error: do not run as root" >&2; exit 1; }
command -v sudo >/dev/null 2>&1        || { echo "Error: sudo not found" >&2; exit 1; }
[ -f "$HOME/.config/shell/bootstrap.sh" ] || { echo "Error: dotfiles not cloned — run: git clone https://github.com/hugotown/dotfiles.git ~/.config" >&2; exit 1; }

# ──────────────────────────────────────────────
# 1. System libraries (apt) — only libs that brew/mise CAN'T provide
#    Build deps, Playwright browser deps, SSH
# ──────────────────────────────────────────────
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

# ──────────────────────────────────────────────
# 2. Homebrew — CLI tools, shells, terminal utilities
#    Installs precompiled bottles, updates with `brew upgrade`
# ──────────────────────────────────────────────
echo "Installing Homebrew..."
if ! command -v brew >/dev/null; then
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Add brew to PATH for this session
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

echo "Installing brew packages..."
brew install \
    zsh bash fish \
    neovim tmux \
    bat ripgrep fd fzf jq \
    curl wget tree btop ncdu \
    git gh \
    httpie \
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
    sops duckdb \
    llvm lld

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

# ──────────────────────────────────────────────
# 3. Mise — runtimes and dev tools ONLY
#    Config lives in ~/.config/mise/config.toml
#    (node, python, go, rust, bun, pnpm, uv, pipx)
# ──────────────────────────────────────────────
echo "Installing mise..."
if ! command -v mise >/dev/null; then
    curl https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"

echo "Installing mise tools (runtimes + postinstall hooks)..."
mise install -y

# pnpm global settings — disable lifecycle scripts by default (supply chain hardening)
# https://pnpm.io/cli/install#--ignore-scripts
echo "Configuring pnpm global settings..."
mise exec -- pnpm config set ignore-scripts true --location=global

# Playwright system deps (after node is available via mise)
echo "Installing Playwright system deps..."
sudo "$(mise which npx)" playwright install-deps 2>/dev/null || true

# Python packages (after mise so uv is available)
echo "Installing Python packages..."
eval "$(mise activate bash)" 2>/dev/null || true
uv pip install --system -q google-genai Pillow duckdb streamlit plotly 2>/dev/null || true

# ──────────────────────────────────────────────
# 4. npm/go global tools
# ──────────────────────────────────────────────
# goose
if ! command -v goose >/dev/null; then
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

# ──────────────────────────────────────────────
# 5. Google Cloud SDK
# ──────────────────────────────────────────────
if [ ! -d "$HOME/google-cloud-sdk" ]; then
    echo "Installing Google Cloud SDK..."
    curl -s https://sdk.cloud.google.com | bash -s -- --disable-prompts
fi

# ──────────────────────────────────────────────
# 5b. kubectl + gke-gcloud-auth-plugin (via Google Cloud apt repo)
# ──────────────────────────────────────────────
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

# ──────────────────────────────────────────────
# 6. Shell bootstrap (symlinks + cached integrations)
# ──────────────────────────────────────────────
echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# ──────────────────────────────────────────────
# 7. AI coding tools
# ──────────────────────────────────────────────
if ! command -v claude >/dev/null; then
    echo "Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
fi

if ! command -v opencode >/dev/null; then
    echo "Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
fi

if ! command -v wb >/dev/null; then
    echo "Installing Workbooks..."
    curl -fsSL https://get.workbooks.dev | sh
fi

# ──────────────────────────────────────────────
# 8. Link ~/.claude → ~/.config/.claude
#    After claude install + dotfiles clone (whichever finishes last)
# ──────────────────────────────────────────────
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

# ──────────────────────────────────────────────
# 9. Link ~/.agents → ~/.config/.agents
#    Claude agents skills directory (mirrors .claude pattern)
# ──────────────────────────────────────────────
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

# ──────────────────────────────────────────────
# 10. graphifyy (uv tool — provides /graphify skill)
#     Runs AFTER ~/.claude symlink so SKILL.md lands in the dotfiles repo
# ──────────────────────────────────────────────
if ! command -v graphify >/dev/null; then
    echo "Installing graphifyy with office+video extras..."
    uv tool install "graphifyy[office,video]"
    graphify install
fi

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
echo "To update all tools: brew upgrade && mise upgrade"
