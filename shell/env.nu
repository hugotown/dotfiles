# Portable environment - works on Nix, NixOS, and Arch Linux

# Platform-agnostic paths
$env.PATH = (
    $env.PATH
    | split row (char esep)
    | prepend $"($env.HOME)/.local/bin"
    | prepend $"($env.HOME)/.npm-global/bin"
    | prepend $"($env.HOME)/.cargo/bin"
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

$env.EDITOR = "nvim"
$env.TERMINAL = "alacritty"

# SOPS secrets — load all files in ~/.config/secrets/ dynamically
$env.SOPS_AGE_KEY_FILE = $"($env.HOME)/.local/share/sops/age/keys.txt"

if (which sops | is-not-empty) and ($"($env.HOME)/.local/share/sops/age/keys.txt" | path exists) {
    for file in (glob $"($env.HOME)/.config/secrets/*.yaml") {
        try { sops -d $file | from yaml | load-env }
    }
    if "GEMINI_API_KEY" in $env { $env.GOOGLE_GENERATIVE_AI_API_KEY = $env.GEMINI_API_KEY }
}
