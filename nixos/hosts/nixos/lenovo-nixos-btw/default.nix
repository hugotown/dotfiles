{ config, lib, pkgs, ... }:
{
  imports = [
    ./hardware-configuration.nix
    ../../common/nixos-common.nix
    ../../common/common-packages.nix
  ];

  # Boot configuration
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Networking
  networking = {
    hostName = "lenovo-nixos-btw";
    networkmanager.enable = true;
    firewall = {
      enable = true;
      allowedTCPPortRanges = [
        { from = 53317; to = 53317; } #LocalSend
      ];
    };
  };

  # Time zone
  time.timeZone = "America/Mexico_City";

  # Localization
  i18n.defaultLocale = "en_US.UTF-8";

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

  # User configuration
  users.users.hugoruiz = {
    isNormalUser = true;
    description = "Hugo Ruiz";
    extraGroups = [ "wheel" "networkmanager" ];
    packages = with pkgs; [
      tree
    ];
  };

  nixpkgs.config.allowUnfree = true;

  # services.pipewire = {
  #   enable = true;
  #   alsa.enable = true;
  #   pulse.enable = true;
  # };

  # Input method support (fcitx5)
  i18n.inputMethod = {
    enable = true;
    type = "fcitx5";
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
    # Paquetes específicos de NixOS (los comunes están en common-packages.nix)
    
    ## Terminales adicionales
    ghostty
    
    ## Sistema
    avahi
    bash-completion
    brightnessctl
    fastfetch
    fontconfig
    plocate
    plymouth
    power-profiles-daemon
    tzupdate
    whois
    wireless-regdb
    
    ## Desarrollo
    gcc
    git
    vim
    nil
    nixpkgs-fmt
    
    ## Aplicaciones
    localsend
    
    ## Wayland/Hyprland
    waybar
    
    ## Temas
    adwaita-icon-theme
    
    ## Prompt
    starship
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

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken.
  system.stateVersion = "25.05";
}
