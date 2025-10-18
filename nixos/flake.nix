{
  description = "hugotown nix-darwin system flake";

  inputs = {
    # Stable nixpkgs - base sólida para el sistema
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    
    # Unstable nixpkgs - para paquetes específicos que necesites más actualizados
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";
    
    # Usar stable para darwin como base (evita problemas como nokogiri)
    nixpkgs-darwin.url = "github:NixOS/nixpkgs/nixos-24.11";

    nix-darwin.url = "github:lnl7/nix-darwin";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs-darwin";

    home-manager.url = "github:nix-community/home-manager";
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
