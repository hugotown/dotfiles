{ inputs, outputs, config, lib, hostname, system, username, pkgs, ... }:
{
  # Primary user for services (skhd, yabai, etc.)
  system.primaryUser = username;

  users.users.${username}.home = "/Users/${username}";

  # ===== NIX SETTINGS =====
  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      warn-dirty = false;
      # Allow wheel users to use binary caches
      trusted-users = [ "root" "@wheel" username ];
    };
    channel.enable = false;

    # Automatic garbage collection (Tuesdays 10 AM, keep last 7 days)
    gc = {
      automatic = true;
      interval = { Weekday = 2; Hour = 10; Minute = 0; };
      options = "--delete-older-than 7d";
    };

    # Automatic store optimization
    optimise.automatic = true;
  };

  system.stateVersion = 5;

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

  # ===== SECURITY =====
  # Touch ID for sudo (convenience on macOS)
  security.pam.services.sudo_local.touchIdAuth = true;

  # ===== FONTS =====
  fonts.packages = [
    pkgs.nerd-fonts.jetbrains-mono
  ];

  # ===== SHELL PROGRAMS =====
  # Enable shells for proper environment integration and nix-index hooks
  programs.zsh.enable = true;
  programs.fish.enable = true;
  programs.nix-index.enable = true;

  # ===== SYSTEM DEFAULTS =====
  system.defaults = {
    # Dock
    dock = {
      autohide = true;
      show-recents = false;
      mru-spaces = false;
    };

    # Finder
    finder = {
      AppleShowAllExtensions = true;
      FXEnableExtensionChangeWarning = false;
      _FXShowPosixPathInTitle = true;
    };

    # Keyboard
    NSGlobalDomain = {
      KeyRepeat = 2;
      InitialKeyRepeat = 15;
      ApplePressAndHoldEnabled = false;
    };

    # Trackpad
    trackpad = {
      Clicking = true;
      TrackpadRightClick = true;
    };
  };

  system.defaults.CustomUserPreferences = {
  };

  # ===== SYSTEM PACKAGES (minimal rescue kit) =====
  environment.systemPackages = with pkgs; [
    vim
    git
    curl
    # Window management tools
    # sketchybar
    # skhd
    # yabai
  ];

  # ===== WINDOW MANAGEMENT SERVICES =====
  # User configures in ~/.config/skhd and ~/.config/yabai
  # services.skhd.enable = true;

  # services.yabai = {
  #   enable = true;
  #   enableScriptingAddition = true;
  # };
}
