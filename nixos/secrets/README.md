# 🔐 Secrets Directory - Guía Completa

Este directorio contiene archivos de secretos encriptados con SOPS (Secrets Operations).

---

## ⚠️ Importante

- **Todos los archivos aquí están encriptados** con age encryption (AES256-GCM)
- Son **seguros para commits públicos en Git**
- Solo pueden ser desencriptados por máquinas con las llaves privadas correctas
- **SIN llave privada = SIN acceso a secretos** 🔒

---

## 📁 Estructura de Archivos

Los secretos están organizados por categoría:

| Archivo | Contenido | Ejemplo de Secretos |
|---------|-----------|---------------------|
| `ai.yaml` | API keys de servicios AI | OpenAI, Anthropic, Gemini |
| `database.yaml` | Credenciales de bases de datos | PostgreSQL, MySQL, Redis |
| `github.yaml` | Tokens y SSH keys de GitHub | PAT, deploy keys |
| `general.yaml` | Otros secretos misceláneos | AWS, Cloudflare, SMTP |

**Templates:** Archivos `.template` son plantillas para crear nuevos secretos.

---

## 🔑 Lo Más Importante: Tu Llave Privada

### ⚠️ CRÍTICO: Backup de Llave Privada

**SIN backup de tu llave = Pérdida total de acceso a secretos**

Tu llave privada está en:
- **macOS**: `~/Library/Application Support/sops/age/keys.txt`
- **NixOS**: `~/.config/sops/age/keys.txt`

### 📦 Haz Backup AHORA (5 minutos)

```bash
# 1. Ver tu llave privada
cat ~/Library/Application\ Support/sops/age/keys.txt
# O en Linux: cat ~/.config/sops/age/keys.txt

# Output (ejemplo):
# AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZ
# age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2

# 2. COPIA TODO ESE CONTENIDO (ambas líneas)

# 3. Guárdalo en tu password manager:
#    - 1Password → New Item → Secure Note
#    - Título: "sops age key - $(hostname)"
#    - Pega las 2 líneas completas
#    - Guarda

# ✅ LISTO! Ya estás protegido
```

### 🛡️ Estrategia de Backup Recomendada

**Mínimo (HAZLO HOY):**
- ✅ Password Manager (1Password/Bitwarden)

**Recomendado:**
- ✅ Password Manager
- ✅ USB Encriptado (VeraCrypt/LUKS)

**Paranoia (Máxima Seguridad):**
- ✅ Password Manager
- ✅ USB Encriptado #1 (en casa)
- ✅ USB Encriptado #2 (otro lugar)
- ✅ Papel impreso (caja fuerte)

---

## 🚨 Reinstalación / Laptop Nueva

### Escenario A: TIENES Backup ✅

**Tiempo:** 10 minutos | **Dificultad:** ⭐ Fácil

```bash
# 1. Instala NixOS/nix-darwin normalmente

# 2. Clona tu configuración
git clone <tu-repo> ~/.config/nixos

# 3. Crea el directorio MANUALMENTE
# En macOS:
mkdir -p ~/Library/Application\ Support/sops/age

# En Linux:
mkdir -p ~/.config/sops/age

# 4. Crea el archivo MANUALMENTE con el contenido de tu backup
# Opción A: Con editor
nano ~/Library/Application\ Support/sops/age/keys.txt
# [Abre 1Password, copia las 2 líneas, pégalas aquí]
# [Ctrl+O, Enter, Ctrl+X para guardar]

# Opción B: Con cat (si tienes las líneas copiadas)
cat > ~/Library/Application\ Support/sops/age/keys.txt << 'EOF'
AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZ
age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
EOF

# 5. IMPORTANTE: Ajusta permisos
chmod 600 ~/Library/Application\ Support/sops/age/keys.txt

# 6. Verifica que la llave es correcta
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
# Debe mostrar tu llave pública (age1xxx...)

# 7. Rebuild
darwin-rebuild switch --flake ~/.config/nixos
# O en Linux: sudo nixos-rebuild switch --flake ~/.config/nixos

# 8. Verifica en NUEVO terminal
echo $OPENAI_API_KEY

# ✅ Si ves tu API key, SUCCESS!
```

### Escenario B: NO Tienes Backup ❌

**Tiempo:** 1-2 horas | **Dificultad:** ⭐⭐⭐ Complejo

```bash
# 1. Genera NUEVA llave
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# 2. Obtén llave pública
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
# age1NUEVA_LLAVE_PUBLICA

# 3. Actualiza .sops.yaml con nueva llave pública
nano ~/.config/nixos/.sops.yaml

# 4. ELIMINA secretos viejos (no puedes desencriptarlos)
cd ~/.config/nixos/secrets
rm ai.yaml database.yaml github.yaml general.yaml

# 5. REGENERA secretos con NUEVOS valores
cp ai.yaml.template ai.yaml && sops ai.yaml
# Ve a OpenAI/Anthropic/etc y genera nuevas API keys
# Llena el archivo con los NUEVOS valores

# Repite para todos los archivos

# 6. REVOCA credenciales viejas en cada servicio
# - OpenAI: https://platform.openai.com/api-keys
# - GitHub: https://github.com/settings/tokens
# - Databases: Cambia passwords

# 7. Commit y rebuild
git add .sops.yaml secrets/
git commit -m "security: regenerate secrets after key loss"
git push
darwin-rebuild switch --flake ~/.config/nixos
```

---

## 💡 Preguntas Frecuentes

### ❓ ¿Nix crea el archivo keys.txt automáticamente?

**❌ NO.** El archivo `keys.txt` es **completamente manual**.

- Nix **SOLO lo lee** para desencriptar secretos
- Nix **NUNCA lo crea** por ti
- Nix **NUNCA lo modifica**
- **TÚ** eres 100% responsable de:
  - Crearlo cuando instales por primera vez
  - Hacer backup
  - Restaurarlo cuando reinstales

### ❓ ¿Dónde "inserto" la llave cuando reinstale?

Creas **MANUALMENTE** este archivo:
- macOS: `~/Library/Application Support/sops/age/keys.txt`
- Linux: `~/.config/sops/age/keys.txt`

Y pegas ahí las 2 líneas desde tu backup (1Password/Bitwarden/etc).

### ❓ ¿La llave está atada a mi hardware?

**❌ NO.** La llave age NO está atada al hardware.

Puedes:
- ✅ Reutilizar la misma llave en laptop nueva
- ✅ Usar la misma llave después de reinstalar
- ✅ Copiarla a múltiples máquinas (si necesitas)

### ❓ ¿Qué pasa si alguien roba mi laptop?

**Con disk encryption (FileVault/LUKS):**
- ✅ Tu llave está segura (disco encriptado)
- ✅ Solo regenera secretos por precaución

**Sin disk encryption:**
- ❌ Llave comprometida
- ❌ **REGENERA TODOS los secretos INMEDIATAMENTE**
- ❌ **REVOCA todas las credenciales viejas**

### ❓ ¿Puedo ver mi llave pública?

✅ SÍ, la llave pública NO es sensible:

```bash
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt

# Output: age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
# Esta está en .sops.yaml y es segura en Git
```

### ❓ ¿Debo hacer backup de la llave pública?

**No es necesario.** La llave pública:
- Ya está en `.sops.yaml` (en Git)
- Se puede derivar de la privada: `age-keygen -y keys.txt`
- No es sensible (puede ser pública)

**SÍ necesitas backup de:** La llave **PRIVADA** (AGE-SECRET-KEY-1...)

---

## 🔧 Uso Diario

### Editar Secretos

```bash
cd ~/.config/nixos

# Edita un archivo de secretos
sops secrets/ai.yaml

# SOPS abrirá el archivo desencriptado en tu $EDITOR
# Modifica lo que necesites
# Guarda y cierra → SOPS lo re-encripta automáticamente

# Commit el archivo encriptado
git add secrets/ai.yaml
git commit -m "update: rotate OpenAI API key"
git push

# Rebuild en cada máquina
darwin-rebuild switch --flake ~/.config/nixos
```

### Agregar Nuevo Secreto

```bash
# 1. Edita el archivo correspondiente
sops secrets/ai.yaml

# 2. Agrega tu nuevo secreto
# my_new_api_key: "valor-del-secreto"

# 3. Guarda (se encripta automáticamente)

# 4. Actualiza home.nix del host
nano hosts/darwin/work-mp-m3-max/home/hugoruiz/home.nix

# Agrega:
# sops.secrets.my_new_api_key = {};

# 5. Agrega variable de entorno en el shell
# programs.fish.shellInit = ''
#   set -gx MY_NEW_API_KEY (cat ${config.sops.secrets.my_new_api_key.path})
# '';

# 6. Rebuild
darwin-rebuild switch --flake ~/.config/nixos

# 7. Verifica en nuevo terminal
echo $MY_NEW_API_KEY
```

### Ver Secreto Desencriptado

```bash
# Después de rebuild, los secretos están en:
ls -la ~/.config/sops-nix/secrets/

# Ver contenido
cat ~/.config/sops-nix/secrets/openai_api_key

# O directamente desde variables de entorno
echo $OPENAI_API_KEY
```

### Rotar/Cambiar un Secreto

```bash
# 1. Edita el archivo
sops secrets/ai.yaml

# 2. Cambia el valor viejo por uno nuevo
# openai_api_key: "sk-proj-NUEVO-KEY-AQUI"

# 3. Guarda (se re-encripta)

# 4. Commit
git add secrets/ai.yaml
git commit -m "security: rotate OpenAI API key"
git push

# 5. Rebuild en todas las máquinas
darwin-rebuild switch --flake ~/.config/nixos

# 6. Revoca la key vieja en OpenAI
# https://platform.openai.com/api-keys

# 7. Verifica la nueva
echo $OPENAI_API_KEY
```

---

## ✅ Checklist de Verificación

### Después de Reinstalación

```bash
# [ ] Archivo existe
ls -la ~/Library/Application\ Support/sops/age/keys.txt

# [ ] Permisos correctos (600)
stat -f "%Lp" ~/Library/Application\ Support/sops/age/keys.txt
# Debe mostrar: 600

# [ ] Llave pública coincide con .sops.yaml
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
cat ~/.config/nixos/.sops.yaml | grep "age1"
# Deben coincidir

# [ ] Rebuild exitoso (sin errores de sops)
darwin-rebuild switch --flake ~/.config/nixos

# [ ] Secretos desencriptados
ls ~/.config/sops-nix/secrets/
cat ~/.config/sops-nix/secrets/openai_api_key

# [ ] Variables de entorno disponibles (en NUEVO terminal)
echo $OPENAI_API_KEY
echo $GITHUB_TOKEN

# [ ] Crear nuevo backup de la llave actual
# (Verifica que puedes acceder a tu backup en 1Password)
```

---

## ⚠️ Errores Comunes y Soluciones

### ❌ "no age key found"

**Problema:** El archivo `keys.txt` no existe.

**Solución:**
```bash
# Verifica
ls -la ~/Library/Application\ Support/sops/age/keys.txt

# Si no existe, restáuralo desde tu backup (ver sección arriba)
```

### ❌ "unsafe permissions on age key file"

**Problema:** Permisos incorrectos en `keys.txt`.

**Solución:**
```bash
chmod 600 ~/Library/Application\ Support/sops/age/keys.txt
```

### ❌ "could not decrypt"

**Problema:** La llave privada no corresponde a la pública en `.sops.yaml`.

**Solución:**
```bash
# Verifica que coinciden
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
cat ~/.config/nixos/.sops.yaml | grep "host_$(hostname)"

# Si no coinciden, restauraste la llave equivocada
```

### ❌ "MAC mismatch"

**Problema:** El archivo de secretos está corrupto o fue editado sin sops.

**Solución:**
```bash
# Re-crea desde template
cd ~/.config/nixos/secrets
rm ai.yaml
cp ai.yaml.template ai.yaml
sops ai.yaml  # Llena valores y guarda
```

### ❌ Variables de entorno vacías

**Problema:** `echo $OPENAI_API_KEY` no muestra nada.

**Solución:**
```bash
# 1. Verifica rebuild exitoso
darwin-rebuild switch --flake ~/.config/nixos

# 2. Abre NUEVO terminal (importante!)

# 3. Para work-mp-m3-max con zsh manual:
echo 'source ~/.zshrc.secrets' >> ~/.zshrc
source ~/.zshrc

# 4. Verifica secreto desencriptado
cat ~/.config/sops-nix/secrets/openai_api_key
```

---

## 🎯 Comandos Útiles

```bash
# Ver archivos de secretos encriptados
cat ~/.config/nixos/secrets/ai.yaml

# Editar secretos
sops ~/.config/nixos/secrets/ai.yaml

# Ver tu llave privada (BACKUP!)
cat ~/Library/Application\ Support/sops/age/keys.txt

# Ver tu llave pública
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt

# Ver secretos desencriptados (después de rebuild)
ls -la ~/.config/sops-nix/secrets/
cat ~/.config/sops-nix/secrets/openai_api_key

# Re-encriptar con nuevas llaves (después de agregar host)
sops updatekeys ~/.config/nixos/secrets/ai.yaml

# Verificar variables de entorno
env | grep -E "OPENAI|GITHUB|ANTHROPIC"
```

---

## 📚 Documentación Adicional

**Guías Completas:**
- [SOPS-SETUP-GUIDE.md](../SOPS-SETUP-GUIDE.md) - Configuración inicial y uso
- [SOPS-DISASTER-RECOVERY.md](../SOPS-DISASTER-RECOVERY.md) - Recuperación completa
- [QUICK-RECOVERY.md](../QUICK-RECOVERY.md) - Reinstalación rápida

**Referencias Oficiales:**
- [SOPS](https://github.com/getsops/sops) - Herramienta de encriptación
- [sops-nix](https://github.com/Mic92/sops-nix) - Integración con Nix
- [age](https://github.com/FiloSottile/age) - Sistema de encriptación

---

## 🚨 Acción Inmediata Requerida

**SI AÚN NO HICISTE BACKUP DE TU LLAVE:**

```bash
# ⚠️ HAZLO AHORA (2 minutos)
cat ~/Library/Application\ Support/sops/age/keys.txt

# 1. Copia TODO el output (2 líneas)
# 2. Abre 1Password/Bitwarden
# 3. Crea "Secure Note"
# 4. Título: "sops age key - $(hostname)"
# 5. Pega el contenido
# 6. Guarda

# ✅ LISTO - Ya estás protegido contra desastres
```

**No esperes al desastre. Sin backup = Sin acceso a secretos.**

---

**Última actualización:** 2025-02-06
**Próxima revisión recomendada:** 2025-08-06 (6 meses)
**Verificar backups cada:** 3-6 meses
