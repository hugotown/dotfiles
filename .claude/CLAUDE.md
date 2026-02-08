# Project Rules & Guidelines

This file consolidates all development rules and guidelines for project, incorporating standards from multiple sources including general development principles, project-specific patterns, Context7 libraries, and the comprehensive project structure documentation.

## ⚠️ IMPORTANT: Documentation and File Management Policy

**No Documentation Files:** Do NOT generate explanatory files, guides, tutorials, or any standalone documentation files (README.md, GUIDE.md, etc.).

**Documentation Location:** All documentation must be added as **short, clear, and concise appendices** exclusively in this file (`.claude/CLAUDE.md`).

**Documentation Style:** ALL documentation in this file MUST be **extremely short, clear, and concise**. Avoid verbosity, redundancy, or unnecessary explanations. Get to the point immediately.

**Temporary Files:** Any temporary files generated during development or testing **MUST be deleted** immediately after use.

## 1. Communication and Language

**Primary Language:** All communication with AI assistants will be exclusively in **Spanish**.

**Code and Comments:**

- Generated code will always be in **English**.
- Comments within the code will also be in **English**, facilitating universal understanding and maintenance.

## 2. Software Development Principles

Excellence in development is paramount. Therefore, I strictly adhere to:

**SOLID Principles:** To create robust, maintainable, and scalable software.

- **S**ingle Responsibility Principle
- **O**pen/Closed Principle
- **L**iskov Substitution Principle
- **I**nterface Segregation Principle
- **D**ependency Inversion Principle

**DRY (Don't Repeat Yourself) Principle:** To avoid redundancy and improve code efficiency and maintainability.

**Test-Driven Development (TDD):** Writing tests before functional code to ensure quality and expected behavior from the outset.

## 3. Nix/Nix-Darwin Philosophy: "Install vs Configure"

**Core Philosophy:** Nix and Nix-Darwin are responsible for **installing** packages and tools, but **user configuration** lives in `~/.config/`.

### The Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│ Nix/Nix-Darwin Role:                                        │
│ ✓ Install packages (programs.*, environment.systemPackages) │
│ ✓ Manage system-level settings                              │
│ ✓ Ensure reproducibility across machines                    │
│ ✓ Generate skeleton/bootstrap configurations                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ User Role (~/.config/):                                      │
│ ✓ Customize application configurations                       │
│ ✓ Modify settings per personal workflow                      │
│ ✓ Iterate and experiment without rebuilds                    │
│ ✓ Keep configs simple and directly editable                  │
└─────────────────────────────────────────────────────────────┘
```

### 🚨 CRITICAL: Directory Structure Rules

Understanding where files should live is fundamental to this philosophy:

#### Rule 1: `~/.config/nixos/` - Nix Configuration ONLY

**Purpose:** All Nix/NixOS/nix-darwin configuration files live here.

**What belongs here:**
- ✅ `flake.nix`, `flake.lock`
- ✅ `home.nix`, `configuration.nix`, `darwin.nix`
- ✅ All `.nix` files (modules, hosts, lib, etc.)
- ✅ SOPS encrypted secrets (e.g., `secrets/*.yaml`)
- ✅ Any Nix-related configuration data

**What does NOT belong here:**
- ❌ Application config files (fish, nvim, etc.) - even if Nix installs them
- ❌ User dotfiles
- ❌ Generated runtime files

**Directory Structure Example:**
```
~/.config/nixos/
├── flake.nix
├── flake.lock
├── hosts/
│   ├── darwin/work-mp-m3-max/
│   │   ├── default.nix
│   │   └── home/hugoruiz/home.nix
│   └── nixos/lenovo-nixos-btw/
│       ├── default.nix
│       └── home/hugoruiz/home.nix
├── lib/
│   └── helpers.nix
└── secrets/
    ├── gemini_api_key.yaml (SOPS encrypted)
    └── .gitignore
```

#### Rule 2: `~/.config/<app>/` - User Configuration Space

**Purpose:** User-editable configuration for applications (whether Nix-installed or not).

**What belongs here:**
- ✅ User config files: `fish/config.fish`, `nvim/init.lua`, `alacritty/alacritty.yml`
- ✅ User customizations, themes, plugins
- ✅ Application-generated files (history, caches, state)

**What does NOT belong here:**
- ❌ Nix-generated config files (unless unavoidable - see exceptions)
- ❌ `.nix` files
- ❌ SOPS secrets or Nix store symlinks

**Key Point:** Even if Nix **installs** the tool, the user **configures** it here.

**Example:**
```
~/.config/
├── fish/
│   ├── config.fish          ← User manages this
│   └── fish_variables       ← Fish generates this
├── nvim/
│   └── init.lua             ← User manages this
├── alacritty/
│   └── alacritty.yml        ← User manages this
└── nixos/                   ← Nix configuration (see Rule 1)
```

#### Rule 3: `~/.*` Dotfiles - Mostly User, Some Nix Exceptions

**Purpose:** Traditional dotfiles in home directory.

**User-managed:**
- ✅ `.zshrc`, `.bashrc`, `.profile` (user edits these)

**Nix-managed (for exceptions):**
- ⚠️ `.zshrc.secrets` (Nix generates, user sources)
- ⚠️ `.fish_env` (Nix generates, user sources)
- ⚠️ `.zoxide.{fish,nu,zsh}` (Nix generates via activation hooks)

#### Summary Table: Where Files Live

| Type | Location | Managed By | Example |
|------|----------|------------|---------|
| **Nix configuration** | `~/.config/nixos/` | Nix | `flake.nix`, `home.nix`, `secrets/*.yaml` |
| **User app config** | `~/.config/<app>/` | User | `fish/config.fish`, `nvim/init.lua` |
| **Nix-generated env** | `~/.*` or `/nix/store` | Nix | `.zshrc.secrets`, `.fish_env` |
| **Nix exceptions (unavoidable)** | `~/.config/<app>/` | Nix | `nushell/env.nu` (hardcoded path) |

### Practical Implementation

**Example: Shell Configuration**

- **Nix installs:** Fish, Nushell, Zsh via `programs.fish.enable = true`
- **Nix generates:** Helper files like `~/.yazi.fish`, `~/.zoxide.nu`
- **User configures:** `~/.config/fish/config.fish`, `~/.config/nushell/config.nu`
- **User edits freely** without needing `darwin-rebuild switch`

**Example: Editor Configuration**

- **Nix installs:** Neovim, VSCode, Helix
- **User configures:** `~/.config/nvim/`, `~/.config/helix/config.toml`

**Benefits of This Approach:**

1. **Fast Iteration:** Change configs instantly, no system rebuilds
2. **Clarity:** Clear boundary between "what's installed" vs "how it's configured"
3. **Portability:** Dotfiles in `~/.config/` can be synced independently
4. **Simplicity:** Users don't need to learn Nix to customize their workflow

### 3.1. Exceptions: Tools That Break the Rule

Some tools **require** Nix-level management due to special constraints. These are legitimate exceptions to the "user configures in ~/.config" philosophy.

**⚠️ CRITICAL RULE FOR EXCEPTIONS:**

When a tool becomes a Nix-managed exception (meaning Nix handles both installation AND configuration), Nix-generated files should follow this hierarchy:

**Priority Order (where Nix should place generated files):**

1. **BEST: `~/.config/nixos/`** - If the file is purely Nix configuration/data
2. **GOOD: `~/.*` (home dotfiles)** - For env files, secrets, integration scripts
3. **ACCEPTABLE: `/nix/store` symlinks** - For immutable generated configs
4. **LAST RESORT: `~/.config/<app>/`** - ONLY if the application hardcodes this path with no alternative

**The Logic:**
- **Default behavior:** Nix installs → User configures in `~/.config/<app>/`
- **Exception behavior:** Nix installs AND configures → Files should live in `~/.config/nixos/` OR `~/.*` OR `/nix/store`
- **Unavoidable cases:** Only when the tool **requires** files in `~/.config/<app>/` by design and offers no alternative

**Why this matters:**
- `~/.config/nixos/` is explicitly for Nix configuration - this is where Nix-managed files belong
- `~/.config/<app>/` is the user's domain for manual app customization
- If Nix generates files in `~/.config/<app>/`, it blurs the line between "Nix-managed" and "user-managed"
- Keeping Nix-generated files in `~/.config/nixos/` or `~/.*` maintains clear boundaries

**Examples:**

| File Type | ❌ Bad Location | ✅ Good Location | Reason |
|-----------|----------------|-----------------|--------|
| Nix secrets config | `~/.config/sops/` | `~/.config/nixos/secrets/` | Nix configuration |
| Shell env vars | `~/.config/fish/conf.d/00-nix-env.fish` | `~/.fish_env` | Avoidable, use home dotfile |
| Shell env vars | N/A | `~/.config/nushell/env.nu` | Unavoidable, Nushell hardcoded |
| Zsh secrets | `~/.config/zsh/secrets.zsh` | `~/.zshrc.secrets` | Avoidable, use home dotfile |
| Integration scripts | `~/.config/zoxide/init.fish` | `~/.zoxide.fish` | Avoidable, use home dotfile |

#### Exception 1: Shell Environment Configuration (Fish, Nushell, Zsh)

**Why it breaks the rule:**

- Environment variables must be **loaded before user scripts execute**
- Secret paths (from SOPS) need to be **injected at shell initialization**
- Shell integration tools (zoxide, yazi, starship) require **early initialization**
- Nix can generate consistent environment across all shells simultaneously
- Ensures **deterministic environment setup** before user customizations load

**Files in `~/.config/` (Applying the Exception Rule):**

Following the **CRITICAL RULE** above, we minimize files in `~/.config/`:

| Shell | Nix-Managed Files | Location | Unavoidable? |
|-------|-------------------|----------|--------------|
| **Nushell** | `env.nu` | `~/.config/nushell/env.nu` | ⚠️ **YES** - Nushell hardcodes this path, no alternative |
| **Fish** | `00-nix-env.fish` | `~/.config/fish/conf.d/00-nix-env.fish` | ❌ **NO** - Can use `~/.fish_env` instead |
| **Zsh** | `.zshrc.secrets` | `~/.zshrc.secrets` | ✅ **GOOD** - Outside `~/.config/` |

**Implementation:**

```nix
# Nushell - UNAVOIDABLE: Must be in ~/.config/nushell/env.nu
xdg.configFile."nushell/env.nu".text = ''
  $env.GEMINI_API_KEY = (open ${config.sops.secrets.gemini_api_key.path} | str trim)
  # PATH, EDITOR, etc.
'';

# Fish - SHOULD MOVE: Use ~/.fish_env instead of ~/.config/fish/conf.d/
home.file.".fish_env".text = ''
  set -gx GEMINI_API_KEY (cat ${config.sops.secrets.gemini_api_key.path} | string trim)
  # PATH, EDITOR, etc.
'';
# User sources this in their ~/.config/fish/config.fish

# Zsh - CORRECT: Lives outside ~/.config/
home.file.".zshrc.secrets".text = ''
  export GEMINI_API_KEY="$(cat ${config.sops.secrets.gemini_api_key.path} | tr -d '\n')"
  # PATH, EDITOR, etc.
'';
```

**Tradeoff:** Base shell environment lives in Nix, but this ensures:

- ✅ Secrets available immediately at shell startup
- ✅ Consistent environment across all shells (fish, nushell, zsh)
- ✅ Tool integrations work before user config runs
- ✅ **Nushell only:** env.nu in `~/.config/` (unavoidable)
- ✅ **Fish/Zsh:** Env files outside `~/.config/` (following the rule)

**User Customization Path:**

Users can still add personal configurations:
- **Nushell:** `~/.config/nushell/config.nu` (user-managed, NOT generated by Nix)
- **Fish:** `~/.config/fish/config.fish` + source `~/.fish_env` (user-managed)
- **Zsh:** `~/.zshrc` + source `~/.zshrc.secrets` (user-managed)

#### Exception 2: System-Level Services (Future Examples)

Other potential exceptions may include:

- **VPN configurations** (require system-level networking)
- **Custom LaunchAgents/LaunchDaemons** (macOS services)
- **Kernel modules or system daemons** (require root privileges)

#### Adding New Exceptions: Decision Criteria

Before making a tool a "Nix-managed exception," ask:

1. **Security:** Does it handle secrets/credentials?
2. **Timing:** Must it run before user login/shell initialization?
3. **Privileges:** Does it require root or system-level access?
4. **Integration:** Does it need deep OS integration (e.g., PAM, networking)?

If **yes** to any: It's likely a valid exception.
If **no** to all: Keep it in `~/.config/` and let the user manage it.

---

## 4. Shell Prompt Configuration (Starship)

### Why Starship over Powerlevel10k?

**Starship** is the recommended prompt solution for multi-shell environments:

**Advantages:**
- ✅ **Cross-shell support:** Works natively in Fish, Nushell, Zsh, Bash
- ✅ **Single configuration:** One `~/.config/starship.toml` for all shells
- ✅ **Philosophy compliant:** Nix installs → User configures in `~/.config/`
- ✅ **Performance:** Written in Rust, < 1ms latency
- ✅ **Modern presets:** P10k-like, Tokyo Night, Nerd Font, etc.

**Powerlevel10k limitations:**
- ❌ Zsh-only (doesn't work in Fish/Nushell/Bash)
- ❌ Complex configuration (interactive wizard, multiple files)
- ❌ Breaks Nix philosophy (generates `~/.p10k.zsh` mixing Nix + manual config)

### Implementation

**Nix configuration** (in `home.nix`):

```nix
# Starship - cross-shell prompt
# NOTE: All shell integrations are disabled because we manage them manually
# via home.activation.generateShellIntegrations which creates ~/.starship.{fish,nu,zsh,bash}
# User configuration lives in ~/.config/starship.toml (editable without rebuild)
programs.starship = {
  enable = true;
  enableFishIntegration = false;
  enableZshIntegration = false;
  enableNushellIntegration = false;
  enableBashIntegration = false;
};
```

**Activation script** generates integration files:

```bash
# In home.activation.generateShellIntegrations
if command -v starship >/dev/null 2>&1; then
  starship init fish > ~/.starship.fish
  starship init nu > ~/.starship.nu
  starship init zsh > ~/.starship.zsh
  starship init bash > ~/.starship.bash
fi
```

**User configuration:** `~/.config/starship.toml` (fully editable, no rebuild needed)

**Shell sourcing:**
- Fish: `source ~/.starship.fish` (in `~/.config/fish/config.fish`)
- Nushell: `source ~/.starship.nu` (in `~/.config/nushell/config.nu`)
- Zsh: `source ~/.starship.zsh` (in `~/.zshrc`)
- Bash: `source ~/.starship.bash` (in `~/.bashrc`)

### Customization

Users can edit `~/.config/starship.toml` directly. Example presets:

```bash
# Use a preset
starship preset nerd-font-symbols -o ~/.config/starship.toml

# Or create custom config (see ~/.config/starship.toml for P10k-inspired example)
```

**Benefits:**
1. **No rebuild needed:** Change prompt instantly by editing TOML
2. **Consistent UX:** Same prompt across all shells
3. **Portable:** Single config file, easy to sync
4. **Maintainable:** Clear separation (Nix installs, user customizes)

### 3.2. Home Manager Activation Scripts

**What are activation scripts?**

`home.activation.*` scripts execute **during** home-manager activation (not after). They run in a controlled order using a DAG (Directed Acyclic Graph) to manage dependencies.

**Execution timing:**
```
darwin-rebuild switch
  ↓
Building configuration...
  ↓
Activating home-manager
  ↓
┌─────────────────────────────────────────┐
│ HOME ACTIVATION SCRIPTS RUN HERE:       │
│ • writeBoundary                         │
│ • generateShellIntegrations (custom)    │
│ • hammerspoon (custom)                  │
│ • linkGeneration                        │
│ • sops-nix                              │
└─────────────────────────────────────────┘
  ↓
System activated
```

#### Best Practice: Keep Logic in Activation Scripts

**Recommendation:** Write bash code directly in activation scripts, avoiding external justfiles or shell scripts.

**Why?**
- ✅ **Nix Integration:** Direct access to `${config.*}`, `${pkgs.*}`, `${config.sops.secrets.*}`
- ✅ **Reproducibility:** Everything in Nix configuration, fully hermetic
- ✅ **Single Source of Truth:** No need to sync between .nix files and external scripts
- ✅ **SOPS Access:** Dynamic secret paths work seamlessly
- ✅ **Simplicity:** One place to look for all activation logic

**When to use activation scripts:**
- ✅ Setting up symlinks (e.g., `~/.hammerspoon` → `~/.config/hammerspoon`)
- ✅ Generating shell integration files (zoxide, atuin, yazi wrappers)
- ✅ Creating dotfiles that need SOPS secrets or Nix paths
- ✅ Running setup commands that must execute during activation

**Examples from our config:**

**Simple script (< 10 lines):**
```nix
home.activation.hammerspoon = lib.hm.dag.entryAfter ["writeBoundary"] ''
  CONFIG_DIR="$HOME/.config/hammerspoon"
  HAMMERSPOON_DIR="$HOME/.hammerspoon"

  if [ ! -e "$HAMMERSPOON_DIR" ]; then
    $DRY_RUN_CMD ln -sf "$CONFIG_DIR" "$HAMMERSPOON_DIR"
    echo "✅ Hammerspoon symlink created"
  fi
'';
```

**Complex script (260+ lines):**
```nix
home.activation.generateShellIntegrations = lib.hm.dag.entryAfter ["writeBoundary"] ''
  echo "🐚 Generando integraciones de shell out-of-the-box"

  # Generate zoxide integration files
  if command -v zoxide >/dev/null 2>&1; then
    $DRY_RUN_CMD zoxide init fish > $HOME/.zoxide.fish
    $DRY_RUN_CMD zoxide init nushell > $HOME/.zoxide.nu
    # ... more shell integrations
  fi

  # Generate yazi wrapper functions with heredocs
  $DRY_RUN_CMD cat > $HOME/.yazi.fish << 'EOF_YAZI_FISH'
function y
    set tmp (mktemp -t "yazi-cwd.XXXXXX")
    yazi $argv --cwd-file="$tmp"
    # ... wrapper logic
end
EOF_YAZI_FISH

  # Auto-source in existing shell configs (idempotent)
  if [ -f "$HOME/.config/fish/config.fish" ]; then
    for file in zoxide.fish atuin.fish yazi.fish; do
      if ! grep -q "source ~/.$file" "$HOME/.config/fish/config.fish"; then
        $DRY_RUN_CMD echo "source ~/.$file" >> "$HOME/.config/fish/config.fish"
      fi
    done
  fi
'';
```

**Benefits:**
1. **No External Dependencies:** Bash code lives in .nix files, nothing to sync
2. **Full Nix Power:** Access all config values, packages, and secrets
3. **Hermetic:** Everything needed for activation is in the Nix configuration
4. **Maintainable:** Even 200+ line scripts are acceptable if they're well-organized with comments

---

## 5. Secret Management with SOPS

**Philosophy:** Decrypt secrets on-the-fly in memory using `sops -d`. Never write plaintext secrets to disk.

**Architecture:**
```
~/.config/nixos/secrets/*.yaml  (ENCRYPTED in git)
        ↓ sops -d (runtime)
    ENV vars in memory (never on disk)
```

**Age Private Key Location:**

| OS | Path | Permissions |
|----|------|-------------|
| macOS | `~/Library/Application Support/sops/age/keys.txt` | `600` |
| Linux | `~/.local/share/sops/age/keys.txt` | `600` |

**Shell Config Examples:**

```fish
# Fish: ~/.fish_env
set -gx SOPS_AGE_KEY_FILE "$HOME/Library/Application Support/sops/age/keys.txt"  # macOS
# set -gx SOPS_AGE_KEY_FILE "$HOME/.local/share/sops/age/keys.txt"  # Linux

set -gx GEMINI_API_KEY (sops -d ~/.config/nixos/secrets/gemini_api_key.yaml | yq '.GEMINI_API_KEY' | string trim)
```

```nushell
# Nushell: ~/.config/nushell/env.nu
$env.SOPS_AGE_KEY_FILE = $"($env.HOME)/Library/Application Support/sops/age/keys.txt"  # macOS
# $env.SOPS_AGE_KEY_FILE = $"($env.HOME)/.local/share/sops/age/keys.txt"  # Linux

load-env {
  GEMINI_API_KEY: (sops -d --extract '["GEMINI_API_KEY"]' ~/.config/nixos/secrets/gemini_api_key.yaml | str trim)
}
```

**Security Rules:**
- ✅ Encrypted secrets in git (`~/.config/nixos/secrets/*.yaml`)
- ✅ In-memory decryption only (`sops -d`)
- ✅ Age key outside git (macOS: `~/Library/`, Linux: `~/.local/share/`)
- ❌ NEVER use `sops-nix` with `path =` (creates plaintext files)

