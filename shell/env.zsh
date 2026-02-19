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

# SOPS secrets (portable)
export SOPS_AGE_KEY_FILE="$HOME/.local/share/sops/age/keys.txt"

if command -v sops >/dev/null 2>&1 && [ -f "$HOME/.config/secrets/gemini_api_key.yaml" ]; then
    export GEMINI_API_KEY="$(sops -d "$HOME/.config/secrets/gemini_api_key.yaml" | yq '.GEMINI_API_KEY' | tr -d '\n')"
    export GOOGLE_GENERATIVE_AI_API_KEY="$GEMINI_API_KEY"
fi
if command -v sops >/dev/null 2>&1 && [ -f "$HOME/.config/secrets/google_api_key.yaml" ]; then
    export GOOGLE_API_KEY="$(sops -d "$HOME/.config/secrets/google_api_key.yaml" | yq '.GOOGLE_API_KEY' | tr -d '\n')"
fi
