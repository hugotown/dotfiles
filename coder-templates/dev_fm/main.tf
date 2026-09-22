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
    CARGO_HOME = "${local.home}/.cargo"
    RUSTUP_HOME = "${local.home}/.rustup"
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
    script       = "coder stat disk --path $HOME"
    interval     = 60
    timeout      = 1
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