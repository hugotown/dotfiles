#!/usr/bin/env bash
set -euo pipefail

echo "=== Dokploy Ubuntu Setup (SSH container) ==="
echo ""

# --- Constraints ---
[ "$(uname -s)" = "Linux" ]            || { echo "Error: must run on Linux" >&2; exit 1; }
[ "$(id -u)" -ne 0 ]                   || { echo "Error: do not run as root" >&2; exit 1; }
command -v sudo >/dev/null 2>&1        || { echo "Error: sudo not found" >&2; exit 1; }
[ -f "$HOME/.config/shell/bootstrap.sh" ] || { echo "Error: dotfiles not cloned — run: git clone https://github.com/hugotown/dotfiles.git ~/.config" >&2; exit 1; }

echo "Setting up claude config"
cp -r ~/.config/claude ~/.claude || true

# ──────────────────────────────────────────────
# 1. System packages (apt) — only what mise CAN'T manage
#    Libraries, system tools, and Playwright deps
# ──────────────────────────────────────────────
echo "Installing system packages..."
sudo apt-get update
sudo apt-get install -y \
    zsh bash fish \
    neovim tmux \
    bat ripgrep fd-find fzf jq \
    curl wget tree btop ncdu \
    git gh \
    httpie \
    duf git-delta hyperfine \
    gnupg age \
    poppler-utils \
    unzip zip \
    build-essential pkg-config libssl-dev cmake \
    zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
    libncursesw5-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
    libgtk-3-dev libgtk-4-dev \
    libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev \
    libenchant-2-dev libsecret-1-dev \
    libwebkit2gtk-4.1-dev \
    libevent-2.1-7t64 libflite1 libavif16 \
    xvfb

# Fix fd/bat binary names (Ubuntu renames them)
[ ! -f /usr/bin/fd ] && sudo ln -sf "$(which fdfind)" /usr/bin/fd 2>/dev/null || true
[ ! -f /usr/bin/bat ] && sudo ln -sf "$(which batcat)" /usr/bin/bat 2>/dev/null || true

# ──────────────────────────────────────────────
# 2. Mise — manages all runtimes and most CLI tools
#    Config lives in ~/.config/mise/config.toml
#    (node, python, go, rust, bun, pnpm, uv, pipx)
# ──────────────────────────────────────────────
echo "Installing mise..."
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"

echo "Installing mise tools (runtimes + postinstall hooks)..."
mise install -y

# Python packages (after mise so uv is available)
echo "Installing Python packages..."
eval "$(mise activate bash)" 2>/dev/null || true
uv pip install -q google-genai Pillow duckdb streamlit plotly 2>/dev/null || true

# ──────────────────────────────────────────────
# 3. CLI tools not in apt or mise — binary releases
# ──────────────────────────────────────────────
echo "Installing CLI tools..."

# glow (not in Ubuntu repos)
if ! command -v glow >/dev/null; then
    GLOW_VERSION=$(curl -s "https://api.github.com/repos/charmbracelet/glow/releases/latest" | grep -Po '"tag_name": "v\K[^"]*')
    curl -Lo /tmp/glow.deb "https://github.com/charmbracelet/glow/releases/download/v${GLOW_VERSION}/glow_${GLOW_VERSION}_amd64.deb"
    sudo dpkg -i /tmp/glow.deb
    rm -f /tmp/glow.deb
fi

# starship prompt
if ! command -v starship >/dev/null; then
    curl -sS https://starship.rs/install.sh | sudo sh -s -- -y -b /usr/local/bin
fi

# zoxide
if ! command -v zoxide >/dev/null; then
    curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh
fi

# atuin (shell history)
if ! command -v atuin >/dev/null; then
    curl -sSf https://setup.atuin.sh | bash
fi

# lazygit
if ! command -v lazygit >/dev/null; then
    LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*')
    curl -Lo /tmp/lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz"
    tar xf /tmp/lazygit.tar.gz -C /tmp lazygit
    sudo install /tmp/lazygit /usr/local/bin/lazygit
    rm -f /tmp/lazygit /tmp/lazygit.tar.gz
fi

# lazydocker
if ! command -v lazydocker >/dev/null; then
    curl -sSfL https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash
fi

# sops
if ! command -v sops >/dev/null; then
    SOPS_VERSION=$(curl -s "https://api.github.com/repos/getsops/sops/releases/latest" | grep -Po '"tag_name": "v\K[^"]*')
    curl -Lo /tmp/sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
    sudo install /tmp/sops /usr/local/bin/sops
    rm -f /tmp/sops
fi

# duckdb
if ! command -v duckdb >/dev/null; then
    curl -Lo /tmp/duckdb.zip "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip"
    unzip -o /tmp/duckdb.zip -d /tmp
    sudo install /tmp/duckdb /usr/local/bin/duckdb
    rm -f /tmp/duckdb /tmp/duckdb.zip
fi

# diffnav
if ! command -v diffnav >/dev/null; then
    cd /tmp && git clone https://github.com/dlvhdr/diffnav.git && cd diffnav && go install . && cd /tmp && rm -rf diffnav
fi

# ──────────────────────────────────────────────
# 4. Cargo tools — use mise-managed rust
# ──────────────────────────────────────────────
echo "Installing cargo tools..."
eval "$(mise activate bash)" 2>/dev/null || true

cargo_install_if_missing() {
    local cmd="$1"; shift
    command -v "$cmd" >/dev/null || cargo install "$@" 2>/dev/null || true
}

cargo_install_if_missing yazi    --locked yazi-fm yazi-cli
cargo_install_if_missing eza     eza
cargo_install_if_missing zellij  --locked zellij
cargo_install_if_missing dust    du-dust
cargo_install_if_missing procs   procs
cargo_install_if_missing xh      xh
cargo_install_if_missing tokei   tokei
cargo_install_if_missing watchexec watchexec-cli
cargo_install_if_missing just    just
cargo_install_if_missing tldr    tealdeer
cargo_install_if_missing nu      nu
cargo_install_if_missing ouch    ouch
cargo_install_if_missing worktrunk worktrunk

# ──────────────────────────────────────────────
# 5. npm/go global tools
# ──────────────────────────────────────────────
npm install -g @google/gemini-cli 2>/dev/null || true
gh extension install dlvhdr/gh-dash 2>/dev/null || true

# goose
if ! command -v goose >/dev/null; then
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
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

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
