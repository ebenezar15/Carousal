# Template inspiration notes (November 2026)

What we looked at before designing the template families in `src/styles/templates.ts` and the new styles in
`styles.json`. We studied **patterns** (structure, type treatment, colour logic, how pictures are used), never
copying anyone's layouts, artwork, wording or brand. All illustrations in the app are generated procedurally.

## Reference the user shared: an editorial theology series

Two pairs of slides from a 10-slide theology carousel. The patterns we took from them:

| Pattern | What we built |
|---|---|
| Page furniture: `@handle` top-left, `03 / 10` top-right, hairline rules, series label bottom-left ("THEOLOGY / EARLY CHURCH"), handle + page bottom-right | `slideNumber: "editorial"` chrome (`chrome.ts`), `theme.series`, Design panel "Page header & footer" and "Series label" |
| A short red dash before an uppercase kicker ("— ADOPTIONISM / THE MAN WHO BECAME GOD") | `dash-kicker` decoration + optional `kicker` field on every slide (AI fills it; offline types number it) |
| Condensed heavy caps headline, the decisive last word in crimson, often on its own line | `roboto-condensed` 900 / `oswald` headlines with colour emphasis on the emphasis word |
| A short accent rule under the headline | `headline-rule` decoration |
| Italic serif body and verses, red small-caps reference | `layout.body.italic` with Cormorant Garamond; scripture attribution in the accent colour |
| Cream paper slides alternating with ink-black slides | `rhythm: "alternate"` — every other slide uses the inverted palette (`invertPalette`) |
| Numbered questions with italic serif numerals and condensed caps items, separated by rules | `numerals: "serif-italic"`, `listItems: "heading"`, `list-numbered-rows` |
| Engraving-style illustrations (a cracked column with a Chi-Rho and red cloth; a baptism scene) with one spot colour | Art treatments (`engraving`, `duotone`, `line`, `silhouette`), new props (column, chi-rho, masks, trinity, tablets…) and scenes (river baptism, council, ruins, upper room) |
| A tiny timeline inside a slide ("ETERNITY •——• BETHLEHEM") | existing `diagram-journey` layout, triggered by the "journey" hint |

## Patterns seen across Christian and educational carousels online

- **Sermon carousels** extend a Sunday message: title, big idea, 3 points with verses, application, prayer, CTA.
  Churches post 1–3 carousels a week; up to 10 slides per post. ([REACHRIGHT](https://reachrightstudios.com/blog/sermon-carousels/),
  [Sermon Shots](https://sermonshots.com/?p=14462), [Sermon Shots guide](https://support.sermonshots.com/en/knowledgebase/article/how-to-turn-sermons-into-carousels-for-church-social-media-posts))
- **One verse spread over 4–5 slides**, "fruits of the Spirit" style breakdowns, one clear concept per post.
  Avoid decorative fonts that hurt reading; don't mix Bible translations in one design.
  ([Sermon Shots](https://sermonshots.com/?p=12840), [MiriCanvas Bible templates](https://www.miricanvas.com/en/template/all-types/bible))
- **Beige/minimal verse cards** and seasonal sets (Easter, Holy Week) with one consistent look across a series.
  ([MiriCanvas](https://www.miricanvas.com/en/templates/card_news/11wza-Beige-Minimal%20Bible%20Encouragement%20Instagram%20Carousel),
  [Subsplash Easter templates](https://www.subsplash.com/blog/2026-easter-graphic-templates), [Subsplash sermon graphics](https://www.subsplash.com/blog/sermon-series-graphics))
- **Bible character series** and illustrated doctrine series (Trinity, Easter, meditation) in a magazine look.
  ([Subsplash characters of the Bible](https://subsplash.com/blog/characters-of-the-bible-graphics), [Dribbble church illustration](https://dribbble.com/GabeEason))
- **Church history** told with infographics and timelines of people, councils and events
  ([Church History Handbook sample](https://store.thegospelcoalition.org/assets/product_downloads/9159/01K85T04C64ZFZ2MM214F2CE49.pdf)).
- **2026 carousel trends** (vendor blogs, directional only): typography-first slides with one sentence each, 7–10 slides,
  one headline + one sentence + one visual anchor, editorial layouts, structured dark themes, simpler compositions, 4:5 portrait.
  ([Trend teardown, April 2026](https://aiso-buzz.pages.dev/insights/instagram-trend-teardown-april-2026/),
  [2026 Instagram design trends](https://mockupline.com/2026-instagram-design-trends/),
  [Carousel text overlays 2026](https://socialrails.com/social-media-terms/text-overlays-on-instagram-carousels))
- Imagery of God should stay consistent with orthodox theology — we never draw God the Father as a person;
  scenes use light, a dove, the cross and people responding.

## Resulting template families (230 templates)

Theology & doctrine (Theology Editorial, Doctrine Noir, Catechism Q&A, Blueprint Study) · Church history (History
Timeline, Engraved Classic, Illuminated Manuscript) · Apologetics (Myth vs Truth, Woodcut Poster, Raw Truth) ·
Scripture & verses (Scripture, Minimal Verse, Verse Cards, Parchment, Stained Glass) · Devotional & prayer (Night
Prayer, Sunday Light, Hymn Sheet, Gentle, Grace) · Sermons & church (Sermon Notes, Church Swiss, Sermon Paper, Sermon
Series) · Bible stories & kids (Sunday School, Bible Comic, Storybook, Flat Story, Clay Story, Paper Story) · Worship,
youth & events (Worship Night, Glass Night, Festival, Youth, Youth Street, Revival) · plus Education, Business, Tech &
data and Lifestyle families built on the general styles.

Each family varies the palette, font pairing, illustration look (colour, engraving, duotone, line, silhouette),
light/dark rhythm, texture and picture density — and "New designs" remixes any of them further.
