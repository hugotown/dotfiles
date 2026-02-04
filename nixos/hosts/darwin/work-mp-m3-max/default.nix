{ pkgs, ... }:
{
  imports = [
    ./custom-dock.nix
  ];

  # ===== HOMEBREW & MAS APPS (host-specific) =====
  homebrew = {
    enable = true;
    onActivation = {
      autoUpdate = true;
      cleanup = "zap";  # Remove apps not in config
    };

    # Mac App Store apps (get IDs with: mas search <app>)
    masApps = {
      "Xcode" = 497799835;
      "Telegram" = 747648890;
      "Apple Creator Studio" = 1868448255;
      "MainStage" = 6746637089;
      "Compressor" = 6746516157;
      "Motion" = 6746637149;
      "Numbers" = 361304891;
      "Pages" = 361309726;
      "Keynote" = 361285480;
      "Pixelmator Pro" = 6746662575;
      "Logic Pro" = 1615087040;
      "Final Cut Pro" = 1631624924;
    };

    # Homebrew casks (GUI apps not in nixpkgs)
    casks = [
      "microsoft-edge"
      "antigravity"
      "ghostty"
    ];

    # Homebrew formulae (CLI tools not in nixpkgs)
    brews = [
    ];
  };

  # ===== HOST-SPECIFIC PACKAGES =====
  environment.systemPackages = with pkgs; [
  ];
}
