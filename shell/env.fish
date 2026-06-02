# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
set -gx PNPM_HOME "$HOME/.local/share/pnpm"
fish_add_path --prepend --global $PNPM_HOME
fish_add_path --prepend --global $HOME/.cargo/bin
fish_add_path --prepend --global $HOME/.npm-global/bin
fish_add_path --prepend --global $HOME/.local/bin

# Nix-specific paths (only if Nix is present)
if test -d /nix
    fish_add_path --prepend --global /nix/var/nix/profiles/default/bin
    fish_add_path --prepend --global $HOME/.nix-profile/bin
    test -d /run/current-system/sw/bin; and fish_add_path --prepend --global /run/current-system/sw/bin
end

# Homebrew (macOS)
test -x /opt/homebrew/bin/brew; and eval (/opt/homebrew/bin/brew shellenv)
# Homebrew (Linux)
test -d /home/linuxbrew/.linuxbrew; and eval (/home/linuxbrew/.linuxbrew/bin/brew shellenv)

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
end

# Host-specific overrides (not tracked in git)
test -f ~/.config/shell/env.local.fish; and source ~/.config/shell/env.local.fish

# Analyzer wrappers - Trigger Phase 2 normalizer when agent exits
function pi
    command pi $argv
    set -l analyzer_dir (set -q XDG_CONFIG_HOME; and echo "$XDG_CONFIG_HOME/agent-session-analyzer"; or echo "$HOME/.config/agent-session-analyzer")
    fish -c "cd $analyzer_dir && python3 -m normalizer pi --all &>/dev/null &" &>/dev/null &
end

function opencode
    command opencode $argv
    set -l analyzer_dir (set -q XDG_CONFIG_HOME; and echo "$XDG_CONFIG_HOME/agent-session-analyzer"; or echo "$HOME/.config/agent-session-analyzer")
    fish -c "cd $analyzer_dir && python3 -m normalizer opencode --all &>/dev/null &" &>/dev/null &
end

