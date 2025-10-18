{ inputs, pkgs, stablePkgs, unstablePkgs, ... }:
let
  inherit (inputs) nixpkgs nixpkgs-unstable;
in
{
  nixpkgs.config.allowUnfree = true;

  environment.systemPackages = with pkgs; [
    ## CLI tools estables (base del sistema)
    # Estos vienen de nixos-24.11 (stable) - más confiables
    alacritty
    atuin
    btop
    eza
    fastfetch
    fd
    fzf
    gh
    git
    neovim
    ripgrep
    vim
    zoxide
    
    # Herramientas del sistema (stable)
    curl
    wget
    tree
    htop
    jq
  ] ++ [
    ## Paquetes unstable (cuando necesites versiones más recientes)
    # Usa unstablePkgs.nombrePaquete para obtener la versión más reciente
    unstablePkgs.yt-dlp      # YouTube downloader (siempre la última versión)
    unstablePkgs.get_iplayer # BBC iPlayer downloader
    unstablePkgs.bat         # cat con syntax highlighting (funciona en Linux y Darwin)
    unstablePkgs.ffmpeg      # Última versión con más codecs (cross-platform)
    
    # Ejemplos de cuándo usar unstable:
    # unstablePkgs.nodejs      # Para desarrollo web con última versión
    # unstablePkgs.rust        # Para desarrollo Rust con toolchain reciente
    # unstablePkgs.go          # Para desarrollo Go con última versión
  ];

  # Fonts are managed in darwin-common.nix to avoid duplication
}