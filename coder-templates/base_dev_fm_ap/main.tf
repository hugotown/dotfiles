terraform {
  required_version = ">= 1.7.0, < 2.0.0"
  required_providers {
    coder = {
      source  = "coder/coder"
      version = "2.18.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}
data "coder_external_auth" "github" {
  id       = "github"
  optional = false
}
data "docker_network" "control" {
  name = "coder-native_outbound"
}

data "coder_parameter" "repository_url" {
  name         = "repository_url"
  display_name = "GitHub repository"
  description  = "Git clones into ~ using the repository name (for example, ~/firstmate). Existing paths are preserved."
  type         = "string"
  default      = "https://github.com/kunchenguid/firstmate"
  mutable      = true
  validation {
    regex = "^$|^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$"
    error = "Leave blank or enter an HTTPS GitHub repository URL without embedded credentials."
  }
}

locals {
  project = "coder-fm-ap-${data.coder_workspace.me.id}"
  labels = {
    "com.docker.compose.project" = local.project
    "coder.workspace_id"         = data.coder_workspace.me.id
    "coder.owner_id"             = data.coder_workspace_owner.me.id
    "coder.template"             = "base-dev-fm-ap"
  }
  # Edit service names/ports here. These are container ports, never host bindings.
  # Coder generates private service URLs under *.apps.hugoruiz.dev.
  # Match OQC's frontend/backend ports; Coder supplies the workspace hostnames.
  services = {
    web     = 3001
    backend = 3000
    agent   = 7880
  }
  livekit_public_url = "wss://agent--${lower(data.coder_workspace.me.name)}--${lower(data.coder_workspace_owner.me.name)}.apps.hugoruiz.dev"
  transport = data.coder_workspace.me.start_count == 1 ? jsondecode(data.docker_logs.transport[0].logs_list_string[0]) : {
    backend_port = 0, serve_port = 0, dns = ""
  }
  livekit_ip = cidrhost(one(data.docker_network.rtc.ipam_config).subnet, 10)
  turn_ip    = cidrhost(one(data.docker_network.rtc.ipam_config).subnet, 11)
}

resource "coder_agent" "main" {
  arch               = "amd64"
  os                 = "linux"
  connection_timeout = 420
  env = {
    HOME                    = "/root"
    SHELL                   = "/root/.local/bin/nu"
    COLORTERM               = "truecolor"
    GIT_TERMINAL_PROMPT     = "0"
    REPOSITORY_URL          = data.coder_parameter.repository_url.value
    UV_PYTHON_PREFERENCE    = "only-managed"
    FB_ADDRESS              = "127.0.0.1"
    DATABASE_URL            = "mongodb://workspace:${random_password.mongo.result}@mongodb:27017/aplus?authSource=admin&replicaSet=rs0"
    LIVEKIT_URL             = "ws://livekit:7880"
    LIVEKIT_PUBLIC_URL      = local.livekit_public_url
    NEXT_PUBLIC_LIVEKIT_URL = local.livekit_public_url
    LIVEKIT_API_KEY         = random_password.livekit["key"].result
    LIVEKIT_API_SECRET      = random_password.livekit["secret"].result
  }
  metadata {
    display_name = "CPU Usage"
    key          = "0_cpu_usage"
    script       = "coder stat cpu"
    interval     = 10
    timeout      = 1
  }
  metadata {
    display_name = "RAM Usage"
    key          = "1_ram_usage"
    script       = "coder stat mem"
    interval     = 10
    timeout      = 1
  }
}

resource "docker_image" "workspace" {
  name         = "ubuntu:24.04@sha256:496754492fb28b4d3049432f2ca787449331e23fb14f0dd3fffea86bf5a93eb4"
  keep_locally = true
}

# Stop/start preserves this home. Deleting the workspace deletes its contents.
resource "docker_volume" "home" {
  name = "${local.project}-home"
  lifecycle { ignore_changes = all }
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "random_password" "mongo" {
  length  = 48
  special = false
}

resource "docker_image" "mongo" {
  name         = "mongo:7.0.37@sha256:486795b20c58fd338291e1552118a59a810a4c30dd7f56c690198085797b6c70"
  keep_locally = true
}

resource "docker_network" "database" {
  name     = "${local.project}-db"
  internal = true
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_volume" "mongo" {
  for_each = toset(["data", "config"])
  name     = "${local.project}-mongo-${each.key}"
  lifecycle { ignore_changes = all }
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "mongo" {
  count = data.coder_workspace.me.start_count
  name  = "${local.project}-mongo"
  image = docker_image.mongo.image_id
  env = [
    "MONGO_INITDB_ROOT_USERNAME=workspace",
    "MONGO_INITDB_ROOT_PASSWORD=${random_password.mongo.result}",
    "MONGO_INITDB_DATABASE=aplus",
  ]
  entrypoint = ["/bin/bash", "-ec", <<-EOT
    keyfile=/data/configdb/replica.key
    if [ ! -f "$keyfile" ]; then
      umask 077
      openssl rand -base64 756 > "$keyfile"
      chmod 400 "$keyfile"
      chown mongodb:mongodb "$keyfile"
    fi
    exec docker-entrypoint.sh mongod --replSet rs0 --keyFile "$keyfile" --bind_ip_all --wiredTigerCacheSizeGB 0.25
  EOT
  ]
  networks_advanced {
    name    = docker_network.database.name
    aliases = ["mongodb"]
  }
  volumes {
    container_path = "/data/db"
    volume_name    = docker_volume.mongo["data"].name
  }
  volumes {
    container_path = "/data/configdb"
    volume_name    = docker_volume.mongo["config"].name
  }
  ulimit {
    name = "nofile"
    soft = 65536
    hard = 524288
  }
  healthcheck {
    test = ["CMD", "mongosh", "--quiet", "--eval", <<-JS
      try {
        db.getSiblingDB("admin").auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD);
        try { rs.status(); } catch (error) {
          if (error.code !== 94) throw error;
          rs.initiate({_id: "rs0", members: [{_id: 0, host: "mongodb:27017"}]});
        }
        quit(db.hello().isWritablePrimary ? 0 : 1);
      } catch (_) { print("MongoDB replica set is not ready."); quit(1); }
    JS
    ]
    interval     = "5s"
    timeout      = "5s"
    retries      = 24
    start_period = "30s"
  }
  wait                  = true
  wait_timeout          = 180
  memory                = 1024
  cpus                  = "1"
  restart               = "unless-stopped"
  destroy_grace_seconds = 20
  privileged            = false
  publish_all_ports     = false
  remove_volumes        = false
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "random_password" "livekit" {
  for_each = toset(["key", "secret", "turn"])
  length   = 48
  special  = false
}

resource "docker_network" "rtc" {
  name     = "${local.project}-rtc"
  internal = true
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

data "docker_network" "rtc" {
  name = docker_network.rtc.name
}

# Docker does not activate published ports on an internal-only container.
# This dedicated ingress bridge carries only TURN's loopback-published TCP endpoint.
resource "docker_network" "turn_ingress" {
  name = "${local.project}-turn-ingress"
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_image" "services" {
  for_each = {
    transport = "tailscale/tailscale:v1.102.3@sha256:51fec4863144d6ba0a22504cfb455d020ee0307d0c04eb48f5afee63390bdba0"
    turn      = "coturn/coturn:4.18.0-r0@sha256:59af4221a2c45c1195a1a4a865542b3ea744be1dd8e228d11bde87c6631081cf"
    livekit   = "livekit/livekit-server:v1.13.7@sha256:5d3dcc475d064536d9948ebe4eeab8e3b24d6f07a46f6d71a3415a2901bbdc52"
  }
  name         = each.value
  keep_locally = true
}

# Approved infrastructure-only helper: no Docker socket or VPN daemon.
# Neither host mount below is ever passed to the development workspace.
resource "docker_container" "transport" {
  count        = data.coder_workspace.me.start_count
  name         = "${local.project}-transport"
  image        = docker_image.services["transport"].image_id
  network_mode = "host"
  init         = true
  env          = ["WORKSPACE_ID=${data.coder_workspace.me.id}"]
  entrypoint   = ["/bin/sh", "-ec", "apk add --no-cache python3 iproute2 >&2; exec python3 -u /route.py"]
  upload {
    file    = "/route.py"
    content = local.route_helper
  }
  volumes {
    host_path      = "/var/run/tailscale/tailscaled.sock"
    container_path = "/var/run/tailscale/tailscaled.sock"
  }
  volumes {
    host_path      = "/root/.local/state/coder-livekit-transport"
    container_path = "/coordination"
  }
  healthcheck {
    test         = ["CMD", "test", "-f", "/tmp/route-ready"]
    interval     = "2s"
    timeout      = "2s"
    retries      = 60
    start_period = "20s"
  }
  wait                  = true
  wait_timeout          = 180
  memory                = 256
  cpus                  = "0.5"
  restart               = "unless-stopped"
  destroy_grace_seconds = 120
  privileged            = false
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

data "docker_logs" "transport" {
  count                    = data.coder_workspace.me.start_count
  name                     = docker_container.transport[0].name
  show_stdout              = true
  show_stderr              = false
  follow                   = false
  discard_headers          = true
  logs_list_string_enabled = true
  tail                     = "1"
}

resource "docker_container" "turn" {
  count = data.coder_workspace.me.start_count
  name  = "${local.project}-turn"
  image = docker_image.services["turn"].image_id
  env   = ["TURN_SECRET=${random_password.livekit["turn"].result}"]
  entrypoint = ["/bin/sh", "-ec", <<-EOT
    exec turnserver -n --listening-ip=0.0.0.0 --listening-port=5349 --relay-ip=${local.turn_ip} --relay-threads=1 \
      --no-udp --no-tls --no-tcp-relay --no-multicast-peers \
      --use-auth-secret --static-auth-secret="$TURN_SECRET" --realm=coder-livekit \
      --denied-peer-ip=0.0.0.0-255.255.255.255 --denied-peer-ip=::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff \
      --allowed-peer-ip=${local.livekit_ip} --min-port=49160 --max-port=49260 \
      --user-quota=12 --total-quota=120 --log-file=stdout --simple-log
  EOT
  ]
  networks_advanced {
    name         = docker_network.rtc.name
    ipv4_address = local.turn_ip
  }
  networks_advanced { name = docker_network.turn_ingress.name }
  ports {
    internal = 5349
    external = local.transport.backend_port
    ip       = "127.0.0.1"
    protocol = "tcp"
  }
  healthcheck {
    test         = ["CMD", "bash", "-ec", "exec 3<>/dev/tcp/127.0.0.1/5349; exec 3>&-"]
    interval     = "5s"
    timeout      = "3s"
    retries      = 12
    start_period = "10s"
  }
  wait                  = true
  wait_timeout          = 90
  memory                = 256
  cpus                  = "0.5"
  restart               = "unless-stopped"
  destroy_grace_seconds = 15
  privileged            = false
  publish_all_ports     = false
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "livekit" {
  count = data.coder_workspace.me.start_count
  name  = "${local.project}-livekit"
  image = docker_image.services["livekit"].image_id
  env = ["LIVEKIT_CONFIG=${yamlencode({
    port = 7880
    rtc = {
      use_external_ip = false
      node_ip         = local.livekit_ip
      tcp_port        = 7881
      udp_port        = 7882
      turn_servers = [{
        host     = local.transport.dns, port = local.transport.serve_port,
        protocol = "tls", secret = random_password.livekit["turn"].result, ttl = 3600
      }]
    }
    keys    = { (random_password.livekit["key"].result) = random_password.livekit["secret"].result }
    logging = { level = "info" }
  })}"]
  networks_advanced {
    name         = docker_network.rtc.name
    aliases      = ["livekit"]
    ipv4_address = local.livekit_ip
  }
  healthcheck {
    test         = ["CMD-SHELL", "wget -q -O- http://127.0.0.1:7880/ | grep -q OK"]
    interval     = "5s"
    timeout      = "3s"
    retries      = 12
    start_period = "10s"
  }
  depends_on            = [docker_container.turn]
  wait                  = true
  wait_timeout          = 90
  memory                = 512
  cpus                  = "1"
  restart               = "unless-stopped"
  destroy_grace_seconds = 15
  privileged            = false
  publish_all_ports     = false
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "workspace" {
  count       = data.coder_workspace.me.start_count
  name        = local.project
  hostname    = data.coder_workspace.me.name
  image       = docker_image.workspace.image_id
  user        = "0:0"
  init        = true
  working_dir = "/root"
  env = [
    "CODER_AGENT_TOKEN=${coder_agent.main.token}",
    "HOME=/root",
    "PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  ]
  # Git/curl must exist before the agent starts its parallel startup scripts.
  entrypoint = ["/bin/bash", "-c", <<-EOT
    set -e
    timeout --kill-after=5s 300s /bin/bash -euc '
      export DEBIAN_FRONTEND=noninteractive
      apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=20 update
      apt-get install -y --no-install-recommends ca-certificates curl git xz-utils zoxide eza \
        ripgrep fd-find bat unzip build-essential pkg-config procps jq
      install -d -m 0755 /etc/apt/keyrings /etc/apt/sources.list.d
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 60 \
        https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
      chmod 0644 /etc/apt/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list
      apt-get -o Acquire::Retries=2 -o Acquire::https::Timeout=20 update
      apt-get install -y --no-install-recommends gh
      rm -rf /var/lib/apt/lists/*
    '
    # Install before the agent starts parallel module scripts: the registry
    # module must never fall back to its unpinned upstream installer.
    timeout --kill-after=5s 180s /bin/bash -euc '
      mkdir -p "$HOME/.local/bin" "$HOME/.local/share/coder-filebrowser"
      if ! command -v filebrowser >/dev/null; then
        test ! -e "$HOME/.local/bin/filebrowser" && test ! -L "$HOME/.local/bin/filebrowser"
        stage=$(mktemp -d)
        trap '\''rm -rf -- "$stage"'\'' EXIT
        curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 \
          https://github.com/filebrowser/filebrowser/releases/download/v2.63.23/linux-amd64-filebrowser.tar.gz -o "$stage/filebrowser.tgz"
        echo "b14db2bb8033caa3f80205eb6578b2ed0744ebd9e716b790bc4a9703ce909e88  $stage/filebrowser.tgz" | sha256sum --check
        tar -xzf "$stage/filebrowser.tgz" -C "$stage" filebrowser
        install -m 0755 "$stage/filebrowser" "$HOME/.local/bin/filebrowser"
      fi
      export FB_DATABASE="$HOME/.local/share/coder-filebrowser/filebrowser.db"
      if [ ! -e "$FB_DATABASE" ]; then
        filebrowser config init --address=127.0.0.1
        filebrowser users add admin "$(openssl rand -hex 32)" --perm.admin=true --perm.execute=false
      fi
    '
    ${coder_agent.main.init_script}
  EOT
  ]
  networks_advanced { name = data.docker_network.control.name }
  networks_advanced { name = docker_network.database.name }
  networks_advanced { name = docker_network.rtc.name }
  depends_on = [docker_container.mongo, docker_container.livekit]
  volumes {
    container_path = "/root"
    volume_name    = docker_volume.home.name
  }
  memory            = 4096
  cpus              = "2"
  privileged        = false
  publish_all_ports = false
  remove_volumes    = false
  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "coder_app" "service" {
  for_each     = local.services
  agent_id     = coder_agent.main.id
  slug         = each.key
  display_name = each.key
  url          = each.key == "agent" ? "http://livekit:7880" : "http://localhost:${each.value}"
  subdomain    = true
  share        = "owner"
}
