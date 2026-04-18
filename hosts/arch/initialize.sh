#!/usr/bin/env bash
set -euo pipefail

echo "=== Arch Linux Setup ==="
echo ""

# --- Constraints ---
[ "$(uname -s)" = "Linux" ]            || { echo "Error: must run on Linux" >&2; exit 1; }
[ "$EUID" -ne 0 ]                      || { echo "Error: do not run as root" >&2; exit 1; }
command -v sudo >/dev/null 2>&1        || { echo "Error: sudo not found" >&2; exit 1; }
[ -f "$HOME/.config/shell/bootstrap.sh" ] || { echo "Error: dotfiles not cloned — run: git clone https://github.com/hugotown/dotfiles.git ~/.config" >&2; exit 1; }
[ -f "$HOME/.local/share/sops/age/keys.txt" ] || { echo "Error: age key not found at ~/.local/share/sops/age/keys.txt" >&2; exit 1; }

# 1. Install packages
echo "Installing packages..."
sudo pacman -S --needed --noconfirm \
    fish nushell zsh bash \
    zoxide atuin starship yazi \
    sops age gnupg oath-toolkit \
    neovim alacritty kitty wezterm tmux zellij \
    bat ripgrep eza fd fzf jq \
    curl wget tree btop ncdu just lazygit \
    git github-cli \
    procs xh httpie tealdeer \
    hyperfine tokei watchexec \
    dust duf git-delta \
    lazydocker pnpm nodejs \
    glow chafa ouch jless mpv ffmpegthumbnailer poppler \
    ffmpeg imagemagick p7zip duckdb resvg iperf3 go rustup \
    gtk3 gtk4 gstreamer gst-plugins-base-libs gst-plugins-bad-libs \
    graphene flite harfbuzz-icu libmanette enchant hyphen woff2 \
    xorg-server-xvfb webkit2gtk-4.1 libxml2-legacy \
    kubectl rsync

sudo pacman -S --needed --noconfirm go-yq 2>/dev/null || true

# Initialize rust toolchain
rustup default stable

# AUR packages (require yay/paru)
if command -v yay >/dev/null 2>&1; then
    echo "Installing AUR packages via yay..."
    yay -S --needed --noconfirm mdcat tdf pandoc-bin
elif command -v paru >/dev/null 2>&1; then
    echo "Installing AUR packages via paru..."
    paru -S --needed --noconfirm mdcat tdf pandoc-bin
else
    echo "Warning: yay/paru not found — skipping AUR packages (mdcat, tdf, pandoc-bin)"
    echo "Install manually: yay -S mdcat tdf pandoc-bin"
fi

# diffnav (go install)
if ! command -v diffnav >/dev/null; then
    echo "Installing diffnav..."
    cd /tmp && git clone https://github.com/dlvhdr/diffnav.git && cd diffnav && go install . && cd /tmp && rm -rf diffnav
fi

# worktrunk (cargo)
cargo install worktrunk 2>/dev/null || true

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

if ! command -v goose >/dev/null; then
    echo "Installing Goose CLI..."
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

# Google Cloud SDK
if [ ! -d "$HOME/google-cloud-sdk" ]; then
    echo "Installing Google Cloud SDK..."
    curl -s https://sdk.cloud.google.com | bash -s -- --disable-prompts
fi

# gke-gcloud-auth-plugin (via gcloud components — not in Arch official repos)
if ! command -v gke-gcloud-auth-plugin >/dev/null; then
    echo "Installing gke-gcloud-auth-plugin..."
    "$HOME/google-cloud-sdk/bin/gcloud" components install gke-gcloud-auth-plugin --quiet
fi

echo "Installing mise..."
curl https://mise.run | sh

echo ""

# 2. Run portable bootstrap (symlinks + cached integrations)
echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# 3. Install Opencode (if not already installed)
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

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
