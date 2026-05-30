# Cloud Profiles — Guía de setup

Gestión multi-cuenta unificada para **`gcloud`**, **`gws`** (Google Workspace CLI) y **`notebooklm-py`**, usando mise tasks globales y `.mise.toml` per-directorio. Objetivo: un único login por identidad autoriza las tres herramientas; cada proyecto elige su perfil con dos líneas de TOML.

## Referencia rápida

| Perfil | gcloud config | gws config dir | notebooklm profile | Browser (rookiepy) |
|---|---|---|---|---|
| **work** | `work` | `~/.config/gws/work` | `work` | Microsoft Edge |
| **personal** | `personal` | `~/.config/gws/personal` | `personal` | Safari |

| Tarea de mise | Qué hace | Cuándo correrla |
|---|---|---|
| `mise run cloud:setup` | Crea configs/dirs/perfiles vacíos | Una vez, en una Mac nueva |
| `mise run cloud:login:work` | Login OAuth + captura de cookies (work) | Primera vez o tras revoke |
| `mise run cloud:login:personal` | Login OAuth + captura de cookies (personal) | Primera vez o tras revoke |
| `mise run cloud:check` | Diagnostica los 3 tools × 2 perfiles | Cuando algo falla |
| `mise run cloud:refresh-notebooklm:work` | Refresh rápido de cookies notebooklm (Edge) | Cookies de notebooklm caducadas |
| `mise run cloud:refresh-notebooklm:personal` | Refresh rápido de cookies notebooklm (Safari) | Cookies de notebooklm caducadas |

Todas las tasks están definidas en `~/.config/mise/config.toml`.

---

## Crear el ambiente para un proyecto nuevo

### 1. Elige el perfil

¿El proyecto es de trabajo o personal? Eso decide qué variables de entorno se cargan al hacer `cd`.

### 2. Crea el directorio del proyecto

```bash
mkdir -p ~/code/mi-proyecto && cd ~/code/mi-proyecto
```

### 3. Crea el `.mise.toml` del proyecto

Copia **uno** de estos dos bloques a `./.mise.toml`:

**Proyecto de trabajo:**
```toml
[env]
CLOUDSDK_ACTIVE_CONFIG_NAME     = "work"
GOOGLE_WORKSPACE_CLI_CONFIG_DIR = "{{env.HOME}}/.config/gws/work"
NOTEBOOKLM_PROFILE              = "work"
CLOUD_PROFILE                   = "work"
```

**Proyecto personal:**
```toml
[env]
CLOUDSDK_ACTIVE_CONFIG_NAME     = "personal"
GOOGLE_WORKSPACE_CLI_CONFIG_DIR = "{{env.HOME}}/.config/gws/personal"
NOTEBOOKLM_PROFILE              = "personal"
CLOUD_PROFILE                   = "personal"
```

Si el proyecto además necesita un stack de herramientas, añade `[tools]` arriba:

```toml
[tools]
node   = "lts"
python = "3.14.0"

[env]
CLOUDSDK_ACTIVE_CONFIG_NAME     = "work"
GOOGLE_WORKSPACE_CLI_CONFIG_DIR = "{{env.HOME}}/.config/gws/work"
NOTEBOOKLM_PROFILE              = "work"
CLOUD_PROFILE                   = "work"
```

### 4. Confía en el archivo

```bash
mise trust
```

mise te muestra el contenido del `.mise.toml` y pide confirmación. Es una protección anti-malware: evita que `cd` en un repo clonado te cambie `PATH` o credenciales sin saberlo.

### 5. Verifica que el perfil está activo

```bash
echo $CLOUD_PROFILE                                             # → work (o personal)
gcloud config list --format='value(core.account)'               # → cuenta del perfil
GOOGLE_WORKSPACE_CLI_CONFIG_DIR=$HOME/.config/gws/$CLOUD_PROFILE \
  gws auth status | jq .credential_source                       # → algo distinto de "none"
notebooklm status --paths                                       # → paths bajo profiles/$CLOUD_PROFILE
```

### 6. Si algo está caducado

```bash
mise run cloud:check
```

La salida te indica exactamente qué comando correr para refrescar lo que esté caído.

---

## Operaciones del día a día

### Cambiar entre perfiles sin salir de la terminal

La función `cloud` (en `~/.zshrc`) abre una subshell con un perfil activo, sin tocar el estado de la shell padre:

```bash
cloud work       # subshell con work activo
# ...ejecutas lo que sea...
exit             # vuelves a la shell original
```

Útil cuando estás en un directorio sin `.mise.toml` pero necesitas correr un comando con un perfil concreto.

### Refrescar credenciales

- **`gcloud` y `gws`** usan OAuth con refresh token. Casi nunca hay que re-autenticar; cuando sí, corre `mise run cloud:login:<profile>` completo.
- **`notebooklm`** usa cookies de browser que caducan en días/semanas. Para refrescar sin tocar gcloud/gws:

  ```bash
  mise run cloud:refresh-notebooklm:work
  mise run cloud:refresh-notebooklm:personal
  ```

  Estos leen las cookies actuales de Edge/Safari via `rookiepy` y actualizan el `storage_state.json`. No abren browser, tardan ~1s. Requieren que hayas visitado `notebooklm.google.com` en ese browser recientemente con la cuenta correspondiente.

---

## Setup inicial (una sola vez en una Mac nueva)

### Prerrequisitos

```bash
# gcloud
brew install --cask google-cloud-sdk

# gws (Google Workspace CLI no oficial)
brew install googleworkspace-cli

# notebooklm-py con el extra [cookies] (habilita rookiepy)
uv tool install 'notebooklm-py[cookies]'
# alternativas:
# pipx install 'notebooklm-py[cookies]'
# pip install  'notebooklm-py[cookies]'
```

### Crear los perfiles vacíos

```bash
mise run cloud:setup
```

### Autorizar cada perfil

```bash
mise run cloud:login:work       # gcloud + gws abren el browser por defecto
mise run cloud:login:personal   # gcloud + gws abren el browser por defecto
```

**Antes de `cloud:login:work`:** asegúrate de que el browser por defecto del sistema es **Edge** (*System Settings → Desktop & Dock → Default web browser*). Así gcloud y gws abrirán Edge para el OAuth, y las cookies quedarán sembradas en Edge para que notebooklm las lea después.

**Antes de `cloud:login:personal`:** cambia el browser por defecto a **Safari**. Mismo motivo.

> **Alternativa determinista:** si no quieres cambiar el default browser cada vez, edita las tasks en `config.toml` para añadir `--no-launch-browser` a los comandos `gcloud` y `gws`. Te imprimirán un URL que copias al browser correcto manualmente.

### Permisos del sistema (una vez)

| Browser | Permiso que pide | Dónde concederlo |
|---|---|---|
| **Edge (work)** | Keychain → "Microsoft Edge Safe Storage" | Aparece un prompt durante el primer `refresh-notebooklm:work`. Dale **Always Allow**. |
| **Safari (personal)** | **Full Disk Access** para tu terminal | *System Settings → Privacy & Security → Full Disk Access → +[tu terminal]*, y reinicia la terminal. |

Safari necesita FDA porque sus cookies están en `~/Library/Cookies/Cookies.binarycookies`, un archivo protegido a nivel de sandbox. Edge y Chrome solo usan Keychain. Si prefieres evitar el FDA, otra opción es usar **Firefox** para el perfil personal (sus cookies están en un SQLite sin cifrar y sin protecciones adicionales).

---

## Archivos que genera este setup

```
~/.config/gcloud/configurations/
├── config_default
├── config_work           ← gcloud perfil work
└── config_personal       ← gcloud perfil personal

~/.config/gws/
├── work/                 ← gws perfil work
│   ├── credentials.enc
│   └── client_secret.json
└── personal/             ← gws perfil personal
    ├── credentials.enc
    └── client_secret.json

~/.notebooklm/profiles/
├── work/
│   ├── storage_state.json    ← cookies leídas de Edge
│   ├── context.json
│   └── browser_profile/
└── personal/
    ├── storage_state.json    ← cookies leídas de Safari
    ├── context.json
    └── browser_profile/
```

---

## Troubleshooting

### `notebooklm login --browser safari` → "Permission denied"

Tu terminal no tiene Full Disk Access. Concédelo en *System Settings → Privacy & Security → Full Disk Access* y **reinicia la terminal** (el permiso se lee al arrancar el proceso).

### `notebooklm login --browser edge` → "Could not decrypt cookies"

Keychain no ha autorizado la lectura. Durante la primera corrida debería aparecer un prompt pidiendo acceso a "Microsoft Edge Safe Storage" — dale **Always Allow**. Si el prompt no aparece, fuérzalo con:

```bash
security find-generic-password -s "Microsoft Edge Safe Storage" -w
```

### `notebooklm auth check --test` dice que las cookies están caducadas

Asegúrate de haber visitado `notebooklm.google.com` en Edge/Safari con la cuenta correspondiente en los últimos días (solo tiene que estar abierto, puedes cerrarlo después). Luego:

```bash
mise run cloud:refresh-notebooklm:work    # o :personal
```

Si persiste, haz un re-login OAuth completo:

```bash
mise run cloud:login:work                 # o :personal
```

### `gcloud` usa la cuenta equivocada dentro de un proyecto con `.mise.toml`

Primero verifica que el `.mise.toml` está confiado:

```bash
mise doctor | grep -i trust
mise trust          # re-confía si hace falta
```

Después, que las env vars están en el entorno de la shell:

```bash
env | grep -E 'CLOUDSDK|GOOGLE_WORKSPACE|NOTEBOOKLM|CLOUD_PROFILE'
```

Si no aparecen, tu shell no tiene el hook de mise activado. Añade a `~/.zshrc`:

```bash
eval "$(mise activate zsh)"
```

### Olvidé qué perfil estoy usando en esta shell

```bash
echo $CLOUD_PROFILE
```

Si tu `PROMPT` incluye el helper `cloud_prompt` del `~/.zshrc`, verás `[cloud:work]` o `[cloud:personal]` en el propio prompt.

---

## Referencias

- **Google Workspace CLI (`gws`)**: https://github.com/googleworkspace/cli
- **notebooklm-py**: https://github.com/teng-lin/notebooklm-py
- **rookiepy** (extrae cookies del browser): https://github.com/thewh1teagle/rookie
- **mise environments**: https://mise.jdx.dev/environments.html
- **gcloud configurations**: https://cloud.google.com/sdk/gcloud/reference/config/configurations
