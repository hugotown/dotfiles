-- ~/.config/hammerspoon/utils/alerts.lua
-- Sistema de alertas con diferentes estilos visuales
-- Basado en el tema Tokyo Night

local alerts = {}

-- Dependencias
local theme = require("theme")

-- ============================================================================
-- FUNCIONES DE ALERTAS
-- ============================================================================

-- Alerta de éxito (verde)
function alerts.showSuccess(message, duration)
    duration = duration or 2
    hs.alert.show(message, {
        fillColor = {hex = theme.colors.green, alpha = 0.95},
        textColor = {hex = "#1a1b26", alpha = 1.0},
        radius = 16,
        padding = 24
    }, duration)
end

-- Alerta de error (rojo)
function alerts.showError(message, duration)
    duration = duration or 2
    hs.alert.show(message, {
        fillColor = {hex = theme.colors.red, alpha = 0.95},
        textColor = {hex = "#ffffff", alpha = 1.0},
        radius = 16,
        padding = 24
    }, duration)
end

-- Alerta de advertencia (amarillo)
function alerts.showWarning(message, duration)
    duration = duration or 2
    hs.alert.show(message, {
        fillColor = {hex = theme.colors.yellow, alpha = 0.95},
        textColor = {hex = "#1a1b26", alpha = 1.0},
        radius = 16,
        padding = 24
    }, duration)
end

-- Alerta informativa (azul)
function alerts.showInfo(message, duration)
    duration = duration or 2
    hs.alert.show(message, {
        fillColor = {hex = theme.colors.blue, alpha = 0.95},
        textColor = {hex = "#ffffff", alpha = 1.0},
        radius = 16,
        padding = 24
    }, duration)
end

return alerts
