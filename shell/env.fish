# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
fish_add_path --prepend --global $HOME/.cargo/bin
fish_add_path --prepend --global $HOME/.npm-global/bin
fish_add_path --prepend --global $HOME/.local/bin

# Nix-specific paths (only if Nix is present)
if test -d /nix
    fish_add_path --prepend --global /nix/var/nix/profiles/default/bin
    fish_add_path --prepend --global $HOME/.nix-profile/bin
    test -d /run/current-system/sw/bin; and fish_add_path --prepend --global /run/current-system/sw/bin
end

set -gx EDITOR nvim
set -gx TERMINAL alacritty

# SOPS secrets (portable: works anywhere sops+age are installed)
set -gx SOPS_AGE_KEY_FILE "$HOME/.local/share/sops/age/keys.txt"

if command -q sops; and test -f "$HOME/.config/secrets/gemini_api_key.yaml"
    set -gx GEMINI_API_KEY (sops -d "$HOME/.config/secrets/gemini_api_key.yaml" | yq '.GEMINI_API_KEY' | string trim)
    set -gx GOOGLE_GENERATIVE_AI_API_KEY $GEMINI_API_KEY
end
if command -q sops; and test -f "$HOME/.config/secrets/google_api_key.yaml"
    set -gx GOOGLE_API_KEY (sops -d "$HOME/.config/secrets/google_api_key.yaml" | yq '.GOOGLE_API_KEY' | string trim)
end
