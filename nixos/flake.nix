{
  description = "hugotown nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.11-darwin";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    home-manager.url = "github:nix-community/home-manager/release-24.11";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, nix-darwin, nixpkgs, home-manager }:
  let
    homeConfiguration = import ./home.nix;
  in
  {
    # Build darwin flake using:
    # sudo darwin-rebuild build --flake ~/.config/nixos#mp-i9-16i
    darwinConfigurations."mp-i9-16i" = nix-darwin.lib.darwinSystem {
      system = "x86_64-darwin";
      modules = [
        home-manager.darwinModules.home-manager
        
        # This is the module that defines your system configuration
        ({ pkgs, ... }: {
          nixpkgs.config.allowUnfree = true;

          environment.systemPackages = with pkgs; [
            alacritty
            atuin
            btop
            eza
            fastfetch
            fd
            fzf
            gh
            nushell
            git
            neovim
            ripgrep
            vim
            zoxide
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

          users.users.hugoruiz = {
            shell = pkgs.bash;
            home = "/Users/hugoruiz";
          };

          home-manager.users.hugoruiz = homeConfiguration;

          system.configurationRevision = self.rev or self.dirtyRev or null;

          system.stateVersion = 6;

          nixpkgs.hostPlatform = "x86_64-darwin";
        })
      ];
    };

    # Expose the package set, including overlays, for convenience.
    darwinPackages = self.darwinConfigurations."mp-i9-16i".pkgs;
  };
}
