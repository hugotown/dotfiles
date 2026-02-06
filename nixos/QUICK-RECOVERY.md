# ⚡ Recuperación Rápida: Reinstalación de NixOS

**TU PREGUNTA:** "¿Qué pasa cuando hago reinstall de nixos en una laptop nueva? ¿Cómo restauro las claves?"

---

## 🎯 Respuesta Rápida (TL;DR)

### Escenario A: TIENES backup de tu llave privada ✅

```bash
# 1. Instala NixOS normalmente
# 2. Clona tu config
git clone <tu-repo> ~/.config/nixos

# 3. RESTAURA la llave privada
mkdir -p ~/.config/sops/age  # En Linux
mkdir -p ~/Library/Application\ Support/sops/age  # En macOS

# Pega el contenido de tu backup aquí:
nano ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt

# 4. Rebuild
sudo nixos-rebuild switch --flake ~/.config/nixos

# ✅ LISTO! Tus secretos están disponibles
echo $OPENAI_API_KEY
```

**Tiempo total:** ~10 minutos

---

### Escenario B: NO tienes backup ❌

```bash
# 1. Genera NUEVA llave
age-keygen -o ~/.config/sops/age/keys.txt

# 2. Obtén llave pública
age-keygen -y ~/.config/sops/age/keys.txt
# Output: age1xxxxx...

# 3. Actualiza .sops.yaml con nueva llave
nano ~/.config/nixos/.sops.yaml

# 4. ELIMINA secretos viejos (no los puedes desencriptar)
rm ~/.config/nixos/secrets/*.yaml

# 5. REGENERA secretos con nuevos valores
cd ~/.config/nixos/secrets
sops ai.yaml  # Crea nuevas API keys desde proveedores
sops database.yaml  # Cambia passwords de bases de datos
sops github.yaml  # Genera nuevos tokens de GitHub

# 6. REVOCA credenciales viejas
# Ve a OpenAI, GitHub, etc. y elimina los tokens antiguos

# 7. Commit y rebuild
git add .sops.yaml secrets/
git commit -m "security: regenerate secrets after key loss"
git push
sudo nixos-rebuild switch --flake ~/.config/nixos
```

**Tiempo total:** ~1-2 horas (depende de cuántos secretos tengas)

---

## 🔑 Lo MÁS Importante

### HAZ BACKUP DE TU LLAVE AHORA

```bash
# Ver tu llave privada actual
cat ~/.config/sops/age/keys.txt
# O en macOS:
cat ~/Library/Application\ Support/sops/age/keys.txt

# Output será algo como:
# AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZ
# age1yuy59d4yqfynuaxdu65pxmjvvvzlp27wzc79wg0dlf287taj5akqvsfhn2
```

**GUARDA TODO ESE CONTENIDO EN:**
- ✅ 1Password (Secure Note)
- ✅ Bitwarden (Secure Note)
- ✅ KeePassXC (Entry)
- ✅ USB encriptado
- ✅ Papel en caja fuerte

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────┐
│ Reinstalo NixOS / Laptop Nueva │
└────────────┬────────────────────┘
             │
             v
    ┌────────────────────┐
    │ ¿Tengo backup de   │
    │ llave privada?     │
    └─────┬──────────┬───┘
          │          │
      SÍ  │          │  NO
          │          │
          v          v
    ┌─────────┐  ┌──────────────┐
    │ FÁCIL   │  │ DIFÍCIL      │
    │ ~10 min │  │ ~1-2 horas   │
    └─────────┘  └──────────────┘
          │          │
          v          v
    ┌─────────┐  ┌──────────────┐
    │1.Restore│  │1.Nueva llave │
    │  llave  │  │2.Actualiza   │
    │2.Rebuild│  │  .sops.yaml  │
    │3.¡Listo!│  │3.Regenera    │
    │         │  │  TODOS los   │
    │         │  │  secretos    │
    │         │  │4.Revoca viejos│
    └─────────┘  └──────────────┘
          │          │
          └────┬─────┘
               v
    ┌──────────────────┐
    │ Sistema listo    │
    │ con secretos ✅  │
    └──────────────────┘
```

---

## 🎯 Comparación de Escenarios

| Aspecto | CON Backup | SIN Backup |
|---------|------------|------------|
| **Tiempo** | 10 minutos | 1-2 horas |
| **Dificultad** | ⭐ Fácil | ⭐⭐⭐ Complejo |
| **Pasos** | 4 pasos | 7+ pasos |
| **Riesgo** | Ninguno | Alto (debes regenerar todo) |
| **Costo** | $0 | Tiempo + posible downtime |
| **Datos perdidos** | Ninguno | Ninguno (si regeneras) |
| **Stress** | 😊 Bajo | 😰 Alto |

---

## 🛡️ Estrategia de Backup Recomendada

### Nivel 1: Básico (MÍNIMO)
```
✅ Password Manager (1Password/Bitwarden)
   └─ Secure Note: "sops age key - work-mp-m3-max"
      └─ Contenido completo de keys.txt
```

### Nivel 2: Intermedio (RECOMENDADO)
```
✅ Password Manager
✅ USB Encriptado (VeraCrypt/LUKS)
   └─ /backups/sops/work-mp-m3-max-age-key.txt
```

### Nivel 3: Paranoia (MÁXIMA SEGURIDAD)
```
✅ Password Manager (online, encriptado)
✅ USB Encriptado #1 (físico, guardado en casa)
✅ USB Encriptado #2 (físico, guardado en otro lugar)
✅ Papel impreso (caja fuerte física)
✅ Archivo GPG encriptado (cloud privado)
```

---

## ⚠️ Errores Comunes

### ❌ Error 1: "No tengo backup porque pensé que estaba en Git"
**Realidad:** La llave privada NUNCA debe estar en Git
**Solución:** Crea backup hoy mismo

### ❌ Error 2: "Guardé la llave en texto plano en Dropbox"
**Realidad:** Cualquiera con acceso a tu Dropbox puede verla
**Solución:** Usa password manager o encripta el archivo

### ❌ Error 3: "Solo guarde la llave pública"
**Realidad:** La llave pública no sirve para desencriptar
**Solución:** Necesitas la PRIVADA (la que dice AGE-SECRET-KEY-1...)

### ❌ Error 4: "Esperé hasta el desastre para pensar en esto"
**Realidad:** Sin backup previo, pierdes acceso a todos tus secretos
**Solución:** ¡HAZ BACKUP AHORA, NO MAÑANA!

---

## ✅ Checklist: Hazlo Hoy

```bash
# [ ] Paso 1: Ver mi llave privada
cat ~/.config/sops/age/keys.txt

# [ ] Paso 2: Copiar todo el contenido

# [ ] Paso 3: Guardar en 1Password/Bitwarden
#     Título: "sops age key - $(hostname)"
#     Tipo: Secure Note
#     Contenido: [pegar aquí]

# [ ] Paso 4: Verificar que puedo acceder a mi backup
#     (Abrir 1Password, buscar "sops age key")

# [ ] Paso 5: (Opcional) Crear segundo backup en USB encriptado

# [ ] Paso 6: Programar revisión en 6 meses
#     Añadir evento de calendario: "Verificar backup de sops keys"
```

---

## 🔗 Documentación Completa

Para más detalles, lee:
- 📖 [SOPS-DISASTER-RECOVERY.md](./SOPS-DISASTER-RECOVERY.md) - Guía completa (4000+ palabras)
- 📖 [SOPS-SETUP-GUIDE.md](./SOPS-SETUP-GUIDE.md) - Guía de configuración original

---

## 💬 Preguntas Frecuentes

**Q: ¿La llave age está atada a mi hardware?**
A: NO. Puedes reutilizar la misma llave en hardware diferente.

**Q: ¿Puedo compartir mi llave con otro developer del equipo?**
A: Técnicamente sí, pero NO es recomendado. Cada persona debe tener su propia llave.

**Q: ¿Cada cuánto debo cambiar mi llave?**
A: Cada 1-2 años, o inmediatamente si hay compromiso de seguridad.

**Q: ¿Qué pasa si alguien roba mi laptop?**
A: Si tienes disk encryption (FileVault/LUKS), tus llaves están seguras. Si no, debes regenerar todos los secretos inmediatamente.

**Q: ¿Puedo tener múltiples llaves por "si acaso"?**
A: SÍ! Puedes agregar múltiples llaves en .sops.yaml. De hecho es una buena práctica.

**Q: ¿La llave pública es sensible?**
A: NO. La llave pública puede estar en Git. Solo la PRIVADA es secreta.

---

**Creado:** 2025-02-06
**Última pregunta respondida:** "¿Cómo restauro claves en reinstalación?"
