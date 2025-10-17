{
  description = "hugotown nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, nix-darwin, nixpkgs, home-manager }:
  let
    configuration = { pkgs, ... }: {

      nixpkgs.config.allowUnfree = true;

      environment.systemPackages =
        [
          pkgs.alacritty
          pkgs.atuin
          pkgs.btop
          pkgs.eza
          pkgs.fastfetch
          pkgs.fd
          pkgs.fzf
          pkgs.gh
          pkgs.nushell
          pkgs.git
          pkgs.neovim
          pkgs.ripgrep
          pkgs.vim
          pkgs.zoxide
        ];

      fonts.packages = with pkgs; [
        nerd-fonts.jetbrains-mono
      ];

      programs.direnv = {
         enable = true;
         nix-direnv.enable = true;
      };

      nix.settings.experimental-features = "nix-command flakes";
      
      programs.bash = {
        enable = true;
      };

      users.users.hugoruiz.shell = pkgs.bash;

      home-manager.users.hugoruiz = import ./home.nix;

      system.configurationRevision = self.rev or self.dirtyRev or null;

      system.stateVersion = 6;

      nixpkgs.hostPlatform = "x86_64-darwin";
    };
  in
  {
    # Build darwin flake using:
    # sudo darwin-rebuild build --flake ~/.config/nixos#mp-i9-16i
    darwinConfigurations."mp-i9-16i" = nix-darwin.lib.darwinSystem {
      system = "x86_64-darwin";
      modules = [
        home-manager.darwinModules.home-manager
        configuration
      ];
    };

    # Expose the package set, including overlays, for convenience.
    darwinPackages = self.darwinConfigurations."mp-i9-16i".pkgs;
  };
}
