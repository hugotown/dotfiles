{ config, pkgs, lib, ... }:
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

  yaziBashWrapper = ''
    # Wrapper de Yazi para Bash/Zsh
    function y() {
      local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
      yazi "$@" --cwd-file="$tmp"
      IFS= read -r -d "" cwd < "$tmp"
      test -n "$cwd" && test "$cwd" != "$PWD" && builtin cd -- "$cwd"
      rm -f -- "$tmp"
    }
  '';
in
{
  # Philosophy: NixOS installs packages → User configures via ~/.config
  # This file contains ONLY essential home-manager configuration
  # All package installations are in common-packages.nix or host-specific default.nix

  home.username = "hugoruiz";
  home.homeDirectory = "/home/hugoruiz";
  home.stateVersion = "25.05";

  # Bash configuration and aliases
  programs.bash = {
    enable = true;
    shellAliases = {
      btw = "echo i use hyprland btw";
      ncrs = "cd /home/hugoruiz/.config && git reset --hard && git pull && sudo nix-collect-garbage -d && sudo nixos-rebuild switch --flake /home/hugoruiz/.config/nixos#lenovo-nixos-btw && sudo nix-store --optimise && echo '✅ nix-rebuild completado'";
    };
  };

  # Direnv integration (requires both package + shell hooks)
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };

  # Custom scripts and tools
  home.packages = with pkgs; [
    (pkgs.writeShellApplication {
      name = "ns";
      runtimeInputs = with pkgs; [
        fzf
        (nix-search-tv.overrideAttrs {
          env.GOEXPERIMENT = "jsonv2";
        })
      ];
      text = ''exec "${pkgs.nix-search-tv.src}/nixpkgs.sh" "$@"'';
    })
  ];

  # Environment variables
  home.sessionVariables = {
    EDITOR = "nvim";
    # Asegurar que yazi use nvim
    YAZI_FILE_ONE = "nvim";
  };

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

      $DRY_RUN_CMD cat > $HOME/.yazi.bash << 'EOFBASH'
${yaziBashWrapper}
EOFBASH
      echo "    ✅ .yazi.bash creado"

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

      if [ -f "$HOME/.bashrc" ] && [ -f "$HOME/.yazi.bash" ]; then
        if ! grep -q "source.*\.yazi\.bash" "$HOME/.bashrc"; then
          $DRY_RUN_CMD echo "" >> "$HOME/.bashrc"
          $DRY_RUN_CMD echo "source ~/.yazi.bash" >> "$HOME/.bashrc"
          echo "    ✅ Bash configurado"
        else
          echo "    ✅ Bash ya configurado"
        fi
      fi

      echo "  🎉 Integración de Yazi completada"
    else
      echo "  ⚠️  Yazi no encontrado en PATH"
    fi
  '';
}
