# ==== YAZI FIX: Wrapper function para Nushell ====
# Archivo: ~/.config/yazi/yazi-nushell-wrapper.nu
# Para instalar: Agregar al final de ~/.config/nushell/config.nu:
#   source ~/.config/yazi/yazi-nushell-wrapper.nu
# Instalado: Octubre 25, 2025

# Problema: Yazi puede tener problemas de input de teclado en Nushell
# Solución: Wrapper function que ejecuta Yazi con soporte para cambio de directorio

# Función principal de Yazi con soporte para cd
def --env yazi [...args] {
    # Crear archivo temporal para guardar el directorio de salida
    let tmp = (mktemp -t "yazi-cwd.XXXXXX")
    
    # Ejecutar yazi (usar ^yazi para llamar al binario externo, no recursivo)
    ^yazi ...$args --cwd-file $tmp
    
    # Leer el directorio donde quedó Yazi
    let cwd = (open $tmp | str trim)
    
    # Cambiar al directorio si es diferente al actual
    if $cwd != "" and $cwd != $env.PWD {
        cd $cwd
    }
    
    # Limpiar archivo temporal
    rm -f $tmp
}

# Alias opcional: usar 'y' como atajo
# Descomenta la siguiente línea si quieres usar 'y' en lugar de 'yazi'
# alias y = yazi

# Nota: Nushell maneja TTY de forma diferente a Fish/Zsh
# Por lo general no necesita el fix de stty -ixon, pero si tienes
# problemas de input, puedes ejecutar antes de abrir Yazi:
# ^stty -ixon; yazi
