# El archivo ~/.zoxide.nu se regenera automáticamente por hooks de nix-darwin
# Solo necesitamos verificar que exista, si no, generarlo como fallback
if not ("~/.zoxide.nu" | path exists) {
    print "⚠️  Generando zoxide.nu como fallback..."
    zoxide init nushell | save -f ~/.zoxide.nu
}
