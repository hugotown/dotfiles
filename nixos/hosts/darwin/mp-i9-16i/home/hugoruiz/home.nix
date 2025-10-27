{ config, inputs, pkgs, lib, ... }:
let
  yaziNushellWrapper = ''
    # Wrapper de Yazi para Nushell
    def --env y [...args] {
      let tmp = (mktemp -t "yazi-cwd.XXXXXX")
      yazi ...$args --cwd-file $tmp
      let cwd = (open $tmp)
      if $cwd != "" and $cwd != $env.PWD {
        cd $cwd
      }
      rm -fp $tmp
    }
  '';

  yaziFishWrapper = ''
    # Wrapper de Yazi para Fish
    function y
      set tmp (mktemp -t "yazi-cwd.XXXXXX")
      yazi $argv --cwd-file="$tmp"
      if read -z cwd < "$tmp"; and test -n "$cwd"; and test "$cwd" != "$PWD"
        builtin cd -- "$cwd"
      end
      rm -f -- "$tmp"
    end
  '';

  yaziZshWrapper = ''
    # Wrapper de Yazi para Zsh/Bash
    function y() {
      local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
      yazi "$@" --cwd-file="$tmp"
      IFS= read -r -d "" cwd < "$tmp"
      test -n "$cwd" && test "$cwd" != "$PWD" && builtin cd -- "$cwd"
      rm -f -- "$tmp"
    }
  '';

  # Alias ncrs para Fish
  ncrsFishAlias = ''
    # Nix Darwin Rebuild System alias
    alias ncrs="sudo nix-collect-garbage -d && cd /Users/hugoruiz/.config && git reset --hard && git pull && darwin-rebuild switch --flake /Users/hugoruiz/.config/nixos#mp-i9-16i && sudo nix-store --optimise && echo '✅ nix-darwin-rebuild completado'"
  '';

  # Alias ncrs para Nushell
  ncrsNushellAlias = ''
    # Nix Darwin Rebuild System alias
    alias ncrs = sudo nix-collect-garbage -d; cd /Users/hugoruiz/.config; git reset --hard; git pull; darwin-rebuild switch --flake /Users/hugoruiz/.config/nixos#mp-i9-16i; sudo nix-store --optimise; echo '✅ nix-darwin-rebuild completado'
  '';

  # Alias ncrs para Zsh
  ncrsZshAlias = ''
    # Nix Darwin Rebuild System alias
    alias ncrs="sudo nix-collect-garbage -d && cd /Users/hugoruiz/.config && git reset --hard && git pull && darwin-rebuild switch --flake /Users/hugoruiz/.config/nixos#mp-i9-16i && sudo nix-store --optimise && echo '✅ nix-darwin-rebuild completado'"
  '';

  # Alias cldy para Fish
  cldyFishAlias = ''
    # Claude skip permissions alias
    alias cldy="claude --dangerously-skip-permissions"
  '';

  # Alias cldy para Nushell
  cldyNushellAlias = ''
    # Claude skip permissions alias
    alias cldy = claude --dangerously-skip-permissions
  '';

  # Alias cldy para Zsh
  cldyZshAlias = ''
    # Claude skip permissions alias
    alias cldy="claude --dangerously-skip-permissions"
  '';
in
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  # ===== REGLA HÍBRIDA: NIX INSTALA, USUARIO CONFIGURA =====
  home.packages = with pkgs; [
    fish
    nushell
    direnv
    nix-direnv
    zoxide
    eza
    bat
    yazi
    alacritty
    wezterm
    neovim
    atuin
    claude-code
    python312
    pipx
    uv
    # localsend movido a darwin-common.nix para que aparezca en /Applications/Nix Apps/
  ];

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
  };
  
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

  # ===== AGREGAR HERRAMIENTAS AL PATH DE ACTIVACIÓN =====
  home.extraActivationPath = with pkgs; [
    zoxide
    yazi
  ];

  # ===== POST-ACTIVATION HOOK: ZOXIDE =====
  home.activation.regenerateZoxide = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Regenerando configuraciones de zoxide..."
    
    if command -v zoxide >/dev/null 2>&1; then
      echo "  📝 Generando archivos de configuración de zoxide..."
      $DRY_RUN_CMD zoxide init nushell > $HOME/.zoxide.nu 2>/dev/null && echo "    ✅ .zoxide.nu creado" || echo "    ⚠️  Error al crear .zoxide.nu"
      $DRY_RUN_CMD zoxide init fish > $HOME/.zoxide.fish 2>/dev/null && echo "    ✅ .zoxide.fish creado" || echo "    ⚠️  Error al crear .zoxide.fish"
      $DRY_RUN_CMD zoxide init zsh > $HOME/.zoxide.zsh 2>/dev/null && echo "    ✅ .zoxide.zsh creado" || echo "    ⚠️  Error al crear .zoxide.zsh"
      $DRY_RUN_CMD zoxide init bash > $HOME/.zoxide.bash 2>/dev/null && echo "    ✅ .zoxide.bash creado" || echo "    ⚠️  Error al crear .zoxide.bash"
      
      echo "  🔗 Verificando integración con shells..."
      
      if [ -f "$HOME/.config/nushell/config.nu" ] && [ -f "$HOME/.zoxide.nu" ]; then
        if ! grep -q "source.*\.zoxide\.nu" "$HOME/.config/nushell/config.nu"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.config/nushell/config.nu"
          $DRY_RUN_CMD echo "source ~/.zoxide.nu" >> "$HOME/.config/nushell/config.nu"
          echo "    ✅ Nushell configurado"
        else
          echo "    ✅ Nushell ya configurado"
        fi
      fi
      
      if [ -f "$HOME/.config/fish/config.fish" ] && [ -f "$HOME/.zoxide.fish" ]; then
        if ! grep -q "source.*\.zoxide\.fish" "$HOME/.config/fish/config.fish"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.config/fish/config.fish"
          $DRY_RUN_CMD echo "source ~/.zoxide.fish" >> "$HOME/.config/fish/config.fish"
          echo "    ✅ Fish configurado"
        else
          echo "    ✅ Fish ya configurado"
        fi
      fi
      
      if [ -f "$HOME/.zshrc" ] && [ -f "$HOME/.zoxide.zsh" ]; then
        if ! grep -q "source.*\.zoxide\.zsh" "$HOME/.zshrc"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.zshrc"
          $DRY_RUN_CMD echo "source ~/.zoxide.zsh" >> "$HOME/.zshrc"
          echo "    ✅ Zsh configurado"
        else
          echo "    ✅ Zsh ya configurado"
        fi
      fi
      
      if [ -f "$HOME/.bashrc" ] && [ -f "$HOME/.zoxide.bash" ]; then
        if ! grep -q "source.*\.zoxide\.bash" "$HOME/.bashrc"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.bashrc"
          $DRY_RUN_CMD echo "source ~/.zoxide.bash" >> "$HOME/.bashrc"
          echo "    ✅ Bash configurado"
        else
          echo "    ✅ Bash ya configurado"
        fi
      fi
      
      echo "  🎉 Integración completada"
    else
      echo "  ⚠️  Zoxide no encontrado en PATH"
    fi
  '';

  # ===== POST-ACTIVATION HOOK: YAZI =====
  home.activation.regenerateYazi = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Regenerando wrappers de Yazi..."

    if command -v yazi >/dev/null 2>&1; then
      echo "  📝 Generando archivos de wrapper de Yazi..."

      $DRY_RUN_CMD cat > $HOME/.yazi.nu << 'EOFNU'
${yaziNushellWrapper}
EOFNU
      echo "    ✅ .yazi.nu creado"

      $DRY_RUN_CMD cat > $HOME/.yazi.fish << 'EOFFISH'
${yaziFishWrapper}
EOFFISH
      echo "    ✅ .yazi.fish creado"

      $DRY_RUN_CMD cat > $HOME/.yazi.zsh << 'EOFZSH'
${yaziZshWrapper}
EOFZSH
      echo "    ✅ .yazi.zsh creado"

      echo "  🔗 Verificando integración de Yazi con shells..."

      if [ -f "$HOME/.config/nushell/config.nu" ] && [ -f "$HOME/.yazi.nu" ]; then
        if ! grep -q "source.*\.yazi\.nu" "$HOME/.config/nushell/config.nu"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.config/nushell/config.nu"
          $DRY_RUN_CMD echo "source ~/.yazi.nu" >> "$HOME/.config/nushell/config.nu"
          echo "    ✅ Nushell configurado"
        else
          echo "    ✅ Nushell ya configurado"
        fi
      fi

      if [ -f "$HOME/.config/fish/config.fish" ] && [ -f "$HOME/.yazi.fish" ]; then
        if ! grep -q "source.*\.yazi\.fish" "$HOME/.config/fish/config.fish"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.config/fish/config.fish"
          $DRY_RUN_CMD echo "source ~/.yazi.fish" >> "$HOME/.config/fish/config.fish"
          echo "    ✅ Fish configurado"
        else
          echo "    ✅ Fish ya configurado"
        fi
      fi

      if [ -f "$HOME/.zshrc" ] && [ -f "$HOME/.yazi.zsh" ]; then
        if ! grep -q "source.*\.yazi\.zsh" "$HOME/.zshrc"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.zshrc"
          $DRY_RUN_CMD echo "source ~/.yazi.zsh" >> "$HOME/.zshrc"
          echo "    ✅ Zsh configurado"
        else
          echo "    ✅ Zsh ya configurado"
        fi
      fi

      echo "  🎉 Integración de Yazi completada"
    else
      echo "  ⚠️  Yazi no encontrado en PATH"
    fi
  '';

  # ===== POST-ACTIVATION HOOK: NCRS ALIAS =====
  home.activation.configureNcrsAlias = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Configurando alias ncrs para shells..."

    echo "  📝 Generando archivos de alias ncrs..."

    $DRY_RUN_CMD cat > $HOME/.ncrs.fish << 'EOFFISH'
${ncrsFishAlias}
EOFFISH
    echo "    ✅ .ncrs.fish creado"

    $DRY_RUN_CMD cat > $HOME/.ncrs.nu << 'EOFNU'
${ncrsNushellAlias}
EOFNU
    echo "    ✅ .ncrs.nu creado"

    $DRY_RUN_CMD cat > $HOME/.ncrs.zsh << 'EOFZSH'
${ncrsZshAlias}
EOFZSH
    echo "    ✅ .ncrs.zsh creado"

    echo "  🔗 Verificando integración de alias ncrs con shells..."

    if [ -f "$HOME/.config/nushell/config.nu" ] && [ -f "$HOME/.ncrs.nu" ]; then
      if ! grep -q "source.*\.ncrs\.nu" "$HOME/.config/nushell/config.nu"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.config/nushell/config.nu"
        $DRY_RUN_CMD echo "source ~/.ncrs.nu" >> "$HOME/.config/nushell/config.nu"
        echo "    ✅ Nushell configurado"
      else
        echo "    ✅ Nushell ya configurado"
      fi
    fi

    if [ -f "$HOME/.config/fish/config.fish" ] && [ -f "$HOME/.ncrs.fish" ]; then
      if ! grep -q "source.*\.ncrs\.fish" "$HOME/.config/fish/config.fish"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.config/fish/config.fish"
        $DRY_RUN_CMD echo "source ~/.ncrs.fish" >> "$HOME/.config/fish/config.fish"
        echo "    ✅ Fish configurado"
      else
        echo "    ✅ Fish ya configurado"
      fi
    fi

    if [ -f "$HOME/.zshrc" ] && [ -f "$HOME/.ncrs.zsh" ]; then
      if ! grep -q "source.*\.ncrs\.zsh" "$HOME/.zshrc"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.zshrc"
        $DRY_RUN_CMD echo "source ~/.ncrs.zsh" >> "$HOME/.zshrc"
        echo "    ✅ Zsh configurado"
      else
        echo "    ✅ Zsh ya configurado"
      fi
    fi

    echo "  🎉 Alias ncrs configurado para todas las shells"
  '';

  # ===== POST-ACTIVATION HOOK: CLDY ALIAS =====
  home.activation.configureCldyAlias = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Configurando alias cldy para shells..."

    echo "  📝 Generando archivos de alias cldy..."

    $DRY_RUN_CMD cat > $HOME/.cldy.fish << 'EOFFISH'
${cldyFishAlias}
EOFFISH
    echo "    ✅ .cldy.fish creado"

    $DRY_RUN_CMD cat > $HOME/.cldy.nu << 'EOFNU'
${cldyNushellAlias}
EOFNU
    echo "    ✅ .cldy.nu creado"

    $DRY_RUN_CMD cat > $HOME/.cldy.zsh << 'EOFZSH'
${cldyZshAlias}
EOFZSH
    echo "    ✅ .cldy.zsh creado"

    echo "  🔗 Verificando integración de alias cldy con shells..."

    if [ -f "$HOME/.config/nushell/config.nu" ] && [ -f "$HOME/.cldy.nu" ]; then
      if ! grep -q "source.*\.cldy\.nu" "$HOME/.config/nushell/config.nu"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.config/nushell/config.nu"
        $DRY_RUN_CMD echo "source ~/.cldy.nu" >> "$HOME/.config/nushell/config.nu"
        echo "    ✅ Nushell configurado"
      else
        echo "    ✅ Nushell ya configurado"
      fi
    fi

    if [ -f "$HOME/.config/fish/config.fish" ] && [ -f "$HOME/.cldy.fish" ]; then
      if ! grep -q "source.*\.cldy\.fish" "$HOME/.config/fish/config.fish"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.config/fish/config.fish"
        $DRY_RUN_CMD echo "source ~/.cldy.fish" >> "$HOME/.config/fish/config.fish"
        echo "    ✅ Fish configurado"
      else
        echo "    ✅ Fish ya configurado"
      fi
    fi

    if [ -f "$HOME/.zshrc" ] && [ -f "$HOME/.cldy.zsh" ]; then
      if ! grep -q "source.*\.cldy\.zsh" "$HOME/.zshrc"; then
        $DRY_RUN_CMD echo "" >> "$HOME/.zshrc"
        $DRY_RUN_CMD echo "source ~/.cldy.zsh" >> "$HOME/.zshrc"
        echo "    ✅ Zsh configurado"
      else
        echo "    ✅ Zsh ya configurado"
      fi
    fi

    echo "  🎉 Alias cldy configurado para todas las shells"
  '';
}
