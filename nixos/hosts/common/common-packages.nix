{ inputs, pkgs, unstablePkgs, ... }:
let
  inherit (inputs) nixpkgs nixpkgs-unstable;
in
{
  nixpkgs.config.allowUnfree = true;

  environment.systemPackages = with pkgs; [
    ## CLI tools actuales del usuario
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
    
    # Herramientas adicionales útiles
    curl
    wget
    tree
    htop
    jq
    
    ## unstable packages (herramientas de usuario)
    unstablePkgs.yt-dlp      # YouTube downloader
    unstablePkgs.get_iplayer # BBC iPlayer downloader
  ];

  # Fonts are managed in darwin-common.nix to avoid duplication
}