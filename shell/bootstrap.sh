#!/usr/bin/env bash
set -euo pipefail

SHELL_DIR="$HOME/.config/shell"
CACHE_DIR="$HOME/.cache/shell"
mkdir -p "$CACHE_DIR"

# Ensure tools are findable regardless of how bootstrap.sh was invoked
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Symlink dotfiles from ~/.config/shell/ to ~/
for rc in bashrc bash_profile zshrc; do
    target="$HOME/.$rc"
    source="$SHELL_DIR/$rc"
    if [ -f "$source" ] && [ ! -L "$target" ]; then
        [ -f "$target" ] && mv "$target" "$target.bak"
        ln -sf "$source" "$target"
        echo "$rc: symlinked"
    fi
done

# Starship (contains absolute paths to binary)
if command -v starship >/dev/null; then
    starship init fish > "$CACHE_DIR/starship.fish"
    starship init nu   > "$CACHE_DIR/starship.nu"
    starship init zsh  > "$CACHE_DIR/starship.zsh"
    starship init bash > "$CACHE_DIR/starship.bash"
    echo "starship: cached"
fi

# Direnv (contains absolute paths to binary)
if command -v direnv >/dev/null; then
    direnv hook fish > "$CACHE_DIR/direnv.fish"
    direnv hook zsh  > "$CACHE_DIR/direnv.zsh"
    direnv hook bash > "$CACHE_DIR/direnv.bash"
    echo "direnv: cached"
fi

# Devenv direnvrc (if devenv is installed)
if command -v devenv >/dev/null; then
    mkdir -p "$HOME/.config/direnv"
    devenv direnvrc > "$HOME/.config/direnv/direnvrc"
    echo "devenv direnvrc: generated"
fi

# Mise - nushell activation (nushell can't eval)
if command -v mise >/dev/null; then
    mise activate nu > "$CACHE_DIR/mise.nu"
    echo "mise: cached (nu)"
fi

# Create empty placeholders so source doesn't fail
touch "$CACHE_DIR/starship.nu" 2>/dev/null || true
touch "$CACHE_DIR/mise.nu" 2>/dev/null || true

echo "Done. Restart your shell."
