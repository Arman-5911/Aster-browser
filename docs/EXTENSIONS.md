# Extensions

Open the browser menu and choose **Extensions** from the internal sidebar, or use Ctrl+K and search Extensions. It opens as a dedicated tab. You can also add the Extensions toolbar button from Theme Studio > Layout Builder > Widget Library.

## Install and manage

1. Obtain an unpacked extension from a publisher you trust. Extract it yourself if supplied as a ZIP. Choose the folder containing `manifest.json`.
2. Click **Load unpacked extension**. Review the extension name/version, API permissions, website access, content-script match patterns and optional permissions.
3. Click **Install reviewed extension**. No extension code runs before this step. Aster copies the reviewed bytes into its own profile; later edits to the original source folder do not update the installed copy.
4. Reload websites to activate newly installed content scripts. Use Enable/Disable, Open extension popup, Extension options or Remove as available.

Extensions are installed separately per workspace. Reopening the same workspace restores enabled extensions before its first website loads. Other workspaces and private containers do not inherit the installation. Internal Aster UI runs in a separate session with no extensions.

## Compatibility

Electron supports only a subset of the Chrome extension API and only unpacked extensions, not CRX files or direct Chrome Web Store installation. Full Chrome compatibility is not promised. [Electron extension support](https://www.electronjs.org/docs/latest/api/extensions/)

Manifest V2 and V3 packages can be reviewed; successfully loading a manifest does not prove every API works. Content scripts and a local popup were verified in this build. Action popups are opened manually from the manager, not through a full implementation of Chrome toolbar action events. Unsupported APIs, provider logins and Web Store-only packages can fail. Aster does not fetch third-party extension packages or bypass store distribution restrictions. [Electron loader API](https://www.electronjs.org/docs/latest/api/extensions-api)

## Security and storage

Only native folder selection creates an import preview. Strict IPC accepts a one-use review ID, never a renderer-supplied filesystem path. The main process copies reviewed content, bounds the package to 64 MB (16 MB per file, 3,000 filesystem entries, 20 nested directories), rejects symbolic links/external paths, and hashes the complete file tree. Changed installed code is rejected on the next load/enable. Private containers cannot install or manage extensions. `allowFileAccess` stays false.

The permission list describes the manifest; it is not an audit or a granular permission editor. Extensions can read/modify matching website content and make external requests within the capabilities Electron supports. Install trusted code only. Optional APIs and permissions may not behave like Chrome.

Enabled background extensions can remain active until disabled or the app exits, even after their workspace tabs are closed.

Registry and installed copies live under the profile's `extensions` directory. Registry writes use a temporary file plus rename. Corrupt registries are preserved and block new writes. At most 20 extensions per workspace, 200 across the profile, eight pending reviews and 128 MB of pending content are allowed. Updates require removing the old extension and reviewing a fresh copy; there are no automatic updates.

Disable/remove unloads the extension and closes its popup windows. Effects of scripts already injected into open pages can remain until those pages reload. Removing deletes installed code and its registry entry; Chromium-owned extension storage can remain in workspace site data. Extension popup/options windows use the browsing session with sandbox/context isolation and no Node (the Volume Booster adapter has the narrow preload described below), and cannot navigate away from their own extension origin.

## Validation

Unit tests cover manifest access reporting, forged command rejection, safe extension-page paths, bounded copying, digest changes and invalid manifests. Electron integration uses a local MV3 fixture and checks pre-consent inactivity, real content-script execution, popup isolation, enable/disable, restart restore, workspace/private isolation and removal. The fixture is local; no Chrome Web Store extension was installed as part of testing.

Verified on Windows: production build and TypeScript passed, 70 unit tests passed, all 20 Electron scenarios passed, and the additional changed-file rejection check passed.

## Volume Booster compatibility adapter

Tab Volume Booster 1.1.0 now has a bounded Aster adapter. Chrome's native `tabCapture.getMediaStreamId` is still absent; the adapter connects this extension's SET_VOLUME controls to Electron's single-WebContents audio capture instead.

1. Restart Aster with `npm start` after building the update.
2. Open the website and start its audio.
3. Open Extensions and choose that website under **Audio target tab** on the Volume Booster card.
4. Click **Open extension popup** and adjust its presets/slider, Mute or Reset.
5. Keep the popup open. Closing it, disabling/removing the extension, closing the website tab or navigating the website ends capture and returns normal playback. Reopen the popup for a new document.

The adapter is selected only for the Tab Volume Booster 1.1.0 manifest/protocol. Other capture extensions are not automatically supported. The popup is bound to the explicitly chosen awake website in the same non-private workspace. Its title identifies the target. No automatic capture starts just from installing an extension.

The extension popup receives a narrow volume-control preload, never Node or the browser's privileged UI bridge. Main-process checks bind each request to that popup's main frame and selected live document. Only numeric volume 0..500 and target metadata are accepted; another tab cannot be selected by an extension message. Pending requests are bounded and startup times out. Only one active processor per target is allowed.

Audio processing runs in a separate in-memory, app-controlled session, without extensions or remote content. Chromium display-media acquisition supplies that selected WebContents (not desktop/system loopback); the temporary video track is stopped immediately and no video is displayed, recorded or sent to the extension. An AudioContext/GainNode routes tab audio to the output device. Local echo is suppressed while captured to avoid duplicate playback. Only the fixed internal processing document receives media/output permission; website and extension permission policies remain unchanged.

The popup adapter overrides the known extension's active-tab query and SET_VOLUME messaging. It does not implement a general chrome.tabCapture API, arbitrary service-worker bridges or background capture after popup closure. Source extension files are preserved. Some extension-specific background APIs may remain incompatible outside this adapted workflow.

Validation includes a generated audio waveform, input/output gain at 150%, a live audio-only processing stream, invalid gain rejection, popup/tab close cleanup, and a run using the user's actual installed extension copy in a temporary profile (150%, Mute and Reset). No live listening comparison or every website/audio-device configuration is claimed.

Reference: [Electron session display-media handling](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts).

Final development validation: production build/TypeScript passed, all 75 unit tests and the 23-scenario Electron suite passed. The installed Volume Booster copy also passed the separate 150% output-gain, Mute, Reset and teardown checks.

Windows installer/portable rebuild succeeded (unsigned preview). The packaged unpacked Aster.exe passed the actual-extension boost/mute/reset and teardown scenario in a temporary profile. SHA256SUMS.txt was refreshed in release/.

## Toolbar controls

Clicking the Extensions toolbar widget opens compact controls directly when one enabled extension supplies a popup. With multiple extensions, a native menu lets you choose one; with none, it offers Manage extensions. Right-click the toolbar widget to open the full manager at any time.

Toolbar controls are frameless, anchored near the button and clamped to the monitor, with a close header and Escape shortcut. Regular extension popups dismiss on blur. Volume Booster stays open on blur so its audio processor continues; close its header or press Escape to end boosting. It automatically targets the current awake website tab. Opening from the full manager keeps the existing explicit target selector and window workflow. Private containers remain excluded.
