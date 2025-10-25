{ config, inputs, pkgs, lib, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  # ===== REGLA HÍBRIDA: NIX INSTALA, USUARIO CONFIGURA =====
  # Solo instalamos paquetes, NO configuramos
  # Las configuraciones están en ~/.config/ (dotfiles)
  
  home.packages = with pkgs; [
    # Shells (instalamos, tú configuras en ~/.config/)
    fish
    nushell
    
    # Herramientas CLI
    direnv
    nix-direnv
    zoxide
    eza  
    bat
    yazi
    
    # Terminales
    alacritty
    wezterm
    
    # Editor
    neovim
    
    # Herramientas adicionales
    atuin
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
