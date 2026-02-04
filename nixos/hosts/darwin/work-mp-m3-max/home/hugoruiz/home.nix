{ config, inputs, pkgs, lib, hostname, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  # ===== DECLARATIVE SHELL INTEGRATIONS =====

  # Zoxide - smart cd (replaces activation hook)
  programs.zoxide = {
    enable = true;
    enableFishIntegration = true;
    enableZshIntegration = true;
    enableNushellIntegration = true;
    enableBashIntegration = true;
  };

  # Fish shell configuration
  programs.fish = {
    enable = true;
    functions = {
      # Yazi wrapper - cd to last directory on exit
      y = ''
        set tmp (mktemp -t "yazi-cwd.XXXXXX")
        yazi $argv --cwd-file="$tmp"
        if read -z cwd < "$tmp"; and test -n "$cwd"; and test "$cwd" != "$PWD"
          builtin cd -- "$cwd"
        end
        rm -f -- "$tmp"
      '';
    };
    shellAliases = {
      cldy = "claude --dangerously-skip-permissions";
    };
  };

  # Zsh configuration
  programs.zsh = {
    enable = true;
    shellAliases = {
      cldy = "claude --dangerously-skip-permissions";
    };
    initExtra = ''
      # Yazi wrapper
      function y() {
        local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
        yazi "$@" --cwd-file="$tmp"
        IFS= read -r -d "" cwd < "$tmp"
        test -n "$cwd" && test "$cwd" != "$PWD" && builtin cd -- "$cwd"
        rm -f -- "$tmp"
      }
    '';
  };

  # Nushell configuration
  programs.nushell = {
    enable = true;
    shellAliases = {
      cldy = "claude --dangerously-skip-permissions";
    };
    extraConfig = ''
      # Yazi wrapper
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
  };

  # ===== SESSION CONFIGURATION =====

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
  };

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
  ];

  home.file.".hushlogin".text = "";

  # ===== HAMMERSPOON SYMLINK =====

  home.activation.hammerspoon = lib.hm.dag.entryAfter ["writeBoundary"] ''
    # Create Hammerspoon symlink from ~/.config/hammerspoon to ~/.hammerspoon
    CONFIG_DIR="$HOME/.config/hammerspoon"
    HAMMERSPOON_DIR="$HOME/.hammerspoon"

    # Backup existing directory if it's not a symlink
    if [ -d "$HAMMERSPOON_DIR" ] && [ ! -L "$HAMMERSPOON_DIR" ]; then
      $DRY_RUN_CMD mv "$HAMMERSPOON_DIR" "$HAMMERSPOON_DIR.backup.$(date +%Y%m%d_%H%M%S)"
      echo "🔨 Backed up existing Hammerspoon config"
    fi

    # Remove old symlink if it exists and points to wrong location
    if [ -L "$HAMMERSPOON_DIR" ] && [ "$(readlink "$HAMMERSPOON_DIR")" != "$CONFIG_DIR" ]; then
      $DRY_RUN_CMD rm "$HAMMERSPOON_DIR"
      echo "🔨 Removed old Hammerspoon symlink"
    fi

    # Create symlink if it doesn't exist
    if [ ! -e "$HAMMERSPOON_DIR" ]; then
      $DRY_RUN_CMD ln -sf "$CONFIG_DIR" "$HAMMERSPOON_DIR"
      echo "✅ Hammerspoon symlink created: $HAMMERSPOON_DIR -> $CONFIG_DIR"
    else
      echo "✅ Hammerspoon symlink already exists"
    fi
  '';

  # ===== KARABINER-ELEMENTS CONFIG =====

  home.activation.karabiner = lib.hm.dag.entryAfter ["writeBoundary"] ''
    # Ensure Karabiner config directory exists
    KARABINER_CONFIG_DIR="$HOME/.config/karabiner"

    # Create directory structure if it doesn't exist
    if [ ! -d "$KARABINER_CONFIG_DIR" ]; then
      $DRY_RUN_CMD mkdir -p "$KARABINER_CONFIG_DIR/assets/complex_modifications"
      echo "⌨️  Created Karabiner config directory"
    fi

    # Verify config file exists
    if [ -f "$KARABINER_CONFIG_DIR/karabiner.json" ]; then
      echo "✅ Karabiner config ready: $KARABINER_CONFIG_DIR/karabiner.json"
    else
      echo "⚠️  Karabiner config not found. Please create ~/.config/karabiner/karabiner.json"
    fi
  '';

  # ===== LAUNCHD AGENTS =====

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

  launchd.agents.hammerspoon = {
    enable = true;
    config = {
      ProgramArguments = [
        "/Applications/Hammerspoon.app/Contents/MacOS/Hammerspoon"
      ];
      RunAtLoad = true;
      KeepAlive = false;
      StandardOutPath = "/tmp/hammerspoon.out.log";
      StandardErrorPath = "/tmp/hammerspoon.err.log";
    };
  };

  launchd.agents.karabiner = {
    enable = true;
    config = {
      ProgramArguments = [
        "/Applications/Karabiner-Elements.app/Contents/MacOS/Karabiner-Elements"
      ];
      RunAtLoad = true;
      KeepAlive = false;
      StandardOutPath = "/tmp/karabiner.out.log";
      StandardErrorPath = "/tmp/karabiner.err.log";
    };
  };

  # launchd.agents.sketchybar = {
  #   enable = true;
  #   config = {
  #     ProgramArguments = [
  #       "${pkgs.sketchybar}/bin/sketchybar"
  #     ];
  #     KeepAlive = true;
  #     RunAtLoad = true;
  #     StandardOutPath = "/tmp/sketchybar.out.log";
  #     StandardErrorPath = "/tmp/sketchybar.err.log";
  #     EnvironmentVariables = {
  #       PATH = "/run/current-system/sw/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  #     };
  #   };
  # };
}
