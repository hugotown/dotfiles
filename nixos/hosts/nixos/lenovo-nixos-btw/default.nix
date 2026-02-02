{ config, lib, pkgs, username, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../../common/nixos-common.nix
    ../../common/common-packages.nix
  ];

  # ===== BOOT =====
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # ===== NETWORKING (host-specific) =====
  networking = {
    hostName = "lenovo-nixos-btw";
    firewall.allowedTCPPortRanges = [
      { from = 53317; to = 53317; } # LocalSend - P2P file sharing
    ];
    # Use iwd backend for better WiFi performance
    networkmanager.wifi.backend = "iwd";
    networkmanager.wifi.powersave = false;
  };

  # ===== DISPLAY MANAGER =====
  services.displayManager.sddm = {
    enable = true;
    wayland.enable = true;
  };
  services.displayManager.defaultSession = "hyprland-uwsm";
  services.displayManager.autoLogin = {
    enable = true;
    user = username;
  };

  # ===== HYPRLAND =====
  programs.hyprland = {
    enable = true;
    xwayland.enable = true;
    withUWSM = true;
  };

  # ===== USER (host-specific packages only) =====
  users.users.${username} = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    packages = with pkgs; [
      # User-specific packages (not in common)
    ];
  };

  # ===== INPUT METHOD =====
  i18n.inputMethod = {
    enable = true;
    type = "fcitx5";
    fcitx5.addons = with pkgs; [ fcitx5-gtk ];
  };

  # ===== POLKIT (for GUI sudo prompts) =====
  security.polkit.enable = true;
  systemd.user.services.polkit-gnome-authentication-agent-1 = {
    description = "polkit-gnome-authentication-agent-1";
    wantedBy = [ "graphical-session.target" ];
    wants = [ "graphical-session.target" ];
    after = [ "graphical-session.target" ];
    serviceConfig = {
      Type = "simple";
      ExecStart = "${pkgs.polkit_gnome}/libexec/polkit-gnome-authentication-agent-1";
      Restart = "on-failure";
      RestartSec = 1;
      TimeoutStopSec = 10;
    };
  };

  # ===== HOST-SPECIFIC PACKAGES =====
  # Hardware, services, laptop-specific tools
  environment.systemPackages = with pkgs; [
    # Hardware control
    avahi
    brightnessctl
    power-profiles-daemon
    wireless-regdb

    # Display/Desktop
    waybar
    adwaita-icon-theme
    polkit_gnome

    # Development tools (system-level, not languages)
    nil
    nixpkgs-fmt

    # Utilities
    bash-completion
    fastfetch
    fontconfig
    plocate
    plymouth
    starship
    tzupdate
    whois
  ];

  # ===== FONTS (host-specific additions) =====
  fonts.packages = with pkgs; [
    jetbrains-mono
  ];

  # ===== ENVIRONMENT =====
  environment.sessionVariables = {
    GTK_ICON_THEME = "Adwaita";
    XDG_ICON_THEME = "Adwaita";
  };

  # Starship prompt integration
  programs.starship.enable = true;
}
