# Almogim brand assets

Vendored so the app never depends on almogim.co.il being reachable.

| file | what it is |
| --- | --- |
| `almogim-logo.svg` | wordmark + mark lockup, `currentColor` |
| `almogim-logo-colors.svg` | the same lockup with the dots in brand colours |
| `almogim-mark.svg` | the six-dot mark alone, `currentColor` |
| `almogim-mark-colors.svg` | the mark in brand colours |
| `almogim-mark-colors-512.png` | the original raster mark, 512×512 |

**The app does not load these files.** They are the source of record; the logo
that renders is inlined at `components/brand/Almogim.tsx`, because an external
SVG cannot inherit `currentColor` and so could not follow the theme or colour
its dots on hover. Regenerate the component from these if the brand changes.

Provenance: the lockup and mark are the inline SVG from Almogim's own site
header; the colours are sampled per dot from their `Logo-Circle-Colors` raster
and matched to each path by measured angle.

Ring colours, clockwise from the top:

| angle | colour |
| --- | --- |
| 0° | `#96b800` |
| 59° | `#9a0a46` |
| 121° | `#4357ad` |
| 180° | `#f9c22e` |
| 239° | `#ed8a75` |
| 301° | `#8f7eb9` |
