terraform {
  required_providers {
    coder = {
      source = "coder/coder"
    }
    docker = {
      source = "kreuzwerker/docker"
    }
  }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "docker_socket" {
  type        = string
  default     = ""
  description = "(Opcional) URI del socket de Docker. Vacio usa el del host."
}

variable "image" {
  type        = string
  default     = "codercom/example-base:ubuntu"
  description = "Imagen base del workspace. Trae sudo, git, curl y build-essential."
}

variable "timezone" {
  type        = string
  default     = "America/Monterrey"
  description = "Zona horaria del workspace. Debe existir en /usr/share/zoneinfo."
}

variable "docker_in_workspace" {
  type    = bool
  default = true
  description = <<-EOT
    Corre un dockerd dentro del workspace para levantar servicios (postgres,
    mongo, livekit, cualquier docker-compose). Los puertos publicados quedan en
    el namespace de red del workspace, asi que Coder los detecta y les da
    subdominio automaticamente, sin colisionar con otros workspaces.

    Exige privileged en el contenedor, que implica acceso root al host. En
    Ubuntu 26.04 no hay alternativa: Sysbox, que da lo mismo sin privilegios,
    solo soporta hasta Ubuntu 22.04. Ponlo en false si compartes este Coder.
  EOT
}

provider "docker" {
  host = var.docker_socket != "" ? var.docker_socket : null
}

# ---------------------------------------------------------------------------
# Datos
# ---------------------------------------------------------------------------

data "coder_provisioner" "me" {}
data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

# Obliga a autorizar GitHub antes de construir el workspace, y deja las
# credenciales en el helper de git del agente: git-clone y las operaciones
# manuales pueden leer repos privados sin pedir usuario ni contrasena.
#
# Usa el proveedor integrado de Coder (device flow), asi que no hay que
# registrar una OAuth App ni guardar client secrets en el servidor.
data "coder_external_auth" "github" {
  id = "github"
}

locals {
  username = data.coder_workspace_owner.me.name
  home     = "/home/coder"
}

# ---------------------------------------------------------------------------
# Agente
# ---------------------------------------------------------------------------

resource "coder_agent" "main" {
  arch = data.coder_provisioner.me.arch
  os   = "linux"

  # Sin startup_script a proposito: el agente convierte startup_script en un
  # coder_script mas y los lanza TODOS en paralelo (errgroup), sin orden. La
  # copia de /etc/skel tiene que ir dentro de bootstrap_tools, porque si corre
  # concurrente puede sobrescribir el .profile que ese mismo script edita.

  # Las herramientas instaladas por bootstrap viven en el volumen home.
  env = {
    CARGO_HOME  = "${local.home}/.cargo"
    RUSTUP_HOME = "${local.home}/.rustup"

    # Cubre a los programas que respetan TZ. Los que leen /etc/localtime
    # directamente los atiende bootstrap_tools, que ademas lo rehace en cada
    # arranque porque /etc vive en el contenedor, no en el volumen.
    TZ = var.timezone
  }

  metadata {
    display_name = "CPU"
    key          = "0_cpu_usage"
    script       = "coder stat cpu"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "RAM"
    key          = "1_ram_usage"
    script       = "coder stat mem"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "Disco home"
    key          = "2_home_disk"

    # Ruta literal, resuelta por Terraform. El agente ejecuta los scripts de
    # metadata con el shell de login, que aqui es nushell: "$HOME" fallaria con
    # env_var_not_var, y "$env.HOME" rompería en cuanto el shell fuese otro.
    script   = "coder stat disk --path ${local.home}"
    interval = 60
    timeout  = 1
  }
}

# ---------------------------------------------------------------------------
# Bootstrap: rustup + uv
#
# Va en un coder_script propio y no en el modulo personalize, porque personalize
# solo ejecuta ~/personalize (un archivo del desarrollador) y no admite inyectar
# comandos desde la plantilla. Ambas instalaciones son idempotentes: en arranques
# posteriores detectan el binario y salen sin hacer nada.
# ---------------------------------------------------------------------------

resource "coder_script" "bootstrap_tools" {
  agent_id     = coder_agent.main.id
  display_name = "Bootstrap (rustup + uv)"
  icon         = "/icon/terminal.svg"
  run_on_start = true
  # No bloquea el login: la terminal esta disponible mientras se instala.
  start_blocks_login = false

  script = <<-EOT
    #!/usr/bin/env bash
    set -euo pipefail

    # Paso 1, y tiene que ser aqui: el volumen de /home/coder nace vacio y tapa
    # lo que traiga la imagen, asi que sin esto no hay .bashrc ni .profile.
    # Va en este script y no en coder_agent.startup_script porque el agente
    # ejecuta todos los scripts en paralelo: una copia de skel concurrente
    # sobrescribiria el .profile que editamos al final.
    if [ ! -f "$HOME/.init_done" ]; then
      echo "Sembrando el home desde /etc/skel..."
      cp -rT /etc/skel "$HOME"
      touch "$HOME/.init_done"
    fi

    # Zona horaria. La variable TZ del agente no basta: git, los logs y
    # cualquier programa que lea /etc/localtime seguirian en UTC. Y como /etc
    # vive en el contenedor y no en el volumen, hay que rehacerlo cada arranque.
    TZ_WANTED="${var.timezone}"
    if [ -f "/usr/share/zoneinfo/$TZ_WANTED" ]; then
      if [ "$(readlink -f /etc/localtime 2>/dev/null)" != "/usr/share/zoneinfo/$TZ_WANTED" ]; then
        sudo ln -sf "/usr/share/zoneinfo/$TZ_WANTED" /etc/localtime
        echo "$TZ_WANTED" | sudo tee /etc/timezone >/dev/null
        echo "Zona horaria: $TZ_WANTED ($(date +%Z%z))"
      fi
    else
      echo "AVISO: zona horaria $TZ_WANTED no existe en /usr/share/zoneinfo"
    fi

    # -----------------------------------------------------------------------
    # dockerd dentro del workspace.
    #
    # No hay systemd en el contenedor, asi que se arranca a mano en cada
    # encendido. setsid lo desprende de este script para que sobreviva cuando
    # el agente termine de ejecutarlo.
    #
    # Los binarios (dockerd, containerd, runc, iptables) ya vienen en la imagen
    # base. Los contenedores que levantes publican sus puertos en el namespace
    # de red de ESTE contenedor, que es justo lo que Coder inspecciona: por eso
    # aparecen solos como subdominio y no chocan con los de otro workspace.
    # -----------------------------------------------------------------------
    if [ "${var.docker_in_workspace}" = "true" ]; then
      if ! docker info >/dev/null 2>&1; then
        echo "Arrancando dockerd..."
        sudo mkdir -p /var/lib/docker
        sudo sh -c 'setsid dockerd --host=unix:///var/run/docker.sock \
          > /var/log/dockerd.log 2>&1 < /dev/null &'

        for i in $(seq 1 45); do
          [ -S /var/run/docker.sock ] && break
          sleep 1
        done
        # El socket nace de root:root. En este contenedor solo existen root y
        # coder, asi que cambiarle el dueno es mas simple y menos fragil que
        # jugar con el grupo docker, que no aplicaria a la sesion ya abierta.
        [ -S /var/run/docker.sock ] && sudo chown "$(id -un)" /var/run/docker.sock
      fi

      if docker info >/dev/null 2>&1; then
        echo "dockerd listo: $(docker version --format '{{.Server.Version}}')"
      else
        echo "AVISO: dockerd no respondio. Revisa /var/log/dockerd.log"
      fi
    fi

    if ! command -v rustup >/dev/null 2>&1; then
      echo "Instalando rustup..."
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    else
      echo "rustup ya instalado, omitiendo."
    fi

    if ! command -v uv >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/uv" ]; then
      echo "Instalando uv..."
      curl -LsSf https://astral.sh/uv/install.sh | sh
    else
      echo "uv ya instalado, omitiendo."
    fi

    # Neovim. La imagen base no lo trae y un `apt install` no sobrevive:
    # el contenedor se recrea en cada arranque y solo /home/coder persiste.
    # Por eso va al home, como rustup y uv. Para actualizar, sube la version.
    NVIM_VERSION="v0.12.5"
    case "$(uname -m)" in
      x86_64) NVIM_ARCH="x86_64" ;;
      aarch64 | arm64) NVIM_ARCH="arm64" ;;
      *) NVIM_ARCH="" ;;
    esac

    if [ -z "$NVIM_ARCH" ]; then
      echo "Arquitectura $(uname -m) sin binario de neovim, omitiendo."
    elif [ -x "$HOME/.local/nvim/bin/nvim" ]; then
      echo "neovim ya instalado ($("$HOME/.local/nvim/bin/nvim" --version | head -1)), omitiendo."
    else
      echo "Instalando neovim $NVIM_VERSION ($NVIM_ARCH)..."
      # Directorio propio en vez de volcar sobre ~/.local: el tarball trae
      # share/nvim/runtime y ahi mismo escriben lazy.nvim y mason.
      mkdir -p "$HOME/.local/nvim" "$HOME/.local/bin"
      curl -fsSL "https://github.com/neovim/neovim/releases/download/$NVIM_VERSION/nvim-linux-$NVIM_ARCH.tar.gz" \
        | tar -xz -C "$HOME/.local/nvim" --strip-components=1
      ln -sf "$HOME/.local/nvim/bin/nvim" "$HOME/.local/bin/nvim"
    fi

    # El PATH va en .profile, NO en .bashrc: el .bashrc de Ubuntu empieza con
    #   case $- in *i*) ;; *) return;; esac
    # y aborta en shells no interactivos, asi que un bloque al final del archivo
    # nunca se ejecuta ahi. .profile no tiene esa guarda y lo leen los shells de
    # login, que es como arranca la terminal web de Coder.
    #
    # Nota para fish: fish no lee .profile ni .bashrc. Su PATH tiene que venir
    # de tu propia config de fish en los dotfiles.
    if ! grep -q 'coder-dev_fm PATH' "$HOME/.profile" 2>/dev/null; then
      cat >> "$HOME/.profile" <<'RC'

# coder-dev_fm PATH
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
RC
    fi

    # Semilla de ~/personalize para que el modulo personalize tenga algo que correr.
    if [ ! -e "$HOME/personalize" ]; then
      cat > "$HOME/personalize" <<'PERS'
#!/usr/bin/env bash
# Tus personalizaciones. Se ejecuta en cada arranque del workspace,
# asi que manten todo idempotente. Salida en ~/personalize.log
set -euo pipefail
PERS
      chmod +x "$HOME/personalize"
    fi
  EOT
}

# ---------------------------------------------------------------------------
# Dotfiles: el repo se materializa COMO ~/.config
#
# No usamos el modulo dotfiles del registry; ver la nota en modules.tf.
# Script propio para que tenga su entrada de log en la UI. Puede correr en
# paralelo con bootstrap_tools sin riesgo: /etc/skel de la imagen base no
# contiene .config, asi que no hay ningun fichero en disputa.
# ---------------------------------------------------------------------------

data "coder_parameter" "dotfiles_repo" {
  name         = "dotfiles_repo"
  display_name = "Dotfiles"
  description  = <<-EOT
    Repositorio que se materializa COMO ~/.config, no como un directorio dentro.
    Ejemplo: https://github.com/hugotown/dotfiles.git
    Dejalo vacio para no sincronizar ~/.config; las herramientas se instalan igual.
  EOT
  type         = "string"
  default      = ""
  mutable      = true
  order        = 2
}

resource "coder_script" "workspace_setup" {
  # Sin count: las herramientas se instalan tengas dotfiles o no. Solo el
  # bloque de sincronizacion de ~/.config mira si el parametro viene vacio.
  agent_id           = coder_agent.main.id
  display_name       = "Dotfiles y herramientas"
  icon               = "/icon/dotfiles.svg"
  run_on_start       = true
  start_blocks_login = false

  # Log en el volumen persistente. Sin esto la salida vive solo en
  # /tmp/coder-script-data, que se limpia y deja sin rastro cualquier fallo.
  log_path = "/home/coder/dev_fm-setup.log"

  script = <<-EOT
    #!/usr/bin/env bash
    set -euo pipefail

    REPO_URL="${data.coder_parameter.dotfiles_repo.value}"
    BRANCH="main"
    CFG="$HOME/.config"

    mkdir -p "$CFG"

    # Todo el bloque de dotfiles es opcional. Si no hay repo configurado se
    # salta la sincronizacion, los symlinks y env.local.nu, pero las
    # herramientas de mas abajo se instalan igual.
    #
    # El cuerpo del else no va indentado a proposito: indentarlo obligaria a
    # reescribir 80 lineas solo por estetica, y bash no lo necesita.
    if [ -z "$REPO_URL" ]; then
    echo "Sin repositorio de dotfiles configurado."
    echo "Omito ~/.config, symlinks y env.local.nu. Las herramientas siguen."
    else

    cd "$CFG"

    if [ ! -d .git ]; then
      echo "Inicializando ~/.config como repositorio git..."
      git init -q
    fi

    if git remote get-url origin >/dev/null 2>&1; then
      git remote set-url origin "$REPO_URL"
    else
      git remote add origin "$REPO_URL"
    fi

    echo "Trayendo $BRANCH desde $REPO_URL..."
    git fetch --depth=1 origin "$BRANCH"

    # Sobrescribe sin preguntar, por decision explicita. reset --hard pisa los
    # cambios locales y los ficheros sin seguimiento que choquen con el repo.
    # Lo que no esta en el repo (copyparty/, uv/) sobrevive intacto.
    git reset --hard "origin/$BRANCH"

    echo "~/.config sincronizado:"
    git --no-pager log -1 --format='  %h  %s'

    # Herramientas que insisten en escribir en $HOME en vez de respetar
    # XDG_CONFIG_HOME. Las apuntamos a ~/.config para que su estado quede
    # dentro del repo y se versione como el resto.
    #
    # Va aqui y no en personalize: personalize corre en paralelo con este
    # script, asi que no puede asumir que ~/.config ya existe. Aqui el orden
    # esta garantizado porque es el mismo script.
    echo "Enlazando directorios de herramientas:"

    link_config() {
      src="$1" # nombre dentro de ~/.config
      dst="$2" # ruta en $HOME

      mkdir -p "$CFG/$src"

      if [ -L "$HOME/$dst" ]; then
        # Ya es symlink: lo reapuntamos por si cambio el destino.
        ln -sfn "$CFG/$src" "$HOME/$dst"
      elif [ -e "$HOME/$dst" ]; then
        # Directorio o fichero real. Lo apartamos en vez de borrarlo: perder
        # credenciales o historial de una de estas herramientas seria caro.
        backup="$HOME/$dst.bak.$(date +%s)"
        echo "  ~/$dst existe y no es symlink, lo muevo a $backup"
        mv "$HOME/$dst" "$backup"
        ln -s "$CFG/$src" "$HOME/$dst"
      else
        ln -s "$CFG/$src" "$HOME/$dst"
      fi

      echo "  ~/$dst -> ~/.config/$src"
    }

    link_config codex     .codex
    link_config kimi-code .kimi-code
    link_config claude    .claude
    link_config pi        .pi
    link_config agents    .agents

    # -----------------------------------------------------------------------
    # shell/env.local.nu
    #
    # Tu shell/env.nu lo referencia con un guardia `path exists`, pero en
    # nushell `source` se resuelve en tiempo de PARSEO: el guardia se evalua
    # despues, asi que si el fichero falta revienta el parseo entero y
    # $env.PATH nunca llega a construirse. En fish y zsh el guardia si
    # funciona porque alli source es en tiempo de ejecucion.
    #
    # Tu hosts/at-apptools/initialize.sh lo genera por host; aqui hacemos lo
    # mismo. Esta gitignoreado via shell/.gitignore (env.local.*).
    # -----------------------------------------------------------------------
    ENV_LOCAL="$CFG/shell/env.local.nu"

    if [ -d "$CFG/shell" ]; then
      if [ ! -f "$ENV_LOCAL" ]; then
        echo "Creando shell/env.local.nu"
        printf '# Entorno de este host. Generado por la plantilla dev_fm de Coder.\n' \
          > "$ENV_LOCAL"
      fi

    fi

    fi # fin del bloque condicional de dotfiles

    # -----------------------------------------------------------------------
    # Homebrew
    #
    # Va en /home/linuxbrew/.linuxbrew, su prefijo estandar, que tiene su
    # propio volumen Docker (ver docker_volume.linuxbrew). Sin ese volumen se
    # perderia en cada arranque; y fuera del prefijo estandar brew no usa
    # bottles y compila todo desde fuente, que son horas.
    # -----------------------------------------------------------------------
    BREW_BIN="/home/linuxbrew/.linuxbrew/bin/brew"

    if [ ! -x "$BREW_BIN" ]; then
      echo "Instalando Homebrew (solo la primera vez, tarda unos minutos)..."
      sudo chown -R "$(id -un):$(id -gn)" /home/linuxbrew
      NONINTERACTIVE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    eval "$("$BREW_BIN" shellenv)"

    if ! grep -q 'coder-dev_fm BREW' "$HOME/.profile" 2>/dev/null; then
      cat >> "$HOME/.profile" <<'RC'

# coder-dev_fm BREW
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
RC
    fi

    echo "Instalando herramientas de terminal..."
    # brew es idempotente: si ya estan, no hace nada.
    brew install \
      nushell \
      starship atuin zoxide \
      yazi television \
      ripgrep fd fzf bat eza \
      gh lazygit \
      ast-grep jq mise

    # -----------------------------------------------------------------------
    # Agentes de codigo. Cada instalador escribe en $HOME, que persiste, asi
    # que el guardia por command -v los salta en arranques posteriores.
    # -----------------------------------------------------------------------
    echo "Instalando agentes..."

    install_agent() {
      name="$1"
      shift
      if command -v "$name" >/dev/null 2>&1; then
        echo "  $name ya instalado"
      else
        echo "  instalando $name..."
        if "$@"; then
          echo "  $name OK"
        else
          echo "  AVISO: fallo la instalacion de $name (codigo $?), sigo con el resto"
        fi
      fi
    }

    run_sh()   { curl -fsSL "$1" | sh; }
    run_bash() { curl -fsSL "$1" | bash; }

    # -----------------------------------------------------------------------
    # Node base via nvm, ANTES de mise y a proposito independiente de el.
    #
    # Varios instaladores de agentes necesitan node en tiempo de instalacion.
    # Si dependieran solo de mise, un fallo de mise o unos shims aun no
    # generados los tumbarian en cascada. nvm vive en ~/.nvm, dentro del
    # volumen persistente, asi que esto ocurre una sola vez.
    #
    # No contamina tu shell: ~/.nvm/versions/... no esta en el PATH de tu
    # shell/env.nu, asi que el node que uses a diario sigue siendo el de mise.
    # Este es solo el node de arranque para los instaladores.
    # -----------------------------------------------------------------------
    export NVM_DIR="$HOME/.nvm"

    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      echo "Instalando nvm..."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
    fi

    # nvm.sh usa variables sin definir, incompatible con `set -u`.
    set +u
    . "$NVM_DIR/nvm.sh"
    if ! nvm ls 24 >/dev/null 2>&1; then
      echo "Instalando node 24 via nvm..."
      nvm install 24
    fi
    nvm use 24 >/dev/null
    corepack enable pnpm 2>/dev/null || true
    set -u

    echo "  node base: $(node -v)  pnpm: $(pnpm -v 2>/dev/null || echo 'n/d')"

    # Ahora mise, con los toolchains que declara tu mise/config.toml.
    echo "Instalando toolchains declarados en ~/.config/mise/config.toml..."
    mise install -y || echo "AVISO: mise install fallo, sigo"
    # reshim explicito: mise crea los shims de forma diferida y sin esto el
    # instalador de pi puede no encontrar node todavia.
    mise reshim || true
    export PATH="$HOME/.local/share/mise/shims:$PATH"

    # Ojo con los nombres de binario: no siempre coinciden con el del producto.
    # kimi-code instala un ejecutable llamado "kimi".
    install_agent claude   run_bash https://claude.ai/install.sh
    install_agent codex    run_sh   https://chatgpt.com/codex/install.sh
    install_agent kimi     run_bash https://code.kimi.com/kimi-code/install.sh
    install_agent opencode run_bash https://opencode.ai/v2/install
    install_agent tuios    run_bash https://raw.githubusercontent.com/Gaurav-Gosain/tuios/main/install.sh
    install_agent herdr    run_sh   https://herdr.dev/install.sh
    install_agent pi       run_sh   https://pi.dev/install.sh

    # kimi, opencode y pi no instalan en ~/.local/bin sino en sus propios
    # directorios, que no estan en el PATH de tu shell/env.nu. El instalador
    # de pi incluso lo avisa: "your shell is not using that install yet".
    # En vez de tocar tus dotfiles, los enlazamos donde tu config ya mira.
    mkdir -p "$HOME/.local/bin"
    for pair in "$HOME/.kimi-code/bin/kimi" "$HOME/.opencode/bin/opencode" "$HOME/.pi/agent/bin/pi"; do
      if [ -x "$pair" ]; then
        ln -sf "$pair" "$HOME/.local/bin/$(basename "$pair")"
        echo "  enlazado $(basename "$pair") en ~/.local/bin"
      fi
    done

    # -----------------------------------------------------------------------
    # Tu propio bootstrap de shell. Genera ~/.cache/shell/starship.nu y
    # mise.nu, que config.nu hace source. Sin esto no tienes ni prompt ni
    # toolchains de mise dentro de nushell. Es el paso 7 de tu
    # hosts/at-apptools/initialize.sh.
    #
    # Va al final a proposito: necesita starship y mise ya instalados.
    # -----------------------------------------------------------------------
    if [ -x "$CFG/shell/bootstrap.sh" ] || [ -f "$CFG/shell/bootstrap.sh" ]; then
      echo "Ejecutando ~/.config/shell/bootstrap.sh..."
      bash "$CFG/shell/bootstrap.sh" || echo "AVISO: bootstrap.sh fallo, sigo"
    fi

    # -----------------------------------------------------------------------
    # Alias de los agentes para nushell.
    #
    # Son `def --wrapped` y no `alias`: tres de los cuatro se llaman igual que
    # su binario y `alias claude = claude ...` recursaria. El `^` fuerza el
    # ejecutable externo. Y `export X=1 && cmd` no existe en nushell: no hay
    # `export` ni `&&`, asi que la variable va con with-env, que ademas la
    # acota a esa invocacion en vez de dejarla puesta en toda la sesion.
    #
    # El fichero vive en ~/.cache/shell, fuera del repo de dotfiles, para que
    # el `git reset --hard` de arriba no se lo lleve por delante y no aparezca
    # en tu `git status`. config.nu ya carga dos ficheros de ese directorio.
    #
    # Tiene que engancharse en config.nu y no en env.local.nu: nushell evalua
    # env.nu en un alcance aparte y los `def` de ahi no llegan a la sesion.
    # Comprobado: via env.nu se definen 0 comandos, via config.nu los 4.
    # -----------------------------------------------------------------------
    if [ -f "$CFG/nushell/config.nu" ]; then
      mkdir -p "$HOME/.cache/shell"

      cat > "$HOME/.cache/shell/dev_fm-agents.nu" <<'AGENTS'
# Generado por la plantilla dev_fm de Coder. Los cambios se sobrescriben.

def --wrapped claude [...args] {
  with-env {IS_SANDBOX: "1"} { ^claude ...$args }
}

def --wrapped cldy [...args] {
  with-env {IS_SANDBOX: "1"} { ^claude --dangerously-skip-permissions ...$args }
}

def --wrapped opencode [...args] { ^opencode --auto ...$args }

def --wrapped codex [...args] { ^codex --yolo ...$args }

def --wrapped kimi [...args] { ^kimi --auto ...$args }
AGENTS

      # El source va al final de config.nu para ganarle a integrations/cldy.nu,
      # que define su propio alias cldy. Se reaplica en cada arranque porque el
      # reset --hard restaura config.nu; si commiteas esta linea a tu repo, el
      # grep la detecta y deja de tocar el fichero.
      if ! grep -q 'dev_fm-agents' "$CFG/nushell/config.nu"; then
        printf '\n# Alias de agentes, anadido por la plantilla dev_fm de Coder\nsource ~/.cache/shell/dev_fm-agents.nu\n' \
          >> "$CFG/nushell/config.nu"
      fi
      echo "Alias de agentes listos (claude, cldy, opencode, codex)"
    fi

    # -----------------------------------------------------------------------
    # nushell como shell por defecto.
    #
    # /etc/passwd vive en el contenedor, no en el volumen, asi que esto se
    # repite en cada arranque. Solo cambiamos el shell si nu arranca limpio:
    # un shell por defecto roto te dejaria sin terminal web.
    # -----------------------------------------------------------------------
    NU="$(command -v nu || true)"
    if [ -n "$NU" ]; then
      if nu -c 'print "ok"' >/dev/null 2>&1; then
        grep -qxF "$NU" /etc/shells || echo "$NU" | sudo tee -a /etc/shells >/dev/null
        if [ "$SHELL" != "$NU" ]; then
          sudo chsh -s "$NU" "$(id -un)"
          echo "Shell por defecto: $NU"
        fi
      else
        echo "AVISO: nu no arranca limpio, dejo el shell por defecto sin tocar"
      fi
    fi

    echo "Setup completo."
  EOT
}

# ---------------------------------------------------------------------------
# Infraestructura Docker
# ---------------------------------------------------------------------------

resource "docker_volume" "home" {
  name = "coder-${data.coder_workspace.me.id}-home"

  # Conserva el volumen aunque cambien los parametros del workspace.
  lifecycle {
    ignore_changes = all
  }

  labels {
    label = "coder.owner"
    value = data.coder_workspace_owner.me.name
  }
  labels {
    label = "coder.owner_id"
    value = data.coder_workspace_owner.me.id
  }
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
  labels {
    label = "coder.workspace_name_at_creation"
    value = data.coder_workspace.me.name
  }
}

# Volumen propio para Homebrew. Su prefijo estandar es /home/linuxbrew, fuera
# de /home/coder, asi que sin esto se reinstalaria entero en cada arranque.
resource "docker_volume" "linuxbrew" {
  name = "coder-${data.coder_workspace.me.id}-linuxbrew"

  lifecycle {
    ignore_changes = all
  }

  labels {
    label = "coder.owner"
    value = data.coder_workspace_owner.me.name
  }
  labels {
    label = "coder.owner_id"
    value = data.coder_workspace_owner.me.id
  }
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
  labels {
    label = "coder.workspace_name_at_creation"
    value = data.coder_workspace.me.name
  }
}

# Volumen para /var/lib/docker del dockerd interno. Sin el, cada arranque
# redescargaria todas las imagenes: el resto del contenedor es efimero.
resource "docker_volume" "docker_lib" {
  count = var.docker_in_workspace ? 1 : 0
  name  = "coder-${data.coder_workspace.me.id}-dockerlib"

  lifecycle {
    ignore_changes = all
  }

  labels {
    label = "coder.owner"
    value = data.coder_workspace_owner.me.name
  }
  labels {
    label = "coder.owner_id"
    value = data.coder_workspace_owner.me.id
  }
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
  labels {
    label = "coder.workspace_name_at_creation"
    value = data.coder_workspace.me.name
  }
}

resource "docker_image" "workspace" {
  name         = var.image
  keep_locally = true
}

resource "docker_container" "workspace" {
  count    = data.coder_workspace.me.start_count
  image    = docker_image.workspace.name
  name     = "coder-${data.coder_workspace_owner.me.name}-${lower(data.coder_workspace.me.name)}"
  hostname = data.coder_workspace.me.name

  # Reescribe localhost a host.docker.internal para que el agente alcance a coderd.
  entrypoint = ["sh", "-c", replace(coder_agent.main.init_script, "/localhost|127\\.0\\.0\\.1/", "host.docker.internal")]
  env        = ["CODER_AGENT_TOKEN=${coder_agent.main.token}"]

  host {
    host = "host.docker.internal"
    ip   = "host-gateway"
  }

  volumes {
    container_path = local.home
    volume_name    = docker_volume.home.name
    read_only      = false
  }

  volumes {
    container_path = "/home/linuxbrew"
    volume_name    = docker_volume.linuxbrew.name
    read_only      = false
  }

  # Requisito del dockerd interno. Con esto el workspace tiene acceso root al
  # host; ver la nota en variable "docker_in_workspace".
  privileged = var.docker_in_workspace

  dynamic "volumes" {
    for_each = var.docker_in_workspace ? [1] : []
    content {
      container_path = "/var/lib/docker"
      volume_name    = docker_volume.docker_lib[0].name
      read_only      = false
    }
  }

  labels {
    label = "coder.owner"
    value = data.coder_workspace_owner.me.name
  }
  labels {
    label = "coder.owner_id"
    value = data.coder_workspace_owner.me.id
  }
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
  labels {
    label = "coder.workspace_name"
    value = data.coder_workspace.me.name
  }
}
