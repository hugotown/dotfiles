-- ~/.config/hammerspoon/init.lua
-- Configuración portable de atajos de trabajo
-- Repo: https://github.com/tuusuario/dotfiles

-- ============================================================================
-- CONFIGURACIÓN
-- ============================================================================

local VOICE = "Paulina"  -- Voz para notificaciones (Paulina = español México)
local BROWSER = "Microsoft Edge"  -- Navegador a usar

-- ============================================================================
-- HERRAMIENTAS DE TRABAJO
-- ============================================================================

local workTools = {
    {
        text = "📊 Workspace",
        subText = "Google Workspace Dashboard",
        url = "https://workspace.google.com/dashboard",
        voice = "Abriendo Workspace"
    },
    {
        text = "📅 Calendar",
        subText = "Google Calendar - Week View",
        url = "https://calendar.google.com/calendar/u/0/r/week",
        voice = "Abriendo Calendar"
    },
    {
        text = "💬 Chat",
        subText = "Gmail Chat Interface",
        url = "https://mail.google.com/chat/u/0",
        voice = "Abriendo Chat"
    },
    {
        text = "📧 Mail",
        subText = "Gmail Inbox",
        url = "https://mail.google.com/mail/u/0",
        voice = "Abriendo Mail"
    },
    {
        text = "🗄️ MongoDB",
        subText = "Cloud MongoDB Projects",
        url = "https://cloud.mongodb.com/v2#/org/67e714e952c7cc3c8732b308/projects",
        voice = "Abriendo MongoDB"
    },
    {
        text = "📂 Repo",
        subText = "GitHub - Avantech Developers",
        url = "https://github.com/AvantechDevelopers",
        voice = "Abriendo repositorio"
    },
    {
        text = "💼 LinkedIn",
        subText = "LinkedIn Feed",
        url = "https://www.linkedin.com/feed",
        voice = "Abriendo LinkedIn"
    },
    {
        text = "🤖 Claude Console",
        subText = "Claude Platform Dashboard",
        url = "https://platform.claude.com/dashboard",
        voice = "Abriendo Claude Console"
    },
    {
        text = "💡 Claude AI",
        subText = "Claude AI Chat - New Conversation",
        url = "https://claude.ai/new",
        voice = "Abriendo Claude AI"
    },
    {
        text = "🚀 Abrir Todo",
        subText = "Abrir todas las herramientas de trabajo",
        special = "all",
        voice = "Abriendo todas las herramientas"
    },
}

-- ============================================================================
-- FUNCIONES HELPER
-- ============================================================================

-- Abrir URL en el navegador configurado
local function openInBrowser(url)
    hs.execute(string.format('open -a "%s" "%s"', BROWSER, url))

    -- Dar foco al navegador después de un pequeño delay
    hs.timer.doAfter(0.3, function()
        local app = hs.application.get(BROWSER)
        if app then
            app:activate()
        end
    end)
end

-- Hablar texto con la voz configurada
local function speak(text)
    hs.execute(string.format('say -v %s "%s" &', VOICE, text))
end

-- Abrir herramienta seleccionada
local function openTool(tool)
    if not tool then return end

    if tool.special == "all" then
        -- Abrir todas las herramientas
        speak(tool.voice)
        for _, t in ipairs(workTools) do
            if t.url then
                openInBrowser(t.url)
            end
        end
        -- Notificación de completado después de 2 segundos
        hs.timer.doAfter(2, function()
            speak("Listo, todas las herramientas están abiertas")
        end)
    else
        -- Abrir herramienta individual
        openInBrowser(tool.url)
        speak(tool.voice)
    end
end

-- ============================================================================
-- MENÚ VISUAL (CHOOSER)
-- ============================================================================

-- Crear el chooser (menú tipo Spotlight)
local workChooser = hs.chooser.new(function(choice)
    if choice then
        openTool(choice)
    end
end)

-- Configurar apariencia
workChooser:width(25)  -- Ancho en porcentaje de la pantalla
workChooser:rows(10)   -- Máximo de filas visibles
workChooser:searchSubText(true)  -- Buscar también en subtítulos
workChooser:choices(workTools)

-- Función para mostrar el menú
local function showWorkMenu()
    workChooser:show()
end

-- ============================================================================
-- ATAJOS DE TECLADO
-- ============================================================================

-- Hyper Key (Caps Lock + W) - Mostrar menú de trabajo
-- Hyper = ⌘⌥⌃⇧ (Command + Option + Control + Shift)
local hyper = {"cmd", "alt", "ctrl", "shift"}

hs.hotkey.bind(hyper, "W", showWorkMenu)

-- Opcional: Atajos directos individuales con Hyper Key (descomenta para usar)
-- hs.hotkey.bind(hyper, "1", function() openTool(workTools[1]) end)  -- Caps Lock + 1 = Workspace
-- hs.hotkey.bind(hyper, "2", function() openTool(workTools[2]) end)  -- Caps Lock + 2 = Calendar
-- hs.hotkey.bind(hyper, "3", function() openTool(workTools[3]) end)  -- Caps Lock + 3 = Chat

-- ============================================================================
-- ÍCONO EN BARRA DE MENÚ (OPCIONAL)
-- ============================================================================

local menubar = hs.menubar.new()
if menubar then
    menubar:setTitle("🏢")
    menubar:setTooltip("Work Launcher (Caps Lock + W)")
    menubar:setMenu({
        { title = "Abrir Work Launcher", fn = showWorkMenu },
        { title = "-" },
        { title = "Workspace", fn = function() openTool(workTools[1]) end },
        { title = "Calendar", fn = function() openTool(workTools[2]) end },
        { title = "Chat", fn = function() openTool(workTools[3]) end },
        { title = "Mail", fn = function() openTool(workTools[4]) end },
        { title = "-" },
        { title = "Recargar Hammerspoon", fn = hs.reload, shortcut = "⌘⌥⌃R" },
        { title = "Editar Configuración", fn = function()
            hs.execute('open -a "Visual Studio Code" ~/.config/hammerspoon/init.lua')
        end },
    })
end

-- ============================================================================
-- RECARGA AUTOMÁTICA
-- ============================================================================

-- Recargar Hammerspoon cuando se modifique init.lua
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

local configWatcher = hs.pathwatcher.new(os.getenv("HOME") .. "/.config/hammerspoon/", reloadConfig)
configWatcher:start()

-- ⌘⌥⌃R - Recargar manualmente
hs.hotkey.bind({"cmd", "alt", "ctrl"}, "R", function()
    hs.reload()
end)

-- ============================================================================
-- NOTIFICACIÓN DE INICIO
-- ============================================================================

hs.notify.new({
    title = "Hammerspoon Listo",
    informativeText = "Presiona Caps Lock + W para abrir Work Launcher",
    withdrawAfter = 3
}):send()

hs.alert.show("Hammerspoon cargado ✓", 1)

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("✅ Hammerspoon configurado correctamente")
print("📍 Config: ~/.config/hammerspoon/init.lua")
print("Caps Lock + W  - Work Launcher (menú)")
print("⌘⌥⌃R           - Recargar Hammerspoon")
print("🏢             - Ícono en barra de menú")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
