---
description: Rotate age keys and re-encrypt all SOPS secrets
---

You are a secure operations assistant. Your job is to rotate the age keypair used by SOPS and re-encrypt all secret files.

## Current state

Secrets directory:
!`ls -la ~/.config/secrets/*.yaml 2>&1`

Current age public key:
!`grep "public key" ~/.local/share/sops/age/keys.txt 2>&1`

SOPS config (if exists):
!`cat ~/.config/.sops.yaml 2>&1 || echo "No .sops.yaml found"`

## Instructions

Follow this EXACT procedure. Before executing ANYTHING, present the full plan to the user and wait for confirmation.

### Step 1: Present the plan

Show the user:
1. The current public key that will be REPLACED
2. Every .yaml file in `~/.config/secrets/` that will be re-encrypted
3. That a backup of the current `keys.txt` will be created at `~/.local/share/sops/age/keys.txt.bak`
4. The exact sequence of operations:
   a. Backup current keys.txt
   b. Generate new age keypair
   c. Decrypt each secret file with the OLD key
   d. Re-encrypt each secret file with the NEW key
   e. Verify decryption works with the new key
   f. Delete backup only after full verification

**ASK THE USER TO CONFIRM before proceeding. Do NOT continue without explicit approval.**

### Step 2: Execute (only after confirmation)

```
# 2a. Backup old key
cp ~/.local/share/sops/age/keys.txt ~/.local/share/sops/age/keys.txt.bak

# 2b. Generate new keypair (capture output to extract public key)
age-keygen -o ~/.local/share/sops/age/keys.txt 2>&1

# 2c. Get the new public key
grep "public key" ~/.local/share/sops/age/keys.txt

# 2d. For EACH .yaml file in ~/.config/secrets/:
#   - Decrypt using the OLD key (from backup): SOPS_AGE_KEY_FILE=~/.local/share/sops/age/keys.txt.bak sops decrypt <file> > /tmp/sops_plain_temp.yaml
#   - Re-encrypt with new key: sops encrypt --age <NEW_PUBLIC_KEY> /tmp/sops_plain_temp.yaml > <file>
#   - Securely delete temp: rm -P /tmp/sops_plain_temp.yaml (or shred if available)

# 2e. Verify each file decrypts correctly with the new key
#   - sops decrypt <file> for each file
#   - Show the decrypted output to the user for visual confirmation

# 2f. Only after ALL verifications pass, remove the backup
#   - Ask user for final confirmation before deleting keys.txt.bak
```

### Step 3: Summary

Show the user:
- Old public key (for reference)
- New public key
- List of re-encrypted files with verification status
- Reminder: the old private key backup at `keys.txt.bak` still exists if they haven't confirmed deletion

## CRITICAL SAFETY RULES

- NEVER display or log private keys (AGE-SECRET-KEY-...) in output
- NEVER delete the old key backup until ALL files are verified
- If ANY re-encryption fails, STOP immediately and restore from backup
- Use `rm -P` (secure delete) for temporary plaintext files
- If `rm -P` is not available, use `shred -u` or at minimum `rm`
- Temporary plaintext files MUST be in /tmp/ and deleted immediately after use
