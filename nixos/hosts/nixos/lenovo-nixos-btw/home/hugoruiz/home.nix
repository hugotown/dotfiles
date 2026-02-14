{ config, pkgs, lib, ... }:
{
  # Philosophy: NixOS installs packages → User configures via ~/.config/shell/ (portable)
  # Shell integrations live in ~/.config/shell/integrations/ (git-tracked)
  # Cached integrations (starship, direnv) live in ~/.cache/shell/ (bootstrap.sh)

  home.username = "hugoruiz";
  home.homeDirectory = "/home/hugoruiz";
  home.stateVersion = "25.05";

  # Direnv + nix-direnv (Nix-specific integration, not portable)
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
    YAZI_FILE_ONE = "nvim";
  };

  # Tools on activation PATH
  home.extraActivationPath = with pkgs; [
    zoxide
    yazi
    atuin
  ];

  # ===== SHELL BOOTSTRAP =====
  home.activation.shellBootstrap = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
    echo "Generating cached shell integrations..."
    bash $HOME/.config/shell/bootstrap.sh
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
}
