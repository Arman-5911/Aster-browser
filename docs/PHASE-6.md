# Phase 6 - optional encrypted password vault

Version **0.6.0** implements the Phase 6 prototype: password vault, authenticated encryption, OS-backed convenience unlock, password generation, explicit domain-matched autofill, timed clipboard clearing and an internal security review. **An independent security audit has not been performed.**

## Use

Open **Browser menu > Password vault**, the internal sidebar, or the Ctrl+K command palette.

1. Create a vault using a unique master passphrase of at least 12 characters, entered twice. Nothing is created until you choose Create. There is no password reset or recovery service.
2. Add a name, HTTPS website, username and password. The website is normalized to its exact HTTPS origin. Generate a password locally with selectable uppercase/lowercase/digits/symbols and length 12-128. Generation uses Web Crypto randomness with rejection sampling and includes each selected character group.
3. Entries can be searched, replaced or deleted with confirmation. Saved passwords are never included in the normal UI snapshot or displayed as stored plaintext. Edit requires entering a replacement password. Copy sends the chosen password directly from the main process to the clipboard.
4. Open the saved site and choose Fill login. Only one visible username input and one visible current-password input in a same-origin POST form are supported. The current top-level HTTPS origin must match exactly, including a nondefault port. No automatic submission occurs. Hidden, disabled, inert, offscreen, new-password and ambiguous fields are excluded. Subframes, cross-origin actions, other subdomains, HTTP pages and temporary containers are not supported.
5. Set auto-lock to 1-30 minutes (default 5), measured since the last vault operation. Merely browsing or receiving snapshots does not extend it. Lock now, OS screen locking, suspend and app exit also lock the vault. It starts locked after every restart.
6. Clipboard clearing defaults to 30 seconds; choose 15, 30, 60, 120 seconds or Off. Lock/exit still attempt to clear the last copied secret. Cleanup compares the current text with a digest of the copied password and preserves different clipboard content. No clipboard history is collected.

## Storage and key handling

The vault lives in **aster.vault.json**, beside aster.sqlite in the app's user-data directory. All credential fields are encrypted together; they are never placed in the ordinary database, history, checkpoints or named sessions. The vault is shared by persistent workspaces in the same profile. Private/temporary containers cannot access it.

- Random 256-bit data key, AES-256-GCM encryption, fresh random 96-bit nonce and 128-bit tag per encryption operation.
- A master-password wrapping key derived with asynchronous scrypt: N=131072, r=8, p=1, 16-byte random salt, 32-byte output. Its configured memory limit is 256 MiB; the work factor uses roughly 128 MiB. These are fixed implementation parameters, not attacker-controlled file settings.
- Separate authenticated contexts for the wrapped key and credential payload. Decryption/tag verification must succeed before parsing or exposing credentials.
- Bounded, validated versioned envelope and credential schema: up to 300 entries, 4096 characters per password and a 4 MB encrypted file. Saves write an encrypted temporary file, flush it and rename it over the destination; no plaintext temporary file is written.
- Key and plaintext buffers are overwritten when released. JavaScript strings, renderer input buffers, filled website fields, OS swap and crash dumps cannot be guaranteed to be zeroized.
- Failed unlock attempts have an increasing in-process retry delay, capped at 30 seconds. This does not prevent offline attacks on a stolen encrypted file, and restarting the process resets the retry delay. Use a strong master passphrase.

## OS account unlock and backup

OS account unlock is **off by default**. Enabling it wraps the data key using Electron safeStorage. On Windows this uses DPAPI protection for the signed-in OS account; it is not a biometric/Windows Hello challenge and does not defend against malicious processes running as that account. Insecure/unknown Linux storage backends are refused. Availability varies with the operating system and key store. Master-password unlock remains available.

Changing the master password uses a fresh salt and wrapping key and disables OS account unlock. It does not change passwords at websites. Previously exported backups still require their original master password.

Export encrypted backup uses a native save dialog and omits the device-specific unlock wrapper. Restore validates/decrypts a backup before accepting it, and is available only in a fresh profile without an existing vault. It never silently overwrites an existing vault. There is no plaintext export, cloud synchronization or automatic backup. Protect backups and keep your master passphrase independently available.

## Validation and audit status

54 unit tests and 14 Electron scenarios cover the new vault and all earlier browser features. New coverage includes ciphertext authentication, wrong passwords, tampering, encrypted persistence, rekeying, portable backup round trip, timeout locking, lock/unlock races, OS wrapper opt-in, secure generation, clipboard replacement/races, UI persistence, HTTPS autofill, hidden fields, cross-origin form actions, origin lookalikes and private-container restrictions. On this Windows environment, the integration test also exercised actual safeStorage account unlock. Clipboard writes in tests are intercepted so the user's clipboard is preserved.

The production dependency audit reported zero known vulnerabilities on 2026-09-11. The [Phase 6 internal security review](SECURITY-REVIEW-PHASE-6.md) records reviewed boundaries, fixes, evidence and remaining risks. Automated tests and code review are not independent certification.

## Run

Close older Aster windows, then run `npm start`. Open Password vault to opt in. Until an independent audit and production release process are complete, use test credentials rather than making this prototype your sole store for important passwords.
