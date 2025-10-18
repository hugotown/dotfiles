# Hugo's Nix-Darwin Configuration

Esta es mi configuración personal de nix-darwin para macOS, inspirada en las mejores prácticas del repositorio [ironicbadger/nix-config](https://github.com/ironicbadger/nix-config).

## Estructura del Proyecto

```
nixos/
├── flake.nix                 # Configuración principal del flake
├── justfile                  # Comandos útiles para administrar el sistema
├── hosts/
│   ├── common/
│   │   ├── darwin-common.nix        # Configuración base de macOS
│   │   ├── darwin-common-dock.nix   # Configuración por defecto del dock
│   │   └── common-packages.nix      # Paquetes comunes
│   └── darwin/
│       └── mp-i9-16i/              # Configuración específica de la máquina
│           ├── default.nix
│           └── custom-dock.nix
├── home/
│   └── hugoruiz.nix         # Configuración de home-manager
└── lib/
    ├── default.nix          # Exportaciones de la librería
    └── helpers.nix          # Funciones helper para crear configuraciones
```

## Instalación Inicial

1. **Instalar Nix** (si no lo tienes):
```bash
sh <(curl -L https://nixos.org/nix/install)
```

2. **Instalar nix-darwin**:
```bash
nix-build https://github.com/LnL7/nix-darwin/archive/master.tar.gz -A installer
./result/bin/darwin-installer
```

3. **Clonar esta configuración**:
```bash
git clone <tu-repo> ~/.config/nixos
cd ~/.config/nixos
```

4. **Construir y aplicar**:
```bash
# Usando just (recomendado)
just build
just switch

# O manualmente
nix --extra-experimental-features 'nix-command flakes' build '.#darwinConfigurations.mp-i9-16i.system'
sudo ./result/sw/bin/darwin-rebuild switch --flake '.#mp-i9-16i'
```

## Uso Diario

### Comandos Principales (usando `just`)

```bash
# Construir y cambiar a la nueva configuración
just switch

# Solo construir sin cambiar
just build

# Actualizar los inputs del flake
just update

# Limpiar generaciones antiguas
just gc

# Ver información del sistema
just show

# Verificar el flake
just check
```

### Comandos Manuales

```bash
# Reconstruir sistema
darwin-rebuild switch --flake '.#mp-i9-16i'

# Actualizar flake
nix flake update

# Limpiar sistema
nix-collect-garbage -d
```

## Características Principales

### Sistema Base
- ✅ **Nix Flakes** habilitado
- ✅ **Home Manager** integrado
- ✅ **Homebrew** configurado con nix-homebrew
- ✅ **TouchID para sudo** habilitado
- ✅ **Configuraciones optimizadas de macOS**

### Aplicaciones Incluidas
- **Terminal**: Alacritty con configuración personalizada
- **Shell**: Zsh con Starship prompt
- **Editor**: Neovim como editor por defecto
- **CLI Tools**: eza, ripgrep, fd, fzf, atuin, zoxide, bat
- **Git**: Configurado con mejores defaults
- **Homebrew Casks**: Chrome, Firefox, VS Code, Discord, Spotify, etc.

### Configuraciones de macOS
- Finder optimizado (mostrar extensiones, pathbar, etc.)
- Dock personalizado por máquina
- Trackpad con tap-to-click y three-finger drag
- Desactivar creación de .DS_Store en redes
- Configuraciones de privacidad mejoradas

## Personalización

### Agregar Aplicaciones

**Via Nix** (editar `hosts/common/common-packages.nix`):
```nix
environment.systemPackages = with pkgs; [
  # ... existing packages
  nueva-aplicacion
];
```

**Via Homebrew** (editar `hosts/common/darwin-common.nix`):
```nix
homebrew = {
  # ...
  casks = [
    # ... existing casks
    "nueva-app"
  ];
  masApps = {
    "Nueva App Store App" = 123456789;
  };
};
```

### Modificar Dock

Editar `hosts/darwin/mp-i9-16i/custom-dock.nix`:
```nix
system.defaults.dock = {
  persistent-apps = [
    "/Applications/Mi App Favorita.app"
    # ... otras apps
  ];
};
```

### Configurar Home Manager

Editar `home/hugoruiz.nix` para personalizar:
- Configuraciones de shell (aliases, funciones)
- Configuraciones de aplicaciones (alacritty, git, etc.)
- Variables de entorno
- Dotfiles adicionales

## Resolución de Problemas

### Build Failures
```bash
# Ver errores detallados
just trace

# Verificar flake
just check

# Limpiar cache
nix-collect-garbage -d
```

### Homebrew Issues
```bash
# Limpiar homebrew
brew cleanup --prune=all

# Re-instalar formulae/casks
darwin-rebuild switch --flake '.#mp-i9-16i'
```

### Rollback a Generación Anterior
```bash
# Ver generaciones disponibles
just generations

# Rollback
sudo darwin-rebuild rollback
```

## Estructura Modular

La configuración está organizada modularmente para facilitar:

1. **Reutilización**: Configuraciones comunes compartidas
2. **Mantenimiento**: Cada host tiene su configuración específica
3. **Escalabilidad**: Fácil agregar nuevas máquinas
4. **Flexibilidad**: Overrides específicos por máquina

## Créditos

Inspirado en el excelente trabajo de [ironicbadger](https://github.com/ironicbadger/nix-config).