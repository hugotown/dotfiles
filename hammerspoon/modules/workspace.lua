-- ~/.config/hammerspoon/modules/workspace.lua
-- Módulo de Work Launcher
-- Menú de herramientas de trabajo accesible vía Hyper+W

local workspace = {}

-- Dependencias
local config = require("config")
local theme = require("theme")
local browser = require("utils.browser")

-- ============================================================================
-- CONFIGURACIÓN ENCAPSULADA DEL MÓDULO
-- ============================================================================

local moduleConfig = {
    voice = "Samantha"  -- US English female voice for this module
}

-- ============================================================================
-- DATOS DE HERRAMIENTAS DE TRABAJO
-- ============================================================================

local workTools = {
    {
        text = "📊 Workspace",
        subText = "Google Workspace Dashboard",
        url = "https://workspace.google.com/dashboard",
        voice = "Opening Workspace"
    },
    {
        text = "📅 Calendar",
        subText = "Google Calendar - Week View",
        url = "https://calendar.google.com/calendar/u/0/r/week",
        voice = "Opening Calendar"
    },
    {
        text = "💬 Chat",
        subText = "Gmail Chat Interface",
        url = "https://mail.google.com/chat/u/0",
        voice = "Opening Chat"
    },
    {
        text = "📧 Mail",
        subText = "Gmail Inbox",
        url = "https://mail.google.com/mail/u/0",
        voice = "Opening Mail"
    },
    {
        text = "🗄️ MongoDB",
        subText = "Cloud MongoDB Projects",
        url = "https://cloud.mongodb.com/v2#/org/67e714e952c7cc3c8732b308/projects",
        voice = "Opening MongoDB"
    },
    {
        text = "📂 Repo",
        subText = "GitHub - Avantech Developers",
        url = "https://github.com/AvantechDevelopers",
        voice = "Opening repository"
    },
    {
        text = "💼 LinkedIn",
        subText = "LinkedIn Feed",
        url = "https://www.linkedin.com/feed",
        voice = "Opening LinkedIn"
    },
    {
        text = "🤖 Claude Console",
        subText = "Claude Platform Dashboard",
        url = "https://platform.claude.com/dashboard",
        voice = "Opening Claude Console"
    },
    {
        text = "💡 Claude AI",
        subText = "Claude AI Chat - New Conversation",
        url = "https://claude.ai/new",
        voice = "Opening Claude AI"
    },
    {
        text = "🚀 Open All",
        subText = "Open all work tools",
        special = "all",
        voice = "Opening all tools"
    },
}

-- ============================================================================
-- FUNCIONES PRIVADAS
-- ============================================================================

-- Función de voz encapsulada para este módulo
local function speak(text)
    hs.execute(string.format('say -v %s "%s" &', moduleConfig.voice, text))
end

-- Abrir herramienta seleccionada
local function openTool(tool)
    if not tool then return end

    if tool.special == "all" then
        -- Abrir todas las herramientas
        speak(tool.voice)
        for _, t in ipairs(workTools) do
            if t.url then
                browser.openURL(t.url)
            end
        end
        -- Notificación de completado después de 2 segundos
        hs.timer.doAfter(2, function()
            speak("Done, all tools are open")
        end)
    else
        -- Abrir herramienta individual
        browser.openURL(tool.url)
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

-- Configurar apariencia y tema Tokyo Night
workChooser:width(25)  -- Ancho en porcentaje de la pantalla
workChooser:rows(10)   -- Máximo de filas visibles
workChooser:searchSubText(true)  -- Buscar también en subtítulos
workChooser:choices(workTools)

-- Aplicar tema Tokyo Night al chooser
workChooser:bgDark(true)
workChooser:fgColor({hex = theme.colors.cyan})
workChooser:subTextColor({hex = theme.colors.purple, alpha = 0.8})
workChooser:placeholderText("🔍 Search work tool...")

-- ============================================================================
-- BARRA DE MENÚ (OPCIONAL)
-- ============================================================================

local menubar = hs.menubar.new()
if menubar then
    menubar:setTitle("🏢")
    menubar:setTooltip("Work Launcher (Hyper + W)")
    menubar:setMenu({
        { title = "Open Work Launcher", fn = function() workspace.show() end },
        { title = "-" },
        { title = "Reload Hammerspoon", fn = hs.reload, shortcut = "⌘⌥⌃R" },
        { title = "Edit Configuration", fn = function()
            hs.execute(string.format('open -a "%s" ~/.config/hammerspoon/init.lua', config.editor))
        end },
    })
end

-- ============================================================================
-- API PÚBLICA DEL MÓDULO
-- ============================================================================

-- Mostrar el menú de workspace
function workspace.show()
    workChooser:show()
end

return workspace
