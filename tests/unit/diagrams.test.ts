import { beforeAll, describe, expect, it } from 'vitest';
// The layout index must load before the diagrams module (layouts.ts and diagrams.ts import each other).
import { buildCarousel, themeFor, LAYOUTS, ROLE_LAYOUTS } from '@/engine/layout';
import { DIAGRAM_LAYOUTS, diagramFor, parseVs, splitItem } from '@/engine/layout/diagrams';
import { makeCtx } from '@/engine/layout/context';
import { emptySlide, type CarouselPlan, type SlidePlan } from '@/engine/schema';
import { getPreset } from '@/styles';
import { loadIcons } from '@/styles/icons';
import { bounds } from '@/editor/ops';
import type { Carousel, SlideElement, TextElement } from '@/model/types';

beforeAll(() => loadIcons());

const PRESETS = ['instagram-portrait-4x5', 'instagram-square-1x1', 'linkedin-document-landscape-16x9', 'tiktok-photo-9x16'];
const STYLES = ['minimal-swiss', 'clay-3d', 'hand-drawn-notes', 'dark-tech'];
const IDS = Object.keys(DIAGRAM_LAYOUTS);

const CONTENT = new Set(['headline', 'body', 'subline', 'bullet', 'bullet-number', 'kicker', 'diagram-label', 'compare-label', 'step-number', 'step-label']);
const CHROME = new Set(['slide-number', 'swipe-cue', 'swipe-cue-label']);
const texts = (els: SlideElement[]) => els.filter((e): e is TextElement => e.kind === 'text');
const intersects = (a: SlideElement, b: SlideElement) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
const inside = (a: SlideElement, b: SlideElement) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;

/** Same rules as layout.test.ts assertSane, with diagram labels counted as content. */
function assertSane(c: Carousel, label: string) {
  const { width: W, height: H } = getPreset(c.presetId);
  for (const [si, slide] of c.slides.entries()) {
    const ts = texts(slide.elements);
    const content = ts.filter((t) => CONTENT.has(t.slot ?? ''));
    const chrome = ts.filter((t) => CHROME.has(t.slot ?? ''));
    for (const t of ts) {
      const where = `${label} slide ${si + 1} (${slide.layoutId}) ${t.slot} "${t.text.slice(0, 30)}"`;
      const b = Math.abs(t.rotation) >= 45 ? bounds(t) : { x: t.x, y: t.y, width: t.width, height: t.height };
      expect(b.x, where).toBeGreaterThanOrEqual(-1);
      expect(b.y, where).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width, where).toBeLessThanOrEqual(W + 1);
      expect(b.y + b.height, where).toBeLessThanOrEqual(H + 1);
    }
    for (let i = 0; i < content.length; i++) {
      for (let j = i + 1; j < content.length; j++) {
        expect(intersects(content[i]!, content[j]!), `${label} slide ${si + 1} (${slide.layoutId}): "${content[i]!.text}" overlaps "${content[j]!.text}"`).toBe(false);
      }
      for (const ch of chrome) expect(intersects(content[i]!, ch), `${label} slide ${si + 1} (${slide.layoutId}): ${content[i]!.slot} overlaps ${ch.slot}`).toBe(false);
    }
  }
}

const plan = (slides: SlidePlan[]): CarouselPlan => ({ title: 'Diagrams', language: 'en', paletteMood: 'calm', caption: '', hashtags: [], slides });
const withBullets = (role: SlidePlan['role'], headline: string, bullets: string[], extra: Partial<SlidePlan> = {}): SlidePlan => ({ ...emptySlide(role, headline), bullets, ...extra });

const POOL = ['Pray: talk with God first', 'Read the Word', 'Reflect on what you read', 'Serve your neighbor', 'Rest in His grace', 'Worship together on Sunday'];

describe('diagram layouts', () => {
  it('are registered in the layout catalog and role lists', () => {
    for (const id of IDS) expect(LAYOUTS[id], id).toBeDefined();
    const roles = new Set(Object.values(ROLE_LAYOUTS).flat());
    for (const id of IDS) expect(roles.has(id), id).toBe(true);
  });

  const cases = IDS.flatMap((id) => PRESETS.map((p) => [id, p] as const));
  it.each(cases)('%s on %s: 2-6 bullets lay out sanely, labels inside their shapes', (id, presetId) => {
    for (const styleId of STYLES) {
      for (let n = 2; n <= 6; n++) {
        const s = withBullets(id === 'diagram-versus' ? 'comparison' : 'list', id === 'diagram-versus' && n > 2 ? 'Law vs Grace' : 'The daily rhythm of grace', POOL.slice(0, n), { body: n % 2 ? 'Grace' : '' });
        const c = buildCarousel({ plan: plan([emptySlide('hook', 'Diagrams'), s, emptySlide('cta', 'Follow for more')]), presetId, theme: { ...themeFor(styleId), layoutOverrides: { 1: id } } });
        const tag = `${styleId}/${presetId}/${id}/${n}`;
        assertSane(c, tag);
        const slide = c.slides[1]!;
        // Venn takes 2-3 ideas; with more it falls back to a list layout. Six long items in a small
        // cycle may not fit at the minimum size; the engine then picks another layout (still sane).
        if (id === 'diagram-venn' && n > 3) continue;
        if (slide.layoutId !== id) {
          expect(n, `${tag} fell back to ${slide.layoutId}`).toBe(6);
          continue;
        }
        const labels = texts(slide.elements).filter((t) => t.slot === 'diagram-label');
        expect(labels.length, tag).toBeGreaterThanOrEqual(n);
        if (id === 'diagram-journey') continue; // journey labels sit beside the road, not in a shape
        const nodes = slide.elements.filter((e) => e.slot === 'diagram-node');
        for (const t of labels) expect(nodes.some((nd) => inside(t, nd)), `${tag}: "${t.text}" outside its shape`).toBe(true);
      }
    }
  });

  it('keep the requested layout for short, typical content', () => {
    const samples: Record<string, SlidePlan> = {
      'diagram-cycle': withBullets('summary', 'The daily rhythm', ['Pray', 'Read', 'Reflect', 'Serve'], { body: 'Grace' }),
      'diagram-flow': withBullets('step', 'How to read a Psalm', ['Read it slowly aloud', 'Notice the feelings', 'Find the turn to trust', 'Pray it back to God']),
      'diagram-venn': withBullets('body', 'Faith, Hope and Love', ['Faith', 'Hope', 'Love']),
      'diagram-pyramid': withBullets('list', 'Build on the right foundation', ['Christ', 'The Word', 'Prayer', 'Fellowship']),
      'diagram-tree': withBullets('list', 'The fruit of the Spirit', ['Love', 'Joy', 'Peace', 'Patience', 'Kindness']),
      'diagram-journey': withBullets('list', "Abraham's journey", ['Ur: the call', 'Haran: waiting', 'Canaan: the promise', 'Moriah: the test']),
      'diagram-versus': withBullets('comparison', 'Law vs Grace', ['Written on stone', 'Written on hearts']),
      'diagram-stairs': withBullets('list', 'Steps of faith', ['Hear', 'Believe', 'Repent', 'Grow']),
    };
    for (const presetId of PRESETS) for (const [id, s] of Object.entries(samples)) {
      const c = buildCarousel({ plan: plan([s]), presetId, theme: { ...themeFor('minimal-swiss'), layoutOverrides: { 0: id } } });
      expect(c.slides[0]!.layoutId, `${id} on ${presetId}`).toBe(id);
      expect(c.slides[0]!.notes, `${id} on ${presetId}`).toBeUndefined();
    }
  });

  it('fall back to a regular layout when there is nothing to diagram', () => {
    const s = emptySlide('body', 'Grace is a gift', 'Nothing to earn, everything to receive.');
    for (const id of IDS) {
      const r = LAYOUTS[id]!(makeCtx(plan([s]), 'instagram-portrait-4x5', themeFor('minimal-swiss')), s, 0);
      expect(r.elements.some((e) => e.slot === 'headline'), id).toBe(true);
      expect(r.elements.some((e) => e.slot?.startsWith('diagram')), id).toBe(false);
    }
  });
});

describe('item parsing', () => {
  it('splits long bullets into a short label and detail', () => {
    expect(splitItem('Pray: talk with God first', 3)).toEqual({ label: 'Pray', detail: 'talk with God first' });
    expect(splitItem('Then read the Word', 3)).toEqual({ label: 'Read the Word', detail: '' });
    expect(splitItem('Love your neighbor as yourself every day', 3)).toEqual({ label: 'Love your neighbor', detail: 'as yourself every day' });
  });
  it('reads "A vs B" and "A → B" headlines', () => {
    expect(parseVs('Law vs Grace')).toEqual({ a: 'Law', b: 'Grace', arrow: false });
    expect(parseVs('Old self → New self')).toEqual({ a: 'Old self', b: 'New self', arrow: true });
    expect(parseVs('Walk in the light of His love today')).toBeNull();
  });
});

describe('diagramFor', () => {
  const pick = (s: SlidePlan) => diagramFor(s, makeCtx(plan([s]), 'instagram-portrait-4x5', themeFor('minimal-swiss')));
  const three = ['Prayer', 'Scripture', 'Service'];

  it('honors explicit layout hints', () => {
    const hint = (h: string, bullets = three, role: SlidePlan['role'] = 'body') => pick(withBullets(role, 'Something', bullets, { layoutHint: h }));
    expect(hint('cycle diagram')).toBe('diagram-cycle');
    expect(hint('a weekly rhythm')).toBe('diagram-cycle');
    expect(hint('process flow with arrows')).toBe('diagram-flow');
    expect(hint('venn of overlapping ideas')).toBe('diagram-venn');
    expect(hint('pyramid, foundation at the bottom')).toBe('diagram-pyramid');
    expect(hint('mind map')).toBe('diagram-tree');
    expect(hint('vine and branches')).toBe('diagram-tree');
    expect(hint('timeline of the story')).toBe('diagram-journey');
    expect(hint('before / after contrast', ['Fear', 'Faith'])).toBe('diagram-versus');
    expect(hint('ladder, steps to grow')).toBe('diagram-stairs');
    expect(hint('giant number left')).toBeNull();
    expect(hint('venn', ['A', 'B', 'C', 'D', 'E'])).toBeNull();
  });

  it('infers diagrams from sample content', () => {
    expect(pick(withBullets('summary', 'The daily rhythm', ['Pray', 'Read', 'Reflect', 'Serve']))).toBe('diagram-cycle');
    expect(pick(withBullets('comparison', 'Law vs Grace', ['Written on stone', 'Written on hearts']))).toBe('diagram-versus');
    expect(pick(withBullets('list', 'Fear or faith?', ['Fear looks at the storm', 'Faith looks at Jesus']))).toBe('diagram-versus');
    expect(pick(withBullets('list', 'Build on the right foundation', ['Christ', 'The Word', 'Prayer', 'Fellowship']))).toBe('diagram-pyramid');
    expect(pick(withBullets('list', 'The fruit of the Spirit', ['Love', 'Joy', 'Peace', 'Patience']))).toBe('diagram-tree');
    expect(pick(withBullets('list', "Abraham's journey", ['Ur', 'Haran', 'Canaan', 'Moriah']))).toBe('diagram-journey');
    expect(pick(withBullets('list', 'How to grow in prayer', ['Start small', 'Be honest', 'Keep going']))).toBe('diagram-stairs');
    expect(pick(withBullets('body', 'Faith, hope and love', ['Faith', 'Hope', 'Love']))).toBe('diagram-venn');
    expect(pick(withBullets('step', 'Reading a Psalm', ['Read it aloud', 'Notice the feelings', 'Pray it back']))).toBe('diagram-flow');
    expect(pick(withBullets('list', 'Forgiving someone', ['First, name the hurt', 'Then release the debt', 'Finally, bless them']))).toBe('diagram-flow');
  });

  it('stays conservative', () => {
    expect(pick(withBullets('list', 'What actually helps', ['Smaller pull requests', 'Daily written updates', 'One owner per decision']))).toBeNull();
    expect(pick(withBullets('list', 'The daily rhythm', ['A very long bullet that goes on and on about many things', 'Read', 'Pray']))).toBeNull();
    expect(pick(withBullets('list', 'The daily rhythm', ['Pray']))).toBeNull();
    for (const role of ['hook', 'cta', 'quote', 'stat'] as const) {
      expect(pick(withBullets(role, 'The daily rhythm', ['Pray', 'Read', 'Reflect'])), role).toBeNull();
      expect(pick(withBullets(role, 'The daily rhythm', ['Pray', 'Read', 'Reflect'], { layoutHint: 'cycle' })), role).toBeNull();
    }
  });

  it('uses diagrams on at most about half the slides and never the same one twice in a row', () => {
    const cyc = () => withBullets('list', 'The daily rhythm', ['Pray', 'Read', 'Reflect']);
    const p = plan([emptySlide('hook', 'Rhythms of grace'), cyc(), cyc(), withBullets('list', "Abraham's journey", ['Ur', 'Haran', 'Canaan']), cyc(), cyc(), cyc(), emptySlide('cta', 'Follow')]);
    const ctx = makeCtx(p, 'instagram-portrait-4x5', themeFor('minimal-swiss'));
    const ids = p.slides.map((s) => diagramFor(s, ctx));
    expect(ids).toEqual([null, 'diagram-cycle', null, 'diagram-journey', 'diagram-cycle', null, 'diagram-cycle', null]);
    expect(ids.filter(Boolean).length).toBeLessThanOrEqual(p.slides.length / 2);
    const c = buildCarousel({ plan: p, presetId: 'instagram-portrait-4x5', theme: themeFor('minimal-swiss') });
    expect(c.slides.map((s) => s.layoutId).filter((l) => l?.startsWith('diagram'))).toHaveLength(4);
    assertSane(c, 'auto');
  });
});
