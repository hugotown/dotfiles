{ config, inputs, pkgs, lib, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };

  # Solo habilita alacritty, NO gestiona su configuración
  programs.alacritty.enable = true;
  
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
    vimdiffAlias = true;
  };
  
  programs.atuin = {
    enable = true;
    enableZshIntegration = true;
  };

  home.packages = with pkgs; [
    claude-code
    python312
    pipx
    uv
  ];

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
  };
  
  home.sessionPath = [
    "$HOME/.local/bin"
  ];

  home.file.".hushlogin".text = "";
}
