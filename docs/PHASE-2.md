# Phase 2 — organized browsing

Version **0.2.0** extends the existing Phase 1 implementation. It preserves the Windows launch fix and the sandbox/IPC boundary.

## Completed features

| Feature | Implemented behavior |
| --- | --- |
| Vertical and horizontal tabs | Instant toolbar toggle; pinned tabs; URL/title search; drag reorder; groups visible in both layouts; native text hover previews |
| Tab groups | Name, four colors, four icon choices, collapse/expand, tab assignment, ungroup without closing tabs, move an entire group between workspaces |
| Workspaces | Create, rename, switch and remove; independent tab/group/split state; per-workspace theme and history preference |
| Website session isolation | Each workspace has its own Chromium partition for cookies and website storage. Personal retains the original Phase 1 partition |
| Local data isolation | Bookmarks and history are scoped by workspace. Existing Phase 1 records migrate into Personal without deletion |
| Sidebar | Searchable tabs, workspace buttons, drag tabs to a workspace, bookmarks/history/download/session shortcuts; Ctrl+B toggles the sidebar |
| Automatic session restore | Normal shutdown/restart restores all open browser windows, their workspaces, tabs, groups and split layouts. Unselected pages are loaded on demand |
| Crash recovery | An unclean checkpoint offers Restore or Start fresh before reopening websites |
| Named sessions | Save the current window's workspaces under a name, restore into another window, delete a saved session |
| Split view | Two columns, two rows, three panes and four-pane grid using real WebContentsViews; pane selection; mouse and keyboard divider resizing |
| Floating tabs | Move a live tab into a resizable native window without reloading it; optional Always on top; close the mini-window or choose Bring back to dock the same view |

## How to run

Close any running **older Aster windows** before launching the updated code; the main process and database schema change in this phase. Then, from `D:\new broweser`:

```powershell
npm install
npm start
```

If `npm start` is still running in the terminal, stop it with Ctrl+C after closing its browser window, then run it again. `built in … ms` means compilation succeeded; Aster opens as a separate window. Phase 2 uses a single-instance lock for each user-data profile, so another normal launch focuses the existing instance.

## Where to find the controls

1. **Vertical tabs:** folder-shaped toolbar button labelled “Toggle vertical tabs.” The setting is also under Browser menu → Workspaces & groups.
2. **Workspaces/groups:** Browser menu → Workspaces & groups, or the gear at the top of the sidebar. Create a workspace, then switch through the toolbar selector or sidebar. Creating a group assigns the current tab; use the tab assignment dropdowns to organize others.
3. **Split:** toolbar “Toggle split view” button or Ctrl+Shift+S. Choose the layout at the top. Select tabs through each pane's dropdown. Drag a divider, or focus it and press arrow keys; Home resets that divider to the middle. Exit split keeps all tabs open.
4. **Floating tab:** tab context menu → Float tab, or the arrow button in a split pane. “Always on top” appears in the original pane. Close the mini-window to dock it back.
5. **Saved sessions:** Browser menu → Save or restore session, the Sessions internal page, or Saved sessions in the sidebar. “Continue where you left off” controls normal startup restore.

## Files created and module connections

```text
src/shared/workspace.ts
  Zod-validated workspace, group, tab, split, checkpoint and window-session contracts
  Stable Chromium partition naming and bounded restore input
src/shared/layout.ts
  Shared native/React pane geometry, toolbar heights and divider gutters
src/main/sessionCoordinator.ts
  One application-wide checkpoint writer; clean shutdown marker and recovery state
src/renderer/features/organization/TabNavigation.tsx
  Reusable horizontal/vertical tab strips, groups and workspace sidebar
src/renderer/features/organization/OrganizationPage.tsx
  Workspace/group editor and named-session manager
src/renderer/features/organization/organization.css
  Phase 2 layouts consuming existing design tokens
src/renderer/features/splitView/SplitView.tsx
  Pane headers, new-tab/error/floating states and accessible draggable dividers
tests/workspace.test.ts
  Session boundary validation, partition policy and split geometry tests
docs/PHASE-2.md
  This completion report
```

Existing files extended: `src/main/browser.ts` owns workspace lifecycle, isolated sessions, view placement and mini-window transfer; `database.ts` adds migration 2, workspace-scoped records and session storage; `index.ts` connects checkpoint ownership, startup restore and single-instance behavior; shared IPC types/schemas allowlist the new commands; `App.tsx` composes the new controls without replacing Phase 1 pages. Database and Electron integration tests extend the existing suites. Package version is 0.2.0.

## Database migration 2

- `bookmarks`: adds `workspace_id` with a composite unique constraint `(workspace_id, url)`; copies every legacy record into `default` before replacing the original table, inside a transaction.
- `history`: adds `workspace_id` with default `default` and an index on workspace/time.
- `sessions`: `id`, `name`, validated `data` JSON, `updated_at`.
- `checkpoints`: one row containing validated window-session JSON and a clean-shutdown flag.

Workspace and group metadata are nested in each window's versioned session document so a checkpoint saves tab order, group references and pane assignments together. Separate normalized workspace/group tables were not needed for these bounded documents. Bookmarks and history remain independently queryable SQL records. Settings from Phase 1 receive defaults for tab layout, sidebar visibility and startup restore.

## Validation

```powershell
npm run check
npm test
npm run test:e2e
```

The phase has **35 passing unit/database tests** and **6 passing Electron integration scenarios**, covering the Phase 1 regressions plus:

- migration of actual Phase 1-shaped data and duplicate bookmark URLs across workspaces;
- workspace session separation, scoped bookmarks/history, tab/group movement and workspace removal;
- vertical tab search, collapsed-group search and visible native window startup;
- split layouts, native bounds/visibility, pointer drag, keyboard resize, adding/closing a split tab;
- floating, always-on-top, docking and preservation of the underlying WebContents instance;
- named and automatic session restore, multiple windows, group/pin/mute metadata and split ratios;
- simulated abrupt exit, recovery prompt and absence of website loads before restoration is chosen;
- unsafe persisted URLs, dangling references, duplicate IDs and invalid IPC input rejection.

Screenshots from the trusted UI are generated under `test-results/phase2-*.png`. Playwright's renderer screenshot does not composite the separate native website surfaces; integration assertions check their bounds and visibility directly.

## Remaining features and practical limits

- Phase 3: granular permissions, privacy dashboard, tracker/ad filtering, temporary/private containers and verified cleanup. Workspace isolation is persistent organization, **not private browsing or network anonymity**.
- Phases 4–8 retain the original notes/reading/command-center, developer tools, vault, AI, performance and distribution roadmap.
- Session restore saves addresses, titles, tab order, groups, pin/mute/zoom, active workspace and split geometry. It does not save form values, back/forward stacks, scroll offsets or live JavaScript state. Floating tabs restore docked. Split pages load on startup; other background tabs wait until selected.
- Workspace definitions and open tabs belong to a window's session. Restoring the same workspace in another window reuses its cookie partition and stored bookmarks/history, while tab/group edits in the two windows are independent.
- Downloads and general preferences remain application-wide. Workspace history requires both the global and workspace history settings to be enabled. A workspace theme override takes precedence over the global theme.
- Moving a tab or group between workspaces destroys its old view and reloads its URL with the destination cookies when selected; in-page work does not transfer.
- Removing a workspace closes its tabs but deliberately retains its website data and local records. Clear its site data/history first if desired. A saved session can reopen the workspace later.
- Limits: eight main browser windows, 20 workspaces and 100 total tabs per window, 50 groups per workspace and 100 named sessions. No new capacity is silently created past these limits.
- Checkpoints are debounced by 200 ms; changes immediately preceding a crash may be lost. Saved session documents are validated before any URL is loaded.
- Native page views are briefly hidden while dragging a divider so the trusted UI can receive pointer input across panes. No screenshot of page content is saved for this interaction.
- Hover previews show title/address/status text; thumbnail capture and nested tab folders remain future enhancements. Sidebar websites and freely rearrangeable tool sets are outside this phase's built-in sidebar.
- Unsaved-form close prompts, a full accessibility/security audit, signed installers and automatic updates remain outstanding as documented in Phase 1.

No production release or full completion of the 100-feature brief is claimed by this phase.
