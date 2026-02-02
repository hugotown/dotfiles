{ inputs, outputs, ... }:
{
  mkDarwin = { hostname, username ? "hugoruiz", system ? "x86_64-darwin" }:
    inputs.nix-darwin.lib.darwinSystem {
      inherit system;
      specialArgs = { inherit system inputs outputs username hostname; };
      modules = [
        ../hosts/common/common-packages.nix
        ../hosts/common/darwin-common.nix
        # Fail explicitly if host path doesn't exist (no silent fallback)
        ../hosts/darwin/${hostname}/default.nix
        inputs.home-manager.darwinModules.home-manager
        {
          networking.hostName = hostname;
          home-manager = {
            useGlobalPkgs = true;
            useUserPackages = true;
            backupFileExtension = "backup";
            # Pass full context to home-manager modules
            extraSpecialArgs = { inherit inputs outputs username hostname system; };
            users.${username} = {
              imports = [ ../hosts/darwin/${hostname}/home/${username}/home.nix ];
            };
          };
        }
      ];
    };

  mkNixOS = { hostname, username ? "hugoruiz", system ? "x86_64-linux" }:
    inputs.nixpkgs.lib.nixosSystem {
      inherit system;
      specialArgs = { inherit system inputs outputs username hostname; };
      modules = [
        ../hosts/nixos/${hostname}/default.nix
        inputs.home-manager.nixosModules.home-manager
        {
          home-manager = {
            useGlobalPkgs = true;
            useUserPackages = true;
            backupFileExtension = "backup";
            # Pass full context to home-manager modules
            extraSpecialArgs = { inherit inputs outputs username hostname system; };
            users.${username} = {
              imports = [ ../hosts/nixos/${hostname}/home/${username}/home.nix ];
            };
          };
        }
      ];
    };
}
