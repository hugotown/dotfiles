{ config, pkgs, ... }:

{
  home.username = "hugoruiz";
  home.homeDirectory = "/home/hugoruiz";
  home.stateVersion = "25.05";

  programs.bash = {
    enable = true;
    shellAliases = {
      btw = "echo i use hyprland btw";
      ncrs = "cd /home/hugoruiz/.config && git reset --hard && git pull && sudo nix-collect-garbage -d && sudo nixos-rebuild switch --flake /home/hugoruiz/.config/nixos#lenovo-nixos-btw && sudo nix-store --optimise && echo '✅ nix-rebuild completado'";
    };
  };

  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };

  # Programas adicionales que agregaste (preservados)
  programs.fish.enable = true;
  programs.nushell.enable = true;
  programs.zoxide.enable = true;
  programs.eza.enable = true;
  programs.bat.enable = true;
  programs.yazi.enable = true;

  home.packages = with pkgs; [
    chromium
    claude-code
    gemini-cli
    gh
    hypridle
    hyprlock
    hyprsunset
    mako              # Notification daemon for Wayland
    nautilus          # GNOME file manager
    nil
    nitch
    opencode
    pcmanfm
    rofi
    swaybg            # Wallpaper utility for Wayland
    swayosd           # OSD (On-Screen Display) for volume/brightness
    warp-terminal
    wl-clip-persist   # Clipboard manager for Wayland
    wofi
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

  home.sessionVariables = {
    EDITOR = "nvim";
    # Asegurar que yazi use nvim
    YAZI_FILE_ONE = "nvim";
  };
}
