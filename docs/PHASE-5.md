# Phase 5 - developer utilities

Version **0.5.0** completes both implementation milestones: (1) developer workspace, API inspector and JSON tools; (2) screenshot utilities and responsive preview.

Open **Browser menu > Developer tools**, or search for Developer tools in the Ctrl+K command palette. Open a website first for page-specific tools.

## Part 1

- **Chromium DevTools:** F12 or the developer workspace button opens the active website's native DevTools, including Elements, Console, Network and sources. The website remains sandboxed and has no browser-control bridge.
- **API Inspector:** Start recording opts the active tab into a ring of at most 200 request metadata records. It displays method, URL path, resource type, HTTP status, failure/block state and elapsed time. Filter by text or show only API requests. Stop prevents new entries; in-flight records can finish. Clear removes the buffer. Recording follows that live tab across navigation and ends at closure. Other tabs start with recording off.
- Query strings, fragments and URL credentials are removed before storage. Headers and request/response bodies are not collected by this lightweight inspector; use DevTools Network for those. URL paths may still contain sensitive information. Records are memory-only, including in private containers, and are not checkpointed or exported. They disappear when the live tab is destroyed or transferred to a different workspace. Session webRequest hooks are shared with the privacy service so recording does not replace tracking protection or cookie filtering.
- **JSON tools:** validate/pretty-print, minify, clear and explicitly copy output. Processing stays in browser chrome, uses JSON.parse rather than code evaluation, and accepts at most 500,000 input characters. Parse errors are visible. Text is discarded when leaving the developer page. Standard JavaScript number precision and object-key behavior apply; use another tool for lossless arbitrary-precision JSON editing.

## Part 2

- **Screenshots:** save the current website viewport as PNG using the native save dialog, or explicitly copy the image to the clipboard. Browser controls are excluded. File destinations are not accepted from website or renderer payloads. Capturing an internal new tab is rejected. The current viewport is captured, not a full scrolling page; scroll to the desired content first. User-saved screenshots, including private screenshots, remain ordinary files on disk. Clipboard contents are changed only through an explicit copy action.
- **Responsive preview:** choose Phone (390 x 844), Tablet (768 x 1024), Laptop (1440 x 900), or custom dimensions. Rotate swaps dimensions. Apply uses real Chromium CSS viewport emulation, scaled to fit the available window. A toolbar displays dimensions and offers Exit. Bounds range from 240-2560 wide and 200-2560 high. Resizing the browser adjusts the fit; Exit restores the natural viewport. Preview is per live tab and is not restored after restart.
- Responsive preview requires a docked tab outside split view. Entering split view or floating a tab clears its responsive override. This is a CSS viewport preview, not a simulation of device hardware, touch, mobile user agent, network speed or every real-phone browser behavior.

## Validation

- **47 unit tests:** all earlier tests plus request opt-in, tab isolation, URL redaction, buffer bounds, completion state, JSON validation/formatting, payload size and IPC restrictions.
- **12 Electron scenarios:** previous browser/privacy/productivity regressions plus real local fetch recording, HTTP status, query redaction, stop/clear, native DevTools opening, JSON UI formatting/errors, actual innerWidth changes/restoration, native preview visibility and rendered pixels, PNG signature/dimensions/pixels, and image clipboard payload generation. Clipboard writes and save-dialog selection are intercepted only in the test harness; tests preserve the user's clipboard.
- No additional database migration or background network service is introduced.

## Implementation references

The inspector is in `src/main/requestRecorder.ts` and uses the existing privacy service's single [Electron webRequest](https://www.electronjs.org/docs/latest/api/web-request) handler set. Screenshot and responsive commands use [webContents capturePage and device emulation](https://www.electronjs.org/docs/latest/api/web-contents). Explicit clipboard writes use [Electron's clipboard API](https://www.electronjs.org/docs/latest/api/clipboard). UI and JSON utilities are under `src/renderer/features/developer` and `src/shared/developer.ts`.

## Run

Close older Aster windows, then run `npm start` from the project folder. These are prototype developer tools; signed distribution and automatic security updates remain later milestones.
