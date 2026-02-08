{ inputs, pkgs, lib, ... }:
{
  # Shared packages across all hosts (NixOS and Darwin)
  # Philosophy: Nix installs terminal tools → User configures in ~/.config
  # Programming languages: Use direnv per-project, NOT system-wide
  environment.systemPackages = with pkgs; [
    ## Terminals
    alacritty
    kitty
    wezterm
    tmux
    zellij

    ## Editor
    neovim

    ## CLI tools - basics
    curl
    wget
    tree
    bat
    ripgrep
    eza

    ## CLI tools - modern replacements
    delta         # better git diffs
    dust          # better du
    duf           # better df
    procs         # better ps
    xh            # better curl/httpie
    httpie        # friendly HTTP client
    tealdeer      # tldr pages (man simplified)

    ## Data processing
    jq            # JSON processor (already have via system)
    yq-go         # YAML processor

    ## Navigation & Productivity
    zoxide
    atuin
    btop
    yazi
    ncdu          # disk usage interactive
    fzf           # fuzzy finder (already have via system)

    ## Development Environment (NOT languages - use direnv/mise per project)
    direnv
    nix-direnv
    mise
    pnpm          # fast, disk-efficient package manager for Node.js
    nodejs        # Node.js runtime (includes npm)
    just
    lazygit
    lazydocker    # docker TUI
    hyperfine     # benchmarking
    tokei         # code statistics
    watchexec     # file watcher

    ## Security & Encryption
    gnupg
    age
    sops

    ## Shells
    fish
    nushell
    zsh

    ## GUI Applications (cross-platform)
    # claude-code  # Installed via activation script: curl -fsSL https://claude.ai/install.sh | bash
    gemini-cli
    localsend
    brave
    obsidian
  ]
  # Linux-only packages (Wayland, Hyprland ecosystem)
  ++ lib.optionals pkgs.stdenv.hostPlatform.isLinux [
    bash
    chromium
    ghostty
    hypridle
    hyprlock
    hyprsunset
    mako
    nautilus
    nitch
    # opencode  # Installed via activation script: curl -fsSL https://opencode.ai/install | bash
    pcmanfm
    rofi
    swaybg
    swayosd
    warp-terminal
    wl-clip-persist
    wofi
  ];
}
