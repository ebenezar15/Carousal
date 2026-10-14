# Research (Phase 0)

Sources of truth for CarouselForge. Later phases import these files directly into `/styles` and `/engine` instead of copying them.

| File | What it holds | Consumed by |
|---|---|---|
| `platform-presets.json` | 17 presets across Instagram, LinkedIn (PDF + multi-image), TikTok, Facebook, X, Pinterest and Threads: size, slide limits, formats, file-size limits, safe zones, and sources with confidence levels | Canvas setup, safe-zone overlay, export validation (Phases 2 and 4) |
| `platform-specs.md` | Readable summary, plus where sources disagree and why each value was chosen | Humans |
| `design-patterns.md` / `.json` | Slide roles, words-per-role limits, hook and CTA templates, typography minimums at 1080 px, margins, swipe cues, continuity, anti-patterns | AI prompt and output validation, rule-based splitter, layout engine |
| `fonts.json` | 72 OFL/Apache fonts in 8 mood groups, with the weights bundled and 59 heading+body pairings | Font picker, variation generator |
| `palettes.json` | 46 original palettes, each passing WCAG contrast (text and muted text ≥ 4.5, primary ≥ 3) | Theme engine, accessibility checker |
| `styles.json` | 18 original style systems plus a catalog of 24 slide layouts. Each style sets its palettes, fonts, background system, layout rules and a layout for every slide role | Variation generator, "swap theme" |
| `LICENSES.md` | Source and license of every bundled or used asset | Compliance |

Bundled font files live in `assets/fonts/<id>/` (woff2, latin and latin-ext subsets, about 7 MB in total) with each font's original `LICENSE`. `assets/fonts/manifest.json` lists every font face.

## Scripts
- `node scripts/fetch-fonts.mjs [ids...]` downloads fonts again from the `@fontsource/*` npm packages, based on `fonts.json`.
- `node scripts/validate-research.mjs` checks counts, schema, contrast, cross-references (style → font/palette/layout, role coverage) and that the font files are present.

## Adding a style
1. Add (or reuse) palettes in `palettes.json`. The validator enforces the contrast rules.
2. Add any fonts to `fonts.json`, then run `fetch-fonts.mjs <id>` followed by a full run to refresh the manifest.
3. Add a style to `styles.json` with a layout id for every role in `design-patterns.json`. Its combination of heading font, background type, hook layout and alignment must not match another style's.
4. Run the validator.

## Known uncertainties
- Safe zones are mostly estimates; only Instagram's 9:16 figures come from Meta's own percentages.
- Instagram 3:4 posts may be cropped to 4:5 when published through the API.
- LinkedIn publishes no official PDF page size.

`platform-specs.md` covers these in detail.
