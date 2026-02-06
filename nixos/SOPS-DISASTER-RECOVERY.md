# 🚨 Disaster Recovery: Reinstalación y Recuperación de Claves

## Escenarios Cubiertos

1. ✅ Reinstalación de NixOS en la misma laptop
2. ✅ Laptop nueva/reemplazo de hardware
3. ✅ Pérdida total de un host (robo, daño, etc.)
4. ✅ Migración a nuevo hardware

---

## 🔑 Lo Más Importante: BACKUP DE LLAVES

### ⚠️ SIN LLAVE PRIVADA = SIN ACCESO A SECRETOS

Si pierdes tu llave privada de age y no tienes backup:
- ❌ **NO podrás desencriptar tus secretos**
- ❌ **Tendrás que regenerar TODAS las API keys**
- ❌ **Perderás acceso a contraseñas almacenadas**

**Por eso es CRÍTICO hacer backup de tus llaves privadas!**

---

## 📦 Escenario 1: Tienes Backup de la Llave (IDEAL)

### Preparación (HAZLO AHORA antes del desastre)

```bash
# 1. Identifica tu llave privada
# En macOS:
KEYFILE="$HOME/Library/Application Support/sops/age/keys.txt"

# En Linux:
KEYFILE="$HOME/.config/sops/age/keys.txt"

# 2. Haz backup de la llave
cat "$KEYFILE"

# Output será algo como:
# AGE-SECRET-KEY-1ABCDEF...
# age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
```

### Opciones de Backup Seguro

**Opción A: Password Manager (RECOMENDADO)**
```bash
# Copia el contenido completo y guárdalo en:
# - 1Password como "Secure Note"
# - Bitwarden como "Secure Note"
# - KeePassXC como "Entry → Advanced → Attachments"

# Título sugerido: "sops age key - [hostname]"
# Incluye: hostname, fecha, y el contenido completo
```

**Opción B: Archivo Encriptado en Cloud**
```bash
# Encripta con GPG y sube a cloud
gpg --symmetric --cipher-algo AES256 "$KEYFILE"
# Esto crea: keys.txt.gpg

# Sube a Dropbox/Google Drive/iCloud
cp keys.txt.gpg ~/Dropbox/backups/sops/

# Para restaurar:
gpg -d keys.txt.gpg > keys.txt
```

**Opción C: USB Encriptado (Offline)**
```bash
# Copia la llave a USB encriptado con VeraCrypt/LUKS
cp "$KEYFILE" /media/usb-encriptado/sops-keys/$(hostname)-age-key.txt
```

**Opción D: Papel (Old School pero Efectivo)**
```bash
# Imprime la llave y guárdala en caja fuerte
cat "$KEYFILE" | lpr
# O escríbela a mano en papel y guarda en lugar seguro
```

### Paso a Paso: Reinstalación con Backup

#### 1️⃣ **Durante la Reinstalación (NUEVO sistema)**

```bash
# Instala NixOS/nix-darwin normalmente
# Clona tu configuración
git clone https://github.com/tu-usuario/nixos-config.git ~/.config/nixos
cd ~/.config/nixos
```

#### 2️⃣ **Restaurar la Llave Privada**

```bash
# En macOS:
mkdir -p ~/Library/Application\ Support/sops/age

# En Linux:
mkdir -p ~/.config/sops/age

# Restaura la llave desde tu backup
# Opción A: Desde password manager (copia y pega)
nano ~/Library/Application\ Support/sops/age/keys.txt
# Pega el contenido:
# AGE-SECRET-KEY-1ABCDEF...
# age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2

# Opción B: Desde archivo encriptado
gpg -d ~/Dropbox/backups/sops/keys.txt.gpg > ~/Library/Application\ Support/sops/age/keys.txt

# Opción C: Desde USB
cp /media/usb-encriptado/sops-keys/$(hostname)-age-key.txt \
   ~/Library/Application\ Support/sops/age/keys.txt
```

#### 3️⃣ **Verificar Permisos**

```bash
# La llave DEBE tener permisos restrictivos
chmod 600 ~/Library/Application\ Support/sops/age/keys.txt
# O en Linux:
chmod 600 ~/.config/sops/age/keys.txt
```

#### 4️⃣ **Verificar que la Llave Funciona**

```bash
# Extrae la llave pública
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt

# Compara con la que está en .sops.yaml
cat ~/.config/nixos/.sops.yaml | grep "age1"

# ✅ Deben coincidir!
```

#### 5️⃣ **Rebuild y Listo**

```bash
# macOS:
darwin-rebuild switch --flake ~/.config/nixos

# Linux:
sudo nixos-rebuild switch --flake ~/.config/nixos

# Verifica secretos
ls -la ~/.config/sops-nix/secrets/
cat ~/.config/sops-nix/secrets/openai_api_key

# ✅ Si ves el contenido desencriptado, SUCCESS!
```

#### 6️⃣ **Verificar Variables de Entorno**

```bash
# Abre NUEVO terminal
echo $OPENAI_API_KEY
echo $GITHUB_TOKEN

# ✅ Deberían mostrar tus secretos
```

---

## 🆕 Escenario 2: Laptop Nueva (Hardware Diferente)

Si estás reemplazando hardware (ej: compraste MacBook nuevo), tienes DOS opciones:

### Opción A: Reutilizar la Llave Antigua (Simple)

Sigue el **Escenario 1** exactamente igual. La llave age no está atada al hardware.

**Pros:**
- ✅ Súper simple
- ✅ No necesitas tocar .sops.yaml
- ✅ No necesitas re-encriptar nada

**Contras:**
- ⚠️ Si alguien robó tu laptop vieja Y tiene acceso a tu repo, podría desencriptar

### Opción B: Nueva Llave para Nueva Máquina (Más Seguro)

Si quieres una llave completamente nueva:

#### 1️⃣ **Generar Nueva Llave en Laptop Nueva**

```bash
# En macOS:
mkdir -p ~/Library/Application\ Support/sops/age
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# En Linux:
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt

# Guarda la llave pública
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
# Output: age1NUEVA_LLAVE_PUBLICA
```

#### 2️⃣ **Actualizar .sops.yaml**

```bash
cd ~/.config/nixos

# Edita .sops.yaml
nano .sops.yaml

# OPCIÓN A: Reemplazar la llave vieja
keys:
  - &host_work_mp_m3_max age1NUEVA_LLAVE_PUBLICA  # <- Reemplaza
  - &host_mp_i9_16i age1xxx...
  - &host_lenovo_nixos_btw age1xxx...

# OPCIÓN B: Agregar como nueva máquina (si cambió el hostname)
keys:
  - &host_work_mp_m3_max_old age1VIEJA_LLAVE  # Mantén por compatibilidad
  - &host_work_mp_m3_max_new age1NUEVA_LLAVE  # Nueva máquina
  - &host_mp_i9_16i age1xxx...
  - &host_lenovo_nixos_btw age1xxx...

creation_rules:
  - path_regex: secrets/.*\.(yaml|json|env|ini)$
    key_groups:
      - age:
        - *host_work_mp_m3_max_old
        - *host_work_mp_m3_max_new
        - *host_mp_i9_16i
        - *host_lenovo_nixos_btw
```

#### 3️⃣ **Re-encriptar TODOS los Secretos**

```bash
cd ~/.config/nixos

# Instala sops temporalmente si no lo tienes
nix-shell -p sops

# Re-encripta cada archivo de secretos
sops updatekeys secrets/ai.yaml
sops updatekeys secrets/database.yaml
sops updatekeys secrets/github.yaml
sops updatekeys secrets/general.yaml

# Verifica que se actualizaron
git diff secrets/

# Deberías ver cambios en los metadatos sops
```

#### 4️⃣ **Commit y Push**

```bash
git add .sops.yaml secrets/
git commit -m "security: add new laptop key and re-encrypt secrets"
git push
```

#### 5️⃣ **Rebuild y Verificar**

```bash
# macOS:
darwin-rebuild switch --flake ~/.config/nixos

# Linux:
sudo nixos-rebuild switch --flake ~/.config/nixos

# Verifica
ls -la ~/.config/sops-nix/secrets/
echo $OPENAI_API_KEY
```

#### 6️⃣ **OPCIONAL: Revocar Llave Vieja**

Si la laptop vieja fue robada o comprometida:

```bash
# Edita .sops.yaml y ELIMINA la llave vieja
nano ~/.config/nixos/.sops.yaml

# Re-encripta SIN la llave vieja
sops updatekeys secrets/*.yaml

# Commit
git add .sops.yaml secrets/
git commit -m "security: revoke old laptop key after theft"
git push
```

---

## 💥 Escenario 3: NO Tienes Backup (DESASTRE)

Si perdiste tu llave privada y no tienes backup, tienes que:

### ⚠️ Realidad Dura

- ❌ **NO puedes recuperar los secretos encriptados**
- ✅ **PUEDES recuperar acceso generando nuevos secretos**

### Paso a Paso: Recuperación Total

#### 1️⃣ **Generar Nueva Llave**

```bash
# En macOS:
mkdir -p ~/Library/Application\ Support/sops/age
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# En Linux:
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt

# Obtén la llave pública
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
```

#### 2️⃣ **Actualizar .sops.yaml**

```bash
cd ~/.config/nixos
nano .sops.yaml

# Reemplaza la llave del host perdido con la nueva
keys:
  - &host_work_mp_m3_max age1NUEVA_LLAVE_AQUI
  - &host_mp_i9_16i age1xxx...
  - &host_lenovo_nixos_btw age1xxx...
```

#### 3️⃣ **Eliminar Archivos de Secretos Viejos**

```bash
cd ~/.config/nixos/secrets
rm ai.yaml database.yaml github.yaml general.yaml
```

#### 4️⃣ **Regenerar TODOS los Secretos**

```bash
# Copia los templates
cp ai.yaml.template ai.yaml
cp database.yaml.template database.yaml
cp github.yaml.template github.yaml
cp general.yaml.template general.yaml

# Edita cada uno CON NUEVOS VALORES
sops ai.yaml
# Genera nuevas API keys desde:
# - OpenAI: https://platform.openai.com/api-keys
# - Anthropic: https://console.anthropic.com/settings/keys
# - GitHub: https://github.com/settings/tokens

sops database.yaml
# Cambia todas las contraseñas de bases de datos

sops github.yaml
# Genera nuevos tokens de GitHub

sops general.yaml
# Regenera otros secretos
```

#### 5️⃣ **Revocar Credenciales Viejas**

**IMPORTANTE:** Si perdiste el hardware, las credenciales viejas podrían estar comprometidas:

```bash
# Ve a cada servicio y:
# ✅ Revoca el token/API key viejo
# ✅ Genera uno nuevo
# ✅ Actualiza sops con el nuevo

# Ejemplos:
# - OpenAI: https://platform.openai.com/api-keys → Delete old key
# - GitHub: https://github.com/settings/tokens → Revoke old token
# - Bases de datos: ALTER USER ... SET PASSWORD ...
```

#### 6️⃣ **Commit y Rebuild**

```bash
git add .sops.yaml secrets/
git commit -m "security: regenerate all secrets after key loss"
git push

# Rebuild
darwin-rebuild switch --flake ~/.config/nixos
# O: sudo nixos-rebuild switch --flake ~/.config/nixos
```

---

## 🔄 Escenario 4: Tienes OTRA Máquina con Acceso

Si tienes otro host funcionando con acceso a los secretos, puedes:

### Opción: Extraer Secretos desde Host Vivo

```bash
# En la máquina que SÍ tiene acceso:
cd ~/.config/sops-nix/secrets/

# Crea backup temporal (JSON)
cat > ~/secrets-backup.json << EOF
{
  "openai_api_key": "$(cat openai_api_key)",
  "anthropic_api_key": "$(cat anthropic_api_key)",
  "github_token": "$(cat github_token)",
  "postgres_password": "$(cat postgres_password)",
  "mysql_password": "$(cat mysql_password)",
  "redis_password": "$(cat redis_password)",
  "gh_token": "$(cat gh_token)"
}
EOF

# Copia este archivo a lugar seguro (USB encriptado)
# NUNCA lo subas a Git en texto plano!
```

En la máquina nueva:

```bash
# 1. Genera nueva llave
age-keygen -o ~/.config/sops/age/keys.txt

# 2. Actualiza .sops.yaml con la nueva llave

# 3. Crea nuevos archivos de secretos desde el backup
nano secrets/ai.yaml
# Copia los valores desde secrets-backup.json

sops secrets/ai.yaml
# Guarda (se encripta con la nueva llave)

# 4. Repite para todos los archivos

# 5. ELIMINA secrets-backup.json de forma segura
shred -vfz -n 10 ~/secrets-backup.json
```

---

## 📋 Checklist de Recuperación

Usa este checklist cuando hagas reinstalación:

### Antes del Desastre (Preparación)
- [ ] Backup de llave privada en password manager
- [ ] Backup de llave privada en USB encriptado
- [ ] Backup de llave privada en papel (caja fuerte)
- [ ] Verificado que puedo acceder a mis backups
- [ ] Documentado dónde están mis backups

### Durante la Reinstalación
- [ ] Clonar repositorio de configuración
- [ ] Restaurar llave privada desde backup
- [ ] Verificar permisos (chmod 600)
- [ ] Verificar que llave pública coincide con .sops.yaml
- [ ] Rebuild del sistema
- [ ] Verificar que secretos se desencriptan
- [ ] Verificar variables de entorno en nuevo terminal

### Si NO Tengo Backup
- [ ] Generar nueva llave age
- [ ] Actualizar .sops.yaml
- [ ] Eliminar archivos de secretos viejos
- [ ] Regenerar TODOS los secretos
- [ ] Revocar credenciales viejas en cada servicio
- [ ] Commit cambios
- [ ] Rebuild sistema

### Post-Recuperación
- [ ] Crear nuevo backup de la llave actual
- [ ] Documentar qué salió mal
- [ ] Mejorar proceso de backup
- [ ] Programar backups periódicos (calendario)

---

## 🎯 Mejores Prácticas

### 1. **Múltiples Backups**
```
✅ Password Manager (online, encriptado)
✅ USB Encriptado (offline, físico)
✅ Papel en Caja Fuerte (offline, low-tech)
```

### 2. **Testing de Backups**

```bash
# Cada 3-6 meses, verifica que puedes restaurar:
# 1. Copia la llave desde tu backup
# 2. Intenta desencriptar un secreto
age -d -i <llave-desde-backup> ~/.config/nixos/secrets/ai.yaml

# Si funciona, tu backup es válido ✅
```

### 3. **Rotación de Llaves**

Considera cambiar llaves cada 1-2 años:
```bash
# 1. Genera nueva llave
# 2. Agrega a .sops.yaml (mantén la vieja temporalmente)
# 3. Re-encripta todo: sops updatekeys secrets/*.yaml
# 4. Después de 1 mes, elimina llave vieja
```

### 4. **Documentación Personal**

Crea un archivo privado (NO en Git) con:
```
- Dónde están mis backups de llaves
- Passwords de archivos encriptados
- Contacts de emergencia
- Procedimiento de recuperación personalizado
```

---

## 🚨 Contactos de Emergencia

En caso de pérdida total, regenera credenciales en:

- **OpenAI:** https://platform.openai.com/api-keys
- **Anthropic:** https://console.anthropic.com/settings/keys
- **GitHub:** https://github.com/settings/tokens
- **Google Cloud:** https://console.cloud.google.com/apis/credentials
- **AWS:** https://console.aws.amazon.com/iam/
- **Bases de datos:** Contacta tu DBA o accede via admin

---

## 💡 Resumen TL;DR

### Si Tienes Backup ✅
1. Reinstala sistema
2. Restaura llave privada
3. chmod 600 la llave
4. Rebuild
5. ¡Listo!

### Si NO Tienes Backup ❌
1. Llora 5 minutos
2. Genera nueva llave
3. Actualiza .sops.yaml
4. REGENERA todos los secretos (revoca los viejos)
5. Commit y rebuild
6. Crea backup AHORA para próxima vez

### Mejor Práctica 🎯
**HAZ BACKUP DE TU LLAVE PRIVADA HOY, NO MAÑANA!**

```bash
# Ejecuta esto AHORA:
cat ~/Library/Application\ Support/sops/age/keys.txt
# O: cat ~/.config/sops/age/keys.txt

# Y guárdalo en tu password manager
```

---

**Última actualización:** 2025-02-06
**Próxima revisión recomendada:** 2025-08-06 (6 meses)
