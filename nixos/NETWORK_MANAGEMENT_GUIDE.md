# Guía de Gestión de Redes - NixOS Lenovo (Opción 2: CLI Minimalista)

## 📋 Cambios Implementados

### Archivo Modificado
**`hosts/nixos/lenovo-nixos-btw/default.nix`** (líneas 21-26)

```nix
# NetworkManager WiFi optimization
# Use iwd backend for better performance and stability
networkmanager.wifi.backend = "iwd";

# Disable WiFi power saving to prevent connectivity issues
networkmanager.wifi.powersave = false;
```

### Beneficios de los Cambios

1. **Backend iwd**: Reemplaza wpa_supplicant con iwd (iNet Wireless Daemon)
   - ⚡ Mejor rendimiento WiFi
   - 🔋 Menor uso de recursos
   - 🚀 Conexiones más rápidas y estables
   - 🔄 Roaming mejorado entre puntos de acceso

2. **Power Save Deshabilitado**: Evita desconexiones intermitentes
   - ✅ Conexión WiFi más estable
   - ✅ Sin latencia por ahorro de energía
   - ✅ Mejor experiencia para trabajo remoto/streaming

---

## 🚀 Aplicar los Cambios

```bash
# 1. Verificar que estás en tu dotfiles
cd ~/.config/nixos

# 2. (Opcional) Verificar sintaxis sin construir
nix flake check --no-build

# 3. Aplicar cambios (tú lo harás cuando estés listo)
sudo nixos-rebuild switch --flake .#lenovo-nixos-btw

# Después del rebuild, NetworkManager usará iwd automáticamente
```

---

## 🛠️ Herramientas CLI Disponibles

### 1. nmcli - NetworkManager Command Line

**Comandos Más Útiles**:

```bash
# Ver estado general de NetworkManager
nmcli general status

# Listar dispositivos de red
nmcli device status

# Escanear redes WiFi disponibles
nmcli device wifi list

# Conectar a red WiFi
nmcli device wifi connect "SSID" password "tu_contraseña"

# Conectar a red WiFi oculta
nmcli device wifi connect "SSID" password "tu_contraseña" hidden yes

# Desconectar WiFi
nmcli device disconnect wlan0

# Ver conexiones guardadas
nmcli connection show

# Activar conexión guardada
nmcli connection up "nombre_conexion"

# Desactivar conexión
nmcli connection down "nombre_conexion"

# Eliminar conexión guardada
nmcli connection delete "nombre_conexion"

# Ver detalles de conexión activa
nmcli connection show --active

# Ver configuración de dispositivo específico
nmcli device show wlan0

# Monitorear cambios en tiempo real
nmcli monitor
```

**Gestión de WiFi Avanzada**:

```bash
# Rescanear redes WiFi
nmcli device wifi rescan

# Conectar con prioridad específica
nmcli connection modify "nombre_conexion" connection.autoconnect-priority 100

# Desactivar auto-conexión
nmcli connection modify "nombre_conexion" connection.autoconnect no

# Ver información de señal WiFi
nmcli -f IN-USE,SSID,SIGNAL,SECURITY device wifi list

# Configurar DNS específico para conexión
nmcli connection modify "nombre_conexion" ipv4.dns "8.8.8.8 1.1.1.1"

# Configurar IP estática
nmcli connection modify "nombre_conexion" ipv4.method manual \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1
```

---

### 2. nmtui - NetworkManager Text User Interface

**Interfaz TUI Interactiva**:

```bash
# Lanzar menú interactivo
nmtui

# Opciones disponibles:
# - Edit a connection  : Modificar configuración de conexiones
# - Activate a connection : Conectar/desconectar redes
# - Set system hostname : Cambiar nombre del host
```

**Características**:
- ✅ Navegación con flechas y Enter
- ✅ Editar todas las opciones de conexión visualmente
- ✅ No requiere memorizar comandos
- ✅ Útil para configuraciones complejas (VPN, bridges, etc.)

---

### 3. iwctl - CLI de iwd (Nuevo con backend iwd)

**Comandos iwd Directos**:

```bash
# Entrar en modo interactivo
iwctl

# Dentro de iwctl:
[iwd]# device list                    # Listar dispositivos WiFi
[iwd]# station wlan0 scan             # Escanear redes
[iwd]# station wlan0 get-networks     # Ver redes disponibles
[iwd]# station wlan0 connect "SSID"   # Conectar (pedirá contraseña)
[iwd]# station wlan0 disconnect       # Desconectar
[iwd]# known-networks list            # Redes conocidas
[iwd]# known-networks forget "SSID"   # Olvidar red
[iwd]# exit                           # Salir de iwctl

# Comandos directos (sin modo interactivo):
iwctl station wlan0 scan
iwctl station wlan0 get-networks
iwctl station wlan0 connect "SSID" --passphrase "contraseña"
iwctl station wlan0 show              # Info detallada de conexión
```

**Archivos de Configuración iwd**:
```bash
# Redes guardadas en:
/var/lib/iwd/

# Ver contraseña de red guardada (requiere sudo):
sudo cat /var/lib/iwd/NombreRed.psk
```

---

## 📊 Monitoreo y Diagnóstico

### Ver Estado de Servicios

```bash
# Estado de NetworkManager
systemctl status NetworkManager

# Estado de iwd (backend WiFi)
systemctl status iwd

# Logs de NetworkManager
journalctl -u NetworkManager -f

# Logs de iwd
journalctl -u iwd -f
```

### Información de Red Actual

```bash
# Ver interfaces de red
ip addr show

# Ver rutas de red
ip route show

# Ver DNS configurado
resolvectl status

# Probar conectividad
ping -c 4 1.1.1.1
ping -c 4 google.com

# Velocidad de conexión WiFi
nmcli -f GENERAL.DEVICE,GENERAL.CONNECTION,WIFI-PROPERTIES.SPEED device show wlan0

# Calidad de señal WiFi
watch -n 1 'nmcli -f IN-USE,SSID,SIGNAL,BARS device wifi list'
```

---

## 🔧 Troubleshooting

### WiFi no Detecta Redes

```bash
# 1. Verificar que el dispositivo WiFi está activo
nmcli radio wifi on

# 2. Forzar rescan
nmcli device wifi rescan
sleep 2
nmcli device wifi list

# 3. Reiniciar NetworkManager
sudo systemctl restart NetworkManager

# 4. Si persiste, revisar logs
journalctl -u NetworkManager -n 50
```

### Conexión Inestable o Lenta

```bash
# 1. Verificar potencia de señal
nmcli device wifi list

# 2. Ver configuración de power save (debe estar deshabilitado)
iw dev wlan0 get power_save
# Debería mostrar: Power save: off

# 3. Si power save está habilitado, desactivar manualmente
sudo iw dev wlan0 set power_save off

# 4. Verificar congestión de canal WiFi
sudo iw dev wlan0 scan | grep -E 'freq|SSID|signal'
```

### Revertir a wpa_supplicant (Si iwd Causa Problemas)

```nix
# En hosts/nixos/lenovo-nixos-btw/default.nix
# Comentar o eliminar esta línea:
# networkmanager.wifi.backend = "iwd";

# Rebuild:
sudo nixos-rebuild switch --flake .#lenovo-nixos-btw
```

### NetworkManager No Inicia

```bash
# Verificar conflictos con otros gestores de red
sudo systemctl status wpa_supplicant

# Debe estar inactivo. Si está activo:
sudo systemctl stop wpa_supplicant
sudo systemctl disable wpa_supplicant

# Reiniciar NetworkManager
sudo systemctl restart NetworkManager
```

---

## 🎯 Uso Diario Recomendado

### Workflow Básico

```bash
# Al iniciar sesión (si no hay auto-conexión)
nmcli device wifi list
nmcli device wifi connect "TuRed"

# Verificar conexión
nmcli connection show --active

# Si hay problemas
nmcli device wifi rescan
nmtui  # usar interfaz visual
```

### Aliases Recomendados

Puedes agregar estos a tu `~/.config/fish/config.fish` o `~/.config/nushell/config.nu`:

```bash
# Fish
alias wifi='nmcli device wifi'
alias wifils='nmcli device wifi list'
alias wificonn='nmcli connection show --active'
alias wifiscan='nmcli device wifi rescan && sleep 2 && nmcli device wifi list'

# Nushell
alias wifi = nmcli device wifi
alias wifils = nmcli device wifi list
alias wificonn = nmcli connection show --active
alias wifiscan = nmcli device wifi rescan; sleep 2sec; nmcli device wifi list
```

---

## 📚 Recursos Adicionales

### Documentación Oficial

- **NetworkManager**: https://wiki.nixos.org/wiki/NetworkManager
- **iwd**: https://wiki.nixos.org/wiki/Iwd
- **nmcli Reference**: `man nmcli` o `man nmcli-examples`
- **iwctl Reference**: `man iwctl`

### Comandos de Ayuda

```bash
# Ayuda de nmcli
nmcli help
nmcli connection help
nmcli device help

# Ayuda de iwctl
iwctl help
man iwctl

# Ejemplos de nmcli
man nmcli-examples
```

---

## ⚠️ Notas Importantes

1. **No Necesitas sudo**: Como usuario en grupo `networkmanager`, puedes gestionar redes sin privilegios de root

2. **Darwin No Afectado**: Todos los cambios son específicos de NixOS Linux, tu configuración de macOS permanece intacta

3. **Contraseñas Guardadas**: Las contraseñas WiFi se guardan cifradas en `/etc/NetworkManager/system-connections/`

4. **Compatibilidad**: iwd es compatible con todas las configuraciones de NetworkManager existentes

5. **Rollback Fácil**: Si algo falla, puedes revertir a generación anterior:
   ```bash
   sudo nixos-rebuild switch --rollback
   ```

---

## ✅ Verificación Post-Instalación

Después de hacer `nixos-rebuild switch`, verifica que todo funciona:

```bash
# 1. NetworkManager corriendo
systemctl status NetworkManager | grep Active

# 2. iwd backend activo
systemctl status iwd | grep Active

# 3. WiFi funcionando
nmcli device status | grep wifi

# 4. Poder conectar sin sudo
nmcli device wifi list
# Deberías ver la lista sin pedir contraseña

# 5. Power save deshabilitado
iw dev wlan0 get power_save
# Debe mostrar: Power save: off
```

---

## 🎉 Resumen de Mejoras

✅ Backend iwd para mejor rendimiento WiFi
✅ Power saving deshabilitado para conexión estable
✅ Herramientas CLI ya disponibles (nmcli, nmtui, iwctl)
✅ Sin necesidad de sudo para gestión de redes
✅ Configuración mínima sin herramientas GUI innecesarias
✅ Compatible con tu filosofía "NixOS instala → User configura"
✅ Darwin completamente intacto

**¡Listo para usar después de tu rebuild!** 🚀
