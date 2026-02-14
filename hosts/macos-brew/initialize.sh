#!/usr/bin/env bash
set -euo pipefail

echo "=== macOS (Homebrew) Setup ==="
echo ""

# 1. Install Homebrew if missing
if ! command -v brew >/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Install packages (mirrors common-packages.nix)
echo "Installing packages..."
brew install \
    fish nushell zsh \
    zoxide atuin starship direnv yazi \
    sops age gnupg \
    neovim alacritty kitty tmux wezterm \
    bat ripgrep eza fzf jq yq git-delta dust duf \
    procs xh httpie tealdeer \
    hyperfine tokei watchexec \
    curl wget tree btop ncdu just lazygit lazydocker \
    git mise pnpm node

echo ""

# 3. Run portable bootstrap (symlinks + cached integrations)
echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

# 4. Install Claude Code (if not already installed)
if ! command -v claude >/dev/null; then
    echo "Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
fi

# 5. Install Opencode (if not already installed)
if ! command -v opencode >/dev/null; then
    echo "Installing Opencode..."
    curl -fsSL https://opencode.ai/install | bash
fi

# 6. Install macOS cask apps
echo "Installing macOS apps..."
brew install --cask --no-quarantine \
    hammerspoon \
    karabiner-elements

# 7. macOS-specific setup
echo "Setting up macOS-specific configs..."

# .hushlogin (suppress login banner)
touch "$HOME/.hushlogin"

# Hammerspoon symlink (~/.hammerspoon -> ~/.config/hammerspoon)
HAMMERSPOON_DIR="$HOME/.hammerspoon"
CONFIG_DIR="$HOME/.config/hammerspoon"
if [ -d "$CONFIG_DIR" ]; then
    if [ -d "$HAMMERSPOON_DIR" ] && [ ! -L "$HAMMERSPOON_DIR" ]; then
        mv "$HAMMERSPOON_DIR" "$HAMMERSPOON_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    if [ -L "$HAMMERSPOON_DIR" ] && [ "$(readlink "$HAMMERSPOON_DIR")" != "$CONFIG_DIR" ]; then
        rm "$HAMMERSPOON_DIR"
    fi
    if [ ! -e "$HAMMERSPOON_DIR" ]; then
        ln -sf "$CONFIG_DIR" "$HAMMERSPOON_DIR"
        echo "Hammerspoon symlink created"
    fi
fi

# Karabiner-Elements config directory
mkdir -p "$HOME/.config/karabiner/assets/complex_modifications"

echo ""
echo "=== Done ==="
echo "Open a new terminal. Fish/Nushell/Zsh/Bash are ready."
