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

echo "setting up claude config"
cp -r ~/.config/claude ~/.claude

echo "install rust"
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"
echo "install android rust compiler"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
echo "install IOS rust compiler"
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

echo "Installing mise-in-place mise.jdx"
curl https://mise.run | sh

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
  atuin starship sops age \
  neovim kitty tmux gh \
  bat eza jq yq git-delta dust duf \
  procs xh httpie tealdeer \
  hyperfine tokei watchexec \
  curl wget tree btop ncdu just lazygit lazydocker

echo ""

echo "Running bootstrap..."
bash "$HOME/.config/shell/bootstrap.sh"

if ! command -v claude >/dev/null; then
  echo "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash
fi

if ! command -v opencode >/dev/null; then
  echo "Installing Opencode..."
  curl -fsSL https://opencode.ai/install | bash
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
