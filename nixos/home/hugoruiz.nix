{ config, inputs, pkgs, lib, unstablePkgs, ... }:
{
  home.stateVersion = "24.05";

  home.homeDirectory = "/Users/hugoruiz";

  programs.home-manager.enable = true;
  programs.nix-index.enable = true;

  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };

  programs.bash = {
    enable = true;
    historyFileSize = 0;
    historySize = 0;
    initExtra = "unset HISTFILE";
  };

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    
    shellAliases = {
      ll = "eza -l --icons --git -a";
      lt = "eza --tree --level=2 --long --icons --git";
      cat = "bat --paging=never";
      grep = "rg";
      find = "fd";
    };
  };
  
  programs.atuin = {
    enable = true;
    enableBashIntegration = true;
    enableZshIntegration = true;
  };

  programs.eza = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
    icons = "auto";
    git = true;
    extraOptions = [
      "--group-directories-first"
      "--header"
      "--color=auto"
    ];
  };

  programs.fzf = {
    enable = true;
    enableBashIntegration = true;
    enableZshIntegration = true;
    defaultOptions = [
      "--no-mouse"
      "--height 50%"
      "--border"
    ];
  };

  programs.git = {
    enable = true;
    userEmail = "7987506+hugotown@users.noreply.github.com";
    userName = "Hugo Ruiz";
    extraConfig = {
      init = {
        defaultBranch = "main";
      };
      merge = {
        conflictStyle = "diff3";
      };
      pull = {
        rebase = true;
      };
      push = {
        autoSetupRemote = true;
      };
      core = {
        editor = "nvim";
      };
    };
  };

  programs.starship = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
  };
  
  programs.bat.enable = true;
  programs.ripgrep.enable = true;
  
  programs.zoxide = {
    enable = true;
    enableBashIntegration = true;
    enableZshIntegration = true;
    # Usa configuración por defecto
  };

  programs.alacritty.enable = true;
  
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
    vimdiffAlias = true;
  };

  home.packages = with pkgs; [
    # Additional packages that aren't covered by programs
    # Core CLI tools are managed in common-packages.nix for better system integration
  ];

  # Shell environment variables
  home.sessionVariables = {
    EDITOR = "nvim";
    BROWSER = "open";
    TERMINAL = "alacritty";
  };

  # Dotfile management
  home.file.".hushlogin".text = "";
}