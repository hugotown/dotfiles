---
name: adb-remote-access
description: Connect to and control an Android device from a remote machine (server, VPS, dev box, container) over the network. Covers wireless ADB, SSH-tunneled ADB, and USB/IP forwarding. Use when a user wants to adb into an Android device that is not physically near the machine running adb.
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [android, adb, ssh, remote-debugging, wireless-adb, usbip, termux]
---

# Remote Android Device Access

Connect to an Android device from a remote machine when the device is not physically near the adb host. Three independent methods cover the common cases.

## When to use

Trigger this skill when the user says or implies any of:

- "I want to access my Android from my server / VPS / remote machine"
- "How do I forward my Android's USB to another computer?"
- "Run adb on a remote server"
- "Connect to Android over SSH"
- "Wirelessly debug Android from a different machine"
- "Share my phone with a server for CI / automation / debugging"
- "USB forwarding over network"
- Mentions both **Android** + **SSH** / **remote server** / **VPS** in the same request
- Wants to drive an Android device from a container/CI host that has no USB port
- Wants to control an Android from an iPad/iPhone as a middleman (see pitfall below)

Also load this skill proactively when a user has an Android device AND works on a remote machine — they often want this and don't know it.

## Critical pitfall: iPadOS / iOS cannot host USB for third-party apps

If the user wants to use an **iPad or iPhone** as the USB host that forwards to a server, **stop and redirect.** iPadOS third-party apps — including Termius, iSH, a-Shell, Blink, Prompt — **cannot access USB host mode**, even when the iPad has a USB-C port and the user expects it to behave like a Mac. iPadOS allows approved USB accessories (MTP, HID) but does not expose raw USB to user apps for ADB-style protocols. The App Store has historically rejected apps that try.

**Do not** suggest "plug the Android into your iPad and forward to the server." It cannot work. Redirect to one of the methods below — typically wireless ADB on the Android itself, or installing Termux on the Android and tunneling from there.

This pitfall is iOS/iPadOS-specific. Android, Linux, macOS, and Windows all work as USB hosts normally. So if the user has any of those as the local machine, the question reduces to how to share the USB device over the network (see Method 3 below).

## Method 1 — Wireless ADB + SSH reverse tunnel (recommended default)

Best when: the Android is the device you want, the server is reachable from the Android (over LAN or internet), and the user can install Termux on the Android.

### Topology

```
┌─────────┐   SSH (-R)      ┌─────────┐
│ Android │ ───────────────►│ Server  │
│ (Termux)│  port 5037      │ (adb)   │
└─────────┘                 └─────────┘
      ▲                            ▲
      └── Wireless ADB on same net
```

The Android is the SSH client (Termux). The server is the SSH target. The server's `adb` daemon sees the Android on its localhost because the Android opened the reverse tunnel.

### Setup

**Android (one-time):**
1. Enable Developer Options: Settings → About phone → tap "Build number" 7 times.
2. Enable Wireless Debugging in Developer Options.
3. Note the displayed `IP:port` and the 6-digit pairing code.
4. Install Termux from F-Droid (NOT Play Store — the Play version is stale and missing core functionality).
5. In Termux: `pkg update && pkg install openssh android-tools`.

**Server (one-time):**
- Install adb: `sudo apt install adb` (Debian/Ubuntu), `sudo dnf install android-tools` (Fedora), `brew install android-platform-tools` (macOS).

**Pairing (one-time, run from any machine with adb installed):**
```bash
adb pair <android-ip>:<pairing-port>   # enter the 6-digit code
adb connect <android-ip>:<connect-port>   # usually 5555 or whatever Wireless Debugging shows
```

On modern Android (11+) there are **two ports**: a pairing port (for `adb pair`) and a connection port (for `adb connect`). See `references/wireless-adb-pairing.md`.

**Tunnel from Termux (the persistent bit):**

Edit `~/.ssh/config` in Termux:
```
Host server
    HostName your-server.example.com
    User youruser
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Copy `templates/termux-adb-tunnel.sh` from this skill to `~/start-tunnel.sh` on the Android, then `chmod +x ~/start-tunnel.sh` and run `./start-tunnel.sh`. For persistence across Termux restarts, run inside `tmux` (pkg install tmux) or set up `termux-services`.

**Server (every time the user wants to use adb):**
```bash
adb kill-server
adb start-server
adb devices   # should list the Android
```

### Why it works
- Android opens SSH to server with `-R 5037:localhost:5037`. This reverses the server's port 5037 back to the Android's localhost.
- The Android's adb daemon is listening on 5037; the server's adb client connects to its own 5037, which is now actually the Android's adb.
- The server sees the device as if it were plugged in locally.

## Method 2 — Wireless ADB only (no SSH, same LAN only)

Best when: the server is on the same routable network as the Android and no firewall traversal is needed.

After pairing (same as Method 1), on the server simply:
```bash
adb connect <android-ip>:5555
adb devices
```

That's it. No tunnel needed. Fails as soon as the Android leaves the LAN or a NAT blocks the connection.

## Method 3 — USB/IP (for non-Android USB devices, or kernel-level access)

Best when: sharing a USB device that is not Android (YubiKey, flash drive, USB license dongle, hardware token), or when the remote host needs the device to appear as a real USB device for drivers that don't speak adb. Also works for Android if you really want kernel-level redirection instead of adb protocol.

Linux ships USB/IP in-kernel. The remote machine attaches the device via `vhci-hcd` as if it were physically plugged in.

**On the host the USB is plugged into (the USB/IP "server"):**
```bash
sudo usbip list -l          # find device, note bus id like 1-1.3
sudo usbip bind -b 1-1.3    # export it
```

**Tunnel USB/IP's port (3240) over SSH:**
```bash
ssh -L 3240:localhost:3240 user@remote
```

**On the remote machine (the one that wants the device):**
```bash
sudo modprobe vhci-hcd
sudo usbip attach -r localhost -b 1-1.3
```

Helpers: [usbip-ssh](https://github.com/turistu/usbip-ssh) automates the tunnel without manual port juggling. [usbip-ssh-docker](https://github.com/Fermium/usbip-ssh-docker) wraps the whole thing in a container.

## Choosing a method

| Situation | Method |
|---|---|
| Android is the device, server reachable from Android | **Method 1** (SSH tunnel) |
| Same LAN, simple case, no firewall traversal | Method 2 (wireless ADB) |
| Non-Android USB device (YubiKey, dongle, flash) | Method 3 (USB/IP) |
| User wants iPad/iPhone in the middle | **Stop — redirect to Method 1 from the Android itself** |
| Container or CI host with no USB port | Method 1 (Android) or Method 3 (other USB) |
| Latency-sensitive interactive work (scrcpy, screen mirror) | Method 1 over LAN, or Method 2 |

## Verification

After setup, on the server:
```bash
adb devices -l
# Expect:
#   <android-ip>:<port>   device  model:Pixel_7  ...

adb shell echo "hello from android"
adb shell getprop ro.product.model
```

If the server has its own local adb devices, always `adb kill-server` first — the tunnel re-establishes when the client connects to localhost:5037.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` shows `offline` | Re-run pairing: `adb pair` then `adb connect` |
| `cannot connect to daemon at tcp:5037` | The Termux tunnel isn't running. Re-run `start-tunnel.sh`. |
| Tunnel drops when Termux closes | Use `tmux` in Termux or set up `termux-services` |
| Server firewall blocks | The server doesn't need to open any inbound port — `-R` is outbound from the Android |
| `permission denied` on device | Tap "Allow USB debugging" on the Android's screen; accept the RSA fingerprint prompt |
| Xiaomi/Huawei/Samsung specifics | Some OEM ROMs hide Wireless Debugging under different menu paths; search "wireless debugging" in Settings |
| Android < 10 | Wireless ADB doesn't exist — use Method 3 (USB/IP) or a USB cable to a Linux/Mac machine first |
| `adb: error: device unauthorized` | The Android hasn't accepted the RSA key; check the device screen for a prompt |
| Multiple devices show up after `adb devices` | The server has local adb running — `adb kill-server` first |

## Files

- `templates/termux-adb-tunnel.sh` — copy-paste ready tunnel script for Termux on the Android
- `references/wireless-adb-pairing.md` — modern Android (11+) two-port pairing flow and OEM quirks
- `references/method-comparison.md` — deeper trade-offs, latency expectations, scrcpy-over-tunnel notes
