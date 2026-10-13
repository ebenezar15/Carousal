# CarouselForge

Turn raw content (notes, a blog post, bullet points) into polished social media carousels, then edit and export them. Runs as a web app/PWA and as a desktop app (Tauri), and works offline.

> Status: **Phase 4 (export) complete.** Generate carousels from text, files or URLs with Claude, Ollama or offline rules. Edit everything in a full canvas editor, then export PNG/JPG/WebP (1×/2×), ZIP, LinkedIn PDF, MP4/GIF slideshows, or a portable `.carousel` project file. Phase 5 (polish: accessibility checks, captions, onboarding) is next.

## Quick start (web)

```bash
npm install
npm run dev          # http://localhost:5173
```

## Desktop app (Tauri 2)

Prerequisites: Rust (stable) and the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS. On Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

```bash
npm run tauri:dev    # desktop app with hot reload
npm run tauri:build  # installers in src-tauri/target/release/bundle
```

## AI providers

Pick one in **Settings**. **Auto** tries them in this order: Claude → Ollama → built-in rules.

| Provider | Needs | Notes |
|---|---|---|
| **Claude** (online) | Your Anthropic API key, internet | Default model `claude-opus-5-5`; Sonnet 5.5 and Haiku 5.5 can be picked in Settings. The desktop app keeps the key in the OS keychain. The browser build keeps it in memory unless you tick "Remember on this device". |
| **Ollama** (offline) | [Ollama](https://ollama.com) running locally | `ollama pull qwen2.5:7b` (or `llama3.2`, `mistral`). The app detects `http://localhost:11434` automatically. In the browser build only, also start Ollama with `OLLAMA_ORIGINS=http://localhost:5173 ollama serve`. |
| **Built-in rules** | Nothing | A deterministic splitter that turns headings, paragraphs, lists, numbers and quotes into slides. It is used automatically whenever no AI is available. |

Every provider's output is checked against one Zod schema (`src/engine/schema.ts`). If it's invalid, the model is asked to fix it (up to 2 retries); if it's still invalid, the app falls back to the rules.

## Export

| Output | Notes |
|---|---|
| PNG / JPG / WebP | Per slide at 1× or 2×, with a JPG/WebP quality slider. Files are named `project_01.png`, `project_02.png`, … WebP needs a browser that can encode it (Chromium yes; Safari may not). |
| ZIP | All slides plus `caption.txt` (the caption and hashtags). |
| PDF | One page per slide; the page size equals the preset size in points (e.g. 1080×1350). Includes an invisible text layer so it stays searchable. Use this for LinkedIn document posts. |
| Video / GIF | Slideshow with slide, fade, zoom or cut transitions. MP4/H.264 needs WebCodecs with H.264 (Chrome, Edge, Safari); other browsers get WebM. GIFs are 540px wide. |
| `.carousel` | A ZIP with `project.json` and every embedded image and uploaded font. Open it with Generate → *Open project file*. |

After each export the dialog decodes the files it wrote and checks them against the preset: exact pixel size, and file size against the platform's limit.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): rules splitter, schema/repair loop, Ollama detection, layout engine |
| `npm run e2e` | End-to-end (Playwright): generate offline → persist → export and check pixel sizes. To use a system Chromium, set `PLAYWRIGHT_CHROMIUM=/path/to/chrome` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run validate:research` | Checks the research data (`/research`) and the bundled fonts |
| `npm run fonts:fetch` | Downloads the bundled OFL/Apache fonts again from `@fontsource` |
| `npm run icons:build` | Rebuilds the offline Lucide icon set (`src/styles/generated/lucide-icons.json`) |

## Project layout

```
research/        Phase 0 data: platform presets, design patterns, fonts, palettes, style systems, licenses
assets/          Static files served by the app (bundled fonts, icon)
src/styles/      Typed access to the research data, font loader, color math
src/engine/      AI providers, prompt, schema, repair loop, rules splitter, variations, regeneration
src/engine/import/  .txt/.md/.docx/.pdf and URL import → markdown-ish text
src/engine/layout/  layout engine: 24 layouts, backgrounds, decorations, slide numbers and swipe cues, fit-checking
src/model/       Document model (plain-JSON scene graph)
src/storage/     IndexedDB (Dexie): projects, templates, brand kits, assets, settings
src/secrets/     API key storage (OS keychain on desktop)
src/editor/      Konva renderer (the full editor arrives in Phase 3)
src/export/      Offscreen exact-size rendering (more formats in Phase 4)
src/app/         App shell and pages
src-tauri/       Desktop shell (keychain commands, HTTP plugin limited to Anthropic + localhost)
```

Licenses for all bundled assets: [`research/LICENSES.md`](research/LICENSES.md).
