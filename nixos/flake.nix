{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # NixOS - Unstable (como en out.nix que funciona)
    nixpkgs.url = "nixpkgs/nixos-unstable";
    
    # Darwin - Estable 24.11
    nixpkgs-darwin.url = "github:NixOS/nixpkgs/nixpkgs-24.11-darwin";

    # nix-darwin estable
    nix-darwin.url = "github:lnl7/nix-darwin/nix-darwin-24.11";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs-darwin";

    # Home Manager para NixOS - 25.05
    home-manager-nixos.url = "github:nix-community/home-manager/release-25.05";
    home-manager-nixos.inputs.nixpkgs.follows = "nixpkgs";
    
    # Home Manager para Darwin - estable 24.11
    home-manager-darwin.url = "github:nix-community/home-manager/release-24.11";
    home-manager-darwin.inputs.nixpkgs.follows = "nixpkgs-darwin";
  };

  outputs = { ... }@inputs:
    with inputs;
    let
      inherit (self) outputs;
      
      # stateVersion se maneja por separado en cada configuración
      libx = import ./lib { inherit inputs outputs; };

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
        
        # alejandra's linux machine (example configuration)
        # alejandra-thinkpad = nixpkgs.lib.nixosSystem {
        #   system = "x86_64-linux";
        #   modules = [
        #     ./hosts/nixos/alejandra-thinkpad/default.nix
        #     home-manager-nixos.nixosModules.home-manager
        #     {
        #       home-manager = {
        #         useGlobalPkgs = true;
        #         useUserPackages = true;
        #         users.alejandra = import ./hosts/nixos/alejandra-thinkpad/home/alejandra/home.nix;
        #         backupFileExtension = "backup";
        #       };
        #     }
        #   ];
        # };
      };

    };
}
