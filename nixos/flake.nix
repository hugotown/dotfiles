{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # Nixpkgs Unstable unificado para todo
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # nix-darwin - usar master para mejor soporte con unstable
    nix-darwin.url = "github:lnl7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    # Home Manager - unstable branch para ambas plataformas
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, nix-darwin, home-manager, ... }@inputs:
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
        # lenovo laptop - hugoruiz - USING OLD WORKING CONFIGURATION
        lenovo-nixos-btw = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            ./hosts/nixos/lenovo-nixos-btw/default.nix
            home-manager.nixosModules.home-manager
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
