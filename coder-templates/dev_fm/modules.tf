# ---------------------------------------------------------------------------
# Modulos del registry de Coder
# https://registry.coder.com/modules
#
# Versiones fijadas a proposito: un `~>` dejaria que un minor rompa builds
# reproducibles. Para actualizar, sube el numero a mano y vuelve a empujar.
# ---------------------------------------------------------------------------

# Sin modulo dotfiles a proposito. `coder dotfiles` clona a ~/dotfiles y luego
# busca install.sh/bootstrap.sh/setup.sh en la raiz del repo; si no lo encuentra
# cae a enlazar solo los ficheros de la raiz que empiezan por "." excluyendo
# .git*. El repo hugotown/dotfiles no tiene ninguno de esos scripts y su raiz
# solo tiene .gitattributes y .gitignore, asi que el modulo no haria nada.
#
# Ese repo ES ~/.config (lo dice su README), asi que lo materializamos
# directamente ahi. Ver coder_script.dotfiles_config en main.tf.

# Escribe ~/.gitconfig con el nombre y email de la cuenta de Coder.
module "git-config" {
  count              = data.coder_workspace.me.start_count
  source             = "registry.coder.com/coder/git-config/coder"
  version            = "1.0.34"
  agent_id           = coder_agent.main.id
  allow_email_change = true
}

# Clona un repositorio al arrancar. Si ya existe, no hace nada.
# El count se anula cuando repo_url viene vacio: sin esta guarda el script
# del modulo aborta con "No clone path specified!" al derivar la ruta.
module "git-clone" {
  count    = data.coder_parameter.repo_url.value == "" ? 0 : data.coder_workspace.me.start_count
  source   = "registry.coder.com/coder/git-clone/coder"
  version  = "2.0.3"
  agent_id = coder_agent.main.id
  url      = data.coder_parameter.repo_url.value

  # Sin base_dir. El modulo compone
  #   base_dir != "" ? "<base_dir>/<nombre>" : "~/<nombre>"
  # asi que omitirlo clona en ~/firstmate en vez de ~/projects/firstmate.
}

data "coder_parameter" "repo_url" {
  name         = "repo_url"
  display_name = "Repositorio"
  description  = <<-EOT
    URL del repositorio a clonar. Aterriza en ~/<nombre-del-repo>.
    Ejemplo: https://github.com/kunchenguid/firstmate
    Dejalo vacio para no clonar nada.
  EOT
  type         = "string"
  default      = ""
  mutable      = true
  order        = 1
}

# Ejecuta ~/personalize en cada arranque. El archivo lo siembra coder_script
# .bootstrap_tools en main.tf; a partir de ahi es tuyo para editar.
module "personalize" {
  count    = data.coder_workspace.me.start_count
  source   = "registry.coder.com/coder/personalize/coder"
  version  = "1.0.33"
  agent_id = coder_agent.main.id
}

# Sin modulo de terminal: la terminal web nativa de Coder ya cubre el caso.
# Usa tokens de reconexion y el agente bufferea la salida, asi que la sesion
# sobrevive a cerrar la pestana y a cortes de red. ttyd, en cambio, lanza un
# proceso nuevo por pestana y lo mata al cerrarla.
#
# Volver a anadirlo solo tiene sentido para una sesion tmux compartida o para
# exponer un comando concreto como app propia:
#   module "ttyd" {
#     count    = data.coder_workspace.me.start_count
#     source   = "registry.coder.com/coder-labs/ttyd/coder"
#     version  = "1.0.0"
#     agent_id = coder_agent.main.id
#     command  = "tmux new-session -A -s main"
#   }

# Explorador de archivos web, en lugar de filebrowser (archivado upstream).
# Nota: modulo de la comunidad, no lleva el sello `verified` de Coder.
# subdomain = true lo sirve en su propio hostname del wildcard, que evita los
# problemas de assets que tienen estas apps bajo una subruta.
module "copyparty" {
  count     = data.coder_workspace.me.start_count
  source    = "registry.coder.com/djarbz/copyparty/coder"
  version   = "1.0.2"
  agent_id  = coder_agent.main.id
  subdomain = true
  order     = 20
  arguments = [
    "-v", "/home/coder:/home:A", # comparte el home con todos los permisos
    "-e2dsa",                    # indexado de archivos
  ]
}
