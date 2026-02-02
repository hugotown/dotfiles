{ inputs, outputs, config, lib, hostname, system, username, pkgs, ... }:
{
  nixpkgs.config.allowUnfree = true;

  # ===== NIX CONFIGURATION =====
  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      warn-dirty = false;
      auto-optimise-store = true;
      # Allow wheel users to use binary caches
      trusted-users = [ "root" "@wheel" username ];
    };
    gc = {
      automatic = true;
      dates = "weekly";
      options = "--delete-older-than 30d";
    };
  };

  # System state version - do not change after installation
  system.stateVersion = "25.05";

  # ===== LOCALIZATION =====
  time.timeZone = lib.mkDefault "America/Mexico_City";
  i18n.defaultLocale = lib.mkDefault "en_US.UTF-8";
  console.useXkbConfig = true;

  # ===== NETWORKING =====
  networking = {
    networkmanager.enable = lib.mkDefault true;
    useDHCP = lib.mkDefault true;
    firewall.enable = lib.mkDefault true;
  };

  # ===== BOOT =====
  boot.loader = {
    systemd-boot.enable = lib.mkDefault true;
    efi.canTouchEfiVariables = lib.mkDefault true;
  };

  # ===== SERVICES =====
  services = {
    openssh = {
      enable = lib.mkDefault true;
      settings = {
        PermitRootLogin = "no";
        PasswordAuthentication = lib.mkDefault true;
      };
    };
    dbus.enable = true;
    udev.enable = true;
    pipewire = {
      enable = lib.mkDefault true;
      alsa.enable = true;
      alsa.support32Bit = true;
      pulse.enable = true;
      jack.enable = true;
    };
  };

  # ===== SECURITY =====
  security = {
    rtkit.enable = true;
    sudo.wheelNeedsPassword = lib.mkDefault true;
  };

  # ===== PROGRAMS =====
  # Note: nushell doesn't have a NixOS module, only home-manager
  programs = {
    dconf.enable = true;
    fish.enable = true;
    bash.enable = true;
  };

  # ===== USER =====
  users.users.${username} = {
    isNormalUser = true;
    description = lib.mkDefault "${username}";
    extraGroups = [ "wheel" "networkmanager" "audio" "video" ];
    shell = pkgs.fish;  # Default to fish for better experience
  };

  # ===== ENVIRONMENT =====
  environment = {
    shells = with pkgs; [ bash fish nushell ];
    pathsToLink = [ "/share/fish" "/share/bash-completion" "/share/nushell" ];
    variables = {
      EDITOR = "nvim";
      BROWSER = "brave";
      TERMINAL = "alacritty";
    };
  };

  # ===== FONTS =====
  fonts.packages = with pkgs; [
    nerd-fonts.jetbrains-mono
    nerd-fonts.fira-code
  ];
}
