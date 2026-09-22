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

  # El volumen de /home/coder nace vacio y tapa lo que traiga la imagen.
  # Sin esto el usuario no tiene .bashrc, .profile ni nada de /etc/skel.
  startup_script = <<-EOT
    set -e

    if [ ! -f ~/.init_done ]; then
      cp -rT /etc/skel ~
      touch ~/.init_done
    fi
  EOT

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

    # Los instaladores no siempre tocan .bashrc de forma consistente.
    # Añadimos el PATH una sola vez, de forma idempotente.
    if ! grep -q 'coder-dev_fm PATH' "$HOME/.bashrc" 2>/dev/null; then
      cat >> "$HOME/.bashrc" <<'RC'

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