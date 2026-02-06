# Guía de Reinstalación - MacBook Pro M3 Max

## 🎯 Problema Original
- Teclado español ISO detectado como ANSI en macOS
- Teclas `<>` y `ºª` intercambiadas
- Intentos de fix fallidos (hidutil, keyboard type plist, Karabiner remapping)
- **Solución**: Reinstalación limpia de macOS con configuración correcta desde el inicio

## 📋 Durante la Instalación de macOS

### ⚠️ IMPORTANTE - Configuración Inicial

1. **Región**: Seleccionar **España** o **México**
2. **Idioma**: Seleccionar **Español** como idioma principal
3. **Teclado**:
   - Debería detectar automáticamente "Español - ISO"
   - Si pregunta, seleccionar "Spanish - ISO" o "España"
   - Verificar que detecte la tecla `<>` al lado de Z

### ✅ Verificación Post-Instalación

Antes de instalar nada, verifica que el teclado funcione:
- Tecla al lado de Z: `<` (sin shift) y `>` (con shift)
- Tecla izquierda del 1: `º` (sin shift) y `ª` (con shift)
- Todas las demás teclas según serigrafía física

**Si el teclado NO funciona correctamente DETENTE y busca ayuda antes de continuar.**

## 🔧 Restauración del Sistema

### 1. Clonar Dotfiles

```bash
# Si tienes backup remoto
git clone <tu-repo-dotfiles> ~/.config

# Si solo tienes local (copiar desde backup/Time Machine)
# Restaurar ~/.config/nixos desde backup
```

### 2. Instalar Nix

```bash
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

### 3. Instalar nix-darwin

```bash
nix run nix-darwin -- switch --flake ~/.config/nixos#work-mp-m3-max
```

### 4. Verificar Todo Funciona

```bash
# Verificar shells
fish --version
nu --version
zsh --version

# Verificar Karabiner
ls ~/.config/karabiner/karabiner.json

# Verificar Hammerspoon
ls ~/.config/hammerspoon/init.lua
```

## 📦 Aplicaciones Homebrew

Las siguientes apps se instalarán automáticamente con nix-darwin:

**Casks:**
- antigravity
- firefox
- ghostty
- hammerspoon
- karabiner-elements
- microsoft-edge

**Mac App Store:**
- Xcode
- Telegram
- MainStage
- Compressor
- Motion
- Numbers
- Pages
- Keynote
- Pixelmator Pro
- Logic Pro
- Final Cut Pro

## 🔐 SOPS Secrets

1. **Restaurar age key**:
```bash
# Desde backup seguro
cp <backup-location>/key.txt ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
```

2. **Verificar secrets**:
```bash
cd ~/.config/nixos
sops secrets/gemini_api_key.yaml
```

## ⌨️ Configuración de Karabiner

**Estado actual**: Solo Hyper Key configurado
- Caps Lock → Hyper Key (⌘⌥⌃⇧) cuando se mantiene
- Caps Lock → Escape cuando se presiona solo

**No hay remapeos de teclado - el teclado debe funcionar nativamente con macOS**

## 🐚 Shells Configuradas

- **Fish**: Manual en `~/.config/fish/config.fish`
- **Nushell**: Manual en `~/.config/nushell/config.nu` + auto-generated `env.nu`
- **Zsh**: Manual en `~/.zshrc`
- **Bash**: Gestionado por nix-darwin

### Out-of-the-box Integration
- Atuin (Ctrl+R) - historial de shell
- Zoxide (z) - navegación inteligente
- Yazi (y) - file manager
- cldy - alias para `claude --dangerously-skip-permissions`

## 🔄 Después de Reinstalar

### Verificación Final

1. ✅ Teclado funciona correctamente (CRÍTICO)
2. ✅ Nix-darwin instalado y configurado
3. ✅ Homebrew apps instaladas
4. ✅ Karabiner funcionando (Hyper Key)
5. ✅ Hammerspoon funcionando
6. ✅ Shells configuradas (Fish, Nushell, Zsh, Bash)
7. ✅ SOPS secrets accesibles

### Problemas Comunes

**Si el teclado sigue mal:**
- Verifica que Region esté en España/México
- Verifica que Idioma principal sea Español
- Ve a System Settings > Keyboard > Keyboard Setup Assistant
- Reinstala de nuevo - puede que la configuración inicial estuviera mal

**Si nix-darwin no construye:**
- Verifica que el flake.lock esté presente
- Ejecuta `nix flake update` si es necesario

## 📊 Estado del Sistema Antes de Reinstalar

- macOS: Sequoia 26.2 (Darwin 25.2.0)
- Mac: MacBook Pro M3 Max (Mac15,9)
- Model: MUW73E/A
- Commit actual: `3bbfe70` - "remove keyboard remapping attempts"

## 💾 Backup Checklist

Antes de reinstalar, asegúrate de tener backup de:
- [ ] `~/.config` (dotfiles completos)
- [ ] `~/.config/sops/age/keys.txt` (age encryption key)
- [ ] `~/Documents`, `~/Downloads`, etc. (datos personales)
- [ ] SSH keys (`~/.ssh`)
- [ ] GPG keys (`~/.gnupg`)
- [ ] Claves y tokens de aplicaciones

## 🚀 Tiempo Estimado

- Reinstalación de macOS: ~45-60 minutos
- Configuración inicial: ~10 minutos
- Instalación de Nix + nix-darwin: ~20 minutos
- Restauración completa: ~30 minutos

**Total: ~2-2.5 horas**

---

**Última actualización**: 2026-02-06
**Razón**: Teclado español ISO detectado como ANSI - todos los intentos de fix fallaron
**Solución**: Reinstalación con configuración correcta desde inicio
