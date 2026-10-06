# Aster

**Modern iOS-inspired interface:** Refreshed light/dark controls, a new start page and an original Aster app icon. Switch between Modern and Classic under Theme Studio > Presets > Interface design. See [design notes and the Figma-importable SVG](docs/IOS-REDESIGN.md).

**Theme Studio + Layout Builder:** Browser menu > Customize Browser opens live presets, Liquid Glass, full-window wallpaper, toolbar reorder/hide, sidebar sizing, clean new tabs, workspace styling, undo/redo and safe `.theme.json` import/export. Advanced controls now add local video/rotating wallpapers, adaptive colors, immersive chrome, movable widgets and exact-origin website profiles (v0.6.1); see [implemented features and remaining work](docs/THEME-STUDIO.md).

A calm, local-first Chromium desktop browser. **Phases 1-7** are implemented at prototype scope (v0.7.3). The [architecture document](docs/ARCHITECTURE.md) covers the stack, security boundary, schema, folder structure, feature dependencies, wireframe and eight-phase roadmap. See the [Phase 7 completion report](docs/PHASE-7.md) for controls, validation and limitations.

## Run on Windows

**Phase 4:** Notes, Reading List, Reading Mode (F9), Command Palette (Ctrl+K), and start-page customization are available. See [the Phase 4 report](docs/PHASE-4.md) for controls and limitations.

Install Node.js 22.12+ and npm, then run in this folder:

```powershell
npm install
npm start
```

The first launch may download the Electron runtime. `npm start` builds the trusted local UI, main process and preload, then launches a real desktop window. No development server or debugging port is enabled during ordinary use. `npm run dev` currently runs the same build-and-launch workflow; restart after source edits.

## Use

- Enter a URL or search in the address bar. Bare domains prefer HTTPS; `localhost:3000` uses HTTP for local development.
- Add tabs with `Ctrl+T`; close with `Ctrl+W`; restore a closed tab with `Ctrl+Shift+T`. Use `Ctrl+Tab` to cycle. Drag tabs to reorder within their pinned/unpinned region. Right-click a tab for pin, mute and duplicate controls.
- `Ctrl+L` focuses the address bar; `Alt+Left/Right` navigates; `Ctrl+R` reloads; `Ctrl+D` bookmarks; `Ctrl+H` opens history; `Ctrl+J` opens downloads; `Ctrl+F` finds text; `Ctrl+P` prints; `F11` toggles fullscreen; `F12` opens page DevTools.
- The menu opens settings, bookmarks, page actions and zoom. Theme, accent, list density, search provider, home page and history preference persist locally.
- Toggle vertical tabs with the folder toolbar button. Browser menu → Workspaces & groups creates isolated workspaces and named/color-coded groups. Search tabs in the sidebar; Ctrl+B toggles it.
- Ctrl+Shift+S opens split view. Choose two columns, two rows, three panes or a grid; select a tab in each pane and drag the dividers to resize.
- Float a website tab through its context menu or pane arrow. Close the floating window to dock the same live page back. Always-on-top is optional.
- Save named sessions through the Sessions page. Normal restarts restore your open workspaces; an unexpected exit offers recovery before loading websites.
- Download links show a native save dialog. The manager supports pause, resume where the server permits, cancel, and showing completed files in their folder. It never launches downloaded files.
- Open **Privacy & permissions** from the menu or address bar security icon. Choose Standard/Strict/Off filtering, pause filtering per site, manage site permissions and inspect or clear cookie metadata.
- **Ctrl+Shift+N** opens a private window. **New temporary container** creates a separate memory-only workspace. Closing its last tab clears its cookies and website storage. Downloaded files remain on disk.

## Current stability build

Version **0.7.3** fixes late database access during shutdown, startup input timing and stuck extension audio capture requests. See [release notes](release/RELEASE-NOTES.md). Close Aster and install `release/Aster Setup 0.7.3.exe`; About should display 0.7.3.

## Verify

```powershell
npm run check
npm test
npm run test:e2e
```

Unit tests cover URL safety, IPC contracts, schema migrations, SQL persistence, session validation, partition policy and split geometry. Electron integration scenarios launch Electron against a local HTTP server with temporary profiles. They cover browsing, workspaces, groups, split resizing, floating windows, saved sessions, crash recovery, actual tracker blocking, permission prompts, cookie metadata and private-session cleanup/persistence. Test screenshots are written to `test-results/`. Electron integration tests need a graphical desktop and download the runtime if it is absent.

```powershell
npm run pack       # unpacked Windows app in release/
npm run dist:win   # unsigned development NSIS and portable packages
```

Installer signing and verified updates belong to Phase 8. Aster now includes its own app icon. Do not treat unsigned development packages as a public release.

## Data and security

Local records live in `aster.sqlite` in Electron's user-data directory (normally `%APPDATA%/Aster`). Chromium stores website data in a separate persistent browsing partition there. The internal app uses a separate session and a constrained `aster://app` asset handler. Remote pages have no preload bridge or Node APIs. The main process validates IPC sender identity, frame origin and command payloads.

No analytics, default AI provider or cloud sync is configured. AI is opt-in, with reviewed text and explicit transmission consent. Search terms go to the selected search provider only on submission. Standard protection blocks matching ad and tracking requests and applies targeted YouTube player protection; Strict adds third-party cookie-header removal. History, bookmarks, sessions and downloads are ordinary local records, **not an encrypted vault**. Workspaces isolate cookies, bookmarks and history; restoring the same workspace in another window shares its stored website data. Temporary containers and private windows omit browsing history, restorable sessions and download records from the database; their website storage stays in memory.

The prototype is not independently audited. It does not provide phishing detection, fingerprinting defenses, cosmetic ad hiding, Chrome extension compatibility, DRM guarantees or automatic security updates. Keep Electron current before handling sensitive browsing. See [Phase 3 status](docs/PHASE-3.md) for current limitations and [Phase 1 status](docs/PHASE-1.md) for the original milestone.

Filter rules are bundled from EasyPrivacy and EasyList with [source attribution](resources/filters/NOTICE.md). They are not fetched during browsing. Developers can refresh them with `npm run filters:update`, then rebuild.

Phase 5 tools are under **Browser menu > Developer tools**: an opt-in API request inspector, Chromium DevTools, local JSON formatting, viewport PNG save/copy and responsive CSS viewport previews. See [Phase 5](docs/PHASE-5.md) for scope and limitations.

The optional **Password vault** uses a separate encrypted file, a master password, optional OS account unlock, explicit HTTPS autofill and timed clipboard clearing. See [Phase 6](docs/PHASE-6.md) and the [internal security review](docs/SECURITY-REVIEW-PHASE-6.md). It has not been independently audited.

**Phase 7:** Open the browser menu, then **AI assistant**, **Research** or **Study** in the sidebar (also available through Ctrl+K). Configure an optional compatible chat API or local Ollama model. Capture page/selection text, edit it, preview the full request and click Send. Research excerpts, annotations, flashcards and focus sessions work locally; see [setup and limits](docs/PHASE-7.md).

**Extensions:** The Extensions sidebar page (or Ctrl+K) supports reviewed unpacked extensions, per-workspace enable/disable, popup/options pages and removal. Chrome Web Store/CRX installs and full Chrome compatibility are not supported. See [setup and limits](docs/EXTENSIONS.md).

## Phase 8 in progress

The first performance slice adds a Performance tab, opt-in Memory Saver and keyboard tab navigation. Open Settings > Performance or enter `aster://performance`. See [Phase 8 status and remaining work](docs/PHASE-8.md). Sleeping pages reload; pin pages with important unsaved work.

Address and new-tab search fields offer native dropdown suggestions from matching open tabs, bookmarks, history and configured shortcuts. Suggestions are local, deduplicated and limited to eight HTTP(S) addresses; private containers exclude saved history/bookmarks. Selecting a suggestion uses its address; it does not switch to an existing tab. Online predicted search phrases are not enabled.


File/PDF/download controls and compatibility details: [Files and downloads](docs/FILES-AND-DOWNLOADS.md).
