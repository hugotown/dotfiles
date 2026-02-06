# 🚀 Atuin + Zoxide: Configuración Completa en Nushell

## ✅ Qué Se Configuró

### **1. Integración de Atuin (Shell History Search)**

Atuin reemplaza el historial de shell estándar con búsqueda sincronizada y contextual.

**Configurado en todos los hosts:**
- ✅ work-mp-m3-max (macOS M3)
- ✅ mp-i9-16i (macOS Intel)
- ✅ lenovo-nixos-btw (NixOS)

**Shells soportados:**
- ✅ Nushell
- ✅ Fish
- ✅ Zsh (mp-i9-16i)
- ✅ Bash (NixOS)

### **2. Integración de Zoxide (Smart cd)**

Zoxide reemplaza `cd` con aprendizaje inteligente de tus directorios más frecuentes.

**Configurado en todos los hosts:**
- ✅ work-mp-m3-max (macOS M3)
- ✅ mp-i9-16i (macOS Intel)
- ✅ lenovo-nixos-btw (NixOS)

**Shells soportados:**
- ✅ Nushell
- ✅ Fish
- ✅ Zsh
- ✅ Bash

---

## 🏗️ Arquitectura de Configuración

### **macOS Hosts (Declarativo via home-manager)**

```nix
# hosts/darwin/{work-mp-m3-max,mp-i9-16i}/home/hugoruiz/home.nix

# Zoxide - smart cd
programs.zoxide = {
  enable = true;
  enableFishIntegration = true;
  enableZshIntegration = true;
  enableNushellIntegration = true;
  enableBashIntegration = true;
};

# Atuin - shell history search
programs.atuin = {
  enable = true;
  enableFishIntegration = true;
  enableZshIntegration = true;  # false en work-mp-m3-max (zsh manual)
  enableNushellIntegration = true;
  enableBashIntegration = true;
};
```

**Ventajas:**
- ✅ Configuración declarativa (todo en Nix)
- ✅ Home-manager gestiona automáticamente la integración
- ✅ No requiere activation scripts
- ✅ Integración se genera automáticamente en cada rebuild

---

### **NixOS Host (Activation Scripts)**

```nix
# hosts/nixos/lenovo-nixos-btw/home/hugoruiz/home.nix

# Activation script para zoxide
home.activation.regenerateZoxide = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
  # Genera archivos de integración
  zoxide init nushell > $HOME/.zoxide.nu
  zoxide init fish > $HOME/.zoxide.fish
  zoxide init bash > $HOME/.zoxide.bash

  # Auto-agrega source líneas a config.nu y config.fish
  if [ -f "$HOME/.config/nushell/config.nu" ]; then
    if ! grep -q "source.*\\.zoxide\\.nu" "$HOME/.config/nushell/config.nu"; then
      echo "source ~/.zoxide.nu" >> "$HOME/.config/nushell/config.nu"
    fi
  fi
'';

# Activation script para atuin (similar estructura)
home.activation.regenerateAtuin = lib.hm.dag.entryAfter ["linkGeneration" "reloadSystemd"] ''
  # Genera archivos de integración
  atuin init nushell > $HOME/.atuin.nu
  atuin init fish > $HOME/.atuin.fish
  atuin init bash > $HOME/.atuin.bash

  # Auto-agrega source líneas a config.nu y config.fish
  if [ -f "$HOME/.config/nushell/config.nu" ]; then
    if ! grep -q "source.*\\.atuin\\.nu" "$HOME/.config/nushell/config.nu"; then
      echo "source ~/.atuin.nu" >> "$HOME/.config/nushell/config.nu"
    fi
  fi
'';
```

**Ventajas:**
- ✅ Genera archivos de integración en cada rebuild
- ✅ Automáticamente agrega `source` líneas a config.nu y config.fish
- ✅ Verifica que no duplique líneas existentes
- ✅ Compatible con filosofía de "~/.config gestionado por usuario"

---

## 🚀 Cómo Usar

### **PASO 1: Rebuild (CRÍTICO)**

```bash
cd ~/.config/nixos

# En macOS:
darwin-rebuild switch --flake .

# En NixOS:
sudo nixos-rebuild switch --flake .
```

**Qué hace el rebuild:**
1. Instala atuin (si no estaba)
2. Instala zoxide (si no estaba)
3. Configura integración en todos los shells
4. **macOS**: Home-manager genera automáticamente la integración
5. **NixOS**: Activation scripts generan archivos y actualizan config.nu/config.fish

---

### **PASO 2: Verifica Instalación**

```bash
# 1. Cierra y abre NUEVO terminal

# 2. Entra a nushell
nu

# 3. Verifica atuin
which atuin
# /run/current-system/sw/bin/atuin ✅

# 4. Verifica zoxide
which zoxide
# /run/current-system/sw/bin/zoxide ✅
```

---

### **PASO 3: Prueba las Herramientas**

#### **Zoxide (Smart cd)**

```bash
# Entra a nushell
nu

# Navega a algunos directorios para entrenar zoxide
cd ~/.config/nixos
cd ~/Documents
cd ~/Projects/mi-proyecto

# Usa 'z' para saltar a directorios frecuentes
z nixos
# Te lleva a ~/.config/nixos ✅

z proj
# Te lleva a ~/Projects/mi-proyecto ✅

# Lista directorios frecuentes
zoxide query -l
```

**Comandos principales:**
- `z <query>` - Salta a directorio que coincida
- `zi` - Buscar interactivamente con fzf
- `zoxide query -l` - Lista directorios frecuentes

---

#### **Atuin (Shell History Search)**

```bash
# Entra a nushell
nu

# Ejecuta algunos comandos para poblar historial
ls -la
git status
docker ps

# Presiona Ctrl+R para buscar en historial
# Se abre interfaz interactiva de búsqueda

# Busca por contexto
atuin search "docker"

# Ver estadísticas
atuin stats
```

**Keybindings en Nushell:**
- `Ctrl+R` - Búsqueda interactiva de historial
- `↑/↓` - Navegar resultados
- `Enter` - Ejecutar comando seleccionado
- `Esc` - Cancelar búsqueda

**Features de Atuin:**
- 🔍 Búsqueda fuzzy en historial completo
- 📊 Estadísticas de uso de comandos
- 🌍 Contexto de directorio (dónde ejecutaste cada comando)
- 📅 Filtrar por fecha/hora
- 🔒 Historial encriptado (opcional con sync)

---

## 📊 Resumen de Shells Configurados

### **Nushell**

```nushell
# ~/.config/nushell/config.nu (NixOS - auto-agregado)
source ~/.zoxide.nu
source ~/.atuin.nu

# macOS: Integración gestionada por home-manager automáticamente
```

### **Fish**

```fish
# ~/.config/fish/config.fish (NixOS - auto-agregado)
source ~/.zoxide.fish
source ~/.atuin.fish

# macOS: Integración gestionada por home-manager automáticamente
```

### **Zsh (mp-i9-16i)**

```zsh
# ~/.zshrc (auto-configurado por home-manager)
# Zoxide y Atuin ya integrados automáticamente
```

### **Bash (NixOS)**

```bash
# ~/.bashrc (auto-configurado via programs.bash.initExtra)
# Zoxide y Atuin ya integrados automáticamente
```

---

## 🔍 Troubleshooting

### ❌ "Command `atuin` not found"

**Problema:** No se hizo rebuild después de agregar atuin.

**Solución:**
```bash
darwin-rebuild switch --flake ~/.config/nixos
# Abre NUEVO terminal
nu
which atuin  # Debe funcionar
```

---

### ❌ "Command `z` not found"

**Problema:** Zoxide no está cargado en nushell.

**Solución (NixOS):**
```bash
# Verifica que exista el archivo de integración
cat ~/.zoxide.nu
# Debe tener contenido ✅

# Verifica que config.nu tenga source línea
cat ~/.config/nushell/config.nu | grep zoxide
# Debe mostrar: source ~/.zoxide.nu ✅

# Si no existe, hacer rebuild
sudo nixos-rebuild switch --flake ~/.config/nixos
```

**Solución (macOS):**
```bash
# Home-manager debe haberlo configurado automáticamente
darwin-rebuild switch --flake ~/.config/nixos

# Reinicia nushell
exit
nu
z --help  # Debe funcionar
```

---

### ❌ "Ctrl+R no abre búsqueda de atuin"

**Problema:** Atuin no está integrado en nushell.

**Solución (NixOS):**
```bash
# Verifica archivo de integración
cat ~/.atuin.nu
# Debe tener contenido ✅

# Verifica source línea en config.nu
cat ~/.config/nushell/config.nu | grep atuin
# Debe mostrar: source ~/.atuin.nu ✅

# Si no existe, hacer rebuild
sudo nixos-rebuild switch --flake ~/.config/nixos
```

**Solución (macOS):**
```bash
# Rebuild para generar integración
darwin-rebuild switch --flake ~/.config/nixos

# Reinicia nushell
exit
nu

# Prueba Ctrl+R
# Debe abrir interfaz de búsqueda ✅
```

---

### ❌ "config.nu tiene duplicados de source líneas"

**Problema:** Múltiples rebuilds agregaron líneas duplicadas.

**Solución:**
```bash
# Edita config.nu y elimina duplicados
nvim ~/.config/nushell/config.nu

# Elimina líneas duplicadas como:
# source ~/.atuin.nu
# source ~/.atuin.nu  ← Duplicado, eliminar

# Los activation scripts verifican con grep, pero si cambias
# el formato de la línea, puede duplicarse
```

---

## 💡 Filosofía de Configuración

### **macOS: Declarativo Total**

```
┌─────────────────────────────────────────┐
│  Home-manager gestiona TODO             │
├─────────────────────────────────────────┤
│  - programs.zoxide                      │
│  - programs.atuin                       │
│  - Genera integración automáticamente  │
│  - No requiere source manual           │
└─────────────────────────────────────────┘
```

### **NixOS: Híbrido (Activation Scripts)**

```
┌─────────────────────────────────────────┐
│  Nix Gestiona (Activation Scripts)     │
├─────────────────────────────────────────┤
│  - Genera archivos de integración      │
│  - Auto-agrega source líneas           │
│  - Se ejecuta en cada rebuild          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Usuario Gestiona (Manual)             │
├─────────────────────────────────────────┤
│  - Resto de config.nu                   │
│  - Aliases personalizados              │
│  - Funciones custom                     │
└─────────────────────────────────────────┘
```

---

## ✅ Checklist de Verificación

```bash
# [ ] 1. Rebuild completado sin errores
darwin-rebuild switch --flake ~/.config/nixos

# [ ] 2. atuin está disponible
nu
which atuin
# /run/current-system/sw/bin/atuin

# [ ] 3. zoxide está disponible
which zoxide
# /run/current-system/sw/bin/zoxide

# [ ] 4. Comando 'z' funciona
z --help
# zoxide - a smarter cd command

# [ ] 5. Ctrl+R abre búsqueda de atuin
# Presiona Ctrl+R en nushell
# Interfaz de búsqueda se abre ✅

# [ ] 6. Navegar con z funciona
cd ~/.config/nixos
cd ~/Documents
z config
# Te lleva a ~/.config ✅

# [ ] 7. Historial se busca con atuin
atuin search "ls"
# Muestra comandos ls del historial ✅
```

---

## 🎯 Resumen

**Antes:**
```bash
nu
z nixos
# Error: External command failed ❌

ctrl+r
# Búsqueda básica de nushell ❌
```

**Después:**
```bash
nu

# Zoxide funciona
z nixos
# Salta a ~/.config/nixos ✅

# Atuin funciona
ctrl+r
# Interfaz de búsqueda avanzada ✅

atuin search "docker"
# Encuentra todos tus comandos docker ✅
```

---

**Creado:** 2025-02-06
**Herramientas:** atuin (shell history), zoxide (smart cd)
**Configuración:** Declarativa (macOS) + Activation Scripts (NixOS)
