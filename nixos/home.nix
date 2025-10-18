{ config, pkgs, ... }:

{
  programs.home-manager.enable = true;
  
  # Especificar explícitamente el homeDirectory para macOS
  home.homeDirectory = "/Users/hugoruiz";
  
  programs.bash = {
    enable = true;
    historyFileSize = 0;
    historySize = 0;
    initExtra = "unset HISTFILE";
  };
  
  programs.atuin = {
    enable = true;
    enableBashIntegration = true;

    settings = {
      auto_sync = true;
      style = "compact";
    };
  };

  home.packages = [
  ];

  home.stateVersion = "24.05";
}
