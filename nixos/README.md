# 🏠 Hugo's Dotfiles

Una configuración completa de NixOS y nix-darwin para gestionar sistemas Linux y macOS con configuraciones específicas y optimizadas para cada plataforma.

## 📋 Tabla de Contenidos

- [🎯 Filosofía](#-filosofía)
- [🏗️ Estructura del Proyecto](#️-estructura-del-proyecto)
- [⚙️ Configuraciones de Sistema](#️-configuraciones-de-sistema)
- [🚀 Uso](#-uso)
- [🔧 Instalación](#-instalación)
- [📝 Notas Importantes](#-notas-importantes)

## 🎯 Filosofía

Este repositorio sigue el principio de **"diferentes herramientas para diferentes necesidades"**:

- **Linux NixOS**: Configuración cutting-edge con las últimas features para desarrollo y gaming
- **macOS Darwin**: Configuración estable y confiable para productividad y trabajo

### ¿Por qué versiones diferentes?

**Linux (Unstable)**:
- ✅ Hyprland con las últimas features de Wayland
- ✅ Drivers actualizados para hardware nuevo
- ✅ Stack de desarrollo más reciente
- ✅ Gaming con soporte actualizado

**macOS (Estable)**:
- ✅ Máxima estabilidad para trabajo productivo
- ✅ Configuración nativa con nix-darwin
- ✅ Menos breakage en workflow diario
- ✅ Compatibilidad consistente con APIs de macOS

## 🏗️ Estructura del Proyecto

```
nixos/
├── flake.nix                    # Configuración principal de inputs y outputs
├── lib/
│   ├── default.nix             # Exports de funciones helper
│   └── helpers.nix             # Funciones para construir configuraciones
├── hosts/
│   ├── common/                 # Configuraciones compartidas
│   │   ├── common-packages.nix # Paquetes base para ambos sistemas
│   │   ├── darwin-common.nix   # Configuración común de macOS
│   │   └── nixos-common.nix    # Configuración común de Linux
│   ├── darwin/                 # Hosts de macOS
│   │   └── mp-i9-16i/          # Mac Studio personal
│   │       ├── default.nix     # Configuración del sistema
│   │       ├── custom-dock.nix # Configuración del Dock
│   │       └── home/           # Home Manager específico del host
│   │           └── hugoruiz/
│   │               └── home.nix
│   └── nixos/                  # Hosts de Linux
│       └── lenovo-nixos-btw/   # Laptop Lenovo
│           ├── default.nix     # Configuración del sistema
│           ├── hardware-configuration.nix # Hardware específico
│           └── home/           # Home Manager específico del host
│               └── hugoruiz/
│                   └── home.nix
└── home/
    └── hugoruiz.nix           # Configuración legacy (en proceso de migración)
```

### 🤔 ¿Por qué Home Manager dentro de cada host?

**Ventajas de esta estructura**:

1. **Configuraciones específicas por máquina**: Cada host puede tener configuraciones de usuario completamente diferentes
2. **Escalabilidad**: Fácil agregar nuevos usuarios a hosts específicos
3. **Separación clara**: Linux puede tener paquetes Wayland/Hyprland, macOS puede tener apps específicas
4. **Mantenimiento sencillo**: Es evidente qué usuarios están configurados en cada máquina
5. **Flexibilidad**: Un usuario puede tener configuraciones diferentes en diferentes hosts

**Ejemplo práctico**:
- `darwin/mp-i9-16i/home/hugoruiz/` → Configuración de trabajo con apps de productividad
- `nixos/lenovo-nixos-btw/home/hugoruiz/` → Configuración personal con gaming y development tools

## ⚙️ Configuraciones de Sistema

### 🐧 NixOS Linux (`lenovo-nixos-btw`)

**Sistema**:
- **Base**: nixos-unstable (rolling release)
- **Home Manager**: release-25.05
- **StateVersion**: 25.05
- **Desktop**: Hyprland con UWSM
- **Display Manager**: SDDM con Wayland
- **Audio**: PipeWire

**Features**:
- Auto-login configurado
- Soporte completo para Wayland
- Stack de desarrollo moderno
- Gaming optimizado
- Paquetes cutting-edge

**Paquetes destacados**:
```nix
# Sistema
environment.systemPackages = with pkgs; [
  alacritty neovim git          # Core tools
  waybar brightnessctl btop     # System utilities
  localsend fastfetch starship  # Modern tools
  adwaita-icon-theme            # GTK theming
];

# Home Manager (usuario específico)
home.packages = with pkgs; [
  chromium claude-code gemini-cli  # Development tools
  hypridle hyprlock hyprsunset     # Hyprland session
  rofi wofi swaybg mako            # Wayland utilities  
  nautilus pcmanfm warp-terminal   # File & terminal apps
  gh nil nitch opencode            # Development utilities
];
```

### 🍎 macOS Darwin (`mp-i9-16i`)

**Sistema**:
- **Base**: nixpkgs-24.11-darwin (stable)
- **Home Manager**: release-24.11  
- **nix-darwin**: nix-darwin-24.11
- **StateVersion**: 24.05

**Features**:
- Gestión completa con Nix (sin Homebrew)
- Dock personalizado via nix-darwin
- Configuración de productividad minimalista
- Estabilidad prioritaria

**Paquetes**:
```nix
# Solo lo esencial para estabilidad
programs.alacritty.enable = true;
programs.neovim.enable = true;

# Configuración macOS nativa
system.defaults = {
  dock.orientation = "left";
  finder.FXPreferredViewStyle = "Nlsv";
  NSGlobalDomain.AppleShowAllExtensions = true;
};
```

**Focus**:
- Alacritty + Neovim como stack principal
- TODO comentado temporalmente para máxima estabilidad
- Configuración macOS via system.defaults
- Sin dependencias externas (no Homebrew)

## 🚀 Uso

### Para NixOS Linux

```bash
# Build y apply
sudo nixos-rebuild switch --flake ~/.config/nixos#lenovo-nixos-btw

# Solo build (para testing)
sudo nixos-rebuild build --flake ~/.config/nixos#lenovo-nixos-btw

# Update flake inputs
nix flake update ~/.config/nixos
```

### Para macOS Darwin

```bash
# Build y apply
sudo darwin-rebuild switch --flake ~/.config/nixos#mp-i9-16i

# Solo build (para testing)  
sudo darwin-rebuild build --flake ~/.config/nixos#mp-i9-16i

# Update flake inputs
nix flake update ~/.config/nixos
```

### Comandos útiles

```bash
# Ver configuraciones disponibles
nix flake show ~/.config/nixos

# Limpiar store
sudo nix-collect-garbage -d

# Rollback a generación anterior
sudo nixos-rebuild --rollback switch    # Linux
sudo darwin-rebuild --rollback switch   # macOS
```

## 🔧 Instalación

### Prerequisitos

1. **NixOS**: Instalación base funcionando
2. **macOS**: Nix package manager instalado
3. **Flakes habilitados**: 
   ```bash
   # En ~/.config/nix/nix.conf o /etc/nix/nix.conf
   experimental-features = nix-command flakes
   ```

### Setup inicial

```bash
# 1. Clonar dotfiles
git clone https://github.com/hugotown/dotfiles.git ~/.config/nixos
cd ~/.config/nixos

# 2. Linux: Backup configuración existente
sudo mv /etc/nixos/hardware-configuration.nix ~/.config/nixos/nixos/hosts/nixos/lenovo-nixos-btw/

# 3. Aplicar configuración
# Linux:
sudo nixos-rebuild switch --flake .#lenovo-nixos-btw
# macOS:
sudo darwin-rebuild switch --flake .#mp-i9-16i
```

## 📝 Notas Importantes

### 🔄 Versionado y Compatibilidad

**¿Por qué diferentes versiones?**
- Las versiones unstable y stable tienen diferentes ciclos de release
- Linux unstable da acceso a Hyprland y Wayland más recientes
- macOS stable evita breakage en entorno de trabajo
- Home Manager versions están sincronizadas con sus respectivos nixpkgs

### 🏠 Home Manager Strategy

**Legacy vs Nueva Estructura**:
- `nixos/home/hugoruiz.nix` → **Legacy** (será eliminado)
- `nixos/hosts/*/home/*/home.nix` → **Nueva estructura**

La nueva estructura permite configuraciones específicas por host, lo cual es especialmente útil cuando el mismo usuario tiene diferentes necesidades en diferentes máquinas.

### 🔧 StateVersions

- **NixOS**: `25.05` (matches system.stateVersion en configuración funcional)
- **Darwin**: `24.05` (stable baseline para macOS)
- **Home Manager**: Sigue la versión del sistema respectivo

### ⚖️ **Diferencias con out.nix**

La configuración actual está **organizada y modularizada**, mientras que `out.nix` es la configuración funcional **monolítica** original:

- **out.nix**: Configuración única, todo en un archivo, ya probada y funcionando
- **Configuración actual**: Separada por módulos, hosts específicos, más mantenible

**¿Por qué la diferencia?**
- Mejor organización para múltiples hosts/usuarios
- Separación de responsabilidades (sistema vs home vs hardware)
- Reutilización de componentes comunes
- Escalabilidad para nuevos hosts

### 🚨 Troubleshooting

**Error común**: `path does not exist`
- Verificar que los archivos home.nix existen en la estructura correcta
- Revisar que las rutas en helpers.nix sean correctas
- Asegurar que los inputs del flake coincidan con las referencias

**Darwin build fails**:
- Verificar que Xcode Command Line Tools estén instalados
- Revisar permisos en `/nix/store`
- Confirmar que nix-darwin esté instalado correctamente

**NixOS differs from out.nix**:
- La configuración modular puede requerir ajustes para match exacto
- Si hay problemas, usar temporalmente el out.nix como base
- Migración gradual de out.nix a estructura modular

---

## 📚 Referencias

- [NixOS Manual](https://nixos.org/manual/nixos/stable/)
- [nix-darwin](https://github.com/LnL7/nix-darwin)
- [Home Manager](https://github.com/nix-community/home-manager)
- [Hyprland](https://hyprland.org/)

---

**Mantenido por**: [@hugotown](https://github.com/hugotown)  
**Último update**: Octubre 2025