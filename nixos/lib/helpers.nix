{ inputs, outputs, stateVersion, ... }:
{
  mkDarwin = { hostname, username ? "hugoruiz", system ? "x86_64-darwin",}:
  let
    inherit (inputs.nixpkgs-darwin) lib;
    # Paquetes unstable unificados
    pkgs = inputs.nixpkgs-darwin.legacyPackages.${system};
    customConfPath = ./../hosts/darwin/${hostname};
    customConf = if builtins.pathExists (customConfPath) then (customConfPath + "/default.nix") else ./../hosts/common/darwin-common-dock.nix;
  in
    inputs.nix-darwin.lib.darwinSystem {
      specialArgs = { inherit system inputs outputs username pkgs hostname; };
      modules = [
        ../hosts/common/common-packages.nix
        ../hosts/common/darwin-common.nix
        customConf
        inputs.home-manager.darwinModules.home-manager {
            networking.hostName = hostname;
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.backupFileExtension = "backup";
            home-manager.extraSpecialArgs = { inherit inputs; };
            home-manager.users.${username} = { imports = [ ./../../hosts/darwin/${hostname}/home/${username}/home.nix ]; };
        }

      ];
    };
}