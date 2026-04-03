#!/usr/bin/env bash
set -euo pipefail

echo "=== HR Colors Ubuntu Setup (SSH container) ==="
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
    procps file

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
    nushell ouch diffnav \
    sops duckdb

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

# Playwright system deps (after node is available via mise)
echo "Installing Playwright system deps..."
sudo "$(mise which npx)" playwright install-deps 2>/dev/null || true

# Python packages (after mise so uv is available)
echo "Installing Python packages..."
eval "$(mise activate bash)" 2>/dev/null || true
uv pip install --system -q google-genai Pillow duckdb streamlit plotly 'notebooklm-py[browser]' 2>/dev/null || true
playwright install chromium 2>/dev/null || true

# ──────────────────────────────────────────────
# 4. npm/go global tools
# ──────────────────────────────────────────────
# goose
if ! command -v goose >/dev/null; then
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

# ──────────────────────────────────────────────
# 5. Shell bootstrap (symlinks + cached integrations)
# ──────────────────────────────────────────────
echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# ──────────────────────────────────────────────
# 6. AI coding tools
# ──────────────────────────────────────────────
if ! command -v opencode >/dev/null; then
    echo "Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
fi

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
echo "To update all tools: brew upgrade && mise upgrade"
