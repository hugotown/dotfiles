---
description: Reinicia OpenCode Web y muestra su URL HTTPS
---

El reinicio de OpenCode Web fue programado para dentro de 30 segundos. Su URL HTTPS es:

!`systemd-run --quiet --collect --unit="opencode-web-restart-$(date +%s)" --on-active=30s /usr/bin/systemctl restart opencode-web.service && journalctl -u opencode-web-tunnel.service --no-pager --output=cat | grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n 1`

Responde únicamente con la confirmación del reinicio programado y la URL HTTPS anterior. Aclara brevemente que la interfaz se desconectará unos segundos, pero la URL no cambiará.
