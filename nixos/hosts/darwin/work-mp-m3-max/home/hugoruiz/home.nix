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
