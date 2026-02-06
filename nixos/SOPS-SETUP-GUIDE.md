# 🔐 Guía Completa de sops-nix: Gestión de Secretos

Esta guía te llevará paso a paso por el uso de **sops-nix** para gestionar secretos de forma segura en tu configuración de NixOS/nix-darwin.

## 📋 Tabla de Contenidos

1. [Estado Actual](#estado-actual)
2. [Generar Llaves en Otros Hosts](#generar-llaves-en-otros-hosts)
3. [Crear y Encriptar Secretos](#crear-y-encriptar-secretos)
4. [Rebuild y Activación](#rebuild-y-activación)
5. [Uso de Secretos](#uso-de-secretos)
6. [Commit a Git](#commit-a-git)
7. [Mantenimiento](#mantenimiento)
8. [Troubleshooting](#troubleshooting)

---

## 1. Estado Actual ✅

### ¿Qué se ha configurado?

✅ **sops-nix integrado** en flake.nix con módulos para Darwin y NixOS
✅ **age y sops** instalados en common-packages.nix
✅ **Llave age generada** para `work-mp-m3-max`
✅ **`.sops.yaml` creado** con reglas de encriptación
✅ **Estructura de secretos** lista en `~/.config/nixos/secrets/`
✅ **Templates de secretos** creados (.template files)
✅ **home-manager configurado** en los 3 hosts con sops
✅ **Variables de entorno** configuradas para todos los shells

### Hosts Configurados

| Host | Sistema | Shells Configurados | Estado Llave |
|------|---------|---------------------|--------------|
| **work-mp-m3-max** | macOS (M3) | Fish, Nushell, Zsh* | ✅ Generada |
| **mp-i9-16i** | macOS (Intel) | Fish, Nushell, Zsh | ⏳ Pendiente |
| **lenovo-nixos-btw** | NixOS | Bash, Fish*, Nushell* | ⏳ Pendiente |

*Zsh en work-mp-m3-max: gestionado manualmente (ver ~/.zshrc.secrets)
*Fish y Nushell en NixOS: usan archivos ~/.secrets.fish y ~/.secrets.nu

---

## 2. Generar Llaves en Otros Hosts 🔑

Necesitas ejecutar estos comandos **en cada host** donde aún no tienes llave generada.

### En mp-i9-16i (macOS Intel)

```bash
# 1. Asegúrate de tener el directorio
mkdir -p ~/Library/Application\ Support/sops/age

# 2. Genera la llave
age-keygen -o ~/Library/Application\ Support/sops/age/keys.txt

# 3. Obtén la llave pública (para agregar a .sops.yaml)
age-keygen -y ~/Library/Application\ Support/sops/age/keys.txt
```

### En lenovo-nixos-btw (NixOS)

```bash
# 1. Asegúrate de tener el directorio
mkdir -p ~/.config/sops/age

# 2. Genera la llave
age-keygen -o ~/.config/sops/age/keys.txt

# 3. Obtén la llave pública (para agregar a .sops.yaml)
age-keygen -y ~/.config/sops/age/keys.txt
```

### Actualizar .sops.yaml

Después de generar las llaves, **edita** `~/.config/nixos/.sops.yaml` y:

1. Descomenta las líneas de las llaves de los otros hosts
2. Reemplaza los `age1xxxxx...` con las llaves públicas reales que obtuviste
3. Descomenta las líneas en `key_groups` para incluir todos los hosts

**Ejemplo:**
```yaml
keys:
  - &host_work_mp_m3_max age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
  - &host_mp_i9_16i age1TU_LLAVE_PUBLICA_AQUI  # <- Actualiza esto
  - &host_lenovo_nixos_btw age1TU_LLAVE_PUBLICA_AQUI  # <- Y esto

creation_rules:
  - path_regex: secrets/.*\.(yaml|json|env|ini)$
    key_groups:
      - age:
        - *host_work_mp_m3_max
        - *host_mp_i9_16i  # <- Descomenta
        - *host_lenovo_nixos_btw  # <- Descomenta
```

---

## 3. Crear y Encriptar Secretos 🔒

### Paso 1: Hacer Rebuild para Instalar sops

Primero necesitas hacer rebuild para que `sops` esté disponible:

```bash
# En macOS
darwin-rebuild switch --flake ~/.config/nixos

# En NixOS
sudo nixos-rebuild switch --flake ~/.config/nixos
```

### Paso 2: Copiar Templates y Llenar Valores

```bash
cd ~/.config/nixos/secrets

# Copia cada template
cp ai.yaml.template ai.yaml
cp database.yaml.template database.yaml
cp github.yaml.template github.yaml
cp general.yaml.template general.yaml
```

### Paso 3: Editar y Encriptar con sops

```bash
# Edita ai.yaml - se abrirá en tu $EDITOR
sops ai.yaml

# Reemplaza los valores de ejemplo:
# ANTES:
#   openai_api_key: "TU_OPENAI_API_KEY_AQUI"
# DESPUÉS:
#   openai_api_key: "sk-proj-tu-key-real-aqui"

# Guarda y cierra el editor
# sops encriptará automáticamente el archivo
```

Repite para cada archivo de secretos que necesites.

### Paso 4: Verificar Encriptación

```bash
# Ver el archivo encriptado
cat secrets/ai.yaml

# Deberías ver algo como:
# openai_api_key: ENC[AES256_GCM,data:xxxxx...]
# sops:
#     kms: []
#     ...
```

✅ Si ves `ENC[...]`, está correctamente encriptado!

---

## 4. Rebuild y Activación 🚀

Ahora que tienes secretos encriptados, actívalos con rebuild:

### En macOS (nix-darwin)

```bash
cd ~/.config/nixos

# Rebuild del sistema
darwin-rebuild switch --flake .

# Verifica que no hay errores
echo $?  # Debería mostrar 0
```

### En NixOS

```bash
cd ~/.config/nixos

# Rebuild del sistema
sudo nixos-rebuild switch --flake .

# Verifica que no hay errores
echo $?  # Debería mostrar 0
```

### Verificación Post-Rebuild

```bash
# 1. Verifica que los secretos fueron desencriptados
ls -la ~/.config/sops-nix/secrets/
# Deberías ver: openai_api_key, anthropic_api_key, github_token, etc.

# 2. Abre un NUEVO terminal (importante!)

# 3. Verifica las variables de entorno
echo $OPENAI_API_KEY
echo $GITHUB_TOKEN

# 4. Si no ves valores:
#    - En work-mp-m3-max: agrega `source ~/.zshrc.secrets` a tu ~/.zshrc
#    - En NixOS: verifica que fish/nushell tienen los source statements
```

---

## 5. Uso de Secretos 💡

### En Shells

Las variables de entorno están disponibles automáticamente:

```bash
# Fish / Zsh / Bash / Nushell
echo $OPENAI_API_KEY
echo $GITHUB_TOKEN
```

### En Scripts de Nix

Puedes referenciar secretos en tu configuración:

```nix
# Ejemplo: Usar un secreto en un servicio
systemd.services.mi-servicio = {
  serviceConfig = {
    EnvironmentFile = config.sops.secrets.mi_secreto.path;
  };
};

# Ejemplo: Leer secreto en script
home.activation.mi-script = lib.hm.dag.entryAfter ["writeBoundary"] ''
  API_KEY=$(cat ${config.sops.secrets.openai_api_key.path})
  echo "Usando API key: $API_KEY"
'';
```

### Agregar Nuevos Secretos

1. Edita el archivo de secretos correspondiente:
   ```bash
   sops secrets/ai.yaml
   ```

2. Agrega tu nuevo secreto:
   ```yaml
   mi_nuevo_secreto: "valor-secreto"
   ```

3. Actualiza `home.nix` del host correspondiente:
   ```nix
   sops.secrets.mi_nuevo_secreto = {
     sopsFile = ../../../../secrets/ai.yaml;
   };
   ```

4. Agrega la variable de entorno en el shell (fish example):
   ```nix
   programs.fish.shellInit = ''
     set -gx MI_NUEVO_SECRETO (cat ${config.sops.secrets.mi_nuevo_secreto.path})
   '';
   ```

5. Rebuild:
   ```bash
   darwin-rebuild switch --flake ~/.config/nixos
   ```

---

## 6. Commit a Git 📤

### Verificación Pre-Commit

Antes de hacer commit, **VERIFICA** que los archivos están encriptados:

```bash
cd ~/.config/nixos

# 1. Verifica que los secretos están encriptados
cat secrets/ai.yaml
# Debe mostrar: ENC[AES256_GCM,data:...]

# 2. NUNCA commits las llaves privadas!
# Verifica que no están en el repo:
git status | grep -i "keys.txt"
# No debería mostrar nada

# 3. Verifica el gitignore (opcional, crear si no existe)
cat > .gitignore << 'EOF'
# Llaves privadas - NUNCA commitear
**/keys.txt
*.key
.age-key

# Templates sin encriptar
secrets/*.template

# Archivos temporales
result
result-*
EOF
```

### Hacer Commit

```bash
cd ~/.config/nixos

# 1. Agrega los cambios
git add flake.nix flake.lock
git add lib/helpers.nix
git add hosts/
git add .sops.yaml
git add secrets/
git add SOPS-SETUP-GUIDE.md

# 2. Verifica lo que vas a commitear
git diff --cached

# 3. Commit
git commit -m "feat: add sops-nix secret management

- Add sops-nix to flake inputs and modules
- Configure age encryption for 3 hosts
- Add encrypted secrets (ai, database, github)
- Integrate secrets into shell environments
- Add comprehensive setup documentation
"

# 4. Push a tu repositorio
git push origin main
```

### ✅ Seguridad Confirmada

- ✅ Archivos en `secrets/*.yaml` están **encriptados**
- ✅ Llaves privadas **NO están en Git** (están en ~/.config localmente)
- ✅ Solo hosts con llaves privadas pueden desencriptar
- ✅ Seguro para repositorios **públicos**

---

## 7. Mantenimiento 🔧

### Rotar un Secreto (ejemplo: API key comprometida)

```bash
# 1. Edita el archivo con sops
sops secrets/ai.yaml

# 2. Actualiza el valor
# openai_api_key: "sk-proj-NUEVA-KEY-AQUI"

# 3. Guarda (se encripta automáticamente)

# 4. Commit y push
git add secrets/ai.yaml
git commit -m "security: rotate OpenAI API key"
git push

# 5. Rebuild en cada host
darwin-rebuild switch --flake ~/.config/nixos

# 6. Recarga el shell o abre nuevo terminal
```

### Agregar un Nuevo Host

```bash
# 1. En el nuevo host, genera llave
mkdir -p ~/Library/Application\ Support/sops/age  # macOS
# o: mkdir -p ~/.config/sops/age  # Linux

age-keygen -o <path>/keys.txt
age-keygen -y <path>/keys.txt  # Obtén pública

# 2. Agrega la llave pública a .sops.yaml

# 3. Re-encripta TODOS los secretos existentes
cd ~/.config/nixos
sops updatekeys secrets/ai.yaml
sops updatekeys secrets/database.yaml
sops updatekeys secrets/github.yaml
sops updatekeys secrets/general.yaml

# 4. Commit los archivos actualizados
git add secrets/
git commit -m "security: add new host to sops encryption"
git push

# 5. En el nuevo host, pull y rebuild
```

### Backup de Llaves Privadas

**⚠️ IMPORTANTE:** Guarda tus llaves privadas en un lugar seguro!

```bash
# Copia la llave a un password manager o USB encriptado
cat ~/Library/Application\ Support/sops/age/keys.txt
# O en Linux: cat ~/.config/sops/age/keys.txt

# Opciones recomendadas:
# - 1Password (como documento seguro)
# - Bitwarden (como nota segura)
# - USB encriptado con VeraCrypt
# - Papel físico en caja fuerte (old school pero efectivo)
```

---

## 8. Troubleshooting 🐛

### "Error: no age key found"

**Problema:** sops no puede encontrar tu llave privada.

**Solución:**
```bash
# Verifica que la llave existe
# macOS:
ls -la ~/Library/Application\ Support/sops/age/keys.txt

# Linux:
ls -la ~/.config/sops/age/keys.txt

# Si no existe, genera una nueva (ver sección 2)
```

### "Error: MAC mismatch"

**Problema:** El archivo fue modificado fuera de sops o la llave es incorrecta.

**Solución:**
```bash
# Re-genera el archivo desde el template
cd ~/.config/nixos/secrets
rm ai.yaml
cp ai.yaml.template ai.yaml
sops ai.yaml  # Edita y guarda
```

### Variables de entorno vacías

**Problema:** `echo $OPENAI_API_KEY` no muestra nada.

**Solución:**
```bash
# 1. Verifica que hiciste rebuild
darwin-rebuild switch --flake ~/.config/nixos

# 2. Abre un NUEVO terminal (importante!)

# 3. Para work-mp-m3-max con zsh manual:
#    Agrega a tu ~/.zshrc:
echo 'source ~/.zshrc.secrets' >> ~/.zshrc
source ~/.zshrc

# 4. Verifica que el secreto existe
ls -la ~/.config/sops-nix/secrets/openai_api_key
cat ~/.config/sops-nix/secrets/openai_api_key
```

### "Error: could not decrypt"

**Problema:** Tu llave pública no está en `.sops.yaml` o el archivo fue encriptado sin tu llave.

**Solución:**
```bash
# 1. Verifica que tu llave está en .sops.yaml
cat ~/.config/nixos/.sops.yaml

# 2. Si no está, agrégala (ver sección 2)

# 3. Re-encripta el archivo
cd ~/.config/nixos
sops updatekeys secrets/ai.yaml
```

### El rebuild falla con errores de sops

**Problema:** Los archivos de secretos no existen o están vacíos.

**Solución:**
```bash
# 1. Crea los archivos de secretos
cd ~/.config/nixos/secrets
for f in ai database github general; do
  if [ ! -f "$f.yaml" ]; then
    echo "Creando $f.yaml..."
    sops $f.yaml
    # Dentro del editor, agrega al menos:
    # dummy: "placeholder"
    # Luego guarda y cierra
  fi
done

# 2. Intenta rebuild de nuevo
```

---

## 🚨 Disaster Recovery

**¿Qué pasa si reinstalo NixOS o compro laptop nueva?**

👉 **Lee la guía completa:** [SOPS-DISASTER-RECOVERY.md](./SOPS-DISASTER-RECOVERY.md)

Resumen rápido:
- ✅ **Con backup de llave:** Restaura llave → Rebuild → Listo
- ❌ **Sin backup:** Genera nueva llave → Regenera TODOS los secretos
- 🎯 **Mejor práctica:** ¡HAZ BACKUP DE TU LLAVE AHORA!

```bash
# Ver tu llave privada (GUÁRDALA en password manager)
cat ~/Library/Application\ Support/sops/age/keys.txt
```

---

## 📚 Recursos Adicionales

- **Documentación oficial sops-nix:** https://github.com/Mic92/sops-nix
- **Documentación age:** https://github.com/FiloSottile/age
- **Documentación SOPS:** https://github.com/getsops/sops
- **NixOS Wiki - Secret Management:** https://nixos.wiki/wiki/Comparison_of_secret_managing_schemes
- **Disaster Recovery Guide:** [SOPS-DISASTER-RECOVERY.md](./SOPS-DISASTER-RECOVERY.md)

---

## 🎉 ¡Listo!

Ahora tienes una configuración completa y segura de gestión de secretos con sops-nix. Tus API keys, contraseñas y tokens están:

- ✅ **Encriptados** en Git
- ✅ **Versionados** con tu configuración
- ✅ **Seguros** para repositorios públicos
- ✅ **Fáciles de usar** via variables de entorno
- ✅ **Fáciles de rotar** cuando sea necesario

¿Preguntas? Revisa la sección de [Troubleshooting](#troubleshooting) o consulta la documentación oficial.
