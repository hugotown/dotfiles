{ inputs, pkgs, ... }:
{
  environment.systemPackages = with pkgs; [
    ## Terminales
    alacritty
    kitty
    wezterm        # Terminal multiplataforma con GPU acelerada
    
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

    ## Shells
    fish
    nushell

    ## Python
    python312
    pipx
    uv            # ultra-fast python package manager
  ];
}
