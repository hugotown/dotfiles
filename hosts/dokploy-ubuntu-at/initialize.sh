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
# 1. System packages (apt) — only what mise CAN'T manage
#    Libraries, system tools, and Playwright deps
# ──────────────────────────────────────────────
echo "Installing system packages..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    zsh bash fish \
    neovim tmux \
    bat ripgrep fd-find fzf jq \
    curl wget tree btop ncdu \
    git gh \
    httpie \
    duf git-delta hyperfine \
    gnupg age \
    poppler-utils \
    unzip zip xz-utils \
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
# 3. CLI tools — pinned versions (instant download, no API calls)
#    Updated in background after setup completes
# ──────────────────────────────────────────────
echo "Installing CLI tools (precompiled binaries)..."

dl() { curl -fsSL -o "$1" "$2"; }

# glow
if ! command -v glow >/dev/null; then
    dl /tmp/glow.deb "https://github.com/charmbracelet/glow/releases/download/v2.1.1/glow_2.1.1_amd64.deb"
    sudo dpkg -i /tmp/glow.deb && rm -f /tmp/glow.deb
fi

# starship
if ! command -v starship >/dev/null; then
    dl /tmp/starship.tar.gz "https://github.com/starship/starship/releases/download/v1.23.0/starship-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/starship.tar.gz -C /tmp && sudo install /tmp/starship /usr/local/bin/ && rm -f /tmp/starship /tmp/starship.tar.gz
fi

# zoxide
if ! command -v zoxide >/dev/null; then
    dl /tmp/zoxide.tar.gz "https://github.com/ajeetdsouza/zoxide/releases/download/v0.9.7/zoxide-0.9.7-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/zoxide.tar.gz -C /tmp && sudo install /tmp/zoxide /usr/local/bin/ && rm -f /tmp/zoxide /tmp/zoxide.tar.gz
fi

# atuin
if ! command -v atuin >/dev/null; then
    dl /tmp/atuin.tar.gz "https://github.com/atuinsh/atuin/releases/download/v18.13.3/atuin-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/atuin.tar.gz -C /tmp
    sudo install /tmp/atuin-x86_64-unknown-linux-musl/atuin /usr/local/bin/
    rm -rf /tmp/atuin.tar.gz /tmp/atuin-x86_64-unknown-linux-musl
fi

# lazygit
if ! command -v lazygit >/dev/null; then
    dl /tmp/lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/download/v0.50.0/lazygit_0.50.0_Linux_x86_64.tar.gz"
    tar xzf /tmp/lazygit.tar.gz -C /tmp lazygit && sudo install /tmp/lazygit /usr/local/bin/ && rm -f /tmp/lazygit /tmp/lazygit.tar.gz
fi

# lazydocker
if ! command -v lazydocker >/dev/null; then
    dl /tmp/lazydocker.tar.gz "https://github.com/jesseduffield/lazydocker/releases/download/v0.24.1/lazydocker_0.24.1_Linux_x86_64.tar.gz"
    tar xzf /tmp/lazydocker.tar.gz -C /tmp lazydocker && sudo install /tmp/lazydocker /usr/local/bin/ && rm -f /tmp/lazydocker /tmp/lazydocker.tar.gz
fi

# sops
if ! command -v sops >/dev/null; then
    dl /tmp/sops "https://github.com/getsops/sops/releases/download/v3.10.2/sops-v3.10.2.linux.amd64"
    sudo install /tmp/sops /usr/local/bin/ && rm -f /tmp/sops
fi

# duckdb
if ! command -v duckdb >/dev/null; then
    dl /tmp/duckdb.zip "https://github.com/duckdb/duckdb/releases/download/v1.3.0/duckdb_cli-linux-amd64.zip"
    unzip -o /tmp/duckdb.zip -d /tmp && sudo install /tmp/duckdb /usr/local/bin/ && rm -f /tmp/duckdb /tmp/duckdb.zip
fi

# yazi
if ! command -v yazi >/dev/null; then
    dl /tmp/yazi.zip "https://github.com/sxyazi/yazi/releases/download/v25.5.28/yazi-x86_64-unknown-linux-musl.zip"
    unzip -o /tmp/yazi.zip -d /tmp/yazi-extract
    sudo install /tmp/yazi-extract/yazi-x86_64-unknown-linux-musl/yazi /usr/local/bin/
    sudo install /tmp/yazi-extract/yazi-x86_64-unknown-linux-musl/ya /usr/local/bin/ 2>/dev/null || true
    rm -rf /tmp/yazi.zip /tmp/yazi-extract
fi

# eza
if ! command -v eza >/dev/null; then
    dl /tmp/eza.tar.gz "https://github.com/eza-community/eza/releases/download/v0.21.3/eza_x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/eza.tar.gz -C /tmp && sudo install /tmp/eza /usr/local/bin/ && rm -f /tmp/eza /tmp/eza.tar.gz
fi

# zellij
if ! command -v zellij >/dev/null; then
    dl /tmp/zellij.tar.gz "https://github.com/zellij-org/zellij/releases/download/v0.42.2/zellij-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/zellij.tar.gz -C /tmp && sudo install /tmp/zellij /usr/local/bin/ && rm -f /tmp/zellij /tmp/zellij.tar.gz
fi

# dust
if ! command -v dust >/dev/null; then
    dl /tmp/dust.tar.gz "https://github.com/bootandy/dust/releases/download/v1.2.1/dust-v1.2.1-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/dust.tar.gz -C /tmp
    find /tmp -name dust -type f -executable -exec sudo install {} /usr/local/bin/ \;
    rm -rf /tmp/dust.tar.gz /tmp/dust-*
fi

# procs
if ! command -v procs >/dev/null; then
    dl /tmp/procs.zip "https://github.com/dalance/procs/releases/download/v0.14.9/procs-v0.14.9-x86_64-linux.zip"
    unzip -o /tmp/procs.zip -d /tmp && sudo install /tmp/procs /usr/local/bin/ && rm -f /tmp/procs.zip /tmp/procs
fi

# xh
if ! command -v xh >/dev/null; then
    dl /tmp/xh.tar.gz "https://github.com/ducaale/xh/releases/download/v0.24.1/xh-v0.24.1-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/xh.tar.gz -C /tmp
    find /tmp -name xh -type f -executable -exec sudo install {} /usr/local/bin/ \;
    rm -rf /tmp/xh.tar.gz /tmp/xh-*
fi

# tokei
if ! command -v tokei >/dev/null; then
    dl /tmp/tokei.tar.gz "https://github.com/XAMPPRocky/tokei/releases/download/v13.0.0-alpha.0/tokei-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/tokei.tar.gz -C /tmp && sudo install /tmp/tokei /usr/local/bin/ && rm -f /tmp/tokei /tmp/tokei.tar.gz
fi

# watchexec
if ! command -v watchexec >/dev/null; then
    dl /tmp/watchexec.tar.xz "https://github.com/watchexec/watchexec/releases/download/v2.3.2/watchexec-2.3.2-x86_64-unknown-linux-musl.tar.xz"
    tar xJf /tmp/watchexec.tar.xz -C /tmp
    find /tmp -name watchexec -type f -executable -exec sudo install {} /usr/local/bin/ \;
    rm -rf /tmp/watchexec.tar.xz /tmp/watchexec-*
fi

# just
if ! command -v just >/dev/null; then
    dl /tmp/just.tar.gz "https://github.com/casey/just/releases/download/1.44.0/just-1.44.0-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/just.tar.gz -C /tmp just && sudo install /tmp/just /usr/local/bin/ && rm -f /tmp/just /tmp/just.tar.gz
fi

# tealdeer (tldr)
if ! command -v tldr >/dev/null; then
    dl /tmp/tldr "https://github.com/tealdeer-rs/tealdeer/releases/download/v1.7.1/tealdeer-linux-x86_64-musl"
    sudo install /tmp/tldr /usr/local/bin/ && rm -f /tmp/tldr
fi

# nushell
if ! command -v nu >/dev/null; then
    dl /tmp/nu.tar.gz "https://github.com/nushell/nushell/releases/download/0.105.1/nu-0.105.1-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/nu.tar.gz -C /tmp
    find /tmp -name nu -type f -executable -exec sudo install {} /usr/local/bin/ \;
    rm -rf /tmp/nu.tar.gz /tmp/nu-*
fi

# ouch
if ! command -v ouch >/dev/null; then
    dl /tmp/ouch.tar.gz "https://github.com/ouch-org/ouch/releases/download/0.5.1/ouch-x86_64-unknown-linux-musl.tar.gz"
    tar xzf /tmp/ouch.tar.gz -C /tmp
    find /tmp -name ouch -type f -executable -exec sudo install {} /usr/local/bin/ \;
    rm -rf /tmp/ouch.tar.gz /tmp/ouch-*
fi

# diffnav
if ! command -v diffnav >/dev/null; then
    dl /tmp/diffnav.tar.gz "https://github.com/dlvhdr/diffnav/releases/download/v0.10.0/diffnav_Linux_x86_64.tar.gz"
    tar xzf /tmp/diffnav.tar.gz -C /tmp diffnav && sudo install /tmp/diffnav /usr/local/bin/ && rm -f /tmp/diffnav /tmp/diffnav.tar.gz
fi

# ──────────────────────────────────────────────
# 4. npm/go global tools
# ──────────────────────────────────────────────
npm install -g @google/gemini-cli 2>/dev/null || true
gh extension install dlvhdr/gh-dash 2>/dev/null || true

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
echo "=== Setup complete. Updating all tools to latest versions in background... ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
echo "(Background update log: /tmp/tool-update.log)"

# ──────────────────────────────────────────────
# 7. Background update — upgrade everything to latest versions
#    Runs after setup so the shell is usable immediately
# ──────────────────────────────────────────────
(
    exec > /tmp/tool-update.log 2>&1
    echo "=== Background update started at $(date) ==="

    # Helper: download latest release binary from GitHub
    gh_latest() {
        local repo="$1" pattern="$2"
        curl -fsSL "https://api.github.com/repos/${repo}/releases/latest" \
            | grep -Po "\"browser_download_url\": *\"[^\"]*${pattern}[^\"]*\"" \
            | head -1 | grep -Po 'https://[^"]+'
    }

    gh_update() {
        local cmd="$1" repo="$2" pattern="$3"
        echo "Updating $cmd..."
        local url
        url=$(gh_latest "$repo" "$pattern")
        [ -z "$url" ] && { echo "  SKIP: no release found for $cmd"; return 0; }
        local file="/tmp/${cmd}-update"
        curl -fsSL -o "$file" "$url"
        case "$url" in
            *.deb)
                sudo dpkg -i "$file" ;;
            *.tar.gz|*.tgz)
                tar xzf "$file" -C /tmp
                find /tmp -maxdepth 2 -name "$cmd" -type f -executable -exec sudo install {} /usr/local/bin/ \; ;;
            *.tar.xz)
                tar xJf "$file" -C /tmp
                find /tmp -maxdepth 2 -name "$cmd" -type f -executable -exec sudo install {} /usr/local/bin/ \; ;;
            *.zip)
                unzip -o "$file" -d /tmp/"${cmd}-upd"
                find /tmp/"${cmd}-upd" -name "$cmd" -type f -executable -exec sudo install {} /usr/local/bin/ \; ;;
            *)
                sudo install "$file" /usr/local/bin/"$cmd" ;;
        esac
        rm -rf "$file" /tmp/"${cmd}-upd" 2>/dev/null
        echo "  OK: $cmd updated"
    }

    # apt packages
    sudo apt-get update -qq && sudo apt-get upgrade -y -qq

    # mise tools (runtimes)
    mise upgrade -y 2>/dev/null || true

    # CLI tools from GitHub
    gh_update glow        charmbracelet/glow       "amd64\\.deb"
    gh_update starship    starship/starship        "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update zoxide      ajeetdsouza/zoxide       "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update lazygit     jesseduffield/lazygit    "Linux_x86_64\\.tar\\.gz"
    gh_update lazydocker  jesseduffield/lazydocker "Linux_x86_64\\.tar\\.gz"
    gh_update sops        getsops/sops             "linux\\.amd64$"
    gh_update duckdb      duckdb/duckdb            "cli-linux-amd64\\.zip"
    gh_update eza         eza-community/eza        "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update zellij      zellij-org/zellij        "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update dust        bootandy/dust            "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update procs       dalance/procs            "x86_64-linux\\.zip"
    gh_update xh          ducaale/xh               "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update watchexec   watchexec/watchexec      "x86_64-unknown-linux-musl\\.tar\\.xz"
    gh_update just        casey/just               "x86_64-unknown-linux-musl\\.tar\\.gz"
    gh_update diffnav     dlvhdr/diffnav           "Linux_x86_64\\.tar\\.gz"
    gh_update ouch        ouch-org/ouch            "x86_64-unknown-linux-musl\\.tar\\.gz"

    # yazi (special: zip with subdirectory)
    echo "Updating yazi..."
    YAZI_URL=$(gh_latest sxyazi/yazi "x86_64-unknown-linux-musl\\.zip")
    if [ -n "$YAZI_URL" ]; then
        curl -fsSL -o /tmp/yazi-upd.zip "$YAZI_URL"
        unzip -o /tmp/yazi-upd.zip -d /tmp/yazi-upd
        find /tmp/yazi-upd -name yazi -type f -executable -exec sudo install {} /usr/local/bin/ \;
        find /tmp/yazi-upd -name ya -type f -executable -exec sudo install {} /usr/local/bin/ \;
        rm -rf /tmp/yazi-upd.zip /tmp/yazi-upd
        echo "  OK: yazi updated"
    fi

    # atuin (special: tar with subdirectory)
    echo "Updating atuin..."
    ATUIN_URL=$(gh_latest atuinsh/atuin "x86_64-unknown-linux-musl\\.tar\\.gz")
    if [ -n "$ATUIN_URL" ]; then
        curl -fsSL -o /tmp/atuin-upd.tar.gz "$ATUIN_URL"
        tar xzf /tmp/atuin-upd.tar.gz -C /tmp
        find /tmp -maxdepth 2 -name atuin -type f -executable -exec sudo install {} /usr/local/bin/ \;
        rm -rf /tmp/atuin-upd.tar.gz /tmp/atuin-*
        echo "  OK: atuin updated"
    fi

    # tokei
    echo "Updating tokei..."
    TOKEI_URL=$(gh_latest XAMPPRocky/tokei "x86_64-unknown-linux-musl\\.tar\\.gz")
    if [ -n "$TOKEI_URL" ]; then
        curl -fsSL -o /tmp/tokei-upd.tar.gz "$TOKEI_URL"
        tar xzf /tmp/tokei-upd.tar.gz -C /tmp
        sudo install /tmp/tokei /usr/local/bin/ 2>/dev/null || true
        rm -rf /tmp/tokei-upd.tar.gz /tmp/tokei
        echo "  OK: tokei updated"
    fi

    # nushell
    echo "Updating nu..."
    NU_URL=$(gh_latest nushell/nushell "x86_64-unknown-linux-musl\\.tar\\.gz")
    if [ -n "$NU_URL" ]; then
        curl -fsSL -o /tmp/nu-upd.tar.gz "$NU_URL"
        tar xzf /tmp/nu-upd.tar.gz -C /tmp
        find /tmp -maxdepth 2 -name nu -type f -executable -exec sudo install {} /usr/local/bin/ \;
        rm -rf /tmp/nu-upd.tar.gz /tmp/nu-*
        echo "  OK: nu updated"
    fi

    # tealdeer (single binary, no extension)
    echo "Updating tldr..."
    TLDR_URL=$(gh_latest tealdeer-rs/tealdeer "x86_64-unknown-linux-musl$")
    if [ -n "$TLDR_URL" ]; then
        curl -fsSL -o /tmp/tldr-upd "$TLDR_URL"
        sudo install /tmp/tldr-upd /usr/local/bin/tldr
        rm -f /tmp/tldr-upd
        echo "  OK: tldr updated"
    fi

    # npm global packages
    npm update -g 2>/dev/null || true

    # goose
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash 2>/dev/null || true

    # opencode
    curl -fsSL https://opencode.ai/install | bash 2>/dev/null || true

    echo "=== Background update finished at $(date) ==="
) &
