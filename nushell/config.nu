# Portable config - works on Nix, NixOS, and Arch Linux

# Tracked integrations (committed to git)
source ~/.config/shell/integrations/zoxide.nu
source ~/.config/shell/integrations/atuin.nu
source ~/.config/shell/integrations/yazi.nu
source ~/.config/shell/integrations/cldy.nu
source ~/.cache/shell/mise.nu

# Cached integrations (must exist - run bootstrap.sh first)
source ~/.cache/shell/starship.nu

# Direnv (inline hook for Nushell - no cached file needed)
$env.config = ($env.config | upsert hooks.pre_prompt (
    $env.config.hooks.pre_prompt | append {||
        if (which direnv | is-empty) { return }
        direnv export json | from json | default {} | load-env
    }
))

# User customizations
alias l = ls --all
alias c = clear
alias ll = ls -l
alias lt = eza --tree --level=2 --long --icons --git
alias v = nvim

alias gc = git commit -m
alias gca = git commit -a -m
alias gp = git push origin HEAD
alias gpu = git pull origin
alias gst = git status
alias glog = git log --graph --topo-order --pretty='%w(100,0,6)%C(yellow)%h%C(bold)%C(black)%d %C(cyan)%ar %C(green)%an%n%C(bold)%C(white)%s %N' --abbrev-commit
alias gdiff = git diff
alias gco = git checkout
alias gb = git branch
alias gba = git branch -a
alias gadd = git add
alias ga = git add -p
alias gcoall = git checkout -- .
alias gr = git remote
alias gre = git reset
