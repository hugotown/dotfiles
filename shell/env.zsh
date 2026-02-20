# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
export PATH="$HOME/.cargo/bin:$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

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
    [ -n "${GEMINI_API_KEY:-}" ] && export GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY"
fi
