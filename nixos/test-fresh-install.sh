#!/usr/bin/env bash

# Script para simular instalación nueva de Nix-Darwin
# Renombra configs actuales y ejecuta darwin-rebuild para verificar out-of-the-box

set -e

echo "🧪 ================================================"
echo "🧪 Testing Out-of-the-Box Shell Integration"
echo "🧪 ================================================"
echo ""

# Safety check
if [ ! -f ~/.config/nixos/flake.nix ]; then
    echo "❌ Error: No estás en una configuración de Nix-Darwin"
    exit 1
fi

echo "⚠️  Este script va a:"
echo "  1. Renombrar tus configs actuales (backup)"
echo "  2. Ejecutar darwin-rebuild switch"
echo "  3. Verificar que las shells funcionen out-of-the-box"
echo ""
read -p "¿Continuar? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelado"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/.config-backup-$TIMESTAMP"

echo ""
echo "📦 Paso 1/5: Haciendo backup de configs..."
echo ""

mkdir -p "$BACKUP_DIR"

# Backup shell configs
for config in ~/.config/fish ~/.config/nushell ~/.zshrc; do
    if [ -e "$config" ]; then
        echo "  📦 Respaldando: $config"
        cp -r "$config" "$BACKUP_DIR/"
    fi
done

# Backup integration files
for file in ~/.zoxide.* ~/.atuin.* ~/.yazi.* ~/.cldy.*; do
    if [ -f "$file" ]; then
        echo "  📦 Respaldando: $file"
        cp "$file" "$BACKUP_DIR/"
    fi
done

echo "  ✅ Backup guardado en: $BACKUP_DIR"
echo ""

echo "🗑️  Paso 2/5: Removiendo configs actuales..."
echo ""

# Remove shell configs (simular instalación nueva)
rm -rf ~/.config/fish ~/.config/nushell
rm -f ~/.zshrc
rm -f ~/.zoxide.* ~/.atuin.* ~/.yazi.* ~/.cldy.*
rm -f ~/.local/share/atuin/init.nu

echo "  ✅ Configs removidos (simulando instalación nueva)"
echo ""

echo "🔨 Paso 3/5: Ejecutando darwin-rebuild switch..."
echo ""

cd ~/.config/nixos
sudo darwin-rebuild switch --flake .#work-mp-m3-max

echo ""
echo "✅ Paso 4/5: Darwin-rebuild completado!"
echo ""

echo "🧪 Paso 5/5: Verificando shells..."
echo ""

# Test Fish
echo "📝 Testing Fish..."
if [ -f ~/.config/fish/config.fish ]; then
    echo "  ✅ config.fish existe"
    if grep -q "source ~/.zoxide.fish" ~/.config/fish/config.fish; then
        echo "  ✅ zoxide sourcedo"
    else
        echo "  ❌ zoxide NO sourcedo"
    fi
    if grep -q "source ~/.atuin.fish" ~/.config/fish/config.fish; then
        echo "  ✅ atuin sourcedo"
    else
        echo "  ❌ atuin NO sourcedo"
    fi
else
    echo "  ❌ config.fish NO existe"
fi

echo ""

# Test Nushell
echo "📝 Testing Nushell..."
if [ -f ~/.config/nushell/config.nu ]; then
    echo "  ✅ config.nu existe"
    if grep -q "source ~/.zoxide.nu" ~/.config/nushell/config.nu; then
        echo "  ✅ zoxide sourcedo"
    else
        echo "  ❌ zoxide NO sourcedo"
    fi
    if grep -q "source ~/.local/share/atuin/init.nu" ~/.config/nushell/config.nu; then
        echo "  ✅ atuin sourcedo"
    else
        echo "  ❌ atuin NO sourcedo"
    fi
else
    echo "  ❌ config.nu NO existe"
fi

if [ -f ~/.config/nushell/env.nu ]; then
    echo "  ✅ env.nu existe"
else
    echo "  ❌ env.nu NO existe"
fi

echo ""

# Test Zsh
echo "📝 Testing Zsh..."
if [ -f ~/.zshrc ]; then
    echo "  ✅ .zshrc existe"
    if grep -q "source ~/.zoxide.zsh" ~/.zshrc; then
        echo "  ✅ zoxide sourcedo"
    else
        echo "  ❌ zoxide NO sourcedo"
    fi
    if grep -q "source ~/.atuin.zsh" ~/.zshrc; then
        echo "  ✅ atuin sourcedo"
    else
        echo "  ❌ atuin NO sourcedo"
    fi
else
    echo "  ❌ .zshrc NO existe"
fi

echo ""

# Check integration files
echo "📝 Verificando archivos de integración..."
files_ok=0
files_total=0

for file in .zoxide.fish .zoxide.nu .zoxide.zsh .atuin.fish .atuin.zsh .yazi.fish .yazi.nu .yazi.zsh .cldy.fish .cldy.nu; do
    files_total=$((files_total + 1))
    if [ -f ~/$file ]; then
        files_ok=$((files_ok + 1))
        echo "  ✅ ~/$file"
    else
        echo "  ❌ ~/$file"
    fi
done

if [ -f ~/.local/share/atuin/init.nu ]; then
    files_ok=$((files_ok + 1))
    echo "  ✅ ~/.local/share/atuin/init.nu"
else
    echo "  ❌ ~/.local/share/atuin/init.nu"
fi
files_total=$((files_total + 1))

echo ""
echo "📊 Archivos de integración: $files_ok/$files_total"
echo ""

echo "🧪 ================================================"
echo "🧪 Testing Manual de Shells"
echo "🧪 ================================================"
echo ""
echo "Ahora prueba manualmente cada shell:"
echo ""
echo "  1. Fish:"
echo "     $ fish"
echo "     $ z --version"
echo "     $ # Presiona Ctrl+R para Atuin"
echo ""
echo "  2. Nushell:"
echo "     $ nu"
echo "     $ z --version"
echo "     $ # Presiona Ctrl+R para Atuin"
echo ""
echo "  3. Zsh:"
echo "     $ zsh"
echo "     $ z --version"
echo "     $ # Presiona Ctrl+R para Atuin"
echo ""
echo "  4. Bash:"
echo "     $ bash"
echo "     $ z --version"
echo "     $ # Presiona Ctrl+R para Atuin"
echo ""
echo "💾 Para restaurar tus configs anteriores:"
echo "   $ cp -r $BACKUP_DIR/* ~/"
echo ""
echo "✅ Test completado!"
