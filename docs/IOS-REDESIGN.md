# Aster modern interface

The modern interface is enabled by default and can be switched to Classic under Theme Studio > Presets > Interface design. Existing wallpaper, toolbar geometry, tab placement and search controls remain available. The Liquid Glass preset adds layered transparency; the default modern interface prioritizes readable light/dark surfaces.

Changes include cool light/dark palettes, rounded controls, a stronger type hierarchy, pastel quick links, functional Research/Focus/Customize shortcuts, updated internal panels and an original Aster app icon. Reduced motion, high-contrast mode and keyboard focus styles remain supported.

## Figma status

[Figma draft](https://www.figma.com/design/U7nTKogv9FKitYEPzCu2jt) was created and the iOS/iPadOS library was inspected. The Starter-plan MCP quota was reached before any design nodes could be written. This file is therefore blank, not a completed Figma design. No plan upgrade was purchased.

[Importable SVG design](design/aster-ios-concept.svg) contains editable vector shapes and text for a desktop design reference. Import it into Figma using File > Place or drag it onto the canvas. It is a local design artifact, not an export from Figma. The implemented browser is the source of truth for responsive sizing and interaction.

## Icon assets

`public/aster-icon.svg` is the original vector source. `npm run icons:build` regenerates `resources/icons/aster.png` (512px) and the multi-resolution Windows ICO (16, 24, 32, 48, 64, 128, 256px). Production builds copy runtime icons into dist/main/icons. Main and floating windows use these icons; electron-builder and NSIS reference the ICO for future Windows packages. The current change does not produce or sign an installer.

Use `npm start` to rebuild and launch. Existing pinned Windows shortcuts may need repinning after installing a rebuilt package.
