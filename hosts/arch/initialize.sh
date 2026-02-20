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
    zoxide atuin starship direnv yazi \
    sops age gnupg \
    neovim alacritty kitty tmux \
    bat ripgrep eza fzf jq \
    curl wget tree btop ncdu just lazygit \
    git wezterm \
    procs xh httpie tealdeer \
    hyperfine tokei watchexec \
    dust duf delta \
    lazydocker pnpm nodejs

sudo pacman -S --needed --noconfirm go-yq 2>/dev/null || true

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
