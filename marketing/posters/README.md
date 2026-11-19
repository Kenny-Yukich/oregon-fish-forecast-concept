# Marketing posters

Four 18 × 24 in posters for oregonfishforecast.com, in the site's own look: forest ink and cream paper, Fraunces headlines, Instrument Sans text, JetBrains Mono labels, and the supplied fish and river artwork. The design brief is in [design-philosophy.md](design-philosophy.md).

| No. | Poster | Says | QR code opens |
| --- | --- | --- | --- |
| 01 | **Read the river before you drive.** | What the site is: dated reports, gauges, dam counts and stocking for 28 reaches, every morning | the homepage |
| 02 | **Are the fish in the system?** | Dam counts, with a schematic of Bonneville, The Dalles and Willamette Falls | `#/counts` |
| 03 | **Ask Eddy.** | The AI assistant: 3 free questions a day, $4.99 a month or $39.99 a year for 50 a day and water alerts | the homepage (Eddy's card) |
| 04 | **Trout are coming. Find out which week.** | ODFW stocking for 250+ Oregon waters | `#/stocking` |

## Files

- `pdf/*-18x24.pdf`: print files, one 18 × 24 in page each, fonts embedded. They also scale cleanly to 12 × 16 or 24 × 32 (same 3:4 shape).
- `png/*.png`: 2400 × 3200 previews for the web, email or social posts.
- `posters.html`: the source. Open it in a browser to see all four.
- `qr/*.svg`: the QR codes, checked to decode to the addresses above.
- `render.mjs`: rebuilds the PDFs and PNGs.

## Printing

- The PDFs are trim size with no bleed. Most poster printers take that as is; if a printer asks for 0.125 in bleed, the background color needs extending first.
- The artwork files are small (1280 and 720 px wide), so the render upscales them smoothly before they go into the PDF. They print well at 18 × 24 in; at 24 × 36 in or larger, ask for larger originals of the artwork.
- The QR codes print about 2.3 in square, which scans from a few feet away.

## Changing a poster

Edit `posters.html`, then run, from the repository root:

```bash
node marketing/posters/render.mjs
```

It needs Playwright with Chromium (not a dependency of this repository) and internet access for Google Fonts. It refuses to render if the fonts do not load.

Facts on the posters that can go stale: the reach count (28), the stocking count (250+, from `data/stocking.js`), Eddy's prices and question limits (`server/access.mjs`), and the three count stations. Check them before a reprint.
