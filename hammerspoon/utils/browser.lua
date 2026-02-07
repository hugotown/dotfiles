-- ~/.config/hammerspoon/utils/browser.lua
-- Utilidades para abrir URLs en navegador y síntesis de voz
-- Funciones helper para navegación web y notificaciones de voz

local browser = {}

-- Dependencias
local config = require("config")

-- ============================================================================
-- FUNCIONES DE NAVEGADOR
-- ============================================================================

-- Abrir URL en el navegador configurado
function browser.openURL(url)
    hs.execute(string.format('open -a "%s" "%s"', config.browser, url))

    -- Dar foco al navegador después de un pequeño delay
    hs.timer.doAfter(0.3, function()
        local app = hs.application.get(config.browser)
        if app then
            app:activate()
        end
    end)
end

-- ============================================================================
-- FUNCIONES DE VOZ
-- ============================================================================

-- Hablar texto con la voz configurada (asíncrono)
function browser.speak(text)
    hs.execute(string.format('say -v %s "%s" &', config.voice, text))
end

return browser
