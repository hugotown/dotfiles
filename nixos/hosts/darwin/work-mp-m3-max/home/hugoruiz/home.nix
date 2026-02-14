{ config, inputs, pkgs, lib, hostname, ... }:
{
  home.stateVersion = "24.11";
  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;

  # ===== PACKAGES =====
  home.packages = with pkgs; [
    devenv
  ];

  # All tools installed via common-packages.nix
  # Shell integrations managed portably in ~/.config/shell/

  # ===== SESSION CONFIGURATION =====

  home.sessionVariables = {
    EDITOR = "nvim";
    TERMINAL = "alacritty";
  };

  home.sessionPath = [
    "${config.home.homeDirectory}/.local/bin"
    "${config.home.homeDirectory}/.npm-global/bin"
  ];

  home.file.".hushlogin".text = "";

  # ===== SHELL BOOTSTRAP =====
  # Generate cached integration files (starship, direnv) in ~/.cache/shell/
  home.activation.shellBootstrap = lib.hm.dag.entryAfter ["writeBoundary"] ''
    echo "Generating cached shell integrations..."
    $DRY_RUN_CMD bash $HOME/.config/shell/bootstrap.sh
  '';

  # ===== HAMMERSPOON SYMLINK =====

  home.activation.hammerspoon = lib.hm.dag.entryAfter ["writeBoundary"] ''
    CONFIG_DIR="$HOME/.config/hammerspoon"
    HAMMERSPOON_DIR="$HOME/.hammerspoon"

    if [ -d "$HAMMERSPOON_DIR" ] && [ ! -L "$HAMMERSPOON_DIR" ]; then
      $DRY_RUN_CMD mv "$HAMMERSPOON_DIR" "$HAMMERSPOON_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    if [ -L "$HAMMERSPOON_DIR" ] && [ "$(readlink "$HAMMERSPOON_DIR")" != "$CONFIG_DIR" ]; then
      $DRY_RUN_CMD rm "$HAMMERSPOON_DIR"
    fi

    if [ ! -e "$HAMMERSPOON_DIR" ]; then
      $DRY_RUN_CMD ln -sf "$CONFIG_DIR" "$HAMMERSPOON_DIR"
      echo "Hammerspoon symlink created: $HAMMERSPOON_DIR -> $CONFIG_DIR"
    fi
  '';

  # ===== CLAUDE CODE INSTALLATION =====

  home.activation.installClaude = lib.hm.dag.entryAfter ["writeBoundary"] ''
    if ! command -v claude &> /dev/null; then
      echo "Installing Claude Code..."
      export PATH="${pkgs.curl}/bin:${pkgs.bash}/bin:${pkgs.coreutils}/bin:${pkgs.gnugrep}/bin:${pkgs.gnused}/bin:${pkgs.gnutar}/bin:${pkgs.gzip}/bin:${pkgs.unzip}/bin:${pkgs.perl}/bin:$PATH"
      $DRY_RUN_CMD ${pkgs.curl}/bin/curl -fsSL https://claude.ai/install.sh | ${pkgs.bash}/bin/bash
    fi
  '';

  # ===== OPENCODE INSTALLATION =====

  home.activation.installOpencode = lib.hm.dag.entryAfter ["writeBoundary"] ''
    if ! command -v opencode &> /dev/null; then
      echo "Installing Opencode..."
      export PATH="${pkgs.curl}/bin:${pkgs.bash}/bin:${pkgs.coreutils}/bin:${pkgs.gnugrep}/bin:${pkgs.gnused}/bin:${pkgs.gnutar}/bin:${pkgs.gzip}/bin:${pkgs.unzip}/bin:${pkgs.perl}/bin:$PATH"
      $DRY_RUN_CMD ${pkgs.curl}/bin/curl -fsSL https://opencode.ai/install | ${pkgs.bash}/bin/bash
    fi
  '';

  # ===== KARABINER-ELEMENTS CONFIG =====

  home.activation.karabiner = lib.hm.dag.entryAfter ["writeBoundary"] ''
    KARABINER_CONFIG_DIR="$HOME/.config/karabiner"
    if [ ! -d "$KARABINER_CONFIG_DIR" ]; then
      $DRY_RUN_CMD mkdir -p "$KARABINER_CONFIG_DIR/assets/complex_modifications"
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

}
