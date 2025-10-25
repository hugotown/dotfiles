local wezterm = require("wezterm")

-- Debug: confirmar que se está cargando el archivo
wezterm.log_info("🎉 Cargando configuración desde: " .. (wezterm.config_file or "ubicación desconocida"))

local config = wezterm.config_builder()

config.color_scheme = "Tokyo Night"

config.font = wezterm.font("JetBrainsMono Nerd Font")

config.font_size = 17
config.enable_tab_bar = false

config.window_decorations = "RESIZE"

config.window_background_opacity = 0.8
config.macos_window_background_blur = 10

-- ✅ VERSIÓN CORREGIDA: Maximizar ventana al iniciar
local mux = wezterm.mux
wezterm.on("gui-startup", function(cmd)
	local tab, pane, window = mux.spawn_window(cmd or {})
	window:gui_window():maximize()
end)

return config
