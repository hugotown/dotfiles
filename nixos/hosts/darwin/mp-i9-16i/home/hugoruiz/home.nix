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
  
  # Configurar XDG_CONFIG_HOME a nivel de sistema en macOS
  # Esto usa launchd para que esté disponible antes de que cualquier shell inicie
  launchd.agents.xdg-config = {
    enable = true;
    config = {
      ProgramArguments = [
        "/bin/sh"
        "-c"
        "/bin/launchctl setenv XDG_CONFIG_HOME $HOME/.config"
      ];
      RunAtLoad = true;
    };
  };
  
  home.sessionPath = [
    "$HOME/.local/bin"
  ];

  home.file.".hushlogin".text = "";

  # ===== AGREGAR ZOXIDE AL PATH DE ACTIVACIÓN =====
  # Esto hace que zoxide esté disponible durante los scripts de activación
  home.extraActivationPath = with pkgs; [
    zoxide
  ];

  # ===== POST-ACTIVATION HOOK =====
  # Regenerar zoxide después de que Home Manager active los paquetes
  # Y agregar source a configs si no existe (respetando dotfiles del usuario)
  home.activation.regenerateZoxide = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Regenerando configuraciones de zoxide..."
    
    # Verificar que zoxide esté disponible
    if command -v zoxide >/dev/null 2>&1; then
      # SIEMPRE regenerar archivos (para asegurar que existan y estén actualizados)
      echo "  📝 Generando archivos de configuración de zoxide..."
      $DRY_RUN_CMD zoxide init nushell > $HOME/.zoxide.nu 2>/dev/null && echo "    ✅ .zoxide.nu creado" || echo "    ⚠️  Error al crear .zoxide.nu"
      $DRY_RUN_CMD zoxide init fish > $HOME/.zoxide.fish 2>/dev/null && echo "    ✅ .zoxide.fish creado" || echo "    ⚠️  Error al crear .zoxide.fish"
      $DRY_RUN_CMD zoxide init zsh > $HOME/.zoxide.zsh 2>/dev/null && echo "    ✅ .zoxide.zsh creado" || echo "    ⚠️  Error al crear .zoxide.zsh"
      $DRY_RUN_CMD zoxide init bash > $HOME/.zoxide.bash 2>/dev/null && echo "    ✅ .zoxide.bash creado" || echo "    ⚠️  Error al crear .zoxide.bash"
      
      echo "  🎉 Archivos de zoxide generados"
      
      # ===== AGREGAR SOURCE A CONFIGS (solo si el archivo de zoxide Y config existen) =====
      echo "  🔗 Verificando integración con shells..."
      
      # NUSHELL
      if [ -f "$HOME/.config/nushell/config.nu" ] && [ -f "$HOME/.zoxide.nu" ]; then
        if ! grep -q "source.*\.zoxide\.nu" "$HOME/.config/nushell/config.nu"; then
          echo "    📝 Integrando con nushell..."
          $DRY_RUN_CMD echo "" >> "$HOME/.config/nushell/config.nu"
          $DRY_RUN_CMD echo "source ~/.zoxide.nu" >> "$HOME/.config/nushell/config.nu"
          echo "    ✅ Nushell configurado"
        else
          echo "    ✅ Nushell ya configurado"
        fi
      fi
      
      # FISH
      if [ -f "$HOME/.config/fish/config.fish" ] && [ -f "$HOME/.zoxide.fish" ]; then
        if ! grep -q "source.*\.zoxide\.fish" "$HOME/.config/fish/config.fish"; then
          echo "    📝 Integrando con fish..."
          $DRY_RUN_CMD echo "" >> "$HOME/.config/fish/config.fish"
          $DRY_RUN_CMD echo "source ~/.zoxide.fish" >> "$HOME/.config/fish/config.fish"
          echo "    ✅ Fish configurado"
        else
          echo "    ✅ Fish ya configurado"
        fi
      fi
      
      # ZSH
      if [ -f "$HOME/.zshrc" ] && [ -f "$HOME/.zoxide.zsh" ]; then
        if ! grep -q "source.*\.zoxide\.zsh" "$HOME/.zshrc"; then
          echo "    📝 Integrando con zsh..."
          $DRY_RUN_CMD echo "" >> "$HOME/.zshrc"
          $DRY_RUN_CMD echo "source ~/.zoxide.zsh" >> "$HOME/.zshrc"
          echo "    ✅ Zsh configurado"
        else
          echo "    ✅ Zsh ya configurado"
        fi
      fi
      
      # BASH
      if [ -f "$HOME/.bashrc" ] && [ -f "$HOME/.zoxide.bash" ]; then
        if ! grep -q "source.*\.zoxide\.bash" "$HOME/.bashrc"; then
          echo "    📝 Integrando con bash..."
          $DRY_RUN_CMD echo "" >> "$HOME/.bashrc"
          $DRY_RUN_CMD echo "source ~/.zoxide.bash" >> "$HOME/.bashrc"
          echo "    ✅ Bash configurado"
        else
          echo "    ✅ Bash ya configurado"
        fi
      fi
      
      echo "🎉 Integración completada"
    else
      echo "⚠️  Zoxide no encontrado en PATH"
    fi
  '';
}
