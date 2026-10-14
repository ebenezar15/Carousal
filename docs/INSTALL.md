# Installing CarouselForge — step by step

CarouselForge runs on **Windows 10/11, macOS 11+ and Linux** (64-bit). Everything except the online AI services works without internet.

- [1. Download the installer](#1-download-the-installer)
- [2. Install it](#2-install-it) — [Windows](#windows) · [macOS](#macos) · [Linux](#linux)
- [3. First launch](#3-first-launch)
- [4. Choose your AI (optional, free options included)](#4-choose-your-ai-optional)
- [5. Make your first carousel](#5-make-your-first-carousel)
- [6. Translate it into Tamil (or any language)](#6-translate-it-into-tamil-or-any-language)
- [7. Export and post](#7-export-and-post)
- [Updating, uninstalling and troubleshooting](#updating-and-uninstalling)

---

## 1. Download the installer

1. Open **<https://github.com/ebenezar15/Carousal/releases>**.
2. Open the newest release (e.g. **CarouselForge v0.2.0**) and scroll to **Assets**.
3. Download the file for your computer:

| Your computer | File to download |
|---|---|
| Windows | `CarouselForge_0.2.0_x64-setup.exe` (or the `.msi`) |
| Mac, Apple silicon or Intel | `CarouselForge_0.2.0_universal.dmg` |
| Linux: Ubuntu, Debian, Mint | `CarouselForge_0.2.0_amd64.deb` |
| Linux: any other distribution | `CarouselForge_0.2.0_amd64.AppImage` |
| Linux: Fedora, openSUSE | `CarouselForge-0.2.0-1.x86_64.rpm` |

> A release can start as a **draft** that only the repository owner can see. If you're the owner and the release shows *Draft*, you can still download the files, then click **Edit → Publish release** to share it.

## 2. Install it

The installers aren't code-signed yet, so Windows and macOS show a warning the first time. That's expected for an unsigned app. The steps below get past it.

### Windows

1. Double-click **`CarouselForge_0.2.0_x64-setup.exe`**.
2. If **"Windows protected your PC"** appears, click **More info → Run anyway**.
3. Follow the installer (Next → Install → Finish). It may install Microsoft Edge WebView2 if it's missing; this is a normal Windows component.
4. Start **CarouselForge** from the Start menu.

### macOS

1. Double-click **`CarouselForge_0.2.0_universal.dmg`**.
2. Drag **CarouselForge** onto the **Applications** folder.
3. Open **Applications**, **right-click** CarouselForge and choose **Open**, then **Open** again. You only do this once; after that it opens normally.
   - On macOS 15 and later, if there's no *Open* button: go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to CarouselForge.

### Linux

**Ubuntu / Debian / Mint (.deb):**
```bash
sudo apt install ./CarouselForge_0.2.0_amd64.deb
```
Then start CarouselForge from your applications menu.

**Any distribution (.AppImage):**
```bash
chmod +x CarouselForge_0.2.0_amd64.AppImage
./CarouselForge_0.2.0_amd64.AppImage
```

**Fedora / openSUSE (.rpm):**
```bash
sudo dnf install ./CarouselForge-0.2.0-1.x86_64.rpm
```

## 3. First launch

You'll see **Welcome to CarouselForge**. Click any sample topic (for example *Remote team habits*) to watch it build a full carousel. No setup or internet is needed. Your projects save automatically on your computer.

## 4. Choose your AI (optional)

CarouselForge works without any AI: the built-in rules split your text into slides. AI writes better slides and can translate. Open **Settings** (top right) and pick one option:

### Option A: free and offline, with Ollama (recommended for privacy)
1. Install **Ollama** from <https://ollama.com/download>. It's free and available for Windows, macOS and Linux. It runs in the background after installing.
2. In CarouselForge, open **Settings → Ollama** and press **Re-check**. It should say *Connected*.
3. Under **Free models to download**, click **Download** next to **gemma3:4b** (≈3.3 GB, needs ~8 GB RAM). It's good at Tamil and 140+ other languages. On older computers, choose **gemma3:1b** instead.
4. Choose **Ollama (offline)** as the AI provider at the top of Settings.

After the download, generation and translation work **without internet**. On a laptop without a graphics card, expect about 1–3 minutes per carousel.

### Option B: free online models (fast, no install)
1. In **Settings → Free online & local models**, pick a service:
   - **Google Gemini (free tier)**: strong in Tamil and other Indian languages. Get a key at <https://aistudio.google.com/apikey>.
   - **Groq (free tier)**: very fast. Get a key at <https://console.groq.com/keys>.
   - **OpenRouter (free models)**: many open models. Get a key at <https://openrouter.ai/keys>.
2. Click **get a free key**, create it on the website, paste it in and click **Save**.
3. Choose a **Model** from the list, then click **Test connection**. It should show **✓ Works**.
4. Choose **Free / local models** as the AI provider at the top of Settings.

Free tiers have rate limits. If you hit one, wait a minute or switch model.

### Option C: Claude (best quality, paid)
Paste your Anthropic API key in **Settings → Claude**. Translation and captions automatically use the cheaper *quick tasks* model (Haiku 5.5).

### Option D: a model app you already use
LM Studio, llama.cpp or Jan: start its local server, then pick it under **Settings → Free online & local models**.

Keys are stored in your operating system's secure keychain.

## 5. Make your first carousel

1. On **Generate**, paste your text (or use **File** for `.txt/.md/.docx/.pdf`, or **URL**).
2. Choose the **Platform** (e.g. *Instagram carousel — Portrait 4:5*).
3. Click **Generate carousel**. You get several designs; click **Use this design** on the one you like.
4. Click **Open in editor →** to change anything: text, fonts, colors, images, layout.

## 6. Translate it into Tamil (or any language)

1. Click **Translate…**, either next to *Export…* on the Generate page or in the editor's top bar.
2. **Language:** choose **Tamil — தமிழ்** (or any of 38 languages, or type a code like `sw`).
3. **Translate with:**
   - **AI model**: uses the AI you set up in step 4.
   - **On-device (browser)**: free; available in some browsers only.
   - **Type it myself**: fully offline.
4. Click **Translate** and wait for the progress bar.
5. **Review:** every line is shown next to its translation. Fix anything you like.
6. Click **Create Tamil copy**. A new project opens in the editor with the **same design**: fonts, colors, effects and highlighted words. Tamil letters use a matching bundled Tamil font. Your original carousel isn't changed.

Translations you accept are remembered, so translating the same text again is instant and free.

## 7. Export and post

Click **Export…**:
- **ZIP of images**: PNG or JPG for Instagram, Facebook, X and Threads.
- **PDF**: LinkedIn carousels.
- **Video / GIF**: Reels, TikTok, Shorts.

Exports are checked for the platform's exact pixel size, and a caption with hashtags and alt text is included in the ZIP.

---

## Updating and uninstalling

- **Update:** download the newer installer from the Releases page and install it over the old one. Your projects are kept.
- **Uninstall:**
  - **Windows:** Settings → Apps → CarouselForge → Uninstall.
  - **macOS:** drag CarouselForge from Applications to the Trash.
  - **Linux (.deb):** `sudo apt remove carouselforge`.
  - **Linux (.AppImage):** delete the file.

## Troubleshooting

| Problem | Fix |
|---|---|
| Windows: "Windows protected your PC" | Click **More info → Run anyway** (the app isn't code-signed yet). |
| macOS: "can't be opened because Apple cannot check it" | Right-click the app → **Open**, or System Settings → Privacy & Security → **Open Anyway**. |
| Linux AppImage won't start | Run `chmod +x` on the file. On Ubuntu 22.04+ you may also need `sudo apt install libfuse2`. |
| Settings → Ollama says *Not detected* | Make sure Ollama is running (look for its icon, or run `ollama serve`), then press **Re-check**. |
| A model download is slow or stops | Press **Cancel** and **Download** again; Ollama resumes where it stopped. |
| "rate limit reached" with a free online model | Wait a minute, pick another free model, or switch to Ollama. |
| Translated text looks too small | Long translations are shrunk to fit their boxes. Make the box bigger in the editor, or shorten the line in the review step. |
| Chinese/Japanese/Korean look different from other scripts | These use your system's fonts, because they're too large to bundle. |

**Prefer the browser?** Developers can run CarouselForge as a web app instead of installing it. See the [README quick start](../README.md#quick-start).
