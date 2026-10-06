# Phase 3 — privacy and temporary browsing

Version **0.3.0** completes the Phase 3 prototype: privacy dashboard, network tracking protection, site permission controls, isolated containers and temporary sessions.

## Controls

- Open **Browser menu → Privacy & permissions**, the address bar security icon, or the Privacy sidebar shortcut.
- **Standard** blocks tracking and ad requests using bundled EasyPrivacy and EasyList rules, plus targeted YouTube player protection. **Strict** also strips third-party HTTP Cookie/Set-Cookie headers. **Off** disables those filters. Reload after changing protection.
- **Pause filtering for this site** applies to the current origin in the current workspace. It does not grant website permissions.
- Set camera, microphone, location, notifications, clipboard read, fullscreen and popup access to **Ask**, **Allow** or **Block**. Notifications, clipboard read and popups default to Block. Other supported permissions default to Ask.
- Prompts identify the requesting origin, expire after 30 seconds and offer an optional remembered decision. Unremembered access lasts for the current document. Navigation cancels pending requests. Repeated prompts are rate limited. Subframes and unsupported device permissions are denied.
- **Refresh cookies** displays names, domains, paths and flags, without exposing cookie values to the browser UI. Remove individual cookies or clear the current site's cookies and local storage. Shared domain cookies can affect sibling subdomains.
- **Ctrl+Shift+N** opens a private window. **New temporary container** opens an isolated temporary workspace within the current window. Private windows also make any newly created workspaces temporary.
- Close a temporary container's last tab, remove the container, or close its window to discard its website session. Closing a container displays a cleanup receipt. Closing the last container of a private window creates a fresh empty private container.

## Persistence and boundaries

Normal workspaces retain their separate Chromium partitions, history and bookmarks. Migration 3 adds `site_permissions` and `site_exceptions`, keyed by workspace and exact origin, without deleting earlier records.

Temporary workspaces use unique partitions without the `persist:` prefix and disable disk caching. Their history, bookmarks, tab restore entries, named sessions, automatic checkpoints, permission decisions, filter exceptions and download records are not written to the application database. Tabs and groups cannot move between temporary and persistent containers. Explicitly downloaded files remain on disk; their temporary manager records disappear when the container closes. All temporary sessions use Strict protection unless the user pauses filtering for a site.

The main process owns filter decisions, permission callbacks and cookies. External pages still have sandboxing, context isolation and no preload bridge or Node access. Allowed popup destinations open as isolated tabs; popup form submissions and unsafe URLs remain blocked. Permission changes affect subsequent access; reload a page to stop already active media capture after revoking access.

## Modules and filter maintenance

- `src/main/privacyService.ts`: shared session hooks, rule matching, measured counters, origin permissions and pending request lifecycle.
- `src/main/privacyPolicy.ts`: origin validation, registrable-domain comparisons and capability mapping.
- `src/main/browser.ts`: temporary lifecycle, cookie metadata, scoped commands and persistence exclusions.
- `src/shared/privacy.ts`: privacy contracts and conservative permission defaults.
- `src/renderer/features/privacy/`: dashboard and permission dialog.
- `resources/filters/`: original EasyList/EasyPrivacy sources, provenance hashes and attribution. `scripts/build.mjs` compiles network-only binary indexes and packages the original lists alongside them.

Runtime browsing never downloads filter updates or submits browsing data. To deliberately refresh the bundled official sources during development:

```powershell
npm run filters:update
npm run build
```

Attribution and licenses are documented in [the bundled notice](../resources/filters/NOTICE.md). The Ghostery matcher is used only for network rules; list-supplied cosmetic filters and scriptlets are disabled. A separate, bundled YouTube content preload removes known player ad metadata before page scripts consume it. It exposes no browser APIs, executes only on exact supported HTTPS YouTube hosts in the top frame, and checks a boolean policy against the registered WebContents in the main process. Reload to apply content-protection changes.

## Validation

`npm test`: 40 unit tests cover the existing browser contracts plus registrable domains, permission origin/frame boundaries, capability mapping and database permission isolation.

`npm run test:e2e`: nine Electron scenarios pass, including all six previous browsing/workspace/split/session regressions. New tests verify actual network cancellation with a local server, per-origin filtering exceptions, cookie metadata redaction/removal, a real Chromium permission prompt, remembered access/reset, private persistence restrictions, a private download, cookie cleanup and private-window exclusion from restart. The test also checks the closed database for unique private fixture strings. The YouTube-origin fixture verifies document-start injection, initial/parsed/fetched player responses, preservation of media URLs and unrelated JSON, no Node or browser bridge exposure, and Off/site-pause behavior. Screenshots include `test-results/privacy-dashboard.png`.

## Limits

### YouTube ad follow-up

The first Phase 3 build only applied EasyList in Strict mode and had no player-response handling. Standard now applies both network lists. `src/preload/youtube.ts` handles known `adPlacements`, `playerAds` and `adSlots` fields on initial player globals and JSON player responses, while preserving streaming data. These field names are also used by the [upstream uBlock YouTube filters](https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt). This is a small independent compatibility implementation, not the full uBlock engine or filter set. Injection uses Electron's [executeInMainWorld](https://www.electronjs.org/docs/latest/api/context-bridge#contextbridgeexecuteinmainworldexecutionscript-experimental) from a separate sandboxed preload; the trusted browser-control preload is never attached to websites.

A manual signed-out YouTube check on 2026-09-09 loaded the Blender Foundation's Big Buck Bunny video, reported playability OK, advanced playback beyond two seconds, and showed no active ad at observation time. This does not establish that an ad would have appeared without protection or prove coverage for other accounts, regions, songs, server-inserted ads or YouTube experiments. The repeatable fixture establishes the implemented transformations and opt-outs; it is not a live ad-auction test.

After upgrading, close all older Aster windows and restart with `npm start`. Keep protection at Standard or Strict, turn off the site's pause checkbox, and reload the YouTube tab. Player transformations are not included in the dashboard's network request counters. If playback breaks, pause protection for the site and reload.

This is a working prototype, not an independently audited browser or anonymity tool. Websites, network operators and the operating system can still observe activity. Private mode does not promise forensic erasure from OS swap/crash dumps, and saved downloads remain ordinary files.

Dashboard counters cover requests attributed to the current tab and reset on navigation; they are not an exhaustive privacy score. Cookie header filtering does not disable every third-party storage API. Filtering can break embedded content or authentication; a per-site pause is available. Rules stay at their bundled version until explicitly updated. Cosmetic ad hiding, fingerprinting defenses, phishing reputation services, certificate inspection, password storage and automatic security updates are outside this milestone.

## Start the updated version

Close older Aster windows, stop their terminal process with Ctrl+C if needed, then run `npm start` from `D:\new broweser`. A `built in ... ms` message is a successful compilation; the browser opens in a separate desktop window.
