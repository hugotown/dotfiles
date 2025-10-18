{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    just
    nixfmt
    nix-prefetch-git
  ];
  
  shellHook = ''
    echo "🚀 Nix-Darwin Development Environment"
    echo "Available commands:"
    echo "  just - Build and manage system"
    echo "  nixfmt - Format nix files"
    echo ""
  '';
}