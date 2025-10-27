{ inputs, outputs, config, lib, hostname, system, username, pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;

  # Nix configuration
  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      warn-dirty = false;
      # Auto optimise store
      auto-optimise-store = true;
    };
    # Garbage collection
    gc = {
      automatic = true;
      dates = "weekly";
      options = "--delete-older-than 30d";
    };
  };

  # System state version - this should not change after installation
  system.stateVersion = "25.05";

  # Localization
  time.timeZone = lib.mkDefault "America/Mexico_City";
  i18n.defaultLocale = lib.mkDefault "en_US.UTF-8";
  console = {
    useXkbConfig = true;
  };

  # Networking configuration
  networking = {
    networkmanager.enable = lib.mkDefault true;
    useDHCP = lib.mkDefault true;
    firewall.enable = lib.mkDefault true;
  };

  # Boot configuration
  boot = {
    loader = {
      systemd-boot.enable = lib.mkDefault true;
      efi.canTouchEfiVariables = lib.mkDefault true;
    };
  };

  # Services
  services = {
    openssh = {
      enable = lib.mkDefault true;
      settings = {
        PermitRootLogin = "no";
        PasswordAuthentication = lib.mkDefault true;
      };
    };
  };

  # Hardware
  # hardware = {
  #   pulseaudio.enable = lib.mkDefault false;
  #   bluetooth.enable = lib.mkDefault true;
  # };

  # Security
  security = {
    rtkit.enable = true;
    sudo.wheelNeedsPassword = lib.mkDefault true;
  };

  # Enable PipeWire
  services.pipewire = {
    enable = lib.mkDefault true;
    alsa.enable = true;
    alsa.support32Bit = true;
    pulse.enable = true;
    jack.enable = true;
  };

  # Enable common services
  services.dbus.enable = true;
  services.udev.enable = true;

  # Programs
  programs = {
    dconf.enable = true;
    fish.enable = true;
    bash.enable = true;
  };

  # User configuration template
  users.users.${username} = {
    isNormalUser = true;
    description = lib.mkDefault "${username}";
    extraGroups = [ "wheel" "networkmanager" "audio" "video" ];
    shell = pkgs.bash;  # Default shell for Linux
  };

  # Environment
  environment = {
    shells = with pkgs; [ bash fish nushell ];
    pathsToLink = [ "/share/fish" "/share/bash-completion" ];
    variables = {
      EDITOR = "nvim";
      BROWSER = "firefox";
      TERMINAL = "alacritty";
    };
  };

  # Fonts
  fonts = {
    packages = with pkgs; [
      nerd-fonts.jetbrains-mono
      nerd-fonts.fira-code
    ];
  };
}
