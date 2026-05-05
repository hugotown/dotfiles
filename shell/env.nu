# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
$env.PNPM_HOME = $"($env.HOME)/.local/share/pnpm"
$env.PATH = (
    $env.PATH
    | split row (char esep)
    | prepend $"($env.HOME)/.local/bin"
    | prepend $"($env.HOME)/.npm-global/bin"
    | prepend $"($env.HOME)/.cargo/bin"
    | prepend $"($env.HOME)/google-cloud-sdk/bin"
    | prepend $env.PNPM_HOME
    | uniq
)

# Nix-specific paths (only if Nix is present)
if ("/nix" | path exists) {
    $env.PATH = (
        $env.PATH
        | split row (char esep)
        | prepend /nix/var/nix/profiles/default/bin
        | prepend $"($env.HOME)/.nix-profile/bin"
        | uniq
    )
    if ("/run/current-system/sw/bin" | path exists) {
        $env.PATH = ($env.PATH | split row (char esep) | prepend /run/current-system/sw/bin | uniq)
    }
}

# Homebrew (macOS)
if ("/opt/homebrew/bin/brew" | path exists) {
    $env.PATH = ($env.PATH | split row (char esep) | prepend "/opt/homebrew/sbin" | prepend "/opt/homebrew/bin" | uniq)
    $env.HOMEBREW_PREFIX = "/opt/homebrew"
    $env.HOMEBREW_CELLAR = "/opt/homebrew/Cellar"
    $env.HOMEBREW_REPOSITORY = "/opt/homebrew"
}
# Homebrew (Linux)
if ("/home/linuxbrew/.linuxbrew/bin/brew" | path exists) {
    $env.PATH = ($env.PATH | split row (char esep) | prepend "/home/linuxbrew/.linuxbrew/sbin" | prepend "/home/linuxbrew/.linuxbrew/bin" | uniq)
    $env.HOMEBREW_PREFIX = "/home/linuxbrew/.linuxbrew"
    $env.HOMEBREW_CELLAR = "/home/linuxbrew/.linuxbrew/Cellar"
    $env.HOMEBREW_REPOSITORY = "/home/linuxbrew/.linuxbrew/Homebrew"
}

$env.EDITOR = "nvim"
$env.TERMINAL = "alacritty"

# SOPS secrets — load all files in ~/.config/secrets/ dynamically
$env.SOPS_AGE_KEY_FILE = $"($env.HOME)/.local/share/sops/age/keys.txt"

if (which sops | is-not-empty) and ($"($env.HOME)/.local/share/sops/age/keys.txt" | path exists) {
    for file in (glob $"($env.HOME)/.config/secrets/*.yaml") {
        try { sops -d $file | from yaml | load-env }
    }
}

# Host-specific overrides (not tracked in git)
const env_local_path = $"($nu.home-dir)/.config/shell/env.local.nu"
if ($env_local_path | path exists) { source $env_local_path }
