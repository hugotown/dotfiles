# 🚀 SOPS Quick Start: Activar Secretos

## ⚠️ Estado Actual

**Todas las configuraciones de sops están COMENTADAS** hasta que crees los archivos de secretos.

Esto permite hacer `darwin-rebuild` sin errores mientras no tengas secretos configurados.

---

## 📝 Paso a Paso para Activar SOPS

### **PASO 1: Genera tu Age Key (si no existe)**

```bash
# macOS:
mkdir -p ~/Library/Application\ Support/sops/age
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# NixOS:
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt

# IMPORTANTE: Haz backup de esta llave!!!
# Guárdala en tu password manager o lugar seguro
```

La llave se verá así:
```
# created: 2025-02-06T10:30:00Z
# public key: age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
AGE-SECRET-KEY-1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Backup lugares sugeridos:**
- 1Password / Bitwarden / LastPass
- USB encriptado
- Papel en lugar seguro

---

### **PASO 2: Crea tu Primer Archivo de Secretos**

```bash
cd ~/.config/nixos

# Usa la plantilla para crear secrets/ai.yaml
sops secrets/ai.yaml
```

El editor se abrirá en **texto plano**. Agrega tus secretos:

```yaml
openai_api_key: sk-proj-xxxxxxxxxxxxxxxxxxxxx
anthropic_api_key: sk-ant-xxxxxxxxxxxxxxxxxxxxx
gemini_api_key: AIzaxxxxxxxxxxxxxxxxxxxxx
```

**Guarda y cierra** el editor (`:wq` en vim).

SOPS automáticamente encriptará el archivo. Verifica:

```bash
cat secrets/ai.yaml
# Debe mostrar algo como:
# openai_api_key: ENC[AES256_GCM,data:xxx...]
```

---

### **PASO 3: Crea Otros Archivos de Secretos (Opcional)**

```bash
# Secretos de base de datos
sops secrets/database.yaml

# Secretos de GitHub
sops secrets/github.yaml
```

---

### **PASO 4: Descomenta Configuración de SOPS**

Ahora que tienes los archivos de secretos, descomenta las secciones en los home.nix:

#### **Para work-mp-m3-max:**

```bash
nvim ~/.config/nixos/hosts/darwin/work-mp-m3-max/home/hugoruiz/home.nix
```

Busca y descomenta:

1. **Sección sops (línea ~8-46)**
   ```nix
   # sops = {
   #   age.keyFile = ...
   #   ...
   # };
   ```
   Elimina los `#` para descomentar.

2. **Fish shellInit (línea ~85-95)**
   ```nix
   # shellInit = ''
   #   set -gx OPENAI_API_KEY ...
   # '';
   ```
   Elimina los `#` para descomentar.

3. **Nushell extraEnv secretos (línea ~144-152)**
   ```nix
   # $env.OPENAI_API_KEY = (cat ${config.sops...
   ```
   Elimina los `#` para descomentar.

4. **Zsh secrets file (línea ~171-189)**
   ```nix
   # home.file.".zshrc.secrets".text = ''
   # ...
   # '';
   ```
   Elimina los `#` para descomentar.

---

#### **Para mp-i9-16i:**

```bash
nvim ~/.config/nixos/hosts/darwin/mp-i9-16i/home/hugoruiz/home.nix
```

Descomenta las mismas secciones (sops, fish, zsh, nushell).

---

#### **Para lenovo-nixos-btw:**

```bash
nvim ~/.config/nixos/hosts/nixos/lenovo-nixos-btw/home/hugoruiz/home.nix
```

Descomenta:
1. **Sección sops** (~línea 60-98)
2. **Bash initExtra secretos** (~línea 113-121)
3. **Activation hook configureSecretsEnv** (~línea 289-352)

---

### **PASO 5: Rebuild con Secretos Activados**

```bash
cd ~/.config/nixos

# macOS:
darwin-rebuild switch --flake .

# NixOS:
sudo nixos-rebuild switch --flake .
```

---

### **PASO 6: Verifica que Funcionó**

```bash
# Abre nuevo terminal
nu

# Verifica que las variables existan
echo $env.OPENAI_API_KEY
# Debe mostrar: sk-proj-xxxxx ✅

echo $env.ANTHROPIC_API_KEY
# Debe mostrar: sk-ant-xxxxx ✅
```

---

## 🎯 Resumen Rápido

```bash
# 1. Genera age key
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# 2. Crea secretos
cd ~/.config/nixos
sops secrets/ai.yaml
# [Agrega tus secrets]
# [Guarda y cierra]

# 3. Verifica encriptación
cat secrets/ai.yaml
# ENC[...] ✅

# 4. Descomenta secciones en home.nix
nvim hosts/darwin/work-mp-m3-max/home/hugoruiz/home.nix
# Busca "# sops = {" y descomenta
# Busca "# shellInit = ''" y descomenta
# Busca "# $env.OPENAI_API_KEY" y descomenta

# 5. Rebuild
darwin-rebuild switch --flake .

# 6. Prueba
nu
echo $env.OPENAI_API_KEY
# sk-proj-xxxxx ✅
```

---

## ⚙️ Archivos que Debes Descomentar

### **macOS (work-mp-m3-max, mp-i9-16i):**
- ✅ `sops = { ... }` - Configuración de sops
- ✅ `programs.fish.shellInit` - Secretos en Fish
- ✅ `programs.nushell.extraEnv` - Secretos en Nushell (solo las líneas de secretos, NO el PATH)
- ✅ `home.file.".zshrc.secrets"` - Secretos en Zsh (solo work-mp-m3-max)
- ✅ `programs.zsh.initExtra` - Secretos en Zsh (solo mp-i9-16i)

### **NixOS (lenovo-nixos-btw):**
- ✅ `sops = { ... }` - Configuración de sops
- ✅ `programs.bash.initExtra` - Secretos en Bash
- ✅ `home.activation.configureSecretsEnv` - Activation hook que genera archivos de secretos

---

## 🔍 Troubleshooting

### ❌ "Error: could not read key from..."

**Problema:** No generaste la age key.

**Solución:**
```bash
# macOS:
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# NixOS:
age-keygen -o ~/.config/sops/age/keys.txt
```

---

### ❌ "Error: path 'secrets/ai.yaml' does not exist"

**Problema:** No creaste el archivo de secretos.

**Solución:**
```bash
cd ~/.config/nixos
sops secrets/ai.yaml
# Agrega secretos y guarda
```

---

### ❌ "No modification is made"

**Problema:** SOPS no puede encontrar tu age key en .sops.yaml.

**Solución:**
```bash
# 1. Obtén tu public key
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt

# 2. Verifica que está en .sops.yaml
cat .sops.yaml | grep age1

# 3. Si no coincide, actualiza .sops.yaml con tu public key real
```

---

## 📚 Documentación Completa

Para más detalles, consulta:
- **SOPS-SETUP-GUIDE.md** - Guía completa de setup
- **SOPS-DISASTER-RECOVERY.md** - Recuperación de desastres
- **secrets/README.md** - Documentación del directorio de secretos

---

**Creado:** 2025-02-06
**Estado Actual:** SOPS comentado hasta que crees los archivos de secretos
**Próximo Paso:** Generar age key y crear primer archivo de secretos
