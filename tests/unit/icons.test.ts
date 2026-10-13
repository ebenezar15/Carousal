import { beforeAll, describe, expect, it } from 'vitest';
import {
  ICON_SYNONYMS,
  ICON_VIEWBOX,
  getIcon,
  iconForKeywords,
  iconSetInfo,
  iconsLoaded,
  listIcons,
  loadIcons,
  searchIcons,
} from '@/styles/icons';

// A path string made only of SVG path commands, numbers, separators.
const VALID_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;

describe('icon library before load', () => {
  it('is empty until loadIcons()', () => {
    expect(iconsLoaded()).toBe(false);
    expect(getIcon('clock')).toBeNull();
    expect(listIcons()).toEqual([]);
    expect(searchIcons('clock')).toEqual([]);
    expect(iconForKeywords(['clock'])).toBeNull();
  });
});

describe('icon library', () => {
  let ALL_NAMES: string[] = [];

  beforeAll(async () => {
    await loadIcons();
    ALL_NAMES = listIcons().map((i) => i.name);
  });

  it('loads idempotently with > 1000 Lucide icons', async () => {
    const again = loadIcons();
    await again;
    expect(iconsLoaded()).toBe(true);
    expect(listIcons().length).toBe(ALL_NAMES.length);
    expect(ALL_NAMES.length).toBeGreaterThan(1000);
    expect(ICON_VIEWBOX).toBe(24);
    expect(iconSetInfo()).toMatchObject({ license: 'ISC' });
    expect(iconSetInfo()?.source).toMatch(/^lucide@\d+\.\d+\.\d+$/);
  });

  it('every icon has at least one non-empty, valid path string starting with a moveto', () => {
    const bad: string[] = [];
    for (const name of ALL_NAMES) {
      const icon = getIcon(name);
      if (!icon || icon.d.length === 0) {
        bad.push(name);
        continue;
      }
      for (const d of icon.d) {
        if (!d.trim() || !VALID_D.test(d) || !/^\s*[Mm]/.test(d) || /NaN|Infinity/.test(d)) bad.push(`${name}: ${d}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('converts circles to arc commands', () => {
    const circle = getIcon('circle');
    expect(circle?.d).toEqual(['M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z']);
    const clock = getIcon('clock');
    expect(clock?.d[0]).toMatch(/^M2 12a10 10/);
    expect(clock?.tags).toContain('time');
  });

  it('converts rounded rects, lines and polylines', () => {
    // square: <rect width=18 height=18 x=3 y=3 rx=2>
    expect(getIcon('square')?.d[0]).toBe('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z');
    for (const d of getIcon('square')?.d ?? []) expect(d).not.toMatch(/[<>"]/);
  });

  it('getIcon is case/whitespace tolerant and returns null for unknown names', () => {
    expect(getIcon(' Clock ')?.name).toBe('clock');
    expect(getIcon('definitely-not-an-icon')).toBeNull();
  });

  it('ranks search results: exact name > prefix > contains > tags', () => {
    const res = searchIcons('clock');
    expect(res[0]?.name).toBe('clock');
    const names = res.map((r) => r.name);
    // Prefix matches (clock-*) come before names that merely contain "clock" (alarm-clock).
    const prefixIdx = names.findIndex((n) => n.startsWith('clock-'));
    const containsIdx = names.indexOf('alarm-clock');
    expect(prefixIdx).toBeGreaterThan(0);
    if (containsIdx >= 0) expect(prefixIdx).toBeLessThan(containsIdx);
    // Tag-only hits ('time' tag on clock) rank below name hits.
    const time = searchIcons('time', 200).map((r) => r.name);
    expect(time).toContain('clock');
    expect(time.indexOf('timer')).toBeLessThan(time.indexOf('clock'));
  });

  it('search is case-insensitive, supports multi-word queries and respects limit', () => {
    expect(searchIcons('CLOCK')[0]?.name).toBe('clock');
    expect(searchIcons('trending up')[0]?.name).toBe('trending-up');
    expect(searchIcons('arrow', 5)).toHaveLength(5);
    expect(searchIcons('')).toEqual([]);
    expect(searchIcons('zzqqxx')).toEqual([]);
  });

  it('iconForKeywords: exact names and synonyms', () => {
    const pick = (kw: string[]) => iconForKeywords(kw)?.name;
    expect(pick(['clock'])).toBe('clock');
    expect(pick(['growth'])).toBe('trending-up');
    expect(pick(['money'])).toBe('banknote');
    expect(pick(['idea'])).toBe('lightbulb');
    expect(pick(['time'])).toBe('clock');
    expect(pick(['team', 'meeting'])).toBe('users');
    expect(pick(['Warning'])).toBe('triangle-alert');
    expect(pick(['success'])).toBe('circle-check');
    expect(pick(['email'])).toBe('mail');
    expect(pick(['data'])).toBe('chart-bar');
    expect(pick(['ideas'])).toBe('lightbulb'); // plural → singular
    expect(pick(['trending up'])).toBe('trending-up'); // phrase → hyphenated name
  });

  it('iconForKeywords falls back to search, and returns null for nonsense', () => {
    expect(iconForKeywords(['xyzzyqq', 'rocket'])?.name).toBe('rocket');
    expect(iconForKeywords(['alarm'])).not.toBeNull(); // tag/name search
    expect(iconForKeywords(['qwzxv'])).toBeNull();
    expect(iconForKeywords([])).toBeNull();
    expect(iconForKeywords(['  '])).toBeNull();
  });

  it('every synonym maps to at least one existing icon', () => {
    const broken = Object.entries(ICON_SYNONYMS)
      .filter(([, names]) => !names.some((n) => getIcon(n)))
      .map(([k]) => k);
    expect(broken).toEqual([]);
  });
});
