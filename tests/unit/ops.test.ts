import { describe, expect, it } from 'vitest';
import { buildCarousel, themeFor } from '@/engine/layout';
import { planFromText } from '@/engine/rules';
import { defaultOptions } from '@/engine/types';
import * as ops from '@/editor/ops';
import type { ShapeElement, TextElement } from '@/model/types';
import { newId } from '@/model/id';
import { ARTICLE } from './fixtures';

function doc(): ops.Doc {
  const plan = planFromText(ARTICLE, defaultOptions);
  return { plan, carousel: buildCarousel({ plan, presetId: 'instagram-portrait-4x5', theme: themeFor('minimal-swiss') }) };
}
const box = (x: number, y: number, w = 100, h = 50): ShapeElement => ({ id: newId('el_'), kind: 'rect', x, y, width: w, height: h, rotation: 0, opacity: 1, fill: '#000' });
const W = { width: 1080, height: 1350 };

describe('geometry', () => {
  it('bounds account for rotation', () => {
    const b = ops.bounds({ x: 0, y: 0, width: 100, height: 20, rotation: 90 });
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(100);
    expect(b.x).toBeCloseTo(40);
  });
});

describe('elements', () => {
  it('adds, updates, removes', () => {
    let d = doc();
    const r = box(10, 10);
    d = ops.addElements(d, 1, [r]);
    d = ops.updateElements(d, 1, [r.id], { x: 99 });
    expect(ops.findElement(d.carousel.slides[1]!.elements, r.id)!.x).toBe(99);
    d = ops.removeElements(d, 1, [r.id]);
    expect(ops.findElement(d.carousel.slides[1]!.elements, r.id)).toBeUndefined();
  });

  it('reorders z', () => {
    let d = doc();
    const [a, b, c] = [box(0, 0), box(0, 0), box(0, 0)];
    d = { ...d, carousel: { ...d.carousel, slides: d.carousel.slides.map((s, i) => (i === 1 ? { ...s, elements: [a, b, c] } : s)) } };
    const ids = () => d.carousel.slides[1]!.elements.map((e) => e.id);
    d = ops.reorder(d, 1, [a.id], 'forward');
    expect(ids()).toEqual([b.id, a.id, c.id]);
    d = ops.reorder(d, 1, [a.id], 'front');
    expect(ids()).toEqual([b.id, c.id, a.id]);
    d = ops.reorder(d, 1, [a.id], 'back');
    expect(ids()).toEqual([a.id, b.id, c.id]);
    d = ops.moveElementTo(d, 1, a.id, 2);
    expect(ids()).toEqual([b.id, c.id, a.id]);
  });

  it('groups and ungroups preserving absolute positions', () => {
    let d = doc();
    const a = box(100, 100);
    const b = box(300, 200);
    d = ops.addElements(d, 1, [a, b]);
    const g = ops.group(d, 1, [a.id, b.id]);
    const grp = ops.findElement(g.doc.carousel.slides[1]!.elements, g.groupId!)!;
    expect(grp).toMatchObject({ kind: 'group', x: 100, y: 100, width: 300, height: 150 });
    const u = ops.ungroup(g.doc, 1, g.groupId!);
    const kids = u.ids.map((id) => ops.findElement(u.doc.carousel.slides[1]!.elements, id)!);
    expect(kids.map((k) => [k.x, k.y])).toEqual([[100, 100], [300, 200]]);
  });

  it('aligns and distributes', () => {
    let d = doc();
    const [a, b, c] = [box(0, 0), box(200, 40), box(900, 80)];
    d = ops.addElements(d, 1, [a, b, c]);
    const al = ops.align(d, 1, [a.id, b.id, c.id], 'top', W);
    expect([a, b, c].map((e) => ops.findElement(al.carousel.slides[1]!.elements, e.id)!.y)).toEqual([0, 0, 0]);
    const single = ops.align(d, 1, [c.id], 'hcenter', W);
    expect(ops.findElement(single.carousel.slides[1]!.elements, c.id)!.x).toBe(490);
    const dist = ops.distribute(d, 1, [a.id, b.id, c.id], 'h');
    expect(ops.findElement(dist.carousel.slides[1]!.elements, b.id)!.x).toBe(450);
  });

  it('clones with fresh ids and no engine slot', () => {
    const t: TextElement = { ...(doc().carousel.slides[0]!.elements.find((e) => e.kind === 'text') as TextElement) };
    const c = ops.cloneElement(t, 10, 10);
    expect(c.id).not.toBe(t.id);
    expect(c.slot).toBeUndefined();
    expect(c.x).toBe(t.x + 10);
  });
});

describe('slides stay aligned with the plan', () => {
  it('add / duplicate / delete / move', () => {
    let d = doc();
    const n = d.carousel.slides.length;
    d = ops.addSlide(d, 0);
    expect(d.carousel.slides).toHaveLength(n + 1);
    expect(d.plan.slides).toHaveLength(n + 1);
    expect(d.carousel.slides[1]!.manual).toBe(true);
    d = ops.duplicateSlide(d, 2);
    expect(d.plan.slides[3]!.headline).toBe(d.plan.slides[2]!.headline);
    const h = d.plan.slides[3]!.headline;
    d = ops.moveSlide(d, 3, 0);
    expect(d.plan.slides[0]!.headline).toBe(h);
    d = ops.deleteSlide(d, 0);
    expect(d.carousel.slides).toHaveLength(n + 1);
    expect(d.plan.slides).toHaveLength(n + 1);
  });
});

describe('plan sync + theme swap keep the user’s content', () => {
  it('edited headline survives a theme change; user elements are carried over', () => {
    let d = doc();
    const head = d.carousel.slides[1]!.elements.find((e) => e.slot === 'headline')!;
    d = ops.updateElements(d, 1, [head.id], { text: 'A brand new headline' } as Partial<TextElement>);
    expect(d.plan.slides[1]!.headline).toBe('A brand new headline');
    const sticker = box(50, 50);
    d = ops.addElements(d, 1, [sticker]);
    const swapped = ops.applyTheme(d, themeFor('neo-pop'));
    const s1 = swapped.carousel.slides[1]!;
    expect(s1.elements.some((e) => e.kind === 'text' && e.text === 'A brand new headline')).toBe(true);
    expect(s1.elements.some((e) => e.id === sticker.id)).toBe(true);
    expect(swapped.carousel.theme.styleId).toBe('neo-pop');
  });

  it('keeps manual slides untouched', () => {
    let d = ops.addSlide(doc(), 0);
    const manual = d.carousel.slides[1]!;
    d = ops.addElements(d, 1, [box(1, 1)]);
    const swapped = ops.applyTheme(d, themeFor('dark-tech'));
    expect(swapped.carousel.slides[1]!.elements).toEqual(d.carousel.slides[1]!.elements);
    expect(swapped.carousel.slides[1]!.id).toBe(manual.id);
  });
});

describe('find & replace', () => {
  it('replaces in elements and plan, respecting case and whole words', () => {
    const d = doc();
    const r = ops.findReplace(d, 'readers', 'viewers', { matchCase: false, wholeWord: true });
    expect(r.count).toBeGreaterThan(0);
    const all = r.doc.carousel.slides.flatMap((s) => s.elements).filter((e) => e.kind === 'text').map((e) => (e as TextElement).text).join(' ');
    expect(all).not.toMatch(/\breaders\b/i);
    expect(JSON.stringify(r.doc.plan)).not.toMatch(/\breaders\b/i);
    expect(ops.findReplace(d, 'READERS', 'x', { matchCase: true, wholeWord: false }).count).toBe(0);
  });
});
