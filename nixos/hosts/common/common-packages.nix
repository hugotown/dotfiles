{ inputs, pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;

  environment.systemPackages = with pkgs; [
    ## CLI tools básicos estables (como en el commit que funcionaba)
    # Estos vienen de nixos-24.11 (stable) - más confiables
    alacritty
    neovim
    git
    curl
    wget
    
    # Herramientas básicas del sistema (stable)
    tree
    
  ] ++ [
    ## Ejemplos de paquetes unstable (comentados para ir agregando gradualmente)
    # unstablePkgs.bat         # cat con syntax highlighting
    # unstablePkgs.yt-dlp      # YouTube downloader
    # unstablePkgs.ffmpeg      # Última versión con más codecs
    
    # Para ir agregando uno por uno:
    # unstablePkgs.nodejs      # Para desarrollo web con última versión
    # unstablePkgs.rust        # Para desarrollo Rust con toolchain reciente
    # unstablePkgs.go          # Para desarrollo Go con última versión
  ];

}