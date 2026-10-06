# Stability fixes (2026-09-16)

- Browser view teardown detaches the tab before native close events can re-enter layout. UI updates and floating-window docking check whether the main window is destroyed.
- Privacy disposal is idempotent. Late network requests are cancelled without accessing a closed repository, and late completion events do not schedule UI updates.
- Audio popup cleanup runs once, drops its host reference before destruction, and queued operations retain the sender ID instead of accessing a destroyed sender.
- A rejected secret-cleanup promise is handled during quit and reports a bounded diagnostic event.
- The opt-in API Inspector displays Chromium network failure codes. Arbitrary error text is replaced with a generic message; request headers and bodies remain excluded.

Validation: 77 unit tests and 8 targeted Electron tests passed, covering privacy, developer tools, audio popup capture, and closing a window with floating, loading and study-focus tabs. The original reported popups were not reproduced; these changes address concrete lifecycle hazards and add a regression for requests after disposal.

## AI Studio submission troubleshooting

The exact original error is unknown. Three representative Google API URLs were checked against the bundled ad/tracker filters and did not match. Successful signed-in AI Studio generation has not been verified.

If submissions fail with Strict protection, use Privacy > Protection level > Standard and reload the page. Standard retains ad/tracker request filtering while allowing third-party cookie headers. This is a diagnostic step, not a confirmed fix for the reported failure. Existing profile settings were not changed automatically.

For a repeated failure, enable Developer > API Inspector > Start recording before retrying, then inspect the failure code or HTTP status. Recording is opt-in and memory-only. Authentication, account restrictions, service errors and extension behavior still need the actual failure to distinguish them.

## Automatic AI site compatibility (2026-09-16)

Enabled by default for exact HTTPS application hosts: aistudio.google.com, gemini.google.com, chatgpt.com, chat.openai.com, claude.ai, copilot.microsoft.com, perplexity.ai, www.perplexity.ai, chat.deepseek.com and grok.com. These top-level pages use request protection Off, including third-party cookie-header filtering, in normal and temporary workspaces. Other pages retain their configured protection. This does not grant camera/microphone permissions or disable Chromium web security.

Privacy > Automatic compatibility for AI sites switches this behavior off or on; reload an existing page after changing it. The Privacy page reports when automatic compatibility applies independently of manual exceptions. Existing settings gain the enabled default without rewriting the profile during development.

The list deliberately does not match all Google domains or hostname lookalikes. Unknown AI sites can use the existing per-site manual pause. Compatibility cannot guarantee successful server responses or change a provider's account limits or pricing.

## 0.7.1 shutdown regression fix (19 September 2026)

The supplied screenshot identified `PrivacyService.mode -> Repository.exception` accessing the closed SQLite database. A new unit regression reproduced `database is not open` through late privacy decision calls after disposal. All privacy decision entry points now avoid storage once disposed; late request/header callbacks cancel, and privacy disposal starts during final quit before database closure. Session checkpoints also stop accepting late flushes after finalization.

Closed-window commands, download notifications and removed-tab Memory Saver checks now stop before accessing retired state. Startup controls wait for the native views to be released before accepting input. Extension capture startup has an explicit deadline and host-close rejection, so a renderer promise that never settles cannot leave the popup permanently waiting.

The retained audio capture implementation uses Electron's session display-media handler bound to the selected tab. Video tracks are stopped immediately. See [Electron's session API](https://github.com/electron/electron/blob/main/docs/api/session.md) for the underlying frame-grant semantics. The attempted audio-only alternative was not retained.

0.7.1 validation: TypeScript/build passed, 81 unit tests and the full 25-test Electron suite passed. The packaged executable also passed shutdown and audio tests, including an injected capture timeout followed by a successful retry. Packaged main code/logo bytes were checked against the current build. Installer and portable packages are in `release/`, with refreshed SHA-256 checksums.

0.7.2 also reduces repeated full-settings parsing in network interception, reuses request policy during header callbacks, and coalesces counter notifications. Validation: 82 unit tests and seven targeted Electron tests passed. A fresh-profile public AI Studio probe reached `/welcome`, returned document.readyState `complete`, and the browser snapshot responded in 35 ms. Signed-in submission and the user's original freeze are not conclusively reproduced by this probe.


## 0.7.3 files and document compatibility (6 October 2026)

See [Files and downloads](FILES-AND-DOWNLOADS.md) for fixes, research sources, tested behavior and remaining compatibility boundaries. Includes sandboxed PDF/local previews, download opening/retry, blob and embedded document navigation, real-input popup gating and selected-file permission handling. 87 unit tests passed; targeted document, browsing, privacy, private-download and shutdown checks passed.
