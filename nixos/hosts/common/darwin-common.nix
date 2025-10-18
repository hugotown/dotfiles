{ inputs, outputs, config, lib, hostname, system, username, pkgs, ... }:
{
  users.users.${username}.home = "/Users/${username}";

  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      warn-dirty = false;
    };
    channel.enable = false;
  };
  system.stateVersion = 5;

  # Set primary user for system-wide activation
  # system.primaryUser = username;

  fonts.packages = [
    # pkgs.nerd-fonts.fira-code
    # pkgs.nerd-fonts.fira-mono
    # pkgs.nerd-fonts.hack
    # pkgs.nerd-fonts.jetbrains-mono
  ];

  # pins to stable darwin channel
  nix.registry = {
    n.to = {
      type = "path";
      path = inputs.nixpkgs-darwin;
    };
  };

  nixpkgs = {
    config.allowUnfree = true;
    hostPlatform = lib.mkDefault "${system}";
  };

  # Shell programs are configured in home-manager for better user-specific customization

  # Add ability to used TouchID for sudo authentication
  # security.pam.services.sudo_local.touchIdAuth = true;

  # macOS configuration
  system.defaults = {
  };

  system.defaults.CustomUserPreferences = {
  };

  # Additional system configurations
  system.defaults.trackpad = {
  };

  programs.nix-index.enable = true;

  programs.zsh = {
    enable = true;
    enableCompletion = true;
  };

  environment.systemPackages = with pkgs; [
    # macOS-specific tools only
    # nix             # Nix package manager (self-reference for system)
  ];

}