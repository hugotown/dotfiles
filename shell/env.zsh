# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$HOME/.cargo/bin:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.opencode/bin:$PATH"

# Homebrew (macOS)
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
# Homebrew (Linux)
[ -d /home/linuxbrew/.linuxbrew ] && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# Nix-specific paths (only if Nix is present)
if [ -d /nix ]; then
    export PATH="/nix/var/nix/profiles/default/bin:$HOME/.nix-profile/bin:$PATH"
    [ -d /run/current-system/sw/bin ] && export PATH="/run/current-system/sw/bin:$PATH"
fi

export EDITOR=nvim
export TERMINAL=alacritty

# SOPS secrets — load all files in ~/.config/secrets/ dynamically
export SOPS_AGE_KEY_FILE="$HOME/.local/share/sops/age/keys.txt"

if command -v sops >/dev/null 2>&1 && [ -f "$HOME/.local/share/sops/age/keys.txt" ]; then
    for _f in "$HOME/.config/secrets"/*.yaml; do
        [ -f "$_f" ] || continue
        while IFS= read -r _line; do
            case "$_line" in
                [A-Z]*:\ *)
                    _key="${_line%%: *}"
                    _val="${_line#*: }"
                    export "${_key}=${_val}"
                    ;;
            esac
        done < <(sops -d "$_f" 2>/dev/null)
    done
    unset _f _line _key _val
fi

# Host-specific overrides (not tracked in git)
[ -f "$HOME/.config/shell/env.local.zsh" ] && source "$HOME/.config/shell/env.local.zsh"
