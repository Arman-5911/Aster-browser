# Files and downloads ? 0.7.3 (6 October 2026)

## Using the new controls

- Browser menu > Open file, or Ctrl+O: choose a PDF, text/HTML document or supported image for a sandboxed browser tab.
- Downloads (Ctrl+J): Open a completed file, Show in folder, pause/resume/cancel an active transfer, or Retry an interrupted/cancelled download. Missing or moved files produce a clear error.
- PDFs use the built-in Chromium viewer. Browser menu > Save page / Ctrl+S downloads the original PDF. This fallback does not include edits made in the PDF viewer; use the viewer's save controls for edited copies.
- Right-click a web link or image for Save link as / Save image as. Copy link address is available too.
- Websites can request access to one selected file using the File System Access API. Aster asks before granting read/write access, limits it to that file and the requesting page, and clears grants on navigation/close. Directory grants are not supported.
- Other downloaded file types open in the system default application after confirmation. Files never open automatically.

## Fixes and boundaries

Enabled plugins on sandboxed content views and allowed the built-in PDF viewer's subframe. Navigation now admits same-origin blob documents and ordinary embedded about:blank/srcdoc documents, while continuing to deny web navigation into arbitrary local files or browser UI. Actual input may open foreground/background links in Aster tabs; unsolicited script popups retain the existing permission policy. Removed the silent three-concurrent-download cancellation. Saved filenames now follow the actual selected save path.

Local paths are authorized by the file picker or a completed download record. Raw, unapproved file: input is still rejected; use Ctrl+O. Local/blob tabs become new tabs when a session is persisted because blob URLs expire and local-file access should be selected again after restart. Private download records stay in their temporary workspace.

Not full Chrome parity: Web Store/native Chrome extension compatibility, directory File System Access grants, POST popups and script-created about:blank popup workflows remain outside this change. Expired/authenticated download URLs may need regeneration on the original website. Server errors/account restrictions are not bypassed.

## Research

- [Chrome: download a file](https://support.google.com/chrome/answer/95759?co=GENIE.Platform%3DDesktop&hl=en-GB): downloads, saving and opening in the default app.
- [Electron DownloadItem](https://www.electronjs.org/docs/latest/api/download-item): native save selection, progress, actual save path, pause/resume and terminal states.
- [Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences): plugin support and sandbox/isolation settings.
- [Electron session permission API](https://www.electronjs.org/docs/latest/api/session): fileSystem checks and requests; isMainFrame is always false for this permission, so origin and selected path are validated explicitly.

## Validation

87 unit tests passed, including document navigation boundaries and file-specific permissions revoked on navigation/shutdown. Electron tests cover actual HTTP link/new-tab/blob downloads, chosen filenames, text preview isolation, missing-file errors, file input upload, remote/local PDF page rendering and byte-for-byte PDF saving. Existing browsing/session, Studio, privacy, private-download and shutdown regressions also passed targeted reruns.

The initial 28-test audit exposed a popup-policy regression, which was corrected by requiring recent real input; its regression test now passes. A video-wallpaper readiness check timed out once and passed unchanged on the targeted rerun. No claim is made that every third-party website or every Chrome feature has been verified.

Packaged 0.7.3 executable: both document/download tests passed, including real mouse input after focusing the native window. The packaged main bundle matches the production build; installer/portable SHA-256 hashes are in release/SHA256SUMS.txt.
