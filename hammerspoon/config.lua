-- ~/.config/hammerspoon/config.lua
-- Configuración centralizada de Hammerspoon
-- Todas las constantes y configuraciones del sistema

local config = {
    -- Voz para notificaciones de texto a voz
    voice = "Samantha",  -- US English female voice

    -- Navegador predeterminado
    browser = "Microsoft Edge",

    -- Editor de código predeterminado
    editor = "Visual Studio Code",

    -- Hyper Key: Combinación de modificadores para todos los atajos
    -- En macOS, típicamente Caps Lock se mapea a ⌘⌥⌃⇧
    hyper = {"cmd", "alt", "ctrl", "shift"},

    -- Configuración de recarga automática
    reload = {
        enabled = true,
        watchPath = os.getenv("HOME") .. "/.config/hammerspoon/",
        notification = true
    }
}

return config
