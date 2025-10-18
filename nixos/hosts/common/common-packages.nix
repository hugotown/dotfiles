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
    
    # Herramientas multiplataforma (movidas desde darwin-common)
    comma           # Nix package runner
    hcloud          # Hetzner Cloud CLI  
    just            # Command runner
    nodejs          # JavaScript runtime
    pass            # Password manager
    
    ## unstable packages (multiplataforma)
    unstablePkgs.yt-dlp      # YouTube downloader
    unstablePkgs.get_iplayer # BBC iPlayer downloader
    unstablePkgs.colmena     # NixOS deployment
  ];

  # Fonts are managed in darwin-common.nix to avoid duplication
}