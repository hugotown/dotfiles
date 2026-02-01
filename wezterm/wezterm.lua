local wezterm = require("wezterm")

-- Debug: confirmar que se está cargando el archivo
wezterm.log_info("🎉 Cargando configuración desde: " .. (wezterm.config_file or "ubicación desconocida"))

local config = wezterm.config_builder()

config.color_scheme = "Tokyo Night"

config.font = wezterm.font("JetBrainsMono Nerd Font")

config.font_size = 17

-- Tab bar minimalista y delgado
config.enable_tab_bar = true
config.use_fancy_tab_bar = false
config.tab_bar_at_bottom = false
config.hide_tab_bar_if_only_one_tab = false
config.tab_max_width = 25
config.show_new_tab_button_in_tab_bar = false
config.show_tab_index_in_tab_bar = true

-- Formato personalizado para tabs ultra-minimalistas
wezterm.on("format-tab-title", function(tab, tabs, panes, config, hover, max_width)
	local title = tab.active_pane.title
	-- Truncar título si es muy largo
	if #title > 15 then
		title = title:sub(1, 14) .. "…"
	end
	local index = tab.tab_index + 1
	return " " .. index .. ":" .. title .. " "
end)

config.colors = {
	tab_bar = {
		background = "#16161e",
		active_tab = {
			bg_color = "#1a1b26",
			fg_color = "#c0caf5",
			intensity = "Normal",
			underline = "None",
			italic = false,
			strikethrough = false,
		},
		inactive_tab = {
			bg_color = "#16161e",
			fg_color = "#565f89",
		},
		inactive_tab_hover = {
			bg_color = "#1a1b26",
			fg_color = "#7aa2f7",
		},
		new_tab = {
			bg_color = "#16161e",
			fg_color = "#565f89",
		},
		new_tab_hover = {
			bg_color = "#1a1b26",
			fg_color = "#7aa2f7",
		},
	},
}

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
