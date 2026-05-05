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

echo "install rust"
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"
echo "install android rust compiler"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
echo "install IOS rust compiler"
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

if ! command -v goose >/dev/null; then
    echo "Installing Goose CLI..."
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

echo "Installing mise-in-place mise.jdx"
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
echo "Installing mise tools (runtimes + cargo tools)..."
"$HOME/.local/bin/mise" install -y

# 1. Install Homebrew if missing
if ! command -v brew >/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
# Add Homebrew to PATH for this session (Apple Silicon: /opt/homebrew, Intel: /usr/local)
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null

echo "Installing packages..."
brew install --cask wezterm
brew install --cask ghostty
brew install --cask font-jetbrains-mono-nerd-font

brew install \
  ffmpeg sevenzip poppler fd ripgrep fzf zoxide resvg imagemagick yazi \
  fish nushell cocoapods \
  atuin starship sops age oath-toolkit \
  neovim kitty tmux gh \
  bat eza jq yq git-delta dust duf television \
  procs xh httpie tealdeer \
  hyperfine tokei watchexec \
  curl wget tree btop ncdu just lazygit lazydocker \
  glow mdcat chafa ouch jless mpv ffmpegthumbnailer pandoc \
  duckdb iperf3 rsync \
  kubernetes-cli \
  llvm lld \
  dlvhdr/formulae/diffnav

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

# tdf (terminal PDF viewer) - not in Homebrew, install via cargo
if ! command -v tdf >/dev/null; then
    echo "Installing tdf (terminal PDF viewer)..."
    cargo install --git https://github.com/itsjunetime/tdf
fi

# Google Cloud SDK
if [ ! -d "$HOME/google-cloud-sdk" ]; then
    echo "Installing Google Cloud SDK..."
    curl -s https://sdk.cloud.google.com | bash -s -- --disable-prompts
fi

# gke-gcloud-auth-plugin (via gcloud components — keeps it in sync with curl-installed SDK)
if ! command -v gke-gcloud-auth-plugin >/dev/null; then
    echo "Installing gke-gcloud-auth-plugin..."
    "$HOME/google-cloud-sdk/bin/gcloud" components install gke-gcloud-auth-plugin --quiet
fi

echo ""

echo "Running bootstrap..."
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

if ! command -v claude >/dev/null; then
  echo "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash
fi

if ! command -v opencode >/dev/null; then
  echo "Installing Opencode..."
  curl -fsSL https://opencode.ai/install | bash
fi

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

echo "Setting up macOS-specific configs..."

# Nushell on macOS uses ~/Library/Application Support/nushell/ instead of ~/.config/nushell/
# Create source redirects so it reads the portable config from ~/.config/
NU_MACOS="$HOME/Library/Application Support/nushell"
mkdir -p "$NU_MACOS"
echo 'source ~/.config/nushell/env.nu' > "$NU_MACOS/env.nu"
echo 'source ~/.config/nushell/config.nu' > "$NU_MACOS/config.nu"
echo "nushell: macOS config redirected to ~/.config/nushell/"

touch "$HOME/.hushlogin"

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
