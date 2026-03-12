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

echo "setting up claude config"
cp -r ~/.config/claude ~/.claude

# 1. Install packages
echo "Installing packages..."
sudo pacman -S --needed --noconfirm \
    fish nushell zsh bash \
    zoxide atuin starship yazi \
    sops age gnupg \
    neovim alacritty kitty wezterm tmux \
    bat ripgrep eza fd fzf jq \
    curl wget tree btop ncdu just lazygit \
    git github-cli \
    procs xh httpie tealdeer \
    hyperfine tokei watchexec \
    dust duf git-delta \
    lazydocker pnpm nodejs \
    glow chafa ouch jless mpv ffmpegthumbnailer poppler \
    ffmpeg imagemagick p7zip duckdb resvg iperf3 rust go

sudo pacman -S --needed --noconfirm go-yq 2>/dev/null || true

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

# gemini-cli + worktrunk (npm/cargo)
npm install -g @google/gemini-cli 2>/dev/null || true
cargo install worktrunk 2>/dev/null || true

# gh extensions
gh extension install dlvhdr/gh-dash 2>/dev/null || true

if ! command -v goose >/dev/null; then
    echo "Installing Goose CLI..."
    curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
fi

echo "Installing mise..."
curl https://mise.run | sh

echo ""

# 2. Run portable bootstrap (symlinks + cached integrations)
echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# 3. Install Claude Code (if not already installed)
if ! command -v claude >/dev/null; then
    echo "Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
fi

# 4. Install Opencode (if not already installed)
if ! command -v opencode >/dev/null; then
    echo "Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
fi

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
