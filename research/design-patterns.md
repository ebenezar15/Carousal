# Carousel Design Patterns: Research Summary

How high-performing Instagram and LinkedIn carousels work, written as general patterns and principles for CarouselForge's AI copy generator and rule-based layout engine. It contains no specific creator's or brand's designs. All example copy is original. Stats are cited by URL in the Sources list. The JSON file at `research/design-patterns.json` holds the machine-readable form of these rules.

> **Evidence quality note.** Platform-level stats come from large benchmark datasets (Socialinsider, Buffer, and an older SEJ study). Most slide-count and design advice comes from tool vendors and practitioners, so treat it as consensus, not proof. Where a number below is our own derivation (e.g. pixel sizes at 1080 px), the method is shown.

---

## 1. Why carousels matter (context)

- On Instagram, carousels are consistently the highest-engagement organic format in large benchmark datasets. They lead Reels by a small margin and static images by a wide one, and they drive the most saves. Reels still win on reach, so carousels are an engagement and save format first. ([Socialinsider 2026 benchmarks](https://www.socialinsider.io/blog/instagram-benchmark-report/), [Buffer comparison via blckalpaca](https://blckalpaca.at/en/knowledge-base/social-media/social-media-algorithms-distribution/reels-vs-carousel-instagram-formats))
- Instagram reportedly re-serves a carousel the user scrolled past, starting on a later slide (often slide 2). This is reported but not confirmed by a primary source. Design implication: **slide 2 should also work as an entry point.** ([Planoly](https://planoly.com/blog/instagram-carousels-are-making-a-comeback), [Socialboostdigital](https://socialboostdigital.com/blog/instagram-carousel-algorithm-double-exposure))
- On LinkedIn, document (PDF) carousels show high engagement rates in some datasets but lower reach in others, so the findings are mixed. ([Socialinsider LinkedIn](https://www.socialinsider.io/blog/linkedin-carousel/), [Ordinal](https://www.tryordinal.com/blog/carousel-posts))

---

## 2. Slide roles

Each slide should have **one job and one idea**. The roles below are the vocabulary the layout engine and AI prompt share.

| Role | Purpose | Typical position |
|---|---|---|
| **hook** | Stops the scroll. It promises a specific payoff and creates a reason to swipe. It is also the grid/feed thumbnail. | Slide 1 |
| **intro / problem** | Names the pain, stakes, or context so the reader feels "this is about me". It is a second entry point if the carousel is re-served from slide 2. | Slide 2 |
| **body** | Delivers one point with a short headline and 1–3 sentences of support. | Middle |
| **list** | Several parallel items that belong together (tools, signs, mistakes), scannable at a glance. | Middle |
| **stat** | One striking number, its meaning in plain words, and a source line. It works as a pattern interrupt mid-deck. | Middle |
| **quote** | A short memorable line, either an insight or a customer voice, with attribution. It adds variety and is shareable. | Middle |
| **comparison / before-after** | Two columns or two states (wrong/right, old/new, myth/fact) that make contrast instantly visible. | Middle |
| **step** | One numbered action in a process. The number is the visual anchor, and the steps build momentum. | Middle (sequence) |
| **summary** | Recaps the takeaways in one view. It is the most-saved slide type, so make it screenshot-worthy. | Second to last |
| **CTA** | Tells the reader exactly one next action (save, share, follow, comment, or click), tied to the value just delivered. | Last |

**Pacing pattern:** hook → problem/context → 3–8 value slides (mix body, list, stat, step, and comparison to avoid monotony) → summary → CTA. Insert a "pattern interrupt" (stat, quote, or comparison) roughly every 3–4 value slides in longer decks.

---

## 3. Hook-slide structures

The hook carries most of the performance load. Principles:
- **Be specific.** Use concrete numbers, outcomes, audiences, or timeframes. Vague hooks ("Tips for success") underperform specific ones.
- **Keep it short.** 4–12 words of headline, readable in under 2 seconds. An optional small subline can qualify the audience or the payoff.
- **Open a loop.** The answer must be in the deck, not on the cover.
- **Stay honest.** The deck must deliver what the hook promises. Clickbait that the body doesn't pay off hurts saves and follows.
- **Use a visual swipe cue** (see section 7).

Original template patterns (placeholders in `{braces}`):

| Structure | Pattern | Original example |
|---|---|---|
| **Question** | `Why does {common effort} still {bad result}?` | "Why does posting daily still get you zero leads?" |
| **Bold claim** | `{Strong statement about topic}.` | "Your onboarding email is losing you half your trials." |
| **Number promise** | `{n} {things} that {outcome}` | "7 spreadsheet formulas that save an hour a week" |
| **Contrarian** | `Stop {common advice}. Do {alternative} instead.` | "Stop chasing followers. Build a reply habit instead." |
| **Before / after** | `From {bad state} to {good state} in {timeframe}` | "From 3 sales calls to 12 a week: what changed" |
| **Curiosity gap** | `The {adjective} {thing} most {audience} overlook` | "The one pricing page element most founders forget" |
| **How to** | `How to {outcome} without {pain}` | "How to write a cold email without sounding like a robot" |
| **Mistake** | `{n} {topic} mistakes {audience} keep making` | "5 resume mistakes career-switchers keep making" |
| **Audience call-out** | `If you {situation}, read this` | "If your team ships late every sprint, read this" |
| **Framework** | `The {n}-step {method} for {outcome}` | "The 4-step method for writing headlines that get read" |

---

## 4. Content density

Carousel slides are glanced at, not read. They are seen at roughly a third of their design size on a phone. Density limits (word counts include headline):

| Role | Max words (total) | Headline max words | Body max words | Max bullets | Max lines of body |
|---|---|---|---|---|---|
| hook | 15 | 12 | 8 (subline) | 0 | 2 |
| intro/problem | 35 | 10 | 28 | 3 | 4 |
| body | 45 | 8 | 35 | 0 | 5 |
| list | 45 | 8 | 36 (≈ 6 words/bullet) | 5 | 5 |
| stat | 25 | 6 (number + label) | 18 | 0 | 3 |
| quote | 30 | 0 | 25 (+ attribution) | 0 | 4 |
| comparison | 40 | 8 | 32 (both sides) | 4 per side | 4 per side |
| step | 35 | 8 | 25 | 3 | 4 |
| summary | 50 | 6 | 42 | 6 | 6 |
| cta | 25 | 8 | 15 | 0 | 2 |

Rules of thumb:
- **One idea per slide.** If the copy needs "and also", split the slide.
- **Bullets:** 3–5 is ideal, 6 is the hard max (summary only). Keep bullets parallel in grammar and under about 8 words each.
- **Lines:** about 6 lines of body text maximum, with no paragraph longer than 3 lines.
- **Reading level:** short, everyday words, active voice, and second person ("you"). Plain-language guidance targets about 8th-grade reading level and average sentences under about 15–20 words.
- **Front-load meaning.** Put the key word in the first 2–3 words of each headline and bullet.

---

## 5. Slide counts

- **Instagram limit:** 20 slides (raised from 10 in 2024). The first slide's aspect ratio applies to all slides. ([socialk.it](https://socialk.it/en/sizes/instagram-carousel-size), [Krumzi](https://www.krumzi.com/blog/instagram-carousel-size-guide))
- **LinkedIn documents:** the platform allows up to about 300 pages, but practitioners warn of "swipe fatigue". ([PostNitro](https://postnitro.ai/blog/post/linkedin-carousel-slide-limits))
- **Evidence:** a large (older) SEJ dataset found that carousels with 8–10 slides beat short ones, with a dip after 3 slides. Its advice was that if a carousel has more than 3 slides, it should go to 8–10. ([SEJ](https://searchenginejournal.com/instagram-carousels/379311)) Current practitioner consensus is about 5–12 slides for LinkedIn and 6–10 for Instagram. ([Oktopost](https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/), [Decktopus](https://www.decktopus.com/blog/linkedin-carousel-best-practices))
- **Recommendation for CarouselForge:** min 3, default range 7–10, max 20 (Instagram) and 15 (LinkedIn soft cap). Avoid 4–5 slide decks unless the content is genuinely that small. A 4–5 slide deck often reads as neither quick nor substantial.

---

## 6. CTA patterns

The final slide should ask for **one** action tied to the value delivered. Ask for the action that fits the content type:

| CTA type | Best for | Original template |
|---|---|---|
| **Save** | Reference content (checklists, frameworks, how-tos) | "Save this for your next {task}." |
| **Share / send** | Relatable or useful-to-a-colleague content | "Send this to a {role} who needs it." |
| **Follow** | Series or niche expertise | "Follow for a new {topic} breakdown every {cadence}." |
| **Comment** | Opinion, contrarian, or "which one are you" content | "Which of these do you do? Drop the number below." |
| **Comment keyword** | Lead magnets | "Comment '{KEYWORD}' and I'll send you the {resource}." |
| **Link** | Offers, long-form follow-up | "Full guide at the link in bio." / "Link in the first comment." |
| **Reflect / try** | Habit or skill content | "Try step 1 today, then tell me how it went." |

Principles:
- Pair the CTA with a **benefit** ("Save this so you don't lose it when you need it"), not a bare command.
- A soft secondary ask is OK (e.g. save plus follow), but give the first ask visual priority.
- Repeat the creator's name or handle on the CTA slide so a follower knows who to follow. Keep it neutral and small.
- Explicit swipe prompts on the cover measurably lift engagement in older data. ([SEJ](https://searchenginejournal.com/instagram-carousels/379311))

---

## 7. Swipe cues

Signal "there's more" without clutter. Use 1–2 cues per slide, not all of them.

- **Directional arrow or chevron** near the right edge of the hook (and optionally every slide). Small and consistent.
- **Partial-bleed element:** a shape, image, line, or word that is cut off at the right edge and continues onto the next slide. This is the strongest implicit cue.
- **Progress indicator:** dots, a thin progress bar, or "3/9" style numbering. It helps orientation and signals deck length.
- **Text prompt:** a small "Swipe →" or "Keep reading" on the hook only. Don't repeat it on every slide.
- **Numbered content:** step and list numbers create natural forward momentum ("1 of 7").
- **Cliffhanger copy:** end a slide on a setup that the next slide pays off.
- **No cue on the final slide.** It signals the end.

---

## 8. Visual continuity

Continuity makes a deck feel designed and rewards swiping.

- **Panoramic / seamless background:** one wide canvas (N × 1080 px) sliced into slides so shapes, gradients, or lines flow across seams. Rules: keep text **off the seam** (at least the margin away from each slide edge), and make sure each slide still reads on its own.
- **Recurring motif:** one graphic device (a shape, line, corner mark, or icon style) repeated in the same position or role on every slide.
- **Consistent grid:** the same margins, column structure, and headline baseline on every slide, so content doesn't jump while swiping.
- **Color coding:** assign one color per meaning (e.g. accent = key term, red/green = wrong/right in comparisons, one color per section in long decks). Use a palette of 1 background, 1 text color, and 1–2 accents.
- **Consistent component placement:** page numbers, handle, and progress indicator stay in fixed positions.
- **Deliberate variety:** vary the layout (stat vs. list vs. quote) inside the system, not by changing the system itself.

---

## 9. Typography hierarchy

**Scale context.** A 1080 px wide slide is displayed at roughly 360–430 CSS px on phones, which is a scale factor of about 0.33–0.40. Apple's HIG uses a 17 pt default body size with 11 pt as the practical minimum. Our derivation: to render body text at ≥ 13–14 pt on a phone, body must be **≥ 36–40 px at 1080 px width**.

| Element | Size at 1080 px wide (px) | Renders on phone (≈0.36×) |
|---|---|---|
| Hook headline | 88–140 | 32–50 pt |
| Slide headline | 64–96 | 23–35 pt |
| Stat number | 160–260 | 58–94 pt |
| Body | 40–48 (min 36) | 14–17 pt |
| Captions, source, page number | 28–32 (min 26) | 10–12 pt |

- **Scale ratio:** use a modular scale of about 1.333 (perfect fourth) for text-dense slides and 1.5–1.618 for hooks and stat slides. The hook headline should be about 2.5–3× body size, and a slide headline about 1.6–2× body.
- **Line length:** long-form research favors 50–75 characters ([Baymard](https://baymard.com/research-articles/line-length-readability)), and WCAG caps lines at 80 ([W3C 1.4.8](https://www.w3.org/WAI/WCAG20/Understanding/visual-presentation)). For glanceable slides, aim for **≤ 40 characters per body line** and **≤ 20 per headline line**. At a 40 px body on about 900 px of content width, this comes out naturally.
- **Line height:** headlines 1.05–1.2 (tight, large type), body 1.35–1.5. WCAG 1.4.8 advises at least 1.5 for paragraph text. Slides have short blocks, so 1.4 is a practical floor.
- **Typefaces:** max 2 families (one display/headline, one text), or one family in 2–3 weights. Avoid thin weights (<400) under 48 px. Avoid script or condensed faces for body text.
- **Emphasis:** use one emphasis method per deck (accent color *or* bold *or* highlight), and apply it to 1–3 words per slide at most.
- **Alignment:** left-align body and lists. Center only short headlines, quotes, and stat slides. Never justify text.
- **Casing:** sentence case for headlines reads faster than ALL CAPS. Reserve caps for short labels.

---

## 10. Contrast and accessibility

- **WCAG 2.x AA:** 4.5:1 for normal text and 3:1 for large text (≥ 24 CSS px regular or ≥ 18.67 px bold, *as rendered*). Non-text UI elements (arrows, progress dots) also need ≥ 3:1.
- **Rendered-size caveat:** because slides display at about 0.36×, "large text" at 1080 px means about **67 px regular / 52 px bold**. Treat anything smaller as normal text and require 4.5:1.
- **Text on images or gradients:** check contrast against the *worst* pixel region behind the text. Use a scrim, overlay, or solid text plate when needed.
- **Don't rely on color alone** for meaning. In comparisons, pair red/green with ✕/✓ icons or labels.
- **Alt text:** platforms allow per-image alt text, so generate a one-sentence alt per slide containing the slide's text.
- **Motion and patterns:** avoid busy textures behind text.

---

## 11. Safe zones and margins

- **Canvas:** Instagram 1080 × 1350 (4:5) is the standard. The first slide sets the ratio for the deck. LinkedIn PDF decks render cleanly at 1080 × 1350 or 1080 × 1080. ([socialk.it](https://socialk.it/en/sizes/instagram-carousel-size), [Ordinal](https://www.tryordinal.com/blog/carousel-posts))
- **Profile grid crop:** the Instagram grid shows a 3:4 center crop of the cover, losing about 34 px on each side. Keep the cover headline centered horizontally within that. ([Krumzi](https://www.krumzi.com/blog/instagram-carousel-size-guide))
- **Margins:** there is no official carousel safe-zone spec. Practitioner guidance ranges from 80 px to 150–200 px. Our recommendation is an **8% outer margin (~86 px at 1080 wide), with critical text ≥ 96 px from every edge**, and extra bottom clearance (~120 px) on Instagram where the dots indicator and overlay UI can sit.
- **Seams:** in panoramic decks, keep text at least the safe inset away from the left and right edges. Only decorative elements cross seams.
- **Fixed chrome zones:** reserve the top or bottom strip (about 80–100 px) for page number, handle, and progress dots, consistently.

---

## 12. Common mistakes to avoid

1. A vague or generic hook ("Some thoughts on marketing") or a cover that is just a logo or title.
2. A wall of text: more than about 50 words per slide, or paragraphs longer than 3 lines.
3. Body text below about 36 px at 1080 width, or thin weights at small sizes.
4. Low contrast, especially text over photos without a scrim, or pastel-on-white.
5. More than 2 typefaces, or emphasis in several colors at once.
6. An inconsistent grid, where headlines jump position between slides.
7. Text crossing slide seams, or important content within about 90 px of edges.
8. No swipe cue on the cover, or every possible cue stacked on every slide.
9. A hook promise the deck doesn't pay off.
10. Several competing CTAs, or no CTA at all.
11. Slide 2 that only says "Let's dive in". It wastes the re-serve entry point.
12. Ten slides that all use the identical layout (monotony), or a mismatched style per slide (chaos).
13. Using color as the only carrier of meaning.
14. Stats without a source line.
15. Centered or justified multi-line body text, and ALL CAPS paragraphs.

---

## Sources

- https://www.socialinsider.io/blog/instagram-benchmark-report/
- https://www.socialinsider.io/data-geeks/instagram_benchmarks_2025.pdf
- https://blckalpaca.at/en/knowledge-base/social-media/social-media-algorithms-distribution/reels-vs-carousel-instagram-formats
- https://searchenginejournal.com/instagram-carousels/379311
- https://planoly.com/blog/instagram-carousels-are-making-a-comeback
- https://socialboostdigital.com/blog/instagram-carousel-algorithm-double-exposure
- https://www.socialinsider.io/blog/linkedin-carousel/
- https://www.tryordinal.com/blog/carousel-posts
- https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/
- https://www.decktopus.com/blog/linkedin-carousel-best-practices
- https://postnitro.ai/blog/post/linkedin-carousel-slide-limits
- https://socialk.it/en/sizes/instagram-carousel-size
- https://www.krumzi.com/blog/instagram-carousel-size-guide
- https://baymard.com/research-articles/line-length-readability
- https://www.w3.org/WAI/WCAG20/Understanding/visual-presentation
- https://www.w3.org/TR/WCAG22/#contrast-minimum
- https://developer.apple.com/design/human-interface-guidelines/typography
