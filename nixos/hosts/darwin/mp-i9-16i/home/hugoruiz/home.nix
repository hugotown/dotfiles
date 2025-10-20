{ config, inputs, pkgs, lib, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };

  programs.alacritty.enable = true;
  
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
    vimdiffAlias = true;
  };

  home.packages = with pkgs; [
    claude-code
  ];

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
  };

  home.file.".hushlogin".text = "";
}
