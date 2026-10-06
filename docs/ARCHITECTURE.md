# Aster browser — architecture and delivery plan

**Implementation status:** Phases 1-6 delivered in v0.6.0. [Phase 6](PHASE-6.md) and its [security review](SECURITY-REVIEW-PHASE-6.md) describe the encrypted vault boundary. [Phase 5](PHASE-5.md) documents developer utilities and their transient data. [Phase 4](PHASE-4.md) documents productivity tools, reader extraction and customization. [Phase 3](PHASE-3.md) covers migration 3, network filtering, permissions and temporary-session boundaries. [Phase 2](PHASE-2.md) details migration 2, the new files, session ownership, isolated Chromium partitions and validation. The initial design below is retained as the original architecture baseline.

The subsequent [Theme Studio architecture](THEME-STUDIO.md) adds a shared validated visual schema and native/renderer geometry resolver. The declarative [theme JSON schema](../schemas/theme.schema.json) is the import/export contract.

## 1. Technology decisions

Windows-first Electron desktop application; Chromium WebContentsView for real websites; TypeScript throughout; React + Vite for trusted browser chrome; Zustand for renderer snapshots; Zod for IPC validation; Node's built-in SQLite in Electron's main process with versioned migrations. CSS custom properties provide themes. Vitest tests pure services and Playwright drives the actual Electron app. Electron Builder produces Windows packages. No remote fonts, analytics, AI requests or extension loading in Phase 1.

SQLite avoids a separate native addon ABI/rebuild dependency. The main process owns all records and Chromium sessions. Later vault work uses authenticated encryption and OS-backed safeStorage, with a separate threat review before implementation.

## 2. Architecture diagram

```text
Trusted local aster://app UI (React, sandboxed)
    │ minimal typed preload bridge; no generic IPC API
    ▼
Main-process IPC router (sender + top-frame + payload validation)
    ├── BrowserController → tabs → sandboxed WebContentsViews
    │                               │ no preload, no Node, no UI access
    │                               └── isolated Chromium browsing session → web
    ├── Repository → SQLite migrations → local user-data directory
    ├── Download manager → native save dialog → user-chosen file
    └── Settings / navigation policy / OS window controls

Untrusted website content ──X── privileged preload and SQLite
```

## 3. Security architecture

Every renderer uses contextIsolation, sandbox and disabled Node integration. Only browser chrome receives the preload. IPC accepts only the registered window's main frame at the exact internal app URL, with a closed command schema. The internal protocol serves only bundled assets from a constrained root; website sessions cannot access it. UI navigation and popup creation are blocked. Website navigation accepts HTTP/HTTPS only, including redirects; no automatic OS protocol launching. Chromium retains certificate validation, same-origin checks and mixed-content protection. Website permissions and popups are denied by default in Phase 1; a granular permission center comes in Phase 3. Downloads require a save dialog, have a concurrency cap, and are never automatically opened or executed. Logs omit visited URLs and sensitive content. React renders user strings as text; CSP forbids remote UI scripts and frames.

This is a prototype, not an audited replacement for a mature browser. Electron/Chromium updates, signed releases, fuzzing and independent security review are release gates. HTTP is allowed for compatibility with a visible insecure indicator. Site compatibility may differ from Chrome, especially DRM, extensions, federated authentication and denied permissions.

## 4. Database schema

Phase 1 (migration 1):

| Table | Fields |
| --- | --- |
| schema_migrations | version INTEGER PK, applied_at INTEGER |
| settings | key TEXT PK, value TEXT JSON |
| bookmarks | id TEXT PK, title TEXT, url TEXT UNIQUE, created_at INTEGER |
| history | id TEXT PK, title TEXT, url TEXT, visited_at INTEGER; descending time index |
| downloads | id TEXT PK, filename TEXT, url TEXT, path TEXT, received INTEGER, total INTEGER, state TEXT, started_at INTEGER |

Parameterized SQL only. History and download reads are capped and history is searched in SQL. Writes remain small; later analytics and large imports should move into a utility process. Settings validate on both read and write. Incomplete downloads become interrupted on restart.

Future migrations, added with their owning feature rather than speculative empty tables: bookmark_folders; workspaces; tab_groups; sessions; site_permissions (origin + permission key); site_profiles; notes; reading_list; custom_shortcuts; themes; time_tracking; projects; page_memories. Workspace-scoped records reference workspaces; Chromium partition names, not SQL alone, isolate cookies. Passwords belong to a separate encrypted vault and are never part of normal exports.

## 5. Folder structure

```text
docs/ARCHITECTURE.md       architecture, dependency map, wireframe, roadmap
docs/PHASE-1.md            completion report and validation
src/main/index.ts         app lifecycle, trusted asset protocol, IPC
src/main/browser.ts       window and WebContentsView tab lifecycle
src/main/security.ts      URL and sender policy
src/main/database.ts      repository and versioned schema migration
src/preload/index.ts      narrow bridge
src/shared/types.ts       state and bridge types
src/shared/schema.ts      validated command/settings contracts
src/shared/navigation.ts  URL/search resolution
src/renderer/App.tsx      browser chrome and internal pages
src/renderer/components/  reusable controls and icons
src/renderer/store.ts     synchronized state
src/renderer/styles.css   design tokens, layout, themes, accessibility
scripts/build.mjs         main/preload bundling
tests/                    unit, database and Electron integration tests
package.json              run, test and packaging commands
```

Feature folders will be extracted as phases add independent services. No empty placeholder services.

## 6. Feature dependency map

```text
Security policy + IPC contracts + SQLite
  → desktop chrome + tab lifecycle + navigation
      → history / bookmarks / downloads / settings                 [1]
      → workspaces → groups → sessions → split view                [2]
      → session policies → containers → permissions → blockers    [3]
      → local content → notes / reading / command palette / themes [4]
      → tab instrumentation → developer tools / captures          [5]
OS keychain + threat model → encrypted vault → autofill             [6]
Content extraction + consent + provider configuration → AI         [7]
All phases → profiling / accessibility audit / signed distribution [8]
```

## 7. Browser UI wireframe

```text
┌ A  ASTER          [New tab ×] [+]                  ─  □  × ┐
│ ←  →  ↻  ⌂    [ security · Search or enter address ] ☆  ⋯ │
│                                                          │
│  NEW TAB                                      local date │
│                                                          │
│                  A little space to explore.               │
│              [ Search the web or enter a URL         ↗ ] │
│                                                          │
│           [GitHub] [Wikipedia] [YouTube] [Add bookmark]    │
│                                                          │
│        Your bookmarks          Recently visited          │
│        saved page rows         actual local history      │
│                                                          │
│  Local by default.                  History · Downloads   │
└──────────────────────────────────────────────────────────┘
```

Websites occupy the full area below the toolbar. Internal history, bookmarks, downloads and settings replace that area. Restrained warm neutrals, forest accent, fine dividers, local system typography, visible focus, 160 ms interactions and reduced-motion support. No fabricated usage or protection statistics.

## 8. Implementation roadmap

1. Runnable desktop browser: native website rendering; tabs (new, select, close, duplicate, pin, mute, reorder, restore closed); navigation/search; history; bookmarks; download management; local settings; keyboard controls; unit and Electron tests.
2. Vertical tabs, groups, workspaces, persistent session/crash restore, sidebar, split panes and floating windows. Validate isolation and restore semantics.
3. Permission UI, established blocking lists, privacy dashboard with measured counters, isolated containers and temporary sessions. Validate cleanup and permission provenance.
4. Notes, reading extraction/list, command center, omnibox utilities, configurable start page, theme/settings export. Validate local persistence and import limits.
5. DevTools integrations, API inspector, responsive testing, screenshots, JSON/URL tools and scratchpad. Keep web instrumentation separate from UI privileges.
6. Vault threat model, key derivation, authenticated encryption, OS keychain, domain-bound autofill, clipboard expiry and independent audit.
7. Provider-agnostic AI with content preview and explicit transmission consent, local cache, research/study workflows. No default provider or silent upload.
8. Profiling, sleeping tabs, accessibility audit, crash recovery, Windows installer/portable, signing and verified update pipeline. No unauthenticated updater.

## Upstream references

- https://www.electronjs.org/docs/latest/api/web-contents-view
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/api/session

Reviewed while establishing the prototype. Their recommendations do not constitute an audit of this application.

## Phase 7 implementation

`shared/ai.ts` defines validated provider, source, learning and preview contracts. `main/aiService.ts` owns session-only credentials, bounded provider requests, one-use consent and exact-input caches. BrowserController owns window context, isolated DOM extraction and focus timers. SQLite migration 5 adds workspace learning collections and AI response caches. `renderer/features/learning` implements the three learning panels. See [Phase 7](PHASE-7.md) for setup, security boundaries and validation.
