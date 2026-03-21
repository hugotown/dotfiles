FROM archlinux:latest

# System setup
RUN pacman -Syu --noconfirm && \
    pacman -S --needed --noconfirm \
    base-devel openssh git sudo \
    fish nushell zsh bash \
    zoxide atuin starship yazi \
    sops age gnupg \
    neovim tmux \
    bat ripgrep eza fzf jq \
    curl wget tree btop ncdu just lazygit \
    procs xh httpie tealdeer \
    hyperfine tokei watchexec \
    dust duf git-delta \
    lazydocker pnpm nodejs \
    glow chafa ouch jless ffmpegthumbnailer poppler \
    gtk3 gtk4 gstreamer gst-plugins-base-libs gst-plugins-bad-libs \
    graphene flite harfbuzz-icu libmanette enchant hyphen woff2 \
    xorg-server-xvfb webkit2gtk-4.1 libxml2-legacy && \
    pacman -S --needed --noconfirm go-yq 2>/dev/null || true && \
    pacman -Scc --noconfirm

# Create user with sudo
RUN useradd -m -s /bin/zsh -G wheel hugo && \
    echo "hugo ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Install yay (AUR helper) as user
USER hugo
WORKDIR /tmp
RUN git clone https://aur.archlinux.org/yay-bin.git && \
    cd yay-bin && makepkg -si --noconfirm && \
    cd / && rm -rf /tmp/yay-bin

# Install AUR packages
RUN yay -S --needed --noconfirm mdcat tdf pandoc-bin || true

# Clone dotfiles
RUN git clone https://github.com/hugotown/dotfiles.git /home/hugo/.config

# Setup claude config
RUN cp -r /home/hugo/.config/claude /home/hugo/.claude

# Install mise
RUN curl https://mise.run | sh

# Install Claude Code
RUN curl -fsSL https://claude.ai/install.sh | bash || true

# Run bootstrap (symlinks + cached integrations)
RUN bash /home/hugo/.config/shell/bootstrap.sh

# SSH setup (root needed)
USER root

# Configure sshd: key-only auth, no password
RUN ssh-keygen -A && \
    sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#AuthorizedKeysFile.*/AuthorizedKeysFile .ssh\/authorized_keys/' /etc/ssh/sshd_config

# Add Mac SSH public key
RUN mkdir -p /home/hugo/.ssh && \
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDQpG4vWRjD1KJqEjs8zhSCGH+E0MjCpXKkSdbmg91sm hugo@arch-dev" > /home/hugo/.ssh/authorized_keys && \
    chmod 700 /home/hugo/.ssh && \
    chmod 600 /home/hugo/.ssh/authorized_keys && \
    chown -R hugo:hugo /home/hugo/.ssh

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
