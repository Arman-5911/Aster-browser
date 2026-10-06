# Phase 8 - performance and release preparation

Status: started; first implementation slice. This is not a production-release completion claim.

## Implemented

- Open Settings, then Performance, or enter `aster://performance`.
- Cached application-wide process count, working-set RAM and CPU samples. The panel refreshes every 10 seconds; metrics are shared across windows and not attributed to individual tabs.
- Manual background-tab sleeping destroys the native website view. Selecting a sleeping tab reloads its URL. The tab strip displays Zz. Page state, scrolling and back/forward history are not preserved.
- Optional automatic sleeping after 5, 15, 30, 60 or 120 idle minutes. Off by default; settings persist. Maintenance is serialized and canceled when a window closes.
- Conservative protection for active, pinned, floating, visible split-pane, loading, private, audible, captured and DevTools pages. Pending permission prompts and active downloads block sleeping. DOM inspection rejects form controls, editable regions, frames and audio/video elements; it does not read form values. Pin important applications: these heuristics cannot detect every unsaved JavaScript state.
- Eligibility is rechecked after asynchronous inspection; changed, closed or selected tabs cannot be discarded by a stale result.
- Keyboard tab selection using arrows, Home and End, with one active tab stop.
- Electron test covers capture protection (Playwright itself captures pages), native view disposal/recreation, form and pinned protection, settings and keyboard navigation. Axe checks the performance panel only, using Electron-compatible legacy mode. This is not a whole-app accessibility certification.

## Remaining Phase 8 work

Full-app accessibility audit, profiling against a recorded baseline, broader auto-sleep/media/session edge-case tests, broader packaged-app validation, signing and a live verified updater remain to be completed. Existing session crash recovery tests remain part of the regression suite. No new crash-report upload service is enabled.

## Update architecture decision

Use electron-updater with the NSIS installer for a future signed release. Updates must remain disabled in development and portable builds. Build-time configuration must require an HTTPS feed and an explicit publisher identity; production builds must require code signing and retain Windows update-signature verification. Feed URLs must not be renderer-controlled. Check, download and install must be separate user actions; no silent download, downgrade or install-on-quit default. Publish the signed installer, blockmap and release metadata together only after validating signatures and a packaged upgrade test. No credentials or hosting have been configured, and no updater dependency/runtime is shipped yet.

Windows targets already exist: `npm run dist:win` builds NSIS and portable artifacts in `release`. Local unsigned artifacts are development previews, not a signed production release. Building does not install the application.

## Validation

TypeScript and production build passed. All 70 unit tests and 21 Electron scenarios passed, including the new performance-panel axe scan. The automatic idle timer and full-app accessibility audit require further coverage.

Official references: [Electron process metrics](https://www.electronjs.org/docs/latest/api/app), [Windows update signature verification](https://www.electron.build/docs/features/security/).

Windows packaging succeeded: `release/Aster Setup 0.7.0.exe` and `release/Aster 0.7.0.exe`. Both were verified as NotSigned. The unpacked packaged `Aster.exe` passed the performance Electron scenario and axe scan using a temporary profile. Install/uninstall and the portable launcher were not exercised. Version stays 0.7.0 while Phase 8 is in progress.

Re-run packaged smoke validation in PowerShell:

```powershell
$env:ASTER_PACKAGED_EXE = (Resolve-Path 'release/win-unpacked/Aster.exe').Path
npx playwright test tests/performance.e2e.ts
Remove-Item Env:ASTER_PACKAGED_EXE
```
