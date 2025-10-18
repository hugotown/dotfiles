{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # Nixpkgs unstable para ambos sistemas
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-darwin.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    # nix-darwin
    nix-darwin.url = "github:lnl7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs-darwin";

    # Home Manager unstable unificado
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { ... }@inputs:
    with inputs;
    let
      inherit (self) outputs;
      
      stateVersion = "25.05";
      libx = import ./lib { inherit inputs outputs stateVersion; };

    in {

      darwinConfigurations = {
        # personal machine - hugoruiz
        mp-i9-16i = libx.mkDarwin { 
          hostname = "mp-i9-16i"; 
          username = "hugoruiz";
          system = "x86_64-darwin";
        };
        
        # alejandra's machine (example configuration)
        # alejandra-macbook = libx.mkDarwin { 
        #   hostname = "alejandra-macbook"; 
        #   username = "alejandra";
        #   system = "x86_64-darwin";
        # };
      };

      nixosConfigurations = {
        # lenovo laptop - hugoruiz (nueva configuración con Hyprland)
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
        
        # alejandra's linux machine (example configuration)
        # alejandra-thinkpad = libx.mkNixos {
        #   hostname = "alejandra-thinkpad";
        #   username = "alejandra";
        #   system = "x86_64-linux";
        # };
      };

    };
}
