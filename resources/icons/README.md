# Aster brand assets

aster-master.png is the enhanced high-resolution logo master. The original user PNG, ICO and traced SVG are preserved in originals/.

Run npm run icons:build after replacing the master. This exports the 512px app PNG, public/aster-icon.png and a Windows ICO with 16, 24, 32, 48, 64, 128 and 256px entries using high-quality resampling. Run npm run build for the browser and npm run dist:win for installer/portable artifacts.

The master was AI-enhanced from the supplied logo; metallic details may differ slightly. It has a solid black outer background, matching the supplied PNG. The public SVG is retained as a legacy asset but the application uses the PNG to preserve the metallic gradients.
