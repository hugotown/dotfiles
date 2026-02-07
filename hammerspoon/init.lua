-- ~/.config/hammerspoon/init.lua
-- Configuración modular de Hammerspoon
-- Arquitectura: módulos separados, init.lua solo como activador

-- ============================================================================
-- CARGAR CONFIGURACIÓN Y TEMA
-- ============================================================================

local config = require("config")
local theme = require("theme")

-- Aplicar tema Tokyo Night
theme.apply()

-- ============================================================================
-- CARGAR MÓDULOS
-- ============================================================================

local workspace = require("modules.workspace")
local research = require("modules.research")

-- ============================================================================
-- ATAJOS DE TECLADO
-- ============================================================================

-- Hyper + W: Abrir Work Launcher
hs.hotkey.bind(config.hyper, "W", workspace.show)

-- Hyper + P: Abrir Research & Documentation Launcher
hs.hotkey.bind(config.hyper, "P", research.show)

-- ⌘⌥⌃R: Recargar Hammerspoon manualmente
hs.hotkey.bind({"cmd", "alt", "ctrl"}, "R", hs.reload)

-- ============================================================================
-- RECARGA AUTOMÁTICA
-- ============================================================================

if config.reload.enabled then
    local function reloadConfig(files)
        local doReload = false
        for _, file in pairs(files) do
            if file:sub(-4) == ".lua" then
                doReload = true
            end
        end
        if doReload then
            hs.reload()
        end
    end

    local configWatcher = hs.pathwatcher.new(config.reload.watchPath, reloadConfig)
    configWatcher:start()
end

-- ============================================================================
-- NOTIFICACIÓN DE INICIO
-- ============================================================================

if config.reload.notification then
    hs.notify.new({
        title = "Hammerspoon Listo",
        informativeText = "Hyper + W: Work | Hyper + P: Research",
        withdrawAfter = 3
    }):send()

    hs.alert.show("Hammerspoon cargado ✓", 1.5)
end

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("✅ Hammerspoon configurado correctamente")
print("📍 Config: ~/.config/hammerspoon/")
print("Hyper + W      - Work Launcher")
print("Hyper + P      - Research & Documentation")
print("⌘⌥⌃R           - Recargar Hammerspoon")
print("🏢             - Ícono en barra de menú")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
