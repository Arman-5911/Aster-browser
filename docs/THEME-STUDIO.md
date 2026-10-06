# Theme Studio and Layout Builder

**Current release: v0.6.1.** Advanced personalization is available under Theme Studio > Advanced; widget editing is available from Browser menu > Widgets. The implementation boundaries below distinguish shipped controls from broader concepts in the original prompt.

## Architecture before implementation

1. **Theme system:** strict, versioned declarative settings in `src/shared/studio.ts`. Existing settings migrate through defaults. A global configuration can be overridden by a workspace; the same resolver feeds renderer tokens and native content bounds.
2. **Layout schema:** bounded toolbar height, sidebar width/side, address mode, and unique ordered toolbar widget IDs. The address field is structurally permanent. Browser menu remains available as a recovery control.
3. **Widget registry:** a closed registry of built-in browser actions, with labels and IDs shared by the editor and toolbar. No executable extensions or arbitrary widget code.
4. **Theme JSON:** version 1, an approved visual settings subset plus Studio configuration. Strict validation, bounded file size, no scripts/CSS/URLs/local paths. Export excludes local wallpaper data, workspace IDs, credentials, history and browsing preferences.
5. **Animation:** short CSS opacity/transform transitions. Motion off and OS reduced motion override effects. No continuous JavaScript animation loop.
6. **Liquid Glass:** wallpaper behind browser-owned surfaces, translucent opaque-color fallbacks, bounded backdrop blur, subtle borders and shadows. Native web pages remain separate opaque content surfaces. This release does not claim optical refraction.
7. **Performance:** Performance/Balanced/Maximum quality caps blur; performance mode disables ambient animation. Static raster wallpapers reuse the existing locally resized JPEG pipeline. No new runtime dependencies.
8. **Accessibility:** persistent address field and menu; keyboard toolbar reordering buttons alongside drag/drop; visible focus; restrained text palettes and readable surface opacity; reduced motion and forced-color fallbacks. No arbitrary text-color injection.
9. **Folders:** shared configuration/validation in `src/shared`; Studio editor, token application, and toolbar in `src/renderer/features/appearance`; native bounds reuse shared geometry; tests under `tests`.
10. **Incremental implementation:** this credit-conscious release delivers presets, full-window wallpaper controls, glass surfaces, layout sizing, toolbar library/reorder/hide, typography/corners/shadows/motion, clean start page, workspace styling, undo/redo, and import/export. Follow-up work covers video/time-based wallpaper collections, image color extraction, automatic battery adaptation, floating/autohide native chrome, free-form widget grids, website profiles and optical refraction. No empty controls for deferred features.

## Safety boundaries

Wallpaper Everywhere means browser-owned chrome and internal pages; it does not inject styling into websites. Private workspace-specific styles are not persisted. Imported themes cannot remove the address field or browser menu. Reset everything resets appearance and layout only and requires confirmation; browsing data and vault settings are excluded.

## First release: available controls

Open **Browser menu > Customize Browser**, the Theme Studio item in the internal sidebar, or search Theme Studio in Ctrl+K.

- Twelve calm presets, including Liquid Glass, Pure Minimal, Developer and Creator. Existing Amethyst/Ocean/Sunset/Botanical tab presets remain available under Tabs.
- Existing local raster wallpaper plus solid/gradient backgrounds; Wallpaper Everywhere; image fill/fit/stretch/center/tile, position, scale, brightness, saturation and contrast. Shared image dim remains bounded to 50–95% for readability, with blur up to 50 px subject to quality caps.
- Glass opacity 65–100%, tint, edge highlight, separate toolbar/sidebar/tab/panel/widget blur, shadow depth and three quality levels. Balanced caps blur at 16 px; Performance removes blur and decorative transitions/animations.
- Closed toolbar registry: navigation, address, workspace, vertical tabs, split view, downloads, history, notes, reading list, privacy, screenshot, developer tools, Studio, separator, spacer and menu. Drag/drop and keyboard-accessible move buttons reorder items. Library buttons add items; optional items can be hidden. Address and menu cannot be deleted. Crowded toolbars scroll horizontally with address/menu recovery controls retained.
- Shared 48–72 px toolbar height and 200–320 px sidebar width, left/right sidebar; full/centered/compact/expand-on-focus address layouts, width, corners and text size.
- System/humanist/monospace font stacks; paired Graphite/Midnight/Paper palettes; spacing/corners/shadows; soft-tab radius, tab spacing and title visibility, plus legacy tab style controls.
- Clean New Tab removes start-page modules except search. Persistent browser chrome remains available.
- Global or workspace-specific Studio styling. Workspace overrides include toolbar order/dimensions, colors, glass, background parameters and clean mode. Base light/dark preference, horizontal/vertical tab selection, image file/dim/blur and legacy tab styles remain global. The editor labels these boundaries. Private containers cannot save their own override.
- Forty-step in-editor undo/redo with Ctrl+Z/Ctrl+Shift+Z when focus is outside text controls. Native text undo is preserved. Theme settings in the embedded Tabs editor also participate; local image file import/removal and changing scope are outside undo history.
- Strict version-1 import/export: [JSON Schema](../schemas/theme.schema.json), authoritative runtime validation in `src/shared/studio.ts`. Export uses the native save dialog. Imports are limited to 64 KB. Local image and browsing preferences are preserved. Per-workspace imports apply Studio fields only.

## Advanced release ? v0.6.1

Open **Theme Studio > Advanced** for the additional controls. Open **Browser menu > Widgets** for the layout editor.

- Local wallpaper library: up to eight normalized images or silent MP4/WebM videos. Select an image, rotate a collection, divide the day across images, or use a video. Media stays in the local application profile; imports never publish the source path. Images retain the 12 MB / 24 megapixel limits; videos are capped at 32 MB. The local protocol serves bounded byte ranges for Chromium playback.
- Slow animated gradients, pointer-driven parallax up to 8 px, day/night dim values, time-dependent palettes, and local average-image-color extraction. Adaptive contrast chooses paired readable palettes. Extracted tints require an explicit click unless adaptive colors is enabled. This is mean-color analysis, not a claim of semantic dominant-color clustering.
- Automatic performance mode uses battery power, total memory below 6 GB, or fewer than four logical processors as conservative heuristics. Power changes refresh the UI. Video pauses with reduced motion, Motion Off, Performance mode, or hidden UI; blur and ambient movement are suppressed on low-power settings. There is no hardware-wide 60 FPS guarantee.
- Eight glass material choices, separate toolbar/tab/sidebar/panel/widget opacity, frost saturation, subtle noise, highlight thickness/direction, and a low-amplitude SVG displacement effect on a copied wallpaper edge. It does not refract native website pixels through the OS window compositor.
- Top, left, right, hidden, floating-appearance and auto-collapsing tabs; compact icon-only or hover-expanded vertical tabs; docked/floating-appearance/hidden/auto sidebar. Floating sidebar styling reserves native page space. Immersive toolbar collapses on pointer exit during website browsing; title-bar hover, a persistent Search affordance, and Ctrl+L recover it. Internal pages retain visible controls. This is pointer-driven immersive behavior, not website-scroll injection.
- Tab height/padding/icon size/border/shadow/close controls, muted/container indicators, pinned and group styles, font weight/tracking/sidebar/menu typography, configurable short animation duration/spring-like easing, workspace fade/slide, animated tab reordering and close-button exit motion. System reduced motion overrides these effects.
- Toolbar left/center/right zone ordering and drag handles directly on the live toolbar while Studio is open. The original editor's move buttons provide keyboard reordering. Live toolbar dragging does not participate in the Studio page's local undo stack.
- Fifteen built-in widget types: clock, date, calendar, focus timer, safe arithmetic calculator, notes, reading list, bookmarks, history, downloads, workspaces, tasks, system memory/power, current-tab mute control, and quick links. Widgets use existing local browser data. Tasks persist on this device, stay out of theme exports, and cannot be added from private containers. The timer is session-local to the mounted widget.
- One-to-four-column widget grids, small/medium/large/icon sizes, header drag reordering, snapped free-form positioning with pointer dragging and keyboard-operable coordinate controls, and relocation between start page, sidebar and a floating-card canvas. Floating cards are browser-internal cards, not separate always-on-top OS windows over websites. Clean New Tab still wins over the dashboard. Download cards can appear only while downloads are active.
- Exact-origin website UI profiles (up to 30) override workspace/global styling. The scope selector can edit an existing site style directly. These profiles contain Studio configuration only; they never inject CSS into website documents. Private containers cannot create profiles. Explicit import/export omits site origins, local asset records, tasks, browsing data and credentials.

## Implementation boundaries

The original prompt also describes concepts not represented as complete product features: arbitrary toolbar groups, true floating address bars/overlays over native websites, scroll-driven chrome reveal, independent OS widget windows, weather/AI/service-backed widgets, live CPU/network telemetry, sleeping-tab indicators, system accent extraction, and a hosted community gallery. Those are not shipped or represented by nonworking controls. The gallery contract remains declarative JSON. Native website views remain opaque, and existing browser security boundaries remain in force.

## Validation — September 11, 2026

`npm test`: 56 tests passed. `npm run test:e2e`: build succeeded and all 15 Electron scenarios passed. The new Studio scenario exercises live glass, undo/redo, protected controls, toolbar hide/add/reorder, right sidebar and custom toolbar native bounds, Ctrl+L from a real website, workspace inheritance, native file export, invalid/valid theme import, reset cancellation, clean start, reduced motion and restart persistence. Existing appearance, browsing, split/floating views, sessions, developer tools, privacy and vault scenarios remain passing. Screenshot: `test-results/studio-layout.png`.

## Advanced validation — September 12, 2026

`npm test`: all **59 tests passed**. `npm run test:e2e`: production build succeeded and all **16 Electron scenarios passed**. The added scenario imports a real locally generated WebM and image, verifies video decoding/playback and reduced-motion pause, adaptive image contrast, calculator output, persisted tasks, widget relocation/free-form dragging/resizing, immersive native bounds and Ctrl+L recovery, exact-origin profile persistence, and restart recovery of media metadata. Existing browser, privacy, vault, floating-window and split-view scenarios remain passing. Windows floating-window always-on-top now uses an explicit native topmost level and records the actual resulting state. `node scripts/export-theme-schema.mjs` regenerates the public declarative JSON schema.

Search Bar now includes classic, soft, glass and minimal surfaces, tint, opacity, border width and depth controls. Match new-tab search applies the same surface, width, radius and font settings to the new-tab field. Keyboard focus indicators remain visible even with borders disabled. Toolbar drag outlines are removed; drag reordering and keyboard controls remain available. Liquid Glass now uses a light pastel gradient, softer active-tab edges and frosted search surfaces. Existing saved themes remain intact; select Liquid Glass again to apply its refreshed preset.

Settings and Theme Studio open as dedicated internal tabs. Switching tabs or pressing Escape keeps them open. Reopening selects the existing tab in the workspace. Close the tab explicitly to dismiss it; normal session restoration also restores these internal tabs without loading a website.
