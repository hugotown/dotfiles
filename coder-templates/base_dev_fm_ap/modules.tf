# Trusted infrastructure helper only: never mount its host paths in the workspace.
locals {
  route_helper = <<-PY
    import contextlib
    import fcntl
    import json
    import os
    from pathlib import Path
    import signal
    import subprocess
    import threading
    import time
    import uuid

    owner = str(uuid.UUID(os.environ['WORKSPACE_ID']))
    root = Path('/coordination')
    record = root / (owner + '.env')
    ready = Path('/tmp/route-ready')
    stopping = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())

    def command(*args):
        return subprocess.check_output(args, text=True, timeout=30, stderr=subprocess.PIPE).strip()

    def serve_config():
        return json.loads(command('tailscale', 'serve', 'status', '--json')) or {}

    def read_record(path):
        return dict(line.split('=', 1) for line in path.read_text().splitlines() if line)

    @contextlib.contextmanager
    def allocation_lock():
        with (root / '.allocation.lock').open('a') as lock:
            deadline = time.monotonic() + 45
            while True:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Transport allocation lock is busy')
                    time.sleep(0.1)
            try:
                yield
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)

    def free(port, config, reserved):
        return port not in reserved and str(port) not in config.get('TCP', {}) and not command('ss', '-ltnH', '( sport = :' + str(port) + ' )')

    route = None
    try:
        with allocation_lock():
            config = serve_config()
            dns = json.loads(command('tailscale', 'status', '--json'))['Self']['DNSName'].rstrip('.')
            if record.exists():
                previous = read_record(record)
                assert previous['WORKSPACE_ID'] == owner
                backend = int(previous['BACKEND_PORT'])
                public = int(previous['SERVE_PORT'])
                existing = config.get('TCP', {}).get(str(public))
                if existing:
                    assert existing.get('TCPForward') == '127.0.0.1:' + str(backend), 'Existing handler is not ours'
                else:
                    assert free(public, config, set()), 'Reserved Serve port is occupied'
            else:
                reserved = set()
                for file in root.glob('*.env'):
                    value = read_record(file)
                    reserved.update([int(value['BACKEND_PORT']), int(value['SERVE_PORT'])])
                backend = next(p for p in range(28000, 38000) if free(p, config, reserved))
                reserved.add(backend)
                public = next(p for p in range(8443, 18443) if free(p, config, reserved))
            command('tailscale', 'serve', '--bg', '--tls-terminated-tcp=' + str(public), 'tcp://127.0.0.1:' + str(backend))
            record.write_text('WORKSPACE_ID=' + owner + '\nBACKEND_PORT=' + str(backend) + '\nSERVE_PORT=' + str(public) + '\nDNS_NAME=' + dns + '\n')
            record.chmod(0o600)
            route = {'backend_port': backend, 'serve_port': public, 'dns': dns}
            print(json.dumps(route), flush=True)
            ready.touch()
        stopping.wait()
    finally:
        ready.unlink(missing_ok=True)
        if route:
            with allocation_lock():
                existing = serve_config().get('TCP', {}).get(str(route['serve_port']))
                if existing and existing.get('TCPForward') != '127.0.0.1:' + str(route['backend_port']):
                    raise RuntimeError('Handler changed ownership; refusing removal')
                if existing:
                    command('tailscale', 'serve', '--tls-terminated-tcp=' + str(route['serve_port']), 'off')
                record.unlink(missing_ok=True)
  PY
}

module "git-config" {
  count                 = data.coder_workspace.me.start_count
  source                = "registry.coder.com/coder/git-config/coder"
  version               = "1.0.33"
  agent_id              = coder_agent.main.id
  allow_email_change    = false
  allow_username_change = false
}

module "filebrowser" {
  count         = data.coder_workspace.me.start_count
  source        = "registry.coder.com/coder/filebrowser/coder"
  version       = "1.1.5"
  agent_id      = coder_agent.main.id
  agent_name    = "main"
  folder        = "/root"
  database_path = "/root/.local/share/coder-filebrowser/filebrowser.db"
  port          = 13339
  share         = "owner"
  subdomain     = true
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
    timeout --kill-after=5s 1800s /bin/bash -se <<'SETUP'
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

    # Required by the hooks in the supplied Nushell dotfiles; no account is imported.
    if [[ ! -x "$HOME/.local/bin/atuin" ]] || ! atuin --version | grep -E '^atuin 18[.]22[.]0( |$)' >/dev/null; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 \
        https://github.com/atuinsh/atuin/releases/download/v18.22.0/atuin-x86_64-unknown-linux-gnu.tar.gz \
        -o "$tmp/atuin.tar.gz"
      echo "920200b8e2ecff88eb8f2c2d4bfc4c62ed1c2f4efca2ba854a23bd157a542328  $tmp/atuin.tar.gz" | sha256sum --check
      mkdir "$tmp/atuin"
      tar -xzf "$tmp/atuin.tar.gz" -C "$tmp/atuin" --strip-components=1
      install -m 0755 "$tmp/atuin/atuin" "$HOME/.local/bin/atuin"
    fi

    # Complete bundles keep Node/Neovim runtimes and tool binaries persistent.
    install_bundle() {
      local key="$1" url="$2" checksum="$3"
      shift 3
      local bundle="$HOME/.local/share/dev-tools/$key" stage="$tmp/$key"
      local entry name relative link
      if [[ ! -f "$bundle/.sha256" ]] || [[ "$(< "$bundle/.sha256")" != "$checksum" ]]; then
        [[ ! -e "$bundle" ]] || { echo "Refusing to replace unrecognized bundle: $bundle" >&2; return 1; }
        mkdir -p "$stage" "$HOME/.local/share/dev-tools"
        curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 "$url" -o "$tmp/$key.archive"
        echo "$checksum  $tmp/$key.archive" | sha256sum --check
        case "$url" in
          *.zip) unzip -q "$tmp/$key.archive" -d "$stage" ;;
          *) tar -xf "$tmp/$key.archive" -C "$stage" ;;
        esac
        for entry in "$@"; do
          IFS='=' read -r name relative <<< "$entry"
          test -x "$stage/$relative"
        done
        printf '%s\n' "$checksum" > "$stage/.sha256"
        mv --no-clobber --no-target-directory "$stage" "$bundle"
      fi
      for entry in "$@"; do
        IFS='=' read -r name relative <<< "$entry"
        test -x "$bundle/$relative"
        link="$HOME/.local/bin/$name"
        if [[ -e "$link" || -L "$link" ]]; then
          [[ -L "$link" && "$(readlink "$link")" == "$HOME/.local/share/dev-tools/"* ]] || {
            echo "Refusing to replace user executable: $link" >&2; return 1;
          }
        fi
        ln -sfn "$bundle/$relative" "$link"
      done
    }
    install_bundle yazi-26.9.1 \
      https://github.com/sxyazi/yazi/releases/download/v26.9.1/yazi-x86_64-unknown-linux-gnu.zip \
      a02fe91d3304294048c681f010f1100856872a4e98ecf6927328e888d40a6ad2 \
      yazi=yazi-x86_64-unknown-linux-gnu/yazi ya=yazi-x86_64-unknown-linux-gnu/ya
    install_bundle ast-grep-0.45.3 \
      https://github.com/ast-grep/ast-grep/releases/download/0.45.3/app-x86_64-unknown-linux-gnu.zip \
      f8ac830881339d1edee6b2652f54798c0f4da5a827f2db38a08ee31117783ce8 ast-grep=ast-grep
    install_bundle starship-1.26.0 \
      https://github.com/starship/starship/releases/download/v1.26.0/starship-x86_64-unknown-linux-gnu.tar.gz \
      321f0dd7af8340a5f2e6a8fec6538a04f617486f9ec70d878f91c09cd8deef22 starship=starship
    install_bundle television-0.15.9 \
      https://github.com/alexpasmantier/television/releases/download/0.15.9/tv-0.15.9-x86_64-unknown-linux-gnu.tar.gz \
      87d47d071f3c3bac939b1e9b2c63e45c299c9ad31cf8711f63dede614d0c6608 tv=tv-0.15.9-x86_64-unknown-linux-gnu/tv
    install_bundle uv-0.12.17 \
      https://github.com/astral-sh/uv/releases/download/0.12.17/uv-x86_64-unknown-linux-gnu.tar.gz \
      fa82fd8dde8e8eefdecada6aa0889666556cfceb690d06e0c3bca49eb3070a63 \
      uv=uv-x86_64-unknown-linux-gnu/uv uvx=uv-x86_64-unknown-linux-gnu/uvx
    install_bundle neovim-0.12.5 \
      https://github.com/neovim/neovim/releases/download/v0.12.5/nvim-linux-x86_64.tar.gz \
      bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875 nvim=nvim-linux-x86_64/bin/nvim
    # Node >=22.19 is a prerequisite of Pi's official installer.
    install_bundle node-24.21.0 \
      https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz \
      fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 \
      node=node-v24.21.0-linux-x64/bin/node npm=node-v24.21.0-linux-x64/bin/npm npx=node-v24.21.0-linux-x64/bin/npx
    # Ubuntu's fd/bat names differ from those in the dotfiles' TV channel.
    for pair in fd=fdfind bat=batcat; do
      IFS='=' read -r name binary <<< "$pair"
      if [[ ! -e "$HOME/.local/bin/$name" && ! -L "$HOME/.local/bin/$name" ]]; then
        ln -s "/usr/bin/$binary" "$HOME/.local/bin/$name"
      fi
    done
    # Reviewed official installers; no terminal, agent, or server is launched.
    if ! command -v herdr >/dev/null; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 60 https://herdr.dev/install.sh -o "$tmp/herdr-install.sh"
      echo "bf83668c944cff30b3365eee5a4fe15ff61a4b749ab0c73b98e7a203f70893dd  $tmp/herdr-install.sh" | sha256sum --check
      timeout --kill-after=5s 240s sh "$tmp/herdr-install.sh"
    fi
    if ! command -v pi >/dev/null; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 60 https://pi.dev/install.sh -o "$tmp/pi-install.sh"
      echo "6dd66554d87aaf3b655f862392bff173f5810ff37bfc38da04eeace0890781df  $tmp/pi-install.sh" | sha256sum --check
      timeout --kill-after=5s 420s sh "$tmp/pi-install.sh"
    fi

    # Install only missing CLIs using reviewed, checksum-verified official scripts.
    # Preserve existing installations and configuration; do not log in or launch agents.
    if ! command -v claude >/dev/null && [[ ! -e "$HOME/.local/bin/claude" && ! -L "$HOME/.local/bin/claude" ]]; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 90 https://claude.ai/install.sh -o "$tmp/claude-install.sh"
      echo "3a68d3406cf674e17bed1733a4dcf37805e2e47d87417700007d7e1aa766a944  $tmp/claude-install.sh" | sha256sum --check
      timeout --kill-after=5s 420s env DISABLE_AUTOUPDATER=1 DISABLE_TELEMETRY=1 bash "$tmp/claude-install.sh" 2.1.278
    fi
    if ! command -v opencode >/dev/null && ! command -v opencode2 >/dev/null && [[ ! -e "$HOME/.opencode/bin/opencode" && ! -e "$HOME/.opencode/bin/opencode2" ]]; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 90 https://opencode.ai/v2/install -o "$tmp/opencode-install.sh"
      echo "bc70dd317fd12ef09350cdb1667e55e19f9e7b3d2897d3a1b750b165ae579d87  $tmp/opencode-install.sh" | sha256sum --check
      timeout --kill-after=5s 300s bash "$tmp/opencode-install.sh" --version 2.0.12 --no-modify-path
    fi
    if ! command -v kimi >/dev/null && [[ ! -e "$HOME/.kimi-code/bin/kimi" ]]; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 90 https://code.kimi.com/kimi-code/install.sh -o "$tmp/kimi-install.sh"
      echo "270a86f2d2304529b6d8a3783fca9534874ebaeecb6cfcc1aebcdb6ce20ae1d7  $tmp/kimi-install.sh" | sha256sum --check
      timeout --kill-after=5s 300s env KIMI_VERSION=2.0.2 KIMI_NO_MODIFY_PATH=1 bash "$tmp/kimi-install.sh"
    fi
    if ! command -v codex >/dev/null && [[ ! -e "$HOME/.local/bin/codex" && ! -L "$HOME/.local/bin/codex" ]]; then
      curl --fail --location --retry 2 --connect-timeout 15 --max-time 90 https://chatgpt.com/codex/install.sh -o "$tmp/codex-install.sh"
      echo "dd4282a1a3c8188f792513f2f16afb852e63ce3b98dbbc67684f716ebcc1e862  $tmp/codex-install.sh" | sha256sum --check
      timeout --kill-after=5s 420s env CODEX_NON_INTERACTIVE=1 sh "$tmp/codex-install.sh" --release 0.155.1
    fi
    # Nushell and noninteractive sessions already include ~/.local/bin.
    for pair in opencode=.opencode/bin/opencode opencode2=.opencode/bin/opencode2 kimi=.kimi-code/bin/kimi; do
      IFS='=' read -r name relative <<< "$pair"
      if [[ -x "$HOME/$relative" && ! -e "$HOME/.local/bin/$name" && ! -L "$HOME/.local/bin/$name" ]]; then
        ln -s "$HOME/$relative" "$HOME/.local/bin/$name"
      fi
    done
    claude --version
    opencode --version
    kimi --version
    codex --version

    clone_once() {
      local url="$1" name="$2" target="$HOME/$2"
      if [[ -e "$target" || -L "$target" ]]; then
        echo "Preserving $target without pull, reset, or overwrite."
        return
      fi
      timeout --kill-after=5s 120s git clone --quiet -- "$url" "$tmp/$name"
      mv --no-clobber --no-target-directory "$tmp/$name" "$target"
    }
    clone_once https://github.com/hugotown/dotfiles.git .dotfiles

    # The repository is laid out for ~/.config. Keep its checkout separate and
    # only create absent links; never replace existing user configuration.
    mkdir -p "$HOME/.config" "$HOME/.cache/shell"
    for source in "$HOME/.dotfiles"/*; do
      [[ -d "$source" || "$source" == "$HOME/.dotfiles/starship.toml" ]] || continue
      [[ "$source" != "$HOME/.dotfiles/nushell" ]] || continue
      target="$HOME/.config/$(basename "$source")"
      if [[ ! -e "$target" && ! -L "$target" ]]; then
        ln -s -- "$source" "$target"
      fi
    done
    # These optional sources must exist for Nushell's parse-time imports.
    # Do not execute hosts/* installers, decrypt secrets, or overwrite shell rc files.
    for file in "$HOME/.cache/shell/starship.nu" "$HOME/.cache/shell/mise.nu" "$HOME/.config/shell/env.local.nu"; do
      if [[ ! -e "$file" && ! -L "$file" ]]; then
        : > "$file"
      fi
    done
    # Fill only the previously empty optional Starship cache, preserving custom files.
    if [[ -f "$HOME/.cache/shell/starship.nu" && ! -L "$HOME/.cache/shell/starship.nu" && ! -s "$HOME/.cache/shell/starship.nu" ]]; then
      starship init nu > "$HOME/.cache/shell/starship.nu"
    fi
    # The tracked Atuin integration uses an obsolete `job spawn -t` flag.
    # Keep the repository pristine and generate a compatible local Nu entrypoint.
    if [[ ! -e "$HOME/.cache/shell/atuin.nu" && ! -L "$HOME/.cache/shell/atuin.nu" ]]; then
      atuin init nu > "$HOME/.cache/shell/atuin.nu"
    fi
    mkdir -p "$HOME/.config/nushell"
    if [[ ! -e "$HOME/.config/nushell/env.nu" && ! -L "$HOME/.config/nushell/env.nu" ]]; then
      ln -s "$HOME/.dotfiles/nushell/env.nu" "$HOME/.config/nushell/env.nu"
    fi
    if [[ ! -e "$HOME/.config/nushell/config.nu" && ! -L "$HOME/.config/nushell/config.nu" ]]; then
      sed 's|^source ~/.config/shell/integrations/atuin.nu$|source ~/.cache/shell/atuin.nu|' \
        "$HOME/.dotfiles/nushell/config.nu" > "$HOME/.config/nushell/config.nu"
    fi
    gh --version
    # Git uses Coder's GitHub provider. Authenticate gh explicitly from the terminal
    # with `gh auth login --hostname github.com --git-protocol https --web` if needed.
    # No GH_TOKEN, GITHUB_TOKEN, or persisted login token is supplied by this template.
    if [[ -n "$REPOSITORY_URL" ]]; then
      # Match Git's directory name only to preserve existing paths and locate Python configuration.
      # Git itself creates the checkout; no destination argument or directory is supplied.
      repo_name=$(basename -- "$REPOSITORY_URL" .git)
      repo_dir="$HOME/$repo_name"
      if [[ -e "$repo_dir" || -L "$repo_dir" ]]; then
        echo "Preserving $repo_dir without pull, reset, or overwrite."
      else
        (cd "$HOME" && timeout --kill-after=5s 120s git clone --quiet -- "$REPOSITORY_URL")
      fi
    else
      repo_dir=""
    fi
    # Python belongs to uv, not apt or a global pip installation.
    # Honor the selected checkout's version file; otherwise provide the Python 3.14 series.
    if [[ -n "$repo_dir" && -f "$repo_dir/.python-version" ]]; then
      (cd "$repo_dir" && uv python install --default)
    else
      uv python install --default 3.14
    fi
    SETUP

    # Add your own startup commands below. Install project runtimes as needed.
    # No AI agent or project dependency installer is started here.
    # Database/RTC containers and the owner-only File Browser are managed separately.
  EOT
}
