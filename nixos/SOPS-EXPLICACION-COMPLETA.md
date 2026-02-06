# 🔐 SOPS: Explicación Completa del Flujo

## 📚 ¿Qué es SOPS y Por Qué lo Usamos?

**SOPS** = Secrets OPerationS

Es una herramienta que te permite **guardar secretos (passwords, API keys) en Git de forma segura** porque están encriptados.

### ❌ Problema Sin SOPS:

```yaml
# secrets.yaml (INSEGURO - texto plano)
GEMINI_API_KEY: AIzaSyD1234567890abcdefghijklmnop
GOOGLE_API_KEY: AIzaSyD0987654321zyxwvutsrqponm
```

Si subes esto a Git, **cualquiera puede leer tus API keys** → 💸 Alguien usa tu cuenta y te cobran.

### ✅ Solución Con SOPS:

```yaml
# secrets/gemini_api_key.yaml (SEGURO - encriptado)
GEMINI_API_KEY: ENC[AES256_GCM,data:fQMboi1qlZF7VWl/Mx9K...]
```

Ahora **puedes subir esto a Git públicamente** y nadie puede leer tu API key, solo tú con tu llave privada.

---

## 🔑 Componentes del Sistema

### **1. Age Key Pair (Par de Llaves)**

Como SSH, tienes **dos llaves**:

#### **Public Key (Llave Pública)**
```
age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
```

- **Para encriptar** secretos
- Puedes compartirla (está en `.sops.yaml`)
- Se usa cuando haces `sops secrets/gemini_api_key.yaml`

#### **Private Key (Llave Privada)**
```
# Ubicación: ~/Library/Application Support/sops/age/keys.txt
AGE-SECRET-KEY-1XXXXXXXXXXXXXXXXXXXXXXXXX
```

- **Para desencriptar** secretos
- **NUNCA la compartas**
- **NUNCA la subas a Git**
- Solo la guardas en backups seguros (1Password, USB, etc.)

---

### **2. Archivos de Secretos Encriptados**

```bash
~/.config/nixos/secrets/
├── gemini_api_key.yaml   # Tu archivo (ENCRIPTADO)
├── google_api_key.yaml   # Tu archivo (ENCRIPTADO)
├── ai.yaml               # Futuro (todavía no existe)
├── database.yaml         # Futuro (todavía no existe)
└── github.yaml           # Futuro (todavía no existe)
```

#### **Estructura Interna de gemini_api_key.yaml:**

```yaml
GEMINI_API_KEY: ENC[AES256_GCM,data:fQMboi1qlZF7...]  ← Valor encriptado
sops:
  age:
    - recipient: age1yuy59d4yqf...  ← Solo esta public key puede desencriptar
      enc: |
        -----BEGIN AGE ENCRYPTED FILE-----
        ...
        -----END AGE ENCRYPTED FILE-----
```

**¿Por qué está encriptado?**
- Porque SOPS lo hizo cuando ejecutaste: `sops secrets/gemini_api_key.yaml`
- Usa tu **public key** para encriptar
- Solo tu **private key** puede desencriptar

---

### **3. Configuración en .sops.yaml**

```yaml
# ~/.config/nixos/.sops.yaml
keys:
  - &host_work_mp_m3_max age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2

creation_rules:
  - path_regex: secrets/.*\.(yaml|json|env|ini)$
    key_groups:
      - age:
        - *host_work_mp_m3_max
```

**¿Qué hace esto?**
1. Define tu **public key** con un alias `&host_work_mp_m3_max`
2. Dice: "Cualquier archivo en `secrets/` con extensión `.yaml`, `.json`, etc. debe encriptarse con esta public key"

**Cuando ejecutas:**
```bash
sops secrets/gemini_api_key.yaml
```

SOPS:
1. Lee `.sops.yaml`
2. Ve que `secrets/gemini_api_key.yaml` coincide con `secrets/.*\.yaml`
3. Usa la public key `age1yuy59d4yqf...` para encriptar
4. Guarda el resultado encriptado en el mismo archivo

---

## 🏗️ Configuración en home.nix

Ahora veamos **qué configuraste en home.nix y por qué**:

### **Parte 1: Configuración de SOPS**

```nix
sops = {
  # Age key location for macOS
  age.keyFile = "${config.home.homeDirectory}/Library/Application Support/sops/age/keys.txt";
```

**¿Qué hace?**
- Le dice a sops-nix dónde está tu **llave PRIVADA**
- Ubicación: `~/Library/Application Support/sops/age/keys.txt`

**¿Por qué?**
- sops-nix necesita esta llave para **desencriptar** los secretos en cada rebuild

---

```nix
  defaultSopsFile = ../../../../secrets/gemini_api_key.yaml;
```

**¿Qué hace?**
- Define un archivo de secretos "por defecto"
- Si no especificas `sopsFile` en un secret, usará este

**¿Por qué?**
- Para no tener que escribir `sopsFile = ...` en cada secret si están todos en el mismo archivo
- En tu caso, cada API key está en su propio archivo, así que cada uno especifica su `sopsFile`

---

```nix
  secrets = {
    gemini_api_key = {
      sopsFile = ../../../../secrets/gemini_api_key.yaml;
      key = "GEMINI_API_KEY";
    };
    google_api_key = {
      sopsFile = ../../../../secrets/google_api_key.yaml;
      key = "GOOGLE_API_KEY";
    };
  };
```

**¿Qué hace?**
- Define **dos secretos** que sops-nix gestionará
- Cada uno apunta a un archivo YAML encriptado
- `key = "..."` especifica **qué llave del YAML** leer

**¿Por qué el atributo `key`?**

En `secrets/gemini_api_key.yaml` tienes:
```yaml
GEMINI_API_KEY: ENC[...]  ← Esta es la llave YAML (en mayúsculas)
```

Pero el secret en Nix se llama `gemini_api_key` (minúsculas con guiones).

Necesitas `key = "GEMINI_API_KEY"` para mapear:
- Secret name en Nix: `gemini_api_key`
- Key en YAML: `GEMINI_API_KEY`

---

### **Parte 2: ¿Dónde se Desencriptan los Secretos?**

Cuando haces `darwin-rebuild switch`, sops-nix:

1. **Lee** `~/Library/Application Support/sops/age/keys.txt` (tu private key)
2. **Desencripta** cada secret definido en `sops.secrets`
3. **Guarda** el valor desencriptado en:
   ```
   ~/.config/sops-nix/secrets/gemini_api_key
   ~/.config/sops-nix/secrets/google_api_key
   ```

**Ejemplo:**
```bash
$ cat ~/.config/sops-nix/secrets/gemini_api_key
AIzaSyD1234567890abcdefghijklmnop
```

**⚠️ IMPORTANTE:**
- Estos archivos desencriptados **NO están en Git**
- Son temporales, se regeneran en cada rebuild
- Solo existen en tu máquina local
- Tienen permisos restrictivos (solo tu usuario puede leerlos)

---

### **Parte 3: Uso en Nushell**

```nix
extraEnv = ''
  # Load secrets from sops-nix para Nushell
  $env.GEMINI_API_KEY = (cat ${config.sops.secrets.gemini_api_key.path} | str trim)
  $env.GOOGLE_API_KEY = (cat ${config.sops.secrets.google_api_key.path} | str trim)
'';
```

**¿Qué hace?**
- Lee el archivo desencriptado
- Lo asigna a una variable de entorno en nushell

**¿Qué es `${config.sops.secrets.gemini_api_key.path}`?**

Es una interpolación de Nix que se expande a:
```
/Users/hugoruiz/.config/sops-nix/secrets/gemini_api_key
```

**¿Por qué `| str trim`?**
- Elimina espacios en blanco o newlines al final del archivo
- Asegura que `$env.GEMINI_API_KEY` contenga solo el API key limpio

**Resultado en nushell:**
```nushell
> echo $env.GEMINI_API_KEY
AIzaSyD1234567890abcdefghijklmnop
```

---

### **Parte 4: Uso en Fish**

```nix
shellInit = ''
  set -gx GEMINI_API_KEY (cat ${config.sops.secrets.gemini_api_key.path})
  set -gx GOOGLE_API_KEY (cat ${config.sops.secrets.google_api_key.path})
'';
```

**¿Qué hace?**
- Igual que nushell, pero sintaxis de Fish
- `set -gx` = export global variable

**Resultado en fish:**
```fish
> echo $GEMINI_API_KEY
AIzaSyD1234567890abcdefghijklmnop
```

---

### **Parte 5: Uso en Zsh**

```nix
home.file.".zshrc.secrets".text = ''
  export GEMINI_API_KEY="$(cat ${config.sops.secrets.gemini_api_key.path})"
  export GOOGLE_API_KEY="$(cat ${config.sops.secrets.google_api_key.path})"
'';
```

**¿Qué hace?**
- Crea un archivo `~/.zshrc.secrets` con exports
- Puedes hacer `source ~/.zshrc.secrets` en tu `.zshrc` manual

**¿Por qué un archivo separado?**
- En work-mp-m3-max, gestionas `.zshrc` manualmente (no con home-manager)
- Home-manager genera `~/.zshrc.secrets` automáticamente
- Tú decides si hacer `source ~/.zshrc.secrets` en tu `.zshrc` manual

---

## 🔄 Flujo Completo: De Encriptación a Uso

### **1. Crear/Editar Secreto**

```bash
cd ~/.config/nixos
sops secrets/gemini_api_key.yaml
```

**Lo que pasa:**
1. SOPS lee `.sops.yaml` → encuentra tu public key
2. Desencripta el archivo con tu private key (si ya existe)
3. Abre el editor (vim/nano) con el contenido en **texto plano**
4. Editas el archivo:
   ```yaml
   GEMINI_API_KEY: AIzaSyD1234567890abcdefghijklmnop
   ```
5. Guardas y cierras (`:wq`)
6. SOPS **encripta automáticamente** con tu public key
7. Guarda el archivo encriptado:
   ```yaml
   GEMINI_API_KEY: ENC[AES256_GCM,data:fQMboi1qlZF7...]
   ```

---

### **2. Commit a Git**

```bash
git add secrets/gemini_api_key.yaml
git commit -m "Add Gemini API key (encrypted)"
git push
```

**¿Es seguro?**
- ✅ SÍ, el archivo está encriptado
- ✅ Nadie puede leer tu API key sin tu private key
- ✅ Tu private key NO está en Git (está en `~/Library/Application Support/sops/age/keys.txt`)

---

### **3. Darwin Rebuild**

```bash
darwin-rebuild switch --flake ~/.config/nixos
```

**Lo que pasa:**

1. **Nix evalúa home.nix**
   - Lee `sops.secrets.gemini_api_key`
   - Ve que necesita desencriptar `secrets/gemini_api_key.yaml`

2. **sops-nix desencripta**
   - Lee tu private key de `~/Library/Application Support/sops/age/keys.txt`
   - Desencripta `secrets/gemini_api_key.yaml`
   - Extrae el valor de la llave `GEMINI_API_KEY`
   - Guarda el valor desencriptado en:
     ```
     ~/.config/sops-nix/secrets/gemini_api_key
     ```
   - Permisos: `600` (solo tú puedes leer)

3. **home-manager configura shells**
   - Genera `env.nu` con:
     ```nushell
     $env.GEMINI_API_KEY = (cat /Users/hugoruiz/.config/sops-nix/secrets/gemini_api_key | str trim)
     ```
   - Genera `config.fish` con:
     ```fish
     set -gx GEMINI_API_KEY (cat /Users/hugoruiz/.config/sops-nix/secrets/gemini_api_key)
     ```
   - Genera `~/.zshrc.secrets` con:
     ```bash
     export GEMINI_API_KEY="$(cat /Users/hugoruiz/.config/sops-nix/secrets/gemini_api_key)"
     ```

4. **Rebuild completa**
   - Activa la nueva configuración
   - Los secretos están disponibles como variables de entorno

---

### **4. Uso en Shell**

```bash
# Abre nuevo terminal
nu

# Verifica
echo $env.GEMINI_API_KEY
# AIzaSyD1234567890abcdefghijklmnop ✅

# Usa en comandos
curl -H "Authorization: Bearer $env.GEMINI_API_KEY" https://api.google.com/...
```

---

## 🔒 Seguridad: ¿Qué Está en Git y Qué No?

### ✅ En Git (SEGURO):

```
~/.config/nixos/
├── .sops.yaml                       ✅ Public key (seguro compartir)
├── secrets/
│   ├── gemini_api_key.yaml         ✅ Encriptado (seguro)
│   └── google_api_key.yaml         ✅ Encriptado (seguro)
├── hosts/darwin/.../home.nix       ✅ Configuración (no contiene secretos)
└── flake.nix                        ✅ Configuración (no contiene secretos)
```

### ❌ NUNCA en Git (PELIGROSO):

```
~/Library/Application Support/sops/age/
└── keys.txt                         ❌ PRIVATE KEY (NUNCA subir)

~/.config/sops-nix/secrets/
├── gemini_api_key                   ❌ DESENCRIPTADO (NUNCA subir)
└── google_api_key                   ❌ DESENCRIPTADO (NUNCA subir)
```

**¿Cómo asegurarte?**
- Verifica `.gitignore`:
  ```gitignore
  # .gitignore
  **/sops/age/keys.txt
  **/.config/sops-nix/secrets/
  ```

---

## 🎯 Resumen: ¿Por Qué Todo Esto?

### **Problema:**
- Necesitas API keys en tu código
- No puedes subirlas a Git en texto plano
- Necesitas compartirlas entre máquinas (work Mac, personal Mac, laptop Linux)

### **Solución con SOPS:**

1. **Encriptación Local**
   - Creas age key pair (pública/privada)
   - Encriptas secretos con public key
   - Subes archivos encriptados a Git

2. **Desencriptación Automática**
   - En cada máquina, guardas tu private key
   - sops-nix desencripta automáticamente en rebuild
   - Variables de entorno disponibles en shells

3. **Ventajas:**
   - ✅ Secretos en Git (encriptados)
   - ✅ Backup automático (Git)
   - ✅ Sincronización entre máquinas
   - ✅ Gestión declarativa (Nix)
   - ✅ Seguro (AES256-GCM encryption)

---

## 🚀 Próximos Pasos

### **1. Rebuild**

```bash
darwin-rebuild switch --flake ~/.config/nixos
```

### **2. Verifica**

```bash
# Nuevo terminal
nu

# Check variables
echo $env.GEMINI_API_KEY
echo $env.GOOGLE_API_KEY
```

### **3. Agrega Más Secretos (Opcional)**

```bash
# OpenAI
sops secrets/ai.yaml
# Agrega: openai_api_key, anthropic_api_key, etc.

# Databases
sops secrets/database.yaml
# Agrega: postgres_password, mysql_password, etc.

# GitHub
sops secrets/github.yaml
# Agrega: github_token, gh_token

# Luego descomenta las secciones en home.nix y rebuild
```

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│  1. Editas Secreto                                          │
│     sops secrets/gemini_api_key.yaml                        │
│     → Editor abre en texto plano                            │
│     → Guardas → SOPS encripta con public key               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Commit a Git                                            │
│     git add secrets/gemini_api_key.yaml                     │
│     git commit -m "Add Gemini key"                          │
│     → Archivo ENCRIPTADO sube a Git ✅                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Rebuild                                                 │
│     darwin-rebuild switch --flake ~/.config/nixos           │
│     → sops-nix lee private key                             │
│     → Desencripta secrets/gemini_api_key.yaml              │
│     → Guarda valor en ~/.config/sops-nix/secrets/          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. home-manager Configura Shells                           │
│     → Genera env.nu con:                                    │
│       $env.GEMINI_API_KEY = (cat ~/.config/sops-nix/...)  │
│     → Genera config.fish con:                               │
│       set -gx GEMINI_API_KEY (cat ...)                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Usas en Shell                                           │
│     nu                                                       │
│     echo $env.GEMINI_API_KEY                                │
│     → AIzaSyD1234567890abcdefghijklmnop ✅                 │
└─────────────────────────────────────────────────────────────┘
```

---

**Creado:** 2025-02-06
**Tu Configuración:** gemini_api_key + google_api_key configurados
**Next:** Hacer rebuild y verificar que funcionan
