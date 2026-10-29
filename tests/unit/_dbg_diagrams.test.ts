import { it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { emptySlide } from '@/engine/schema';
it('dbg', () => {
  const s = { ...emptySlide('list', "Abraham's journey"), bullets: ['Ur: the call to leave', 'Haran: waiting', 'Canaan: the promise', 'Moriah: the test of faith'] };
  const c = buildCarousel({ plan: { title: '', language: 'en', paletteMood: 'calm', caption: '', hashtags: [], slides: [s] }, presetId: 'instagram-portrait-4x5', theme: { ...themeFor('minimal-swiss'), layoutOverrides: { 0: 'diagram-journey' } } });
  for (const e of c.slides[0]!.elements) if (e.kind === 'text') process.stdout.write([e.slot, JSON.stringify(e.text), e.x, e.y, e.width, e.height, e.fontSize].join(" ") + "\n");
});
