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

  fonts.packages = [
    # pkgs.nerd-fonts.fira-code
    # pkgs.nerd-fonts.fira-mono
    # pkgs.nerd-fonts.hack
    # pkgs.nerd-fonts.jetbrains-mono
  ];

  # Pin registry to unstable
  nix.registry = {
    n.to = {
      type = "path";
      path = inputs.nixpkgs;
    };
  };

  nixpkgs = {
    config.allowUnfree = true;
    hostPlatform = lib.mkDefault "${system}";
  };

  system.defaults = {
  };

  system.defaults.CustomUserPreferences = {
  };

  system.defaults.trackpad = {
  };

  programs.nix-index.enable = true;

  programs.zsh = {
    enable = true;
    enableCompletion = true;
  };

  environment.systemPackages = with pkgs; [
    # macOS-specific tools only
  ];
}
