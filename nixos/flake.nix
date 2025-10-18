{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # Nixpkgs para Darwin - usar la rama específica de darwin 24.11
    nixpkgs-darwin.url = "github:NixOS/nixpkgs/nixpkgs-24.11-darwin";
    
    # Unstable nixpkgs - para paquetes específicos que necesites más actualizados
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";
    
    # Alias para compatibilidad
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.11-darwin";

    # nix-darwin con la rama correspondiente a 24.11
    nix-darwin.url = "github:lnl7/nix-darwin/nix-darwin-24.11";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs-darwin";

    # Home Manager correspondiente a 24.11
    home-manager.url = "github:nix-community/home-manager/release-24.11";
    home-manager.inputs.nixpkgs.follows = "nixpkgs-darwin";
  };

  outputs = { ... }@inputs:
    with inputs;
    let
      inherit (self) outputs;
      
      stateVersion = "24.05";
      libx = import ./lib { inherit inputs outputs stateVersion; };

    in {

      darwinConfigurations = {
        # personal machine
        mp-i9-16i = libx.mkDarwin { 
          hostname = "mp-i9-16i"; 
          username = "hugoruiz";
          system = "x86_64-darwin";
        };
      };

    };
}
