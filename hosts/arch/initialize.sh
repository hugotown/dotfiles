#!/usr/bin/env bash
set -euo pipefail

echo "=== Arch Linux Setup ==="
echo ""

# 1. Install packages (mirrors common-packages.nix)
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

# yq-go (Go version, matches Nix's yq-go)
sudo pacman -S --needed --noconfirm go-yq 2>/dev/null || true

# AUR packages (requires yay or paru)
if command -v yay >/dev/null; then
    yay -S --needed --noconfirm mise
elif command -v paru >/dev/null; then
    paru -S --needed --noconfirm mise
else
    echo "WARNING: yay/paru not found. Install mise manually: https://mise.run"
fi

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
