# Phase 1 — desktop browsing foundation

Historical milestone: Phase 2 is now implemented. See [Phase 2](PHASE-2.md) for current session, workspace and split-view behavior; the “remaining” list below describes the original Phase 1 handoff.

## Completed

- Real Electron desktop window with independently sandboxed Chromium website views.
- Warm neutral start page, local typography, CSS design tokens, dark/system themes, three accents and reduced-motion support.
- Address/search bar, configurable search engine, HTTPS-first bare domains, localhost support, explicit insecure HTTP indicator.
- Back, forward, reload, stop, home, new tab, close, duplicate, pin, mute, reorder, tab cycling and restore recently closed tabs within a running window.
- Text tab previews via native tooltips and a tab context menu. Thumbnail previews belong to later tab work.
- SQLite migrations and repositories for history, bookmarks, preferences and downloads. Parameterized queries; duplicate bookmark URLs update existing entries.
- Searchable local history/bookmark/download lists, bookmark deletion and confirmation before clearing browsing data.
- Native file-save dialog for downloads, progress records, pause/resume/cancel and reveal-in-folder. No executable launch API.
- Settings for theme, accent, content density, search engine, home page, history recording and bookmark start-page module.
- Find in page, zoom, fullscreen, native print/save-page dialogs, basic website context menu, file-upload support through Chromium and separate DevTools.
- Multiple windows sharing a normal browsing session and local database.
- Sender/frame/origin and payload validation, minimal preload, constrained internal asset scheme, permission denial, popup denial and safe protocol navigation.
- URL/IPC/database unit tests and real Electron integration tests.

## Files and module connections

`src/main/index.ts` registers the internal asset handler and the two request IPC channels, owns the repository and window registry, and routes validated commands to `src/main/browser.ts`. That controller owns website views, navigation events and download items. It publishes bounded snapshots through `src/preload/index.ts`. The renderer's Zustand store receives snapshots; `App.tsx` composes chrome, start page, library pages and settings with reusable controls. The renderer cannot query SQLite or supply filesystem paths.

`src/shared/schema.ts` defines validated settings and command variants; `types.ts` supplies the shared snapshot shape; `navigation.ts` defines the address policy. `src/main/database.ts` owns migration 1 and all SQL. `styles.css` consumes `tokens.css`. Build scripts bundle main and preload separately from Vite's renderer output.

See [the full architecture](ARCHITECTURE.md) and [run instructions](../README.md).

## Validation

- `npm run build`: passed strict TypeScript checking and production bundles.
- `npm test`: 18 tests passed across navigation/security/IPC and SQLite suites.
- `npm run test:e2e`: two desktop integration scenarios passed against a local HTTP fixture. Verified real navigation/back/forward, tab duplication/pinning/muting/closing/restoring, bookmark and theme persistence across restart, denied notifications, sandbox preferences, absence of Node/preload in websites, malformed command denial, download completion, blocked popups and inaccessible internal UI assets from a website.
- Screenshots captured from actual Electron windows: `test-results/start-page.png`, `settings-dark.png`, `downloads.png`.
- Dependency installation audit reported zero known vulnerabilities at installation time. This is not a security audit.

## Remaining phases

Phase 2 adds vertical tabs, groups, workspaces, persistent sessions/crash restore and split panes. Phases 3–8 add permission management, containers/private sessions, blocker integration, notes/reading/command center, developer utilities, encrypted vault, consent-based AI, performance work and signed distribution. The architecture document maps their dependencies and release gates.

## Known limitations

- This is a Phase 1 prototype, not the complete 100-feature product or an independently audited daily-use browser.
- All website permission requests and popups are denied; some camera, notification, OAuth and payment workflows will not work yet. No external custom-protocol handlers are launched.
- Tabs do not survive an app restart. Restore closed tab retains URLs during the running window, not page form state, navigation stacks or pin/mute metadata.
- Closing tabs/windows releases their views immediately; unsaved website forms are not protected by a browser-owned close confirmation yet.
- History is capped to the newest 300 visible entries, bookmarks to 500 and downloads to 200; search currently covers those displayed records. Full-history pagination and advanced indexing remain future work.
- A window accepts up to 100 tabs and three concurrent downloads. Interrupted downloads remain visible after restart but cannot yet resume across app restarts.
- The basic HTTPS panel does not expose certificate details. There is no ad/tracker blocking, anti-phishing reputation service or encryption of ordinary SQLite records.
- DRM, Chrome Web Store extensions, passkeys, desktop capture, site-installed apps and broad third-party compatibility have not been certified.
- Native website surfaces appear above renderer layers. Internal panels deliberately hide the active website; page find controls remain within browser chrome. Transient renderer notifications over a live website may be occluded.
- SQLite access is synchronous and bounded for this phase. Large-scale import, advanced analytics and full-data search need a worker/utility process.
- Packaging configuration is supplied; installer generation, signing, custom application icon and auto-update verification have not been validated in this phase.
- Keyboard focus styling and reduced-motion handling are implemented; a full screen-reader/contrast audit and custom shortcut editor remain outstanding.

## Commands

```powershell
npm install
npm start
npm run check
npm test
npm run test:e2e
```

For manual validation: browse a website, follow a link, go back and forward, save a bookmark, duplicate/mute/pin/reorder tabs, download a file through the native dialog, search history, switch themes, close/reopen Aster and confirm saved records. Use a local upload form to verify Chromium's file picker. Test native print and save-page dialogs manually; the automated suite does not interact with OS modal dialogs.
