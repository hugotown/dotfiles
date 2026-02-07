-- ~/.config/hammerspoon/modules/research.lua
-- Módulo de Research & Documentation Launcher
-- Menú de herramientas de investigación y documentación accesible vía Hyper+P

local research = {}

-- Dependencias
local config = require("config")
local theme = require("theme")

-- ============================================================================
-- CONFIGURACIÓN ENCAPSULADA DEL MÓDULO
-- ============================================================================

local moduleConfig = {
    voice = "Victoria",  -- US English female voice for this module
    browser = "Safari"  -- Safari specifically for research
}

-- ============================================================================
-- DATOS DE HERRAMIENTAS DE INVESTIGACIÓN
-- ============================================================================

local researchTools = {
    {
        text = "🔍 Safari",
        subText = "Open Safari for research",
        app = "Safari",
        voice = "Opening Safari for research"
    }
}

-- ============================================================================
-- FUNCIONES PRIVADAS
-- ============================================================================

-- Función de voz encapsulada para este módulo
local function speak(text)
    hs.execute(string.format('say -v %s "%s" &', moduleConfig.voice, text))
end

-- Abrir aplicación
local function openApp(appName)
    hs.application.launchOrFocus(appName)
end

-- Abrir herramienta seleccionada
local function openTool(tool)
    if not tool then return end

    if tool.app then
        openApp(tool.app)
        speak(tool.voice)
    end
end

-- ============================================================================
-- MENÚ VISUAL (CHOOSER)
-- ============================================================================

-- Crear el chooser (menú tipo Spotlight)
local researchChooser = hs.chooser.new(function(choice)
    if choice then
        openTool(choice)
    end
end)

-- Configurar apariencia y tema Tokyo Night
researchChooser:width(25)  -- Ancho en porcentaje de la pantalla
researchChooser:rows(10)   -- Máximo de filas visibles
researchChooser:searchSubText(true)  -- Buscar también en subtítulos
researchChooser:choices(researchTools)

-- Aplicar tema Tokyo Night al chooser
researchChooser:bgDark(true)
researchChooser:fgColor({hex = theme.colors.cyan})
researchChooser:subTextColor({hex = theme.colors.purple, alpha = 0.8})
researchChooser:placeholderText("🔍 Search research tool...")

-- ============================================================================
-- API PÚBLICA DEL MÓDULO
-- ============================================================================

-- Mostrar el menú de research
function research.show()
    researchChooser:show()
end

return research
