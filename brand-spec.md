# Oregon Fish Forecast — field guide concept

The supplied fish and river artwork anchors an airy, human field guide: forest ink, quiet surfaces, expressive serif headings, and practical comparison tables.

## Source and tokens

Reference assets copied without changes from the supplied read-only packet. The most frequent opaque color in weather-fish.webp is RGB (2, 57, 38), converted to the forest OKLch token below. The neutral background, surface and border come from the human-approachable direction. Typography and composition are new design decisions, as requested; no existing site layout is reproduced.

```css
:root {
  --bg: oklch(98% 0.004 240);
  --surface: oklch(100% 0 0);
  --fg: oklch(30.561% 0.06410 163.509);
  --muted: oklch(49% 0.018 170);
  --border: oklch(90% 0.006 240);
  --accent: oklch(30.561% 0.06410 163.509);
  --font-display: Georgia, 'Times New Roman', serif;
  --font-body: 'Segoe UI', 'Helvetica Neue', sans-serif;
  --font-mono: Consolas, monospace;
}
```

## Visual language

- Preserve the actual fish mark and full river illustration; never use the illustration as an image of a specific listed water.
- Carry the artwork's deep forest tone into typography and the selected state, with bright illustration colors confined to the artwork.
- Let the winding landscape be the one expressive visual flourish; use crisp rules and generous white space elsewhere.
- Pair friendly, large serif headings with compact sans-serif data. Details use a reading column and a practical access sidebar.
- Keep the comparison table central, with reach names always attached to water names and a sticky first column on smaller screens.

## Asset provenance

Both WebP files are user-supplied brand references, not newly sourced location photographs. Intrinsic dimensions: weather-fish.webp 720 × 348; river-country-landscape.webp 1280 × 683. Display both at their original ratio.
