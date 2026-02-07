-- ~/.config/hammerspoon/theme.lua
-- Tema Tokyo Night para Hammerspoon
-- Paleta de colores y estilos de alertas

local theme = {}

-- ============================================================================
-- PALETA DE COLORES TOKYO NIGHT
-- ============================================================================

theme.colors = {
    -- Colores principales
    bg = "#24283b",           -- Background
    bg_dark = "#1f2335",      -- Background oscuro
    fg = "#c0caf5",           -- Foreground/texto

    -- Colores de acento
    blue = "#7aa2f7",         -- Azul
    cyan = "#7dcfff",         -- Cyan
    purple = "#bb9af7",       -- Púrpura
    green = "#9ece6a",        -- Verde
    yellow = "#e0af68",       -- Amarillo
    orange = "#ff9e64",       -- Naranja
    red = "#f7768e",          -- Rojo

    -- Colores secundarios
    comment = "#565f89",      -- Gris para comentarios
    dark3 = "#545c7e",        -- Gris oscuro
}

-- ============================================================================
-- CONFIGURACIÓN DE ESTILOS DE ALERTAS
-- ============================================================================

-- Aplicar estilo Tokyo Night a las alertas de Hammerspoon
function theme.apply()
    hs.alert.defaultStyle = {
        -- Colores
        strokeWidth = 0,
        fillColor = {hex = theme.colors.bg, alpha = 0.95},
        textColor = {hex = theme.colors.cyan, alpha = 1.0},

        -- Tipografía
        textFont = ".AppleSystemUIFont",
        textSize = 20,

        -- Forma
        radius = 16,
        padding = 24,

        -- Animaciones
        fadeInDuration = 0.2,
        fadeOutDuration = 0.3,

        -- Posición
        atScreenEdge = 0,  -- 0 = centro de pantalla
    }
end

return theme
