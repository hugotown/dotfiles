function on_exit --on-event fish_exit
    echo fish is now exiting
end

# Configuración de zoxide - el archivo ~/.zoxide.fish se regenera automáticamente por hooks de nix-darwin
if test -f ~/.zoxide.fish
    source ~/.zoxide.fish
else
    # Fallback: usar aliases manuales si el archivo no existe
    echo "⚠️  Usando zoxide fallback aliases..."
    abbr --erase z &>/dev/null
    alias z=__zoxide_z
    
    abbr --erase zi &>/dev/null
    alias zi=__zoxide_zi
end

source ~/.yazi.fish

source ~/.ncrs.fish

source ~/.cldy.fish
