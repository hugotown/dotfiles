{ config, inputs, pkgs, lib, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  # ===== Shells y Herramientas CLI =====
  
  programs.fish.enable = true;
  programs.nushell.enable = true;
  
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };
  
  # Navegación inteligente de directorios
  programs.zoxide.enable = true;
  
  # ls moderno con colores e iconos
  programs.eza.enable = true;
  
  # cat mejorado con syntax highlighting
  programs.bat.enable = true;
  
  # Gestor de archivos en terminal
  programs.yazi.enable = true;
  
  # ===== Terminales =====
  programs.alacritty.enable = true;
  programs.wezterm.enable = true;
  programs.neovim.enable = true;
  programs.atuin.enable = true;

  home.packages = with pkgs; [
    claude-code
    python312
    pipx
    uv
  ];

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
    # Asegurar que yazi use nvim
    YAZI_FILE_ONE = "nvim";
  };
  
  home.sessionPath = [
    "$HOME/.local/bin"
  ];

  home.file.".hushlogin".text = "";
}
