# CarouselForge

Turn raw content — notes, a blog post, a document, a URL or bullet points — into polished social media carousels. CarouselForge generates several distinct designs at once, gives you a full editor to change anything, checks readability, and exports exact-size files for every major platform. It runs as a web app/PWA and as a desktop app (Tauri), and **everything except cloud AI, URL import and stock photos works offline**.

- **Generate:** paste text, upload `.txt/.md/.docx/.pdf`, or import a URL. Claude (online), a local Ollama model (offline) or built-in rules (no AI) write the slides. You get 3–6 designs side by side, each with its own style system, layout logic and font pairing.
- **Edit:** a canvas editor with layers, snapping, rulers, grouping, unlimited undo, rich text, fonts (bundled, installed, uploaded), shapes, icons, emoji, charts, tables, QR codes, images with crop/mask/filters and offline background removal, gradient/mesh/image/pattern backgrounds, brand kits, find & replace and templates.
- **Check:** contrast is measured on the actual pixels behind each text box. The checker also flags text too small for phones, platform safe zones, missing alt text and slide limits.
- **Publish:** PNG/JPG/WebP (1×/2×), ZIP, LinkedIn PDF, MP4/GIF slideshows, a caption with hashtags and per-slide alt text, and portable `.carousel` project files.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev            # http://localhost:5173
```

On first launch, pick one of the sample topics to see the whole flow without any setup.

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

Choose one in **Settings**. *Auto* tries Claude, then Ollama, then the built-in rules.

| Provider | Needs | Notes |
|---|---|---|
| **Claude** | Your Anthropic API key, internet | Default model `claude-opus-5-5`; Sonnet 5.5 and Haiku 5.5 can be picked in Settings. Output must match a schema; invalid output is repaired, and on failure the app falls back to rules. |
| **Ollama** | Ollama running locally | Fully offline after the model download. Detected automatically at `http://localhost:11434`. |
| **Built-in rules** | Nothing | Deterministic splitter for headings, paragraphs, lists, numbers and quotes. Always available. |

### Installing Ollama (offline AI)

1. Install it:
   - **macOS:** download the app from <https://ollama.com/download>, or run `brew install ollama`.
   - **Windows:** run the installer from <https://ollama.com/download>.
   - **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model while you're online. Any instruction-tuned model works; these are good starting points:
   ```bash
   ollama pull qwen2.5:7b      # best quality/size balance (≈4.7 GB, 8 GB RAM+)
   ollama pull llama3.2:3b     # lighter machines (≈2 GB)
   ollama pull mistral         # alternative 7B
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

## What works offline

| Feature | Offline? |
|---|---|
| Generation with Ollama or the built-in rules, design variations, layout engine | ✅ |
| Editor, all 72 bundled fonts, 1,879 icons, emoji, charts, QR codes, background removal | ✅ |
| Accessibility check, caption writer (rules mode), every export format, project files | ✅ |
| Claude, URL import, stock photos (Unsplash/Pexels) | Needs internet. Each shows a clear message when offline. |

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
| `npm run fonts:fetch`, `npm run icons:build`, `npm run models:fetch` | Rebuild the bundled fonts, icon set and background-removal model from npm |

## Known limitations

- **Untested against live services.** Claude, Ollama and stock photo search are tested against mocked services here. Try them with your own key or a local model.
- **Video:** MP4 export depends on the browser's H.264 encoder. Chromium builds without proprietary codecs (and some Linux WebViews) produce WebM or need GIF.
- **Background removal:** soft on fine hair. The model runs at 320×320.
- **PDF text layer:** Latin text only. Pages in other scripts are image-only (still exact size).
- **Desktop builds:** only the Linux build was compiled during development; macOS and Windows builds are untested.

## Licenses

Every bundled font, icon, model and library is under a license that allows bundling and commercial use. They are listed with versions in [`research/LICENSES.md`](research/LICENSES.md). Palettes, styles, layouts and sample content are original work for this project.
