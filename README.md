# CarouselForge

Turn raw content — notes, a blog post, a document, a URL or bullet points — into polished social media carousels. CarouselForge generates several distinct designs at once, gives you a full editor to change anything, checks readability, and exports exact-size files for every major platform. It runs as a web app/PWA and as a desktop app (Tauri), and **everything except cloud AI, URL import and stock photos works offline**.

- **Generate:** paste text, upload `.txt/.md/.docx/.pdf`, or import a URL. The slides are written by Claude (online), a free model (OpenRouter, Groq, Gemini, or LM Studio/llama.cpp on your computer), a local Ollama model (offline, downloadable from inside the app), or built-in rules (no AI). You get 3–6 designs side by side, each with its own style system, layout logic and font pairing.
- **Edit:** a canvas editor with layers, snapping, rulers, grouping, unlimited undo, rich text, fonts (bundled, installed, uploaded), shapes, icons, emoji, charts, tables, QR codes, images with crop/mask/filters and offline background removal, gradient/mesh/image/pattern backgrounds, brand kits, find & replace and templates.
- **Design extras:**
  - 12 procedural textures, 13 patterns, and plain backgrounds.
  - 33 graphics: doodles, sparkles, bursts, stickers.
  - Text effects: neon, outline, 3D, retro, glitch, echo, sticker, highlighter.
  - Continuous slides, with graphics and photos that flow across seams.
  - Animations: entrances, typewriter, word-by-word, loops.
- **Translate:** turn a finished carousel into Tamil, Hindi, Arabic, Japanese or 30+ other languages with the exact same design. Fonts, colors, effects and emphasized words carry over, and matching fonts for each script are bundled offline. You review every line before the copy is created.
- **Check:** contrast is measured on the actual pixels behind each text box. The checker also flags text too small for phones, platform safe zones, missing alt text and slide limits.
- **Publish:** PNG/JPG/WebP (1×/2×), ZIP, LinkedIn PDF, MP4/GIF slideshows, a caption with hashtags and per-slide alt text, and portable `.carousel` project files.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev            # http://localhost:5173
```

On first launch, pick one of the sample topics to see the whole flow without any setup.

**Just want to install the app?** Follow the step-by-step [installation guide](docs/INSTALL.md).

### Desktop app (Tauri 2)

Install Rust (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. On Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

```bash
npm run tauri:dev      # desktop app with hot reload
npm run tauri:build    # installers in src-tauri/target/release/bundle
```

How the desktop app differs from the browser version:
- API keys are stored in the OS keychain.
- Network requests go through Rust, so URL import and Ollama have no cross-origin limits.
- Exports use the native Save dialog.

## AI providers

Choose one in **Settings**. *Auto* tries Claude, then your free/local model (once set up), then Ollama, then the built-in rules.

| Provider | Needs | Notes |
|---|---|---|
| **Claude** | Your Anthropic API key, internet | Default model `claude-opus-5-5`; Sonnet 5.5 and Haiku 5.5 can be picked in Settings. Output must match a schema; invalid output is repaired, and on failure the app falls back to rules. |
| **Free / local models** | A free key (OpenRouter, Groq, Google Gemini) or a local server (LM Studio, llama.cpp, Jan) | Any OpenAI-compatible API. The model list loads live; OpenRouter shows its free models only. A *Test connection* button checks the setup. |
| **Ollama** | Ollama running locally | Fully offline after the model download. Detected automatically at `http://localhost:11434`. Models can be downloaded and deleted from **Settings → Ollama**. |
| **Built-in rules** | Nothing | Deterministic splitter for headings, paragraphs, lists, numbers and quotes. Always available. |

### Installing Ollama (offline AI)

1. Install it:
   - **macOS:** download the app from <https://ollama.com/download>, or run `brew install ollama`.
   - **Windows:** run the installer from <https://ollama.com/download>.
   - **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
2. Download a model while you're online, either in **Settings → Ollama → Free models to download** or in a terminal:
   ```bash
   ollama pull gemma3:4b       # recommended: good quality, 140+ languages incl. Tamil (≈3.3 GB, 8 GB RAM)
   ollama pull gemma3:1b       # older/lighter machines (≈0.8 GB)
   ollama pull qwen2.5:7b      # very reliable structure (≈4.7 GB, 10 GB RAM)
   ollama pull gemma3:12b      # best quality if you have 16 GB RAM or a GPU
   ```
3. Start it. The desktop app and macOS/Windows installs run Ollama in the background automatically. Otherwise run `ollama serve`.
4. **Browser version only:** allow requests from the app's address:
   ```bash
   OLLAMA_ORIGINS=http://localhost:5173 ollama serve
   ```
   On Windows, set `OLLAMA_ORIGINS` as an environment variable and restart Ollama. The desktop app doesn't need this.
5. In **Settings → Ollama**, check that it says *Connected* and pick your model.

Troubleshooting:
- *Not detected* means Ollama isn't running, the URL is wrong, or (in the browser) `OLLAMA_ORIGINS` isn't set.
- *No models installed* means you still need to run `ollama pull …`.
- Small models occasionally produce invalid JSON. The app sends the errors back to the model (up to 2 repair attempts), then falls back to the rules.

## Design styles, prompts and motion

**35 style systems**, each a complete look: typography (fonts, weight, case, tracking, tilt), palettes, background, motifs, slide layouts and a matching **motion**. The 10 newest:

| Style | Typography | Carousel look | Motion |
|---|---|---|---|
| Minimalism | Light Albert Sans, wide margins | Stone/fog palettes, hairline divider, nothing else | Slow, quiet fades |
| Maximalism | Dela Gothic One caps + Bricolage Grotesque | Zigzag pattern, confetti shapes, starburst, sticker, thick frame, offset shadow | Word drops, pops, spins and wiggles |
| Surreal | Instrument Serif with italic emphasis | Mesh gradient, glossy floating spheres, arched portal, stars | Words fade in, shapes drift and float |
| Swiss design | Tight 800-weight Inter | Visible column grid, red circle, vertical edge label | Sharp slides and ruled wipes |
| Editorial | DM Serif Display + Newsreader, italic accents | Newspaper masthead with issue number, double rules, paper grain | Word rise, ruled wipes |
| Paper | Young Serif with a lifted shadow | Layered paper-cut hills with real shadows, cut-out sun, paper texture | Layers slide up, panels unfold |
| Clay | Rounded Fredoka with a soft shadow | Puffy lit pastel shapes, pillowy cards with deep soft shadows | Squash and stretch, gentle float |
| Vector art | Geometric Outfit | Flat hills, sun and clouds on covers; geometric clusters | Draw-on lines, pops, word slides |
| Handwritten | Gochi Hand + Caveat | Dot-grid journal page, red margin line, tape, paper clip, doodles | Text written on, doodles drawn |
| Graffiti | Sedgwick Ave Display caps, tilted | Spray drips, soft spray halo, paint splats, concrete wall | Spray-on zoom, drips unfold, wiggles |

**Describe the look.** Type what you want on the Generate page (or *Design → Describe the look* in the editor, or the *Restyle* box above the slides), e.g. “dreamy pastel clay shapes, rounded type, bouncy motion, ribbon across slides”, or click one of the 10 style chips. It understands styles, colors (names or a hex code), dark/light, fonts (serif, rounded, handwritten…), textures, patterns, background, decoration amount, continuous slides and motion — offline, for free. An AI model is asked only when the prompt uses words the built-in reader doesn't know (one quick, cached call); change this in **Settings → Saving AI credits**.

**Motion.** Every design animates in its style's motion by default (it shows in the preview and in video/GIF/clip exports; still images are unaffected). Change it with the **Motion** selector on the Generate page or in *Design → Background*, or fine-tune any element in the editor (hand-tuned animations are kept when you change the theme).

## Diagrams, illustrations and Christian carousels

**Diagrams.** Points on a slide become a diagram when that tells the story better: **cycle** (rhythms and habits), **flow** (a process), **venn** (overlapping ideas, e.g. *Faith · Hope · Love*), **pyramid** (foundations, priorities), **tree** (vine and branches, fruit), **journey** (a story or timeline), **versus** (*Law vs Grace*, before → after) and **stairs** (steps of growth). They're chosen from the slide's words and the AI's layout hint, never on two slides in a row; *↻ Layout* cycles through them.

**Illustrations.** Original drawn art matched to each slide's words, generated in the app (works offline):
- **Characters** in 12 poses — praying, reading, worshipping, kneeling, waving, walking, sitting, thinking, welcoming, carrying, pointing, standing — with diverse skin tones, hair and clothes; adults and children.
- **21 scenes:** hill with a cross, empty tomb, shepherd and sheep, storm at sea, calm sea, tree by the river, field of seeds, garden, desert, night sky, sunrise, road, mountains, rainbow, church, table with bread and cup, open door, lighthouse, well, manger, city.
- **32 symbols:** Bible, cross, dove, candle, lamp, heart, bread, cup, crown, sheep, star, anchor, key, seed, fish, flame, scroll, olive branch and more.
- They **move** in animations (an arm waves, a dove floats, stars twinkle, a boat bobs, a candle flickers), never repeat within a carousel, and change with every *New designs* press.
- Choose how many under **Illustrations** (above the slides or in *Design → Background*): none, some slides, most slides, or **every slide as story panels**.

**Christian styles:** Scripture (verse cards), Stained Glass, Parchment, Sunday Light, Illustrated Story, Night Prayer and Bible Story Comic. Christian content (Bible references, faith words) is offered these first. The built-in writer recognises verses with their reference (“…” — John 3:16, Psalm 23:1 — …, … (1 Cor 13:4 NIV)) and prayers; AI models are told to quote Scripture word for word. Tip: most modern translations (NIV, ESV…) are copyrighted — the KJV and WEB are public domain.

**Endless designs.** Every *New designs* press remixes styles with freshly generated palettes (always contrast-checked), other font pairings, alternative layouts, textures and new art, and styles you've seen recently step back — so designs keep changing.

## Backgrounds, graphics, text effects and animation

**Backgrounds.** Set these for all slides in **Design → Background**, or for one slide in the slide panel.
- **Plain:** one flat color with no decoration.
- **Textures:** paper, kraft, crumpled paper, linen, canvas, watercolor, concrete, stucco, grunge, terrazzo, brushed metal and riso grain. They're generated in the app, so they work offline, and read on light and dark designs.
- **Patterns:** dots, grid, lines, halftone, diagonal, perspective grid, waves, zigzag, stripes, checker, crosses, rings and triangles.
- **Quick buttons:** **Plain** and **Textured** also sit next to *Bolder / More minimal* on the Generate page.

**Continuous slides.** Choose a style on the Generate page or in Design → Background. The drawing is laid out across the whole carousel, so it lines up at every seam when swiping.
- **Seamless flow:** shapes and a wave line across the seams.
- **Ribbon:** a wide band weaving through every slide.
- **Journey path:** a dashed route with one stop per slide.
- **Split shapes:** shapes cut in half at each seam.
- **Giant word:** the title written huge across the slides.
- **Your own elements:** any element that crosses a slide edge gets **Continue on next slide** (or previous slide).
- **Photo:** the slide panel's **Panoramic photo across all slides** spreads one image over every slide.

**Graphics and text graphics** (Insert tab).
- **Graphics:** 33 original vector graphics in palette colors:
  - doodles: arrows, underlines, circles, squiggles, checks;
  - sparkles and bursts: sparkles, starbursts, seals, rays, confetti;
  - shapes and frames: brush strokes, highlighter, wave divider, arch, ribbon, speech bubble, thought bubble;
  - stickers: heart, lightning, crown, washi tape, pin, quote mark.
- **Text graphics:** ready-made styled text: giant background word, big number, neon/outline/3D/retro/glitch/echo titles, sticker label and arc text.
- **Text effects:** any text box can take neon glow, outline, sticker, retro offset, 3D extrude, long shadow, glitch, echo stack, gradient or highlighter, and every value stays editable.

**Animation.** Pick a style for a slide or all slides from the slide panel's *Animation* section:
- **Styles:** subtle, lively, typewriter headlines or kinetic word-by-word.
- **Per element:** select an element to choose its entrance (fade, slide, zoom, pop, drop, spin, wipe/draw-on), word animation (typewriter, word-by-word fade/rise/pop/slide, highlight sweep), loop (float, pulse, wiggle, spin, blink), delay and duration.
- **Preview:** **▶ Preview** plays the slide, or all slides.
- **Export:** in *Export → Video / GIF*, each slide plays its animation before its hold. **One animated clip per slide (ZIP)** gives a separate video per slide, for video carousels.

## Translating a carousel

Open a carousel and click **Translate…** (on the Generate page or in the editor toolbar).

1. Pick a language, or type any other language code.
2. Pick an engine:
   - **AI model**: your current provider, using its quick-task model.
   - **On-device**: the translator built into recent Chrome/Edge. Free and private; it downloads each language once.
   - **Type it myself**: fully offline.
3. Review every line in the side-by-side list and edit anything.
4. Click **Create … copy**. The original stays untouched.

What carries over: every element, position, color, effect and font. Emphasized words stay emphasized because they travel with the translation as tags. Text that grows is shrunk to fit its box (down to 55%) before a box grows. Right-to-left languages mirror text alignment. Theme changes on the copy keep the translated text, because the plan is translated too.

Fonts: each design keeps its own font for Latin letters, digits and brand names. Other scripts get a bundled OFL font of the same kind. For Tamil, only fonts that render today's reformed script are used:
- sans → Catamaran;
- serif and elegant designs → Arima;
- display → Baloo Thambi 2;
- handwriting → Kavivanar.

Mukta Malar, Hind Madurai, Meera Inimai, Pavanam and Coiny are also available. Pick one font for all Tamil text in **Settings → Fonts for other languages**; all nine also appear in the editor's font list under *Tamil*. Noto Sans/Serif Tamil, Anek Tamil and Tiro Tamil aren't used, because browsers draw them with pre-1978 ligatures.

The same pattern covers Devanagari, Bengali, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Odia, Sinhala, Arabic, Hebrew, Thai, Cyrillic, Greek and Vietnamese (`research/script-fonts.json`). Cyrillic, Greek and Vietnamese also use the design font's own glyphs when it has them. Chinese, Japanese and Korean use the system's fonts. Thai and CJK lines break at word boundaries, and long words shrink the text instead of being split.

## Using AI efficiently

- **Translation memory:** every accepted translation is stored on the device. The same text is never sent to a model twice; re-running or reusing lines costs nothing. Clear it in Settings.
- **Batching and deduplication:** a carousel is translated in a few batched requests. Text that repeats across slides, the plan and the caption is sent once.
- **Quick-task model:** translation, captions, headline ideas, slide rewrites and design prompts use a cheaper model, set per provider in Settings. For Claude the default is Haiku 5.5, which runs at low effort.
- **No repeat spending:** generating the same text with the same settings reuses the copy already written (use *↻ Regenerate copy* for a new version); headline ideas and design-prompt readings are cached; translations are remembered as soon as they arrive.
- **Small requests:** one-slide jobs send a short task prompt (not the whole carousel-writing prompt), every call has an output cap sized to the task, a failed translation batch keeps the others and stops the rest, and only missing lines are asked again.
- **Design is free:** styles, layouts, textures, motion, “Make it …” buttons and most design prompts never use AI.
- **Prompt caching (Claude):** system prompts are cached, so repeat calls within 5 minutes read them at a fraction of the price.
- **Ollama:**
  - The model stays loaded for 30 minutes between calls.
  - The context window is sized to each request, which means less memory and faster loads.
  - Output is capped, so a looping model always stops.
  - It runs in JSON mode with the schema in the prompt; in live tests this was about 4× faster than grammar-constrained output and wrote better slides.

## What works offline

| Feature | Offline? |
|---|---|
| Generation with Ollama, LM Studio/llama.cpp or the built-in rules, design variations, layout engine | ✅ |
| Translation with Ollama/local models, the browser's on-device translator, or by hand; all script fonts | ✅ |
| Editor, all 72 bundled fonts, 1,879 icons, emoji, charts, QR codes, background removal | ✅ |
| Accessibility check, caption writer (rules mode), every export format, project files | ✅ |
| Claude, free online models (OpenRouter/Groq/Gemini), URL import, stock photos (Unsplash/Pexels) | Needs internet. Each shows a clear message when offline. |

The web build is a PWA: after the first visit it caches the app, fonts, icons, the background-removal model and the PDF engine (≈29 MB) for offline use.

## Export

| Output | Notes |
|---|---|
| PNG / JPG / WebP | Per slide at 1× or 2×, with a quality slider. Files are named `project_01.png`, `project_02.png`, … WebP needs a browser that can encode it. |
| ZIP | All slides, plus `caption.txt` containing the caption, hashtags and alt text. |
| PDF | One page per slide; the page size equals the preset size in points. Includes an invisible text layer (Latin text) so it stays searchable. Use this for LinkedIn document posts. |
| Video / GIF | Slide, fade, zoom or cut transitions. MP4/H.264 needs WebCodecs with H.264 (Chrome, Edge, Safari); other browsers produce WebM and the dialog says so. GIFs are 540px wide. |
| `.carousel` | A ZIP with `project.json` and every embedded image, logo and uploaded font. Open it with Generate → *Open project file*. |

After exporting, the dialog decodes the files it wrote and checks pixel dimensions and file size against the platform preset.

## Project structure

```
research/           Phase 0 data: platform presets, design patterns, fonts, palettes, style systems, LICENSES.md
assets/             Static files (served as-is): bundled fonts, background-removal model, icon
src/styles/         Typed access to the research data, font loading/catalog, colors, offline icon set
src/engine/         AI providers, prompt, Zod schema + repair loop, rules splitter, variations,
                    regeneration, captions/hashtags/alt text
  import/           .txt/.md/.docx/.pdf and URL → markdown-ish text
  layout/           layout engine: 24 layouts, backgrounds, decorations, slide numbers/swipe cues,
                    text measurement shared with the renderer
src/model/          Document model (plain-JSON scene graph)
src/editor/         Canvas editor, renderer, panels, document ops, accessibility checker
src/image/bgremove/ Offline background removal (U²-Netp via onnxruntime-web in a worker)
src/export/         Image/ZIP/PDF/video export, .carousel files, save helpers, export dialog
src/storage/        IndexedDB (Dexie): projects, templates, brand kits, assets, settings
src-tauri/          Desktop shell (keychain, HTTP, dialog, fs)
tests/unit, tests/e2e
```

How data flows:
1. Content goes through a provider (or the rules) to a validated `CarouselPlan`.
2. Plan + theme (style, palette, fonts, modifiers) + preset go through the layout engine to a scene graph (`Carousel`).
3. The scene graph is rendered with Konva identically for the editor, thumbnails and every export.
4. Text edits sync back into the plan, so changing the theme later keeps your words and any elements you added.

## Adding a new style system

Styles are data, not code.

1. **Palette:** add an entry to `research/palettes.json` (`bg, surface, text, mutedText, primary, accent, highlight`). The validator requires text/mutedText ≥ 4.5:1 on `bg` and `surface`, and primary ≥ 3:1.
2. **Fonts (optional):** add an OFL/Apache font to `research/fonts.json` with its Fontsource id and the weights to bundle. Then run `npm run fonts:fetch` and add a row to `research/LICENSES.md`.
3. **Style:** add an object to `research/styles.json` → `styles`:
   - `palettes`: palette ids (the first is the default). `fonts` / `altFonts`: heading/body pairs.
   - `background.type`: `solid | linear-gradient | radial-gradient | mesh-gradient | pattern | panoramic`, optionally with `pattern` (`dot-grid`, `halftone-dots`, `lined-paper`, `fine-grid`, `perspective-grid`), `noise` and `texture`.
   - `layout`: `alignment`, `marginPct`, `headline {scale, weight, case, tracking, lineHeight, rotateDeg?}`, `body`, `emphasis` (`color | highlight | marker | box | underline-thick | italic | bold`), `decorations` (ids handled in `src/engine/layout/decorations.ts`), `slideNumber.style` and `swipeCue.style` (handled in `chrome.ts`), and `panoramic`.
   - `roleLayouts`: a layout id from `layoutCatalog` for **every** slide role.
4. Run `npm run validate:research` and `npm test`. The layout tests automatically lay out every style on four platform sizes and fail on overlapping or out-of-canvas text. The end-to-end contrast audit renders every style and checks real pixels.

The new style then shows up everywhere: design variations, the Design panel, the template gallery and "make it more…".

### Adding a layout

Write a `LayoutFn` in `src/engine/layout/layouts.ts` using the primitives (`fitStack`, `rows`, `rect`, `path`, …). Register it in `LAYOUTS` and `ROLE_LAYOUTS`, and describe it in `research/styles.json → layoutCatalog`. The "every layout" test covers it automatically.

### Adding templates

- **In the app:** Editor → Templates → *Save current design*. Saved templates appear in the gallery (filterable by style and platform). They can restyle any carousel, or start a new project from the template.
- **To share:** export a `.carousel` project file and open it on another machine.
- **Built-in starters:** every style system appears in the gallery as a starter template, so adding a style adds a template.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Dev server / production build (PWA) |
| `npm test` | Unit tests (Vitest): layout engine, AI JSON parsing/repair, rules splitter, providers (mocked), import, icons, editor ops, accessibility, captions, export/project files |
| `npm run e2e` | End-to-end tests (Playwright): offline generation, editor flows, export verification, mocked-Claude flow, first-run journey, contrast audit of every style. To use a system Chromium, set `PLAYWRIGHT_CHROMIUM=/path/to/chrome`. |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run validate:research` | Checks research data, palette contrast and bundled fonts |
| `npm run fonts:fetch`, `npm run fonts:fetch-scripts`, `npm run icons:build`, `npm run models:fetch` | Rebuild the bundled design fonts, script fonts, icon set and background-removal model from npm |

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and push to `main`:
  - research validation, typecheck, lint, unit tests and the production build;
  - the Playwright end-to-end suite;
  - a native desktop compile on Linux, macOS and Windows.
- **Releases** (`.github/workflows/release.yml`): push a tag such as `v0.1.0`, or start the workflow manually in the Actions tab. It builds installers (macOS universal `.dmg`, Windows `.msi`/`.exe`, Linux `.AppImage`/`.deb`) and attaches them to a **draft** GitHub release for you to review and publish.

The installers aren't code-signed yet, so the first launch needs one extra step:
- **macOS:** right-click the app → *Open* → *Open*.
- **Windows:** SmartScreen → *More info* → *Run anyway*.

To sign them, add an Apple Developer ID or a Windows code-signing certificate as repository secrets (see the [Tauri signing guide](https://v2.tauri.app/distribute/sign/)).

## Known limitations

- **Live services:** Ollama was tested live (Qwen2.5 3B and Gemma 3 4B, including a full Tamil translation). Claude, the free online services and stock photo search are tested against mocked services only; try them with your own keys.
- **Curved text** in Indic, Arabic, Thai and similar scripts is drawn straight, because arc text can't shape those scripts.
- **Video:** MP4 export depends on the browser's H.264 encoder. Chromium builds without proprietary codecs (and some Linux WebViews) produce WebM or need GIF.
- **Background removal:** soft on fine hair. The model runs at 320×320.
- **PDF text layer:** Latin text only. Pages in other scripts are image-only (still exact size).
- **Desktop builds:** they compile in CI on Linux, macOS and Windows; the installers are unsigned (see above).

## Licenses

Every bundled font, icon, model and library is under a license that allows bundling and commercial use. They are listed with versions in [`research/LICENSES.md`](research/LICENSES.md). Palettes, styles, layouts and sample content are original work for this project.
