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

# SOPS secrets — load all files in ~/.config/secrets/ dynamically
set -gx SOPS_AGE_KEY_FILE "$HOME/.local/share/sops/age/keys.txt"

if command -q sops; and command -q yq; and test -f "$HOME/.local/share/sops/age/keys.txt"
    for secret_file in $HOME/.config/secrets/*.yaml
        test -f $secret_file; or continue
        for pair in (sops -d $secret_file 2>/dev/null | yq 'to_entries[] | .key + "=" + .value' 2>/dev/null)
            set -l kv (string split -m 1 '=' $pair)
            test (count $kv) -eq 2; and set -gx $kv[1] $kv[2]
        end
    end
    set -q GEMINI_API_KEY; and set -gx GOOGLE_GENERATIVE_AI_API_KEY $GEMINI_API_KEY
end
