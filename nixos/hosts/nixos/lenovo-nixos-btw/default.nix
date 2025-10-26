{ config, lib, pkgs, ... }:

{
  imports =
    [
      ./hardware-configuration.nix
    ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "lenovo-nixos-btw";
  networking.networkmanager.enable = true;
  networking.firewall = {
    enable = true;
    allowedTCPPortRanges = [
      { from = 53317; to = 53317; } #LocalSend
    ];
  };

  time.timeZone = "America/Mexico_City";

  # services.getty.autologinUser = "hugoruiz";

  # Display Manager (SDDM) con autologin
  services.displayManager.sddm = {
    enable = true;
    wayland.enable = true;
  };

  services.displayManager.defaultSession = "hyprland-uwsm";

  services.displayManager.autoLogin = {
    enable = true;
    user = "hugoruiz";
  };

  programs.hyprland = {
    enable = true;
    xwayland.enable = true;
    withUWSM = true;
  };

  users.users.hugoruiz = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    packages = with pkgs; [
      tree
    ];
  };

  nixpkgs.config.allowUnfree = true;

  # Workaround for broken fcitx5-qt6 in nixos-unstable
  # See: https://github.com/NixOS/nixpkgs/issues/...
  nixpkgs.overlays = [
    (final: prev: {
      fcitx5-qt6 = prev.runCommand "fcitx5-qt6-stub" {} ''
        mkdir -p $out
        echo "fcitx5-qt6 is broken, using stub" > $out/README
      '';
    })
  ];

  services.pipewire = {
    enable = true;
    alsa.enable = true;
    pulse.enable = true;
  };

  # Input method support (fcitx5)
  i18n.inputMethod = {
    enabled = "fcitx5";
    fcitx5.addons = with pkgs; [
      fcitx5-gtk
    ];
  };

  # Polkit authentication agent
  # security.polkit.enable = true;
  # systemd.user.services.polkit-gnome-authentication-agent-1 = {
  #   description = "polkit-gnome-authentication-agent-1";
  #   wantedBy = [ "graphical-session.target" ];
  #   wants = [ "graphical-session.target" ];
  #   after = [ "graphical-session.target" ];
  #   serviceConfig = {
  #     Type = "simple";
  #     ExecStart = "${pkgs.polkit_gnome}/libexec/polkit-gnome-authentication-agent-1";
  #     Restart = "on-failure";
  #     RestartSec = 1;
  #     TimeoutStopSec = 10;
  #   };
  # };

  environment.systemPackages = with pkgs; [
    alacritty
    avahi
    bash-completion
    bat
    brightnessctl
    btop
    fastfetch
    fontconfig
    gcc
    ghostty
    git
    kitty
    localsend
    neovim
    nil
    nixpkgs-fmt
    plocate
    plymouth
    power-profiles-daemon
    ripgrep
    starship
    tzupdate
    vim
    waybar
    adwaita-icon-theme
    wget
    whois
    wireless-regdb
    zoxide
  ];

  fonts.packages = with pkgs; [
    jetbrains-mono
    nerd-fonts.jetbrains-mono
  ];

  # Icon themes for GTK applications
  environment.sessionVariables = {
    GTK_ICON_THEME = "Adwaita";
    XDG_ICON_THEME = "Adwaita";
  };

  # Variables de entorno para fcitx5 gestionadas automáticamente por el módulo i18n.inputMethod
  # NOTA: En Wayland, fcitx5 usa el frontend nativo cuando GTK_IM_MODULE no está definido
  # El módulo i18n.inputMethod gestiona automáticamente las variables necesarias

  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  system.stateVersion = "25.05";

}
