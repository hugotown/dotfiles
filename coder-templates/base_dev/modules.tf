module "git-config" {
  count                 = data.coder_workspace.me.start_count
  source                = "registry.coder.com/coder/git-config/coder"
  version               = "1.0.33"
  agent_id              = coder_agent.main.id
  allow_email_change    = false
  allow_username_change = false
}

# Keep installation, cloning, and custom setup in one ordered script.
# Terraform depends_on does not order separate agent startup scripts.
resource "coder_script" "startup_script" {
  agent_id           = coder_agent.main.id
  display_name       = "Startup Script"
  run_on_start       = true
  start_blocks_login = true
  script             = <<-EOT
    #!/bin/bash
    set -euo pipefail
    timeout --kill-after=5s 600s /bin/bash -se <<'SETUP'
    set -euo pipefail
    mkdir -p "$HOME/.local/bin"
    tmp=$(mktemp -d "$HOME/.base-dev.XXXXXX")
    trap 'rm -rf -- "$tmp"' EXIT

    # Pinned releases and checksums. Binaries persist across container recreation.
    if [[ ! -x "$HOME/.local/bin/nu" ]] || [[ "$(nu --version)" != "0.115.1" ]]; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 \
        https://github.com/nushell/nushell/releases/download/0.115.1/nu-0.115.1-x86_64-unknown-linux-gnu.tar.gz \
        -o "$tmp/nu.tar.gz"
      echo "d11d825241f6504a3617c535fa725a9dd6d009c86d7b19fb3168b47635b9d8b0  $tmp/nu.tar.gz" | sha256sum --check
      mkdir "$tmp/nu"
      tar -xzf "$tmp/nu.tar.gz" -C "$tmp/nu" --strip-components=1
      install -m 0755 "$tmp/nu/nu" "$HOME/.local/bin/nu"
    fi
    if [[ ! -x "$HOME/.local/bin/tuios" ]] || ! tuios --version | grep -Fx 'tuios version 0.7.0' >/dev/null; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 \
        https://github.com/Gaurav-Gosain/tuios/releases/download/v0.7.0/tuios_0.7.0_Linux_x86_64.tar.gz \
        -o "$tmp/tuios.tar.gz"
      echo "0a42da4dafc170f888d5fc6148c5bc62b3d65b69c3fc82e2ab0bb1ae47875fcd  $tmp/tuios.tar.gz" | sha256sum --check
      mkdir "$tmp/tuios"
      tar -xzf "$tmp/tuios.tar.gz" -C "$tmp/tuios"
      install -m 0755 "$tmp/tuios/tuios" "$HOME/.local/bin/tuios"
    fi
    grep -qxF "$HOME/.local/bin/nu" /etc/shells || echo "$HOME/.local/bin/nu" >> /etc/shells
    usermod --shell "$HOME/.local/bin/nu" root
    nu --version
    tuios --version
    # TuiOS uses SHELL=Nushell. Launch it interactively with `tuios`, not here.

    if [[ -n "$REPOSITORY_URL" ]]; then
      if [[ -e "$HOME/repo" || -L "$HOME/repo" ]]; then
        echo '~/repo exists; preserving it without pull, reset, or overwrite.'
      else
        echo 'Cloning the authorized repository into ~/repo...'
        timeout --kill-after=5s 120s git clone --quiet -- "$REPOSITORY_URL" "$tmp/repo"
        mv --no-clobber --no-target-directory "$tmp/repo" "$HOME/repo"
        if [[ -d "$tmp/repo" ]]; then
          echo '~/repo appeared during cloning; existing contents were preserved.'
        else
          echo 'Repository ready at ~/repo.'
        fi
      fi
    fi
    SETUP

    # Add your own startup commands below. Install project runtimes as needed.
    # No application server, database, or dependency installer is started by default.
  EOT
}
