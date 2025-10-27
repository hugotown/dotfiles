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

  # Alias ncrs para Fish (NixOS)
  ncrsFishAlias = ''
    # NixOS Rebuild System alias
    alias ncrs="sudo nix-collect-garbage -d && cd /home/hugoruiz/.config && git reset --hard && git pull && sudo nixos-rebuild switch --flake /home/hugoruiz/.config/nixos#lenovo-nixos-btw && sudo nix-store --optimise && echo '✅ nix-rebuild completado'"
  '';

  # Alias ncrs para Nushell (NixOS)
  ncrsNushellAlias = ''
    # NixOS Rebuild System alias
    alias ncrs = sudo nix-collect-garbage -d; cd /home/hugoruiz/.config; git reset --hard; git pull; sudo nixos-rebuild switch --flake /home/hugoruiz/.config/nixos#lenovo-nixos-btw; sudo nix-store --optimise; echo '✅ nix-rebuild completado'
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
      ncrs = "sudo nix-collect-garbage -d && cd /home/hugoruiz/.config && git reset --hard && git pull && sudo nixos-rebuild switch --flake /home/hugoruiz/.config/nixos#lenovo-nixos-btw && sudo nix-store --optimise && echo '✅ nix-rebuild completado'";
      cldy = "claude --dangerously-skip-permissions";
    };
    initExtra = ''
      # Auto-source zoxide, yazi and atuin integrations
      [ -f ~/.zoxide.bash ] && source ~/.zoxide.bash
      [ -f ~/.yazi.bash ] && source ~/.yazi.bash
      [ -f ~/.atuin.bash ] && source ~/.atuin.bash
    '';
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
    atuin
  ];

  # ===== POST-ACTIVATION HOOK: ZOXIDE =====
  home.activation.regenerateZoxide = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Generando archivos de integración de zoxide..."

    if command -v zoxide >/dev/null 2>&1; then
      $DRY_RUN_CMD zoxide init nushell > $HOME/.zoxide.nu 2>/dev/null && echo "  ✅ .zoxide.nu creado" || echo "  ⚠️  Error al crear .zoxide.nu"
      $DRY_RUN_CMD zoxide init fish > $HOME/.zoxide.fish 2>/dev/null && echo "  ✅ .zoxide.fish creado" || echo "  ⚠️  Error al crear .zoxide.fish"
      $DRY_RUN_CMD zoxide init bash > $HOME/.zoxide.bash 2>/dev/null && echo "  ✅ .zoxide.bash creado" || echo "  ⚠️  Error al crear .zoxide.bash"
      echo "  💡 Bash: Auto-configurado via programs.bash.initExtra"
      echo "  💡 Fish: Agrega 'source ~/.zoxide.fish' a ~/.config/fish/config.fish"
      echo "  💡 Nushell: Agrega 'source ~/.zoxide.nu' a ~/.config/nushell/config.nu"
    else
      echo "  ⚠️  Zoxide no encontrado en PATH"
    fi
  '';

  # ===== POST-ACTIVATION HOOK: YAZI =====
  home.activation.regenerateYazi = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Generando wrappers de Yazi..."

    if command -v yazi >/dev/null 2>&1; then
      $DRY_RUN_CMD cat > $HOME/.yazi.nu << 'EOFNU'
${yaziNushellWrapper}
EOFNU
      echo "  ✅ .yazi.nu creado"

      $DRY_RUN_CMD cat > $HOME/.yazi.fish << 'EOFFISH'
${yaziFishWrapper}
EOFFISH
      echo "  ✅ .yazi.fish creado"

      $DRY_RUN_CMD cat > $HOME/.yazi.bash << 'EOFBASH'
${yaziBashWrapper}
EOFBASH
      echo "  ✅ .yazi.bash creado"
      echo "  💡 Bash: Auto-configurado via programs.bash.initExtra"
      echo "  💡 Fish: Agrega 'source ~/.yazi.fish' a ~/.config/fish/config.fish"
      echo "  💡 Nushell: Agrega 'source ~/.yazi.nu' a ~/.config/nushell/config.nu"
    else
      echo "  ⚠️  Yazi no encontrado en PATH"
    fi
  '';

  # ===== POST-ACTIVATION HOOK: ATUIN =====
  home.activation.regenerateAtuin = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "🔧 Generando archivos de integración de Atuin..."

    if command -v atuin >/dev/null 2>&1; then
      $DRY_RUN_CMD atuin init nushell > $HOME/.atuin.nu 2>/dev/null && echo "  ✅ .atuin.nu creado" || echo "  ⚠️  Error al crear .atuin.nu"
      $DRY_RUN_CMD atuin init fish > $HOME/.atuin.fish 2>/dev/null && echo "  ✅ .atuin.fish creado" || echo "  ⚠️  Error al crear .atuin.fish"
      $DRY_RUN_CMD atuin init bash > $HOME/.atuin.bash 2>/dev/null && echo "  ✅ .atuin.bash creado" || echo "  ⚠️  Error al crear .atuin.bash"
      echo "  💡 Bash: Auto-configurado via programs.bash.initExtra"
      echo "  💡 Fish: Agrega 'source ~/.atuin.fish' a ~/.config/fish/config.fish"
      echo "  💡 Nushell: Agrega 'source ~/.atuin.nu' a ~/.config/nushell/config.nu"
    else
      echo "  ⚠️  Atuin no encontrado en PATH"
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

    echo "  🎉 Alias ncrs configurado para Fish y Nushell"
    echo "  💡 Bash: ncrs ya configurado via programs.bash.shellAliases"
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

    echo "  🎉 Alias cldy configurado para Fish y Nushell"
    echo "  💡 Bash: cldy ya configurado via programs.bash.shellAliases"
  '';
}
