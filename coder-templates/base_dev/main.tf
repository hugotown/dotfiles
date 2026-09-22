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
  display_name = "GitHub repository (optional)"
  description  = "HTTPS URL to clone into ~/repo. Leave blank for an empty workspace. Existing ~/repo is never replaced."
  type         = "string"
  default      = ""
  mutable      = true
  validation {
    regex = "^$|^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$"
    error = "Leave blank or enter an HTTPS GitHub repository URL without embedded credentials."
  }
}

locals {
  project = "coder-base-dev-${data.coder_workspace.me.id}"
  labels = {
    "com.docker.compose.project" = local.project
    "coder.workspace_id"         = data.coder_workspace.me.id
    "coder.owner_id"             = data.coder_workspace_owner.me.id
    "coder.template"             = "base-dev"
  }
  # Edit service names/ports here. These are container ports, never host bindings.
  # Coder generates private service URLs under *.apps.hugoruiz.dev.
  services = {
    web = 3000
    # api = 3001
  }
}

resource "coder_agent" "main" {
  arch               = "amd64"
  os                 = "linux"
  connection_timeout = 300
  env = {
    HOME                = "/root"
    SHELL               = "/root/.local/bin/nu"
    COLORTERM           = "truecolor"
    GIT_TERMINAL_PROMPT = "0"
    REPOSITORY_URL      = data.coder_parameter.repository_url.value
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
    timeout --kill-after=5s 180s /bin/bash -euc '
      export DEBIAN_FRONTEND=noninteractive
      apt-get -o Acquire::Retries=2 -o Acquire::http::Timeout=20 update
      apt-get install -y --no-install-recommends ca-certificates curl git xz-utils
      rm -rf /var/lib/apt/lists/*
    '
    ${coder_agent.main.init_script}
  EOT
  ]
  networks_advanced { name = data.docker_network.control.name }
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
  url          = "http://localhost:${each.value}"
  subdomain    = true
  share        = "owner"
}
