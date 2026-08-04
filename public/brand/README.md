# Lightstone brand assets

Vendored so the app never depends on lightstonegroup.com being reachable.

| file | what it is |
| --- | --- |
| `lightstone-logo.svg` | the wordmark, `currentColor` |
| `lightstone-logo-red.svg` | the wordmark in the brand red |
| `lightstone-mark.svg` | the L on its own, `currentColor` |
| `lightstone-mark-red.svg` | the mark in the brand red |

Brand red is **`#D01E3B`**, sampled from the published wordmark.

**The app does not load these files.** They are the source of record; the logo
that renders is inlined at `components/brand/Lightstone.tsx`, because an external
SVG cannot inherit `currentColor` and so could not follow the theme. The favicon
at `app/icon.svg` is the mark reversed out of a red tile, matching the site's own.

Provenance: traced from `dist/images/logo.png` on lightstonegroup.com — a flat
two-colour raster wordmark — with potrace at `--alphamax 0`, so the straight-edged
letterforms stay polygonal instead of being smoothed into curves. The ten glyph
paths are shared between both marks; the first of them, the L, is the mark.

The mark is drawn centred in a 100×100 box rather than cropped tight, because it
carries the thinking indicator: an arc orbits it on a circle of r=44. The letter
itself never rotates — a spinning L reads as a broken image, and the same
reasoning is why logos are excluded from directional icon mirroring.
