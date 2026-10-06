# Internal security review - Phase 6

Review date: **2026-09-11**. Scope: vault cryptography/storage, secret IPC, autofill, clipboard and integration with the existing browser. This is implementation review and automated validation by the implementing agent, **not an independent audit**.

## Threat model

Protect saved credentials against disclosure from ordinary browser records, accidental logging, unauthenticated encrypted-file modification, wrong-origin autofill and use after vault locking. Master-password encryption protects a copied vault file subject to passphrase strength and offline guessing. OS convenience unlock changes this boundary to the signed-in OS account.

Not protected: malware or debugging access under the same OS account, a compromised trusted UI/dependency, keyloggers, OS clipboard history, malicious code on the legitimate site after a user chooses Fill, filesystem deletion/rollback, physical-memory analysis or OS swap/crash dumps. Existing history, bookmarks and website storage remain outside vault encryption.

## Reviewed controls and evidence

| Boundary | Implementation and checks |
| --- | --- |
| Cryptography | Node's AES-256-GCM and scrypt primitives; fresh random keys/salts/nonces; authenticated context separation; no hand-built encryption primitive. Unit tests reject wrong context/tag/password and tampered files. |
| File integrity and writes | Closed versioned schema and size limits; only ciphertext is flushed to temporary storage; replacement after a successful write. Corrupt existing files cannot be replaced through Create or Import. Windows flush handling was corrected to use a writable descriptor. |
| Secret exposure | Password values and master keys are excluded from snapshots and SQL. Tests scan serialized snapshots, the vault file and SQLite for unique synthetic secrets. User-entered passwords cross only the existing validated trusted-UI command channel. |
| IPC | Registered chrome WebContents, exact internal main-frame URL and closed Zod commands are required. No website preload exposes vault APIs. Existing website isolation tests and the new fill test verify no Node or browser bridge in the page. |
| Autofill | Exact HTTPS origin checked in both main process and isolated top-frame function. Visible single-login-form constraints, POST, same-origin action, no submit. Tests reject origin lookalikes, hidden fields and off-origin form actions without inserting a password. |
| Locking | Startup locked; idle deadline verified before secret access as well as by timer. Screen lock/suspend/quit lock the vault. An epoch invalidates asynchronous unlock/key operations after a concurrent lock. Unit tests cover timeout and lock/unlock overlap. |
| Clipboard | Explicit copy only; serialized copy/clear operations prevent a concurrent lock from leaving a late copy behind. Digest comparison avoids clearing different replacement text. Tests cover timeout, replacement, races and timer-Off behavior. Quit awaits cleanup. |
| OS keys | Explicit opt-in; OS encryption availability/backend checks; asynchronous safeStorage; encrypted exports exclude device wrapper; master change disables convenience unlock. Actual Windows integration and injected-provider unit tests exercise this path. |
| Password generation | Web Crypto getRandomValues, rejection sampling to avoid modulo bias, selected-class coverage and random shuffle. Passwords are generated locally and are not sent to a service. |
| Private browsing | Vault access commands are rejected in temporary workspaces; snapshots omit entries there. Tests verify private copy is rejected and credentials stay outside ordinary database records. |

## Results and release limits

The full suite contains **54 passing unit tests and 14 passing Electron scenarios**. `npm audit --omit=dev` reported **0 known vulnerabilities** at review time. This checks the available advisory database, not the absence of vulnerabilities.

Further production work should include independent cryptographic and application review, fuzzing of corrupted vaults/forms, multi-platform key-store testing, recovery/backup UX review, signed releases and a maintained Electron security-update process. Automatic autofill, arbitrary page scripting, plaintext export and silent recovery are intentionally unavailable. Support for a conservative set of login forms should not be described as universal autofill.

Clipboard comparison is best effort: another process can change the clipboard between read and clear, and identical replacement text is indistinguishable. JavaScript string copies cannot be securely erased on demand. Permission mode bits on Windows rely on the user-data directory's inherited OS permissions; they are not a separate hardened ACL policy.

## Primary references

- [Node Crypto documentation](https://nodejs.org/api/crypto.html): authenticated encryption, scrypt and cryptographic randomness.
- [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): scrypt work-factor guidance used when selecting the fixed KDF settings.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): OS protection boundaries and weak Linux fallback behavior.
- [Electron clipboard](https://www.electronjs.org/docs/latest/api/clipboard): asynchronous main-process clipboard operations.
