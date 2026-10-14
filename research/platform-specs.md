# Platform carousel specs (retrieved 2026-10-13)

Machine-readable version: `platform-presets.json` (same folder).

**How these were verified.** Direct WebFetch to the official help centers failed (DNS errors in this environment). Official values were therefore read from search-indexed excerpts of the official pages: help.instagram.com, linkedin.com/help, facebook.com/business, help.x.com, help.pinterest.com, developers.tiktok.com and developers.facebook.com.
- **Verified** means the value came from one of those official pages.
- **Secondary** means it came only from 2025–2026 third-party guides.
- **Estimated** means it is a CarouselForge design default.

## Summary table

| Preset id | Size (px) | Ratio | Slides | Formats | Max MB | Safe zone T/R/B/L (px) | Export | Confidence |
|---|---|---|---|---|---|---|---|---|
| instagram-portrait-4x5 ★ | 1080×1350 | 4:5 | 2–20 | jpg, png | 30 | 60/60/80/60 (est.) | images | verified (MB secondary) |
| instagram-portrait-3x4 ★ | 1080×1440 | 3:4 | 2–20 | jpg, png | 30 | 60/60/80/60 (est.) | images | verified (help page 1.91:1–3:4) |
| instagram-square-1x1 | 1080×1080 | 1:1 | 2–20 | jpg, png | 30 | 60/60/80/60 (est.) | images | verified |
| instagram-story-9x16 (reference) | 1080×1920 | 9:16 | 1 | jpg, png | 30 | 270/65/670/65 | images | verified (Meta %s) |
| linkedin-document-portrait-4x5 ★ | 1080×1350 | 4:5 | 1–300 | pdf | 100 | 50/50/70/50 (est.) | pdf | limits verified; size secondary |
| linkedin-document-square-1x1 | 1080×1080 | 1:1 | 1–300 | pdf | 100 | 50/50/70/50 (est.) | pdf | limits verified; size secondary |
| linkedin-document-landscape-16x9 | 1920×1080 | 16:9 | 1–300 | pdf | 100 | 50/80/70/80 (est.) | pdf | limits verified; size secondary |
| linkedin-multi-image-4x5 | 1080×1350 | 4:5 | 2–20 | jpg, png | 5 | 0 (centre subjects) | images | count verified; MB secondary |
| tiktok-photo-9x16 ★ | 1080×1920 | 9:16 | 2–35 | jpg, png, webp | 20 | 130/140/484/44 (est.) | images | 35 / 20MB verified (API) |
| facebook-carousel-ad-1x1 ★ | 1080×1080 | 1:1 | 2–10 | jpg, png | 30 | 40 all (est.) | images | verified |
| facebook-carousel-ad-4x5 | 1080×1350 | 4:5 | 2–10 | jpg, png | 30 | 40 all (est.) | images | verified |
| facebook-multi-photo-1x1 | 1080×1080 | 1:1 | 2–10* | jpg, png | 30* | 0 (centre subjects) | images | secondary / estimated |
| x-multi-image-16x9 ★ | 1200×675 | 16:9 | 2–4 | jpg, png | 5 | 0/300/0/300 (est., 2-up crop) | images | count/MB verified; size secondary |
| x-multi-image-1x1 | 1080×1080 | 1:1 | 2–4 | jpg, png | 5 | 236/60/236/60 (est.) | images | count/MB verified |
| pinterest-carousel-2x3 ★ | 1000×1500 | 2:3 | 2–5 | jpg, png | 20 | 60/60/100/60 (est.) | images | verified |
| pinterest-carousel-1x1 | 1000×1000 | 1:1 | 2–5 | jpg, png | 20 | 60/60/100/60 (est.) | images | verified |
| threads-carousel-4x5 (optional) | 1080×1350 | 4:5 | 2–20 | jpg, png | 8 | 0 | images | limits verified (API); size chosen |

★ = `recommended: true`. \* = not officially documented (see below).

### Key platform facts
- **Instagram.** Carousels hold up to 20 photos or videos; the first slide's orientation applies to every slide. 3:4 (1080×1440) support arrived in May 2025, and the profile grid now uses 3:4 tiles. The Graph API is still documented as 4:5–1.91:1, JPEG-only and 8MB, with reportedly 10 items per carousel.
- **LinkedIn documents.** Accepts PDF, PPT, PPTX, DOC and DOCX, up to 100MB and 300 pages. Keep every page the same size. The document cannot be replaced after posting.
- **LinkedIn multi-image.** Up to 20 images, shown as a collage rather than a swipe carousel. The first image sets the layout.
- **TikTok photo mode.** Up to 35 photos. The API accepts JPEG and WebP up to 20MB each, at most 1080p.
- **Meta carousel ads.** 2–10 cards, JPG/PNG, 30MB each, 1:1 or 4:5, at least 1080×1080.
- **X.** 1–4 images, 5MB each (GIF 15MB on web). Single images between 2:1 and 3:4 now show uncropped; multi-image grids still crop.
- **Pinterest.** Carousels take 2–5 static images, all 1:1 or all 2:3, and can only be created on desktop. Ad images: PNG/JPEG, 20MB. Sales carousels: 2–10 items, 10MB.
- **Threads.** 2–20 items. API: JPEG/PNG, 8MB, width 320–1440, aspect-ratio limit 10:1.

## Discrepancies & uncertainties

1. **Instagram 3:4 vs 4:5 maximum.** One Instagram help page (help.instagram.com/1631821640426723) says photos keep full resolution between 1.91:1 and **3:4** (1080×1440). An older Posting help page still says **4:5** (1080×1350). Meta's API reference also still lists 4:5–1.91:1.
   - *Chosen:* ship 3:4 as a supported preset, backed by the help page and the May 2025 Mosseri, PetaPixel and Lindsey Gamble reports. 4:5 stays a recommended default.
   - The 3:4 preset's notes warn that API or scheduler publishing may crop to 4:5.
2. **Instagram slide count.** Older help text says 10; the newer help page and Meta's announcements say **20**.
   - *Chosen:* 20.
   - The Graph API reportedly still caps carousels at 10 (third-party docs, secondary).
3. **Instagram file size.** No official limit for organic posts. 30MB per image is the figure used by third parties and Meta ads; 8MB applies to API JPEGs (secondary).
   - *Chosen:* 30, with a recommendation to export under about 5MB.
4. **LinkedIn document page size.** LinkedIn publishes no recommended dimensions. Third parties split between 1080×1350 (Oktopost, PostEverywhere) and 1080×1080 (Moda, ViralBrain), and one lists 1200×1200 (ScreenSnap).
   - *Chosen:* 4:5 recommended, plus 1:1 and 16:9 options.
   - The 100MB, 300-page and file-type limits are verified.
5. **LinkedIn multi-image count and size.** The help center says **20** images; some guides say 9.
   - *Chosen:* 20.
   - Per-image size limit: no official figure. Guides say 5MB each, 10MB total, or no cap with a 36MP limit. *Chosen:* 5MB (secondary, conservative).
6. **TikTok minimum photos.** Some guides say at least 4 photos are needed for photo mode. This is not confirmed officially.
   - *Chosen:* minSlides 2, the carousel minimum.
7. **TikTok formats and size.** The API lists JPEG and WebP at 20MB. Guides list JPG/PNG and quote everything from 500KB to a 500MB total.
   - *Chosen:* jpg, png, webp at 20MB per image. The app does accept PNG.
8. **TikTok safe zone.** TikTok publishes overlay templates, not pixel values. The pixel values used are third-party measurements: top 130, right 140, left 44, and bottom anywhere from 480 to 560 depending on the source.
   - *Chosen:* bottom 484 (estimated).
9. **Meta carousel ad resolution.** The Business Help Center recommends 1024×1024 (minimum 500×500). The Ads Guide says at least 1080×1080.
   - *Chosen:* 1080×1080, which meets both.
10. **Facebook organic multi-photo.** No official limit on photos per post or per-image size was found; third parties claim much higher counts. These posts are grids, not swipe carousels.
    - *Chosen:* maxSlides 10 and 30MB as safe defaults (estimated).
11. **X multi-image.** No official per-tile sizes exist. The 2-up layout gives tiles of about 8:9 and the 4-up layout about 16:9 (inferred from the grid layout). Older help text says GIFs can't be mixed with multiple images; the newer "How to Post" page allows mixed media up to 4 items.
    - *Chosen:* 1200×675 (common third-party recommendation) with side insets of 300px for the 2-up crop.
12. **Pinterest safe zone.** Pinterest documents safe zones for video and Idea Pins, but none for standard or carousel image Pins.
    - *Chosen:* the insets used are estimated.
13. **Threads display size.** No official recommended dimensions exist.
    - *Chosen:* 1080×1350 for Instagram parity, within the API's 320–1440 width range.
14. **Safe zones generally.** Only the Instagram Story/Reels reference preset uses official Meta percentages: about 14% top, 35% bottom and 6% sides for Reels, and about 14% (250px) top and bottom for Stories. **Every other safeZone is estimated.**

## Sources
- https://help.instagram.com/269314186824048/ · https://help.instagram.com/1631821640426723
- https://petapixel.com/2025/05/29/instagram-finally-adds-support-for-34-aspect-ratio-photos · https://www.lindseygamble.com/blog/instagram-now-supports-34-aspect-ratio-for-photos-and-carousel-posts · https://www.inro.social/blog/instagram-post-size
- https://www.linkedin.com/help/linkedin/answer/97459 · https://www.linkedin.com/help/linkedin/answer/a527229 · https://docs.emplifi.io/platform/latest/home/linkedin-publishing · https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/ · https://www.decktopus.com/blog/linkedin-carousel-size-dimensions
- https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post · https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide · https://postfa.st/sizes/tiktok/carousel · https://getkoro.app/blog/tiktok-safe-zone-guide
- https://www.facebook.com/business/help/1114358518575630 · https://www.facebook.com/business/ads-guide/update/carousel · https://www.facebook.com/business/help/980593475366490/ · https://en-gb.facebook.com/business/help/188477725155524 · https://metricool.com/facebook-image-sizes/
- https://help.x.com/en/using-x/posting-gifs-and-pictures · https://help.x.com/en/using-x/how-to-post · https://developer.x.com/en/docs/x-api/v1/media/upload-media/uploading-media/media-best-practices · https://influencermarketinghub.com/twitter-image-size/
- https://help.pinterest.com/en/business/article/create-a-carousel · https://help.pinterest.com/en/business/article/pinterest-product-specs · https://help.pinterest.com/en/article/review-pin-specs · https://business.pinterest.com/creative-best-practices/
- https://developers.facebook.com/docs/threads/posts/ · https://www.threads.com/@threads/post/DAELxBhOoWc
