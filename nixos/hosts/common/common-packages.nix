{ inputs, pkgs, lib, ... }:
{
  # Shared packages across all hosts (NixOS and Darwin)
  # Philosophy: Nix installs → User configures in ~/.config
  # Platform-aware: Use conditionals for platform-specific packages
  environment.systemPackages = with pkgs; [
    ## Terminales
    alacritty
    # ghostty is Linux-only, exclude on Darwin
    kitty
    wezterm       # Terminal multiplataforma con GPU acelerada

    ## Editores
    neovim

    ## CLI tools básicos
    curl
    wget
    tree
    bat           # cat mejorado con syntax highlighting
    ripgrep       # búsqueda rápida (rg)
    eza           # ls moderno con colores e iconos

    ## Navegación y productividad
    zoxide        # cd inteligente
    atuin         # shell history sync
    btop          # monitor de sistema

    ## Gestores de archivos
    yazi          # file manager en terminal

    ## Desarrollo
    direnv        # auto-load environment variables
    nix-direnv    # direnv integration with nix
    gh            # GitHub CLI

    ## Shells
    bash          # Default shell (explicit)
    fish
    nushell

    ## Python
    python312
    pipx
    uv            # ultra-fast python package manager

    ## GUI Applications (cross-platform)
    claude-code
    gemini-cli
  ]
  # Linux-only packages (Chromium, Wayland, Hyprland, Ghostty)
  ++ lib.optionals pkgs.stdenv.hostPlatform.isLinux [
    chromium          # Browser (Linux-only in nixpkgs)
    ghostty           # GPU-accelerated terminal (Linux-only)
    hypridle
    hyprlock
    hyprsunset

    ## Wayland utilities (Linux-only)
    mako              # Notification daemon
    nautilus          # GNOME file manager
    nitch             # System info
    opencode          # VSCode alternative
    pcmanfm           # Lightweight file manager
    rofi              # Application launcher
    swaybg            # Wallpaper utility
    swayosd           # OSD for volume/brightness
    warp-terminal     # Modern terminal
    wl-clip-persist   # Clipboard manager
    wofi              # Wayland rofi alternative
  ];
}
