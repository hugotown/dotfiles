{ inputs, pkgs, ... }:
{
  environment.systemPackages = with pkgs; [
    ## CLI tools básicos
    alacritty
    neovim
    curl
    wget
    tree
  ];
}
