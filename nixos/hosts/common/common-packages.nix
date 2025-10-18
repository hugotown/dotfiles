{ inputs, pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;

  environment.systemPackages = with pkgs; [
    ## CLI tools básicos (como en el commit que funcionaba)
    # Paquetes base necesarios para ambas plataformas
    alacritty
    neovim
    git
    curl
    wget
    
    # Herramientas básicas del sistema (stable)
    tree
    
  ] ++ [
    ## Paquetes adicionales pueden agregarse aquí según sea necesario
    # bat         # cat con syntax highlighting
    # yt-dlp      # YouTube downloader
    # ffmpeg      # Procesamiento de medios
    
    # Herramientas de desarrollo:
    # nodejs      # Para desarrollo web
    # rustc       # Para desarrollo Rust
    # go          # Para desarrollo Go
  ];

}