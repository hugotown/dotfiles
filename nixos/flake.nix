{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # Nixpkgs Unstable para Darwin (latest)
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # Nixpkgs Unstable para NixOS - pinned to Oct 9, 2025 (pre-CMake-4)
    # Commit: 0b4defa2584313f3b781240b29d61f6f9f7e0df3
    # This avoids fcitx5-qt6 build failures from CMake 4 update
    nixpkgs-nixos.url = "github:NixOS/nixpkgs/0b4defa2584313f3b781240b29d61f6f9f7e0df3";

    # nix-darwin - usar master para mejor soporte con unstable
    nix-darwin.url = "github:lnl7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    # Home Manager - unstable branch para ambas plataformas
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # Home Manager for NixOS - follows nixpkgs-nixos
    home-manager-nixos.url = "github:nix-community/home-manager";
    home-manager-nixos.inputs.nixpkgs.follows = "nixpkgs-nixos";
  };

  outputs = { self, nixpkgs, nixpkgs-nixos, nix-darwin, home-manager, home-manager-nixos, ... }@inputs:
    let
      inherit (self) outputs;
      libx = import ./lib { inherit inputs outputs; };
    in {

      darwinConfigurations = {
        # personal machine - hugoruiz
        mp-i9-16i = libx.mkDarwin {
          hostname = "mp-i9-16i";
          username = "hugoruiz";
          system = "x86_64-darwin";
        };
      };

      nixosConfigurations = {
        # lenovo laptop - hugoruiz - Using pinned nixpkgs-nixos (pre-CMake-4)
        lenovo-nixos-btw = nixpkgs-nixos.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            ./hosts/nixos/lenovo-nixos-btw/default.nix
            home-manager-nixos.nixosModules.home-manager
            {
              home-manager = {
                useGlobalPkgs = true;
                useUserPackages = true;
                users.hugoruiz = import ./hosts/nixos/lenovo-nixos-btw/home/hugoruiz/home.nix;
                backupFileExtension = "backup";
              };
            }
          ];
        };
      };

    };
}
