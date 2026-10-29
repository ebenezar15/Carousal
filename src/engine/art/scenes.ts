// Full-bleed scene illustrations (viewBox 1000×600). Every scene is palette-driven, varies its
// composition with the seed, and can host people standing on its ground line.

import { NEUTRALS as N, SKIN_TONES } from './characters';
import { arcBand, arcShape, blob, capsule, circle, curve, ellipse, hashStr, poly, rand, roundPoly, rrect, sparkle, type Pt } from './geom';
import {
  birds,
  bigStar,
  bush,
  clouds,
  crest,
  cross,
  Ctx,
  flower,
  grassTufts,
  moon,
  moundPath,
  palmTree,
  pineTree,
  rays,
  ridgePath,
  roundTree,
  sailboat,
  sheep,
  sky,
  stars,
  sun,
  waterBands,
  waveDashes,
} from './sceneKit';
import type { ArtPalette, ArtPiece, CharacterSpec, SceneKind } from './types';

export const SCENE_LIST: SceneKind[] = [
  'hill-cross', 'sunrise', 'road', 'mountains', 'sea-boat', 'storm-sea', 'shepherd', 'tree-river', 'garden', 'desert', 'night-sky',
  'empty-tomb', 'city', 'rainbow', 'church', 'table', 'open-door', 'lighthouse', 'field-seeds', 'well', 'manger',
];

/** Where people stand: [x, groundY, height] candidates in preference order. */
type Slot = [number, number, number, number?];

interface SceneCtx extends Ctx {
  people: CharacterSpec[];
  slots?: Slot[];
}

/**
 * Reserve slots for the given people. By default they're drawn after the whole scene (so foreground
 * ground layers never hide their feet); `now` draws them immediately (e.g. behind a table).
 */
function placePeople(c: SceneCtx, slots: Slot[], now = false) {
  if (!now) {
    c.slots = slots;
    return;
  }
  const n = Math.min(c.people.length, slots.length);
  const chosen = slots.slice(0, n).map((s, i) => ({ s, p: c.people[i]! }));
  // Back to front by ground line.
  chosen.sort((a, b) => a.s[1] - b.s[1]);
  for (const { s, p } of chosen) {
    const half = (s[2] * 0.36) / (p.child ? 1.5 : 1);
    // Optional 4th value raises children (e.g. so they can see over a table).
    c.person(p, Math.max(half, Math.min(1000 - half, s[0])), s[1] - (p.child ? (s[3] ?? 0) : 0), s[2]);
  }
}

type Recipe = (c: SceneCtx) => void;

const R: Record<SceneKind, Recipe> = {
  'hill-cross': (c) => {
    const { pal, r } = c;
    sky(c);
    const hx = r.range(420, 600);
    const top = r.range(200, 240);
    rays(c, hx, top - 40, 60, 700, 14, pal.highlight, 0.16, r.range(0, 20), 180, 180);
    sun(c, hx + r.pick([-1, 1]) * r.range(170, 260), top - r.range(40, 80), 50, pal.highlight, false);
    clouds(c, 2, 60, 140, c.light, 0.9, [hx, 160]);
    c.tone(ridgePath(c, 380, 30, 6), pal.primary, 0.78);
    c.tone(moundPath(hx, top, 300, 430), pal.primary, 0.55);
    // Crosses on the summit.
    c.add(circle(hx, top - 70, 120), pal.highlight, 0.18);
    cross(c, hx, top + 8, 150, c.dark);
    if (r.chance(0.6)) {
      cross(c, hx - 95, top + 46, 96, c.dark);
      cross(c, hx + 95, top + 44, 96, c.dark);
    }
    c.tone(ridgePath(c, 500, 22, 4), pal.primary, 0.3);
    placePeople(c, [[hx - 260, 560, 210], [hx + 250, 565, 210], [hx - 380, 575, 200]]);
    c.tone(ridgePath(c, 560, 12, 3), pal.primary, 0.12);
    grassTufts(c, 10, 520, 590, c.dark, 0.18);
    birds(c, 3, 120, 880, 70, 180);
  },

  sunrise: (c) => {
    const { pal, r } = c;
    sky(c);
    const sx = r.range(300, 700);
    c.add(rrect(0, 180, 1000, 420), pal.highlight, 0.18);
    rays(c, sx, 400, 90, 760, 16, pal.highlight, 0.2, r.range(0, 10), 180, 180);
    sun(c, sx, 400, r.range(80, 100), pal.highlight, false);
    clouds(c, 3, 70, 220, c.light, 0.85, [sx, 120]);
    c.tone(ridgePath(c, 380, 34, 7), pal.primary, 0.8);
    c.tone(ridgePath(c, 430, 30, 5), pal.primary, 0.62);
    c.tone(ridgePath(c, 490, 26, 4), pal.primary, 0.42);
    placePeople(c, [[sx - 220, 555, 220], [sx + 230, 560, 220], [sx + 360, 565, 200]]);
    c.tone(ridgePath(c, 545, 14, 3), pal.primary, 0.22);
    birds(c, 4, 100, 900, 80, 230);
  },

  road: (c) => {
    const { pal, r } = c;
    sky(c);
    const hx = r.range(380, 620);
    sun(c, hx + r.range(-60, 60), 250, 60, c.pal.highlight, false);
    clouds(c, 3, 60, 170);
    c.tone(ridgePath(c, 280, 26, 6), pal.primary, 0.8);
    c.tone(ridgePath(c, 330, 26, 5), pal.primary, 0.6);
    c.tone(rrect(0, 360, 1000, 240), pal.primary, 0.42);
    c.tone(ridgePath(c, 400, 18, 4), pal.primary, 0.32);
    // Winding road: centreline from the horizon to the bottom, widening toward the viewer.
    const sway = r.pick([-1, 1]) * r.range(120, 200);
    const center: Pt[] = [
      [hx, 340],
      [hx + sway * 0.35, 380],
      [hx - sway * 0.2, 440],
      [hx + sway * 0.6, 520],
      [hx - sway * 0.1, 600],
    ];
    const half = (i: number) => 4 + i * i * 34;
    const left: Pt[] = center.map(([x, y], i): Pt => [x - half(i), y]);
    const right: Pt[] = center.map(([x, y], i): Pt => [x + half(i), y]).reverse();
    const road = curve(left) + curve(right).replace(/^M/, 'L') + 'Z';
    c.tone(road, c.light, 0, c.light);
    c.shade(road, 0.08);
    for (let i = 0; i < 9; i++) {
      const t = 0.12 + i * 0.1;
      const k = Math.min(3, Math.floor(t * 4));
      const a = center[k]!;
      const b = center[Math.min(4, k + 1)]!;
      const u = t * 4 - k;
      const x = a[0] + (b[0] - a[0]) * u;
      const y = a[1] + (b[1] - a[1]) * u;
      const w = 1 + t * 5;
      c.add(capsule([x, y - w * 1.4], [x, y + w * 1.4], w * 0.7), pal.highlight, 0.9);
    }
    const sides = [[120, 420, 120], [880, 430, 130], [60, 520, 180], [940, 540, 190], [260, 380, 80], [730, 375, 80]] as const;
    for (const [x, y, h] of sides) if (r.chance(0.8)) roundTree(c, x + r.range(-30, 30), y, h, pal.primary, 0.15);
    placePeople(c, [[center[3]![0] + 150, 560, 230], [center[3]![0] - 160, 565, 230]]);
    birds(c, 3, 200, 800, 80, 180);
  },

  mountains: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(150, 850), r.range(90, 150), 46);
    clouds(c, 2, 80, 160);
    const range = (base: number, n: number, hMin: number, hMax: number, t: number, snow: boolean) => {
      const step = 1000 / n;
      for (let i = 0; i < n; i++) {
        const x = step * (i + 0.5) + r.range(-step * 0.25, step * 0.25);
        const h = r.range(hMin, hMax);
        const w = step * r.range(0.8, 1.05);
        const peak: Pt = [x, base - h];
        const d = roundPoly([peak, [x + w, base + 60], [x - w, base + 60]], 26);
        c.tone(d, pal.primary, t);
        c.shade(roundPoly([peak, [x + w, base + 60], [x + w * 0.05, base + 60]], 20), 0.1);
        if (snow) c.add(roundPoly([peak, [x + w * 0.28, base - h * 0.72], [x + w * 0.1, base - h * 0.66], [x - w * 0.05, base - h * 0.74], [x - w * 0.28, base - h * 0.7]], 8), c.light, 0.95);
      }
    };
    range(330, 4, 180, 250, 0.72, true);
    range(400, 5, 110, 170, 0.52, false);
    c.tone(ridgePath(c, 460, 20, 4), pal.primary, 0.36);
    for (let i = 0; i < 7; i++) pineTree(c, r.range(20, 980), r.range(470, 520), r.range(70, 110), pal.primary, 0.22);
    placePeople(c, [[r.range(300, 420), 565, 220], [r.range(600, 720), 570, 220]]);
    c.tone(ridgePath(c, 545, 12, 3), pal.primary, 0.18);
    birds(c, 3, 100, 900, 90, 200);
  },

  'sea-boat': (c) => {
    const { pal, r } = c;
    sky(c);
    const sx = r.range(150, 850);
    sun(c, sx, r.range(150, 230), 60);
    clouds(c, 3, 60, 180, c.light, 0.9, [sx, 120]);
    c.tone(ridgePath(c, 330, 14, 5, 360), pal.primary, 0.75);
    waterBands(c, 340);
    c.add(rrect(sx - 80, 345, 160, 8, 4), pal.highlight, 0.5);
    c.add(rrect(sx - 50, 365, 100, 6, 3), pal.highlight, 0.35);
    waveDashes(c, 10, 360, 470, c.light, 0.45, !c.people.length);
    const bx = r.range(330, 680);
    sailboat(c, bx, 430, r.range(1.1, 1.4), pal.accent, c.light);
    c.mover('gull', 'float', [bx, 200], () => c.stroke(`M${bx - 120} 170Q${bx - 108} 160 ${bx - 96} 172Q${bx - 84} 160 ${bx - 72} 170`, c.dark, 3.2, 0.7), 0.4);
    // Sandy shore in the foreground.
    const shore = curve([[0, 500], [180, 492], [380, 520], [560, 556], [760, 580], [1000, 572]], [[1000, 600], [0, 600]]);
    c.add(shore, pal.highlight);
    c.add(shore, c.light, 0.35);
    c.add(curve([[0, 500], [180, 492], [380, 520], [560, 556], [760, 580], [1000, 572]]), 'none', undefined, { stroke: c.light, strokeWidth: 6, opacity: 0.8 });
    for (let i = 0; i < 4; i++) c.add(ellipse(r.range(40, 420), r.range(540, 590), r.range(8, 16), 4), N.stone, 0.5);
    placePeople(c, [[170, 585, 230], [330, 592, 230], [60, 592, 220]]);
  },

  'storm-sea': (c) => {
    const { pal, r } = c;
    sky(c, true);
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 260 + r.range(-40, 40);
      const k = r.range(0.75, 1.1);
      const y = r.range(-10, 30);
      c.mover(`storm-cloud-${i}`, 'drift', [x, 90], () => {
        const d = circle(x - 70 * k, 110 + y, 66 * k) + circle(x + 10 * k, 110 + y - 26 * k, 84 * k) + circle(x + 100 * k, 112 + y, 62 * k) + rrect(x - 136 * k, 110 + y, 290 * k, 66 * k, 33 * k);
        c.tone(d, pal.muted, 0.2 + (i % 2) * 0.2, c.dark);
      }, i * 1.1);
    }
    // Lightning.
    const lx = r.range(250, 750);
    c.mover('lightning', 'blink', [lx, 200], () => c.add(poly([[lx, 170], [lx - 34, 270], [lx - 6, 266], [lx - 26, 350], [lx + 30, 240], [lx + 2, 246], [lx + 20, 170]]), pal.highlight));
    // Rain.
    let rain = '';
    for (let i = 0; i < 50; i++) {
      const x = r.range(0, 1000);
      const y = r.range(170, 520);
      rain += capsule([x, y], [x - 12, y + 34], 1.8);
    }
    c.add(rain, c.light, 0.35);
    c.tone(rrect(0, 380, 1000, 220), pal.primary, 0.35, c.dark);
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * 210 + r.range(-30, 30);
      c.mover(`swell-${i}`, 'bob', [x, 420], () => crest(c, x, 410, 260, 60, pal.primary, 0.2), i * 0.4);
    }
    const bx = r.range(380, 620);
    // Anyone in this scene rides in the boat (drawn first so the hull hides their legs).
    placePeople(c, [[bx - 30, 486, 120], [bx + 34, 482, 110]], true);
    c.mover('boat', 'bob', [bx, 470], () => {
      c.add(rrect(bx - 3, 360, 6, 104, 2), N.woodDark);
      c.add(`M${bx + 6} 370Q${bx + 50} 410 ${bx + 54} 450L${bx + 6} 452Z`, c.light);
      c.add(`M${bx - 80} 455L${bx + 80} 440Q${bx + 70} 485 ${bx + 40} 492L${bx - 50} 498Q${bx - 72} 488 ${bx - 80} 455Z`, N.woodDark);
      c.add(`M${bx - 70} 470L${bx + 72} 458L${bx + 66} 470L${bx - 64} 482Z`, N.wood);
    });
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 170 + r.range(-20, 20);
      c.mover(`front-wave-${i}`, 'bob', [x, 520], () => crest(c, x, 515, 230, 70, pal.primary, 0.05), 0.3 + i * 0.35);
    }
    c.tone(rrect(0, 560, 1000, 40), pal.primary, 0.05);
  },

  shepherd: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(120, 880), r.range(100, 170), 52);
    clouds(c, 3, 60, 180);
    c.tone(ridgePath(c, 300, 30, 5), pal.primary, 0.78);
    c.tone(ridgePath(c, 370, 30, 4), pal.primary, 0.58);
    roundTree(c, r.range(80, 260), 380, 150, pal.primary, 0.35);
    c.tone(ridgePath(c, 430, 20, 4), pal.primary, 0.4);
    grassTufts(c, 14, 440, 590, c.dark, 0.12);
    const flock = r.int(3, 5);
    const spots: Pt[] = [];
    for (let i = 0; i < flock; i++) {
      let p: Pt = [0, 0];
      for (let k = 0; k < 10; k++) {
        p = [r.range(140, 900), r.range(450, 560)];
        if (spots.every((q) => Math.hypot(q[0] - p[0], (q[1] - p[1]) * 2) > 140) && (c.people.length === 0 || Math.abs(p[0] - 300) > 110)) break;
      }
      spots.push(p);
    }
    spots.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of spots) sheep(c, x, y, 0.85 + (y - 450) / 300, r.chance(0.4));
    placePeople(c, [[300, 580, 250], [180, 560, 230]]);
    birds(c, 2, 300, 800, 80, 160);
  },

  'tree-river': (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(600, 900), r.range(90, 150), 50);
    clouds(c, 2, 70, 150);
    c.tone(ridgePath(c, 300, 22, 5), pal.primary, 0.75);
    c.tone(ridgePath(c, 350, 18, 4), pal.primary, 0.55);
    // River winding from the horizon to the bottom edge.
    const s = r.pick([-1, 1]);
    const riverL: Pt[] = [[600, 360], [640 + s * 40, 400], [560 - s * 60, 460], [600 + s * 70, 530], [500, 600]];
    const riverR: Pt[] = [[630, 360], [690 + s * 40, 400], [660 - s * 60, 460], [790 + s * 70, 530], [860, 600]];
    const river = curve(riverL) + curve([...riverR].reverse()).replace(/^M/, 'L') + 'Z';
    c.add(river, c.light);
    c.add(river, pal.primary, 0.4);
    c.glow(curve([[620, 380], [660 + s * 40, 410], [610 - s * 60, 470]]), 0);
    waveDashes(c, 6, 420, 580, c.light, 0.5, !c.people.length);
    // Big fruitful tree by the water.
    const tx = r.range(230, 360);
    c.add(capsule([tx, 520], [tx, 300], 22, 15), N.woodDark);
    c.add(capsule([tx, 380], [tx - 70, 300], 10, 7) + capsule([tx, 360], [tx + 70, 290], 10, 7), N.woodDark);
    const cy = 230;
    c.tone(circle(tx - 90, cy + 30, 80) + circle(tx + 90, cy + 30, 80) + circle(tx, cy - 20, 110) + circle(tx - 40, cy + 70, 70) + circle(tx + 50, cy + 70, 70), pal.primary, 0.15);
    c.shade(circle(tx + 90, cy + 40, 70) + circle(tx + 50, cy + 80, 60), 0.08);
    c.glow(circle(tx - 50, cy - 60, 40), 0.18);
    for (let i = 0; i < 10; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(0.2, 1) * 90;
      c.add(circle(tx + Math.cos(a) * d * 1.4, cy + 10 + Math.sin(a) * d * 0.8, 10), pal.accent);
    }
    c.add(curve([[tx - 60, 525], [tx - 20, 510], [tx + 40, 512], [tx + 70, 526]], [[tx + 70, 530], [tx - 60, 530]]), N.woodDark);
    placePeople(c, [[tx + 160, 560, 220], [tx - 140, 565, 220]]);
    grassTufts(c, 10, 500, 590, c.dark, 0.14);
    birds(c, 3, 450, 950, 80, 200);
  },

  garden: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(100, 900), r.range(90, 140), 50);
    clouds(c, 2, 60, 160);
    c.tone(ridgePath(c, 320, 20, 5), pal.primary, 0.75);
    for (let i = 0; i < 4; i++) roundTree(c, 80 + i * 280 + r.range(-40, 40), 380, r.range(140, 200), pal.primary, 0.45);
    c.tone(rrect(0, 380, 1000, 220), pal.primary, 0.4);
    // Path through the garden.
    c.add(curve([[470, 380], [520, 430], [430, 500], [520, 600]], [[700, 600], [600, 500], [560, 430], [500, 380]]), c.light, 0.8);
    for (let i = 0; i < 5; i++) bush(c, r.range(30, 970), r.range(410, 450), r.range(90, 140), pal.primary, 0.25);
    placePeople(c, [[600, 560, 230], [380, 570, 230]]);
    const petals = [pal.accent, pal.highlight, c.light];
    for (let i = 0; i < 22; i++) {
      const x = r.range(20, 980);
      if (x > 400 && x < 680 && c.people.length) continue;
      flower(c, x, r.range(480, 590), r.range(30, 60), r.pick(petals), pal.primary);
    }
    c.mover('butterfly', 'float', [700, 300], () => {
      c.add(ellipse(690, 300, 14, 10) + ellipse(712, 300, 14, 10), pal.accent);
      c.add(capsule([701, 292], [701, 310], 2.5), c.dark);
    }, 0.5);
  },

  desert: (c) => {
    const { pal, r } = c;
    sky(c);
    const sx = r.range(200, 800);
    c.add(rrect(0, 150, 1000, 450), pal.highlight, 0.2);
    sun(c, sx, r.range(170, 250), 90, pal.highlight, false);
    c.tone(ridgePath(c, 360, 30, 4), pal.accent, 0.75, pal.highlight);
    c.tone(ridgePath(c, 420, 40, 3), pal.accent, 0.6, pal.highlight);
    if (r.chance(0.7)) {
      const tx = r.range(120, 880);
      c.add(roundPoly([[tx - 60, 430], [tx, 380], [tx + 60, 430]], 8), c.light);
      c.add(roundPoly([[tx - 12, 430], [tx, 398], [tx + 12, 430]], 4), c.dark, 0.5);
    }
    c.tone(ridgePath(c, 480, 36, 3), pal.accent, 0.45, pal.highlight);
    palmTree(c, r.range(60, 220), 520, 220, pal.primary, 1);
    palmTree(c, r.range(780, 940), 530, 260, pal.primary, -1);
    placePeople(c, [[r.range(380, 460), 565, 220], [r.range(560, 640), 570, 220]]);
    c.tone(ridgePath(c, 545, 16, 3), pal.accent, 0.3, pal.highlight);
    birds(c, 2, 200, 800, 70, 150);
  },

  'night-sky': (c) => {
    const { pal, r } = c;
    sky(c, true);
    const mx = r.range(150, 850);
    const my = r.range(100, 170);
    stars(c, 45, 330, [[mx, my, 110]]);
    moon(c, mx, my, 55);
    if (r.chance(0.6)) {
      const x = r.range(200, 700);
      c.mover('shooting-star', 'drift', [x, 80], () => {
        c.add(capsule([x, 80], [x + 120, 40], 1, 3), pal.highlight, 0.6);
        c.add(sparkle(x, 80, 10), pal.highlight);
      });
    }
    const far = ridgePath(c, 400, 30, 5);
    c.add(far, c.isDark ? pal.surface : pal.primary, c.isDark ? 0.9 : 0.6);
    c.add(far, c.isDark ? pal.primary : c.dark, c.isDark ? 0.12 : 0.35);
    const hill = ridgePath(c, 470, 26, 4);
    c.add(hill, c.isDark ? pal.surface : pal.primary);
    c.add(hill, c.dark, c.isDark ? 0.2 : 0.55);
    // A little house with a warm window.
    const hx = r.range(620, 880);
    c.add(rrect(hx, 410, 90, 60, 4), c.dark, 0.85);
    c.add(roundPoly([[hx - 12, 414], [hx + 45, 370], [hx + 102, 414]], 6), c.dark);
    c.mover('window', 'blink', [hx + 45, 440], () => c.add(rrect(hx + 32, 428, 26, 22, 3), pal.highlight), 0.5);
    for (let i = 0; i < 4; i++) pineTree(c, r.range(30, 560), r.range(460, 490), r.range(70, 100), c.dark, 0);
    placePeople(c, [[r.range(300, 450), 570, 220], [r.range(480, 560), 575, 200]]);
    const front = ridgePath(c, 550, 14, 3);
    c.add(front, c.isDark ? pal.surface : pal.primary);
    c.add(front, c.dark, c.isDark ? 0.35 : 0.65);
  },

  'empty-tomb': (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(700, 900), r.range(110, 170), 56);
    clouds(c, 2, 60, 150, c.light, 0.9, [600, 200]);
    c.tone(ridgePath(c, 320, 24, 5), pal.primary, 0.78);
    // Rock hillside with the tomb opening.
    const tx = r.range(330, 520);
    const rock = curve([[0, 260], [tx - 200, 200], [tx + 40, 170], [tx + 260, 230], [tx + 420, 330], [1000, 400]], [[1000, 600], [0, 600]]);
    c.tone(rock, pal.muted, 0.55);
    c.shade(curve([[tx + 260, 230], [tx + 420, 330], [1000, 400]], [[1000, 600], [tx + 320, 600]]), 0.06);
    // Opening + light pouring out.
    const door = `M${tx - 70} 470L${tx - 70} 400C${tx - 70} 320 ${tx + 70} 320 ${tx + 70} 400L${tx + 70} 470Z`;
    c.add(door, c.dark, 0.85);
    c.add(`M${tx - 54} 470L${tx - 54} 405C${tx - 54} 340 ${tx + 54} 340 ${tx + 54} 405L${tx + 54} 470Z`, pal.highlight, 0.9);
    c.add(poly([[tx - 54, 470], [tx + 54, 470], [tx + 200, 600], [tx - 180, 600]]), pal.highlight, 0.35);
    rays(c, tx, 400, 90, 260, 9, pal.highlight, 0.25, 0, 180, 180);
    // Rolled stone beside the opening.
    const sx = tx + 150;
    c.add(ellipse(sx + 6, 478, 84, 10), c.dark, 0.15);
    c.add(circle(sx, 400, 78), N.stone);
    c.shade(arcShape(sx, 400, 78, 78, -40, 130), 0.14);
    c.glow(arcShape(sx, 400, 66, 66, 190, 260), 0.3);
    c.shade(arcShape(sx - 6, 396, 40, 40, 200, 320), 0.06);
    c.tone(ridgePath(c, 480, 12, 4), pal.primary, 0.4);
    placePeople(c, [[tx - 230, 560, 230], [tx + 340, 565, 230]]);
    for (let i = 0; i < 9; i++) flower(c, r.range(20, 980), r.range(500, 590), r.range(25, 45), r.pick([pal.accent, pal.highlight, c.light]), pal.primary);
    birds(c, 2, 550, 950, 60, 140);
  },

  city: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(100, 900), r.range(90, 140), 48);
    clouds(c, 3, 50, 160);
    const row = (base: number, hMin: number, hMax: number, t: number, windows: boolean) => {
      let x = -20;
      while (x < 1000) {
        const w = r.range(70, 130);
        const h = r.range(hMin, hMax);
        const top = base - h;
        const roofKind = r.int(0, 3);
        c.tone(rrect(x, top, w - 6, h + 10, 4), pal.primary, t);
        if (roofKind === 1) c.tone(roundPoly([[x, top + 2], [x + (w - 6) / 2, top - 30], [x + w - 6, top + 2]], 4), pal.primary, t);
        if (roofKind === 2) c.tone(rrect(x + w * 0.4, top - 30, 8, 32, 2), pal.primary, t);
        c.shade(rrect(x + (w - 6) * 0.72, top, (w - 6) * 0.28, h + 10, 0), 0.08);
        if (windows)
          for (let wy = top + 18; wy < base - 20; wy += 28)
            for (let wx = x + 12; wx < x + w - 24; wx += 22) if (r.chance(0.55)) c.add(rrect(wx, wy, 10, 14, 2), pal.highlight, 0.85);
        x += w;
      }
    };
    row(420, 120, 260, 0.75, false);
    row(480, 80, 200, 0.45, true);
    // A church spire among the buildings.
    const cx = r.range(200, 800);
    c.tone(rrect(cx - 30, 300, 60, 190, 2) + roundPoly([[cx - 36, 304], [cx, 220], [cx + 36, 304]], 4), pal.primary, 0.3);
    cross(c, cx, 222, 46, pal.highlight);
    c.add(rrect(cx - 12, 330, 24, 34, 12), pal.highlight, 0.9);
    c.tone(rrect(0, 480, 1000, 120), pal.muted, 0.7);
    c.add(rrect(0, 478, 1000, 10), c.light, 0.7);
    for (let i = 0; i < 5; i++) roundTree(c, 60 + i * 220 + r.range(-30, 30), 500, 90, pal.primary, 0.2);
    placePeople(c, [[r.range(260, 400), 575, 240], [r.range(560, 700), 580, 240], [r.range(820, 900), 585, 230]]);
    birds(c, 3, 100, 900, 60, 160);
  },

  rainbow: (c) => {
    const { pal, r } = c;
    sky(c);
    const rx = r.range(420, 580);
    const colors = [pal.accent, pal.highlight, pal.primary, c.light];
    colors.forEach((col, i) => c.add(arcBand(rx, 470, 330 - (i + 1) * 34, 330 - i * 34, 180, 360), col, i === 2 ? 0.65 : 0.9));
    clouds(c, 2, 70, 140, c.light, 0.9, [rx, 200]);
    c.mover('cloud-left', 'drift', [rx - 330, 450], () => c.add(circle(rx - 360, 450, 50) + circle(rx - 300, 440, 60) + circle(rx - 250, 460, 40), c.light), 0.3);
    c.mover('cloud-right', 'drift', [rx + 330, 450], () => c.add(circle(rx + 250, 460, 40) + circle(rx + 300, 440, 60) + circle(rx + 360, 450, 50), c.light), 1.1);
    c.tone(ridgePath(c, 430, 26, 5), pal.primary, 0.6);
    c.tone(ridgePath(c, 490, 24, 4), pal.primary, 0.4);
    placePeople(c, [[rx - 120, 560, 220], [rx + 120, 565, 220]]);
    c.tone(ridgePath(c, 550, 12, 3), pal.primary, 0.22);
    for (let i = 0; i < 8; i++) flower(c, r.range(20, 980), r.range(560, 595), r.range(20, 34), r.pick([pal.accent, pal.highlight, c.light]), pal.primary);
    birds(c, 3, 100, 900, 60, 140);
  },

  church: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.pick([r.range(100, 250), r.range(750, 900)]), r.range(90, 150), 52);
    clouds(c, 2, 60, 150, c.light, 0.9, [500, 160]);
    c.tone(ridgePath(c, 360, 24, 5), pal.primary, 0.78);
    const cx = r.range(440, 560);
    // Steeple + nave + roof.
    c.tone(rrect(cx - 40, 190, 80, 260, 2), c.light, 0, c.light);
    c.shade(rrect(cx + 14, 190, 26, 260, 0), 0.07);
    c.add(roundPoly([[cx - 52, 196], [cx, 110], [cx + 52, 196]], 6), pal.accent);
    cross(c, cx, 112, 60, pal.accent);
    c.add(rrect(cx - 15, 220, 30, 40, 15), pal.highlight);
    c.mover('bell', 'sway', [cx, 222], () => c.add(arcShape(cx, 248, 11, 16, 180, 360) + rrect(cx - 13, 246, 26, 5, 2), N.gold), 0);
    c.tone(rrect(cx - 170, 300, 340, 180, 4), c.light, 0, c.light);
    c.shade(rrect(cx - 170, 300, 340, 180, 4), 0.04);
    c.add(roundPoly([[cx - 190, 306], [cx - 120, 250], [cx + 120, 250], [cx + 190, 306]], 6), pal.accent);
    c.shade(roundPoly([[cx - 190, 306], [cx - 120, 250], [cx + 120, 250], [cx + 190, 306]], 6), 0.1);
    c.tone(rrect(cx - 40, 190, 80, 120, 2), c.light, 0, c.light);
    c.add(roundPoly([[cx - 52, 196], [cx, 110], [cx + 52, 196]], 6), pal.accent);
    c.add(circle(cx, 260, 24), pal.highlight);
    c.add(capsule([cx, 240], [cx, 280], 2.2) + capsule([cx - 20, 260], [cx + 20, 260], 2.2), c.light, 0.8);
    c.add(`M${cx - 34} 480L${cx - 34} 390C${cx - 34} 350 ${cx + 34} 350 ${cx + 34} 390L${cx + 34} 480Z`, N.woodDark);
    c.add(capsule([cx, 360], [cx, 478], 1.6), c.dark, 0.4);
    for (const s of [-1, 1]) for (const k of [0, 1]) c.add(`M${cx + s * (80 + k * 50) - 14} 420L${cx + s * (80 + k * 50) - 14} 360C${cx + s * (80 + k * 50) - 14} 336 ${cx + s * (80 + k * 50) + 14} 336 ${cx + s * (80 + k * 50) + 14} 360L${cx + s * (80 + k * 50) + 14} 420Z`, pal.highlight, 0.95);
    c.tone(rrect(0, 480, 1000, 120), pal.primary, 0.45);
    c.add(curve([[cx - 34, 480], [cx - 60, 540], [cx - 110, 600]], [[cx + 110, 600], [cx + 60, 540], [cx + 34, 480]]), c.light, 0.85);
    roundTree(c, cx - r.range(280, 360), 490, 200, pal.primary, 0.2);
    roundTree(c, cx + r.range(280, 360), 495, 220, pal.primary, 0.25);
    for (let i = 0; i < 4; i++) bush(c, r.pick([r.range(40, cx - 140), r.range(cx + 140, 960)]), 500, r.range(60, 90), pal.primary, 0.1);
    placePeople(c, [[cx - 170, 570, 210], [cx + 170, 572, 210], [cx + 270, 580, 200]]);
    birds(c, 3, 100, 900, 50, 140);
  },

  table: (c) => {
    const { pal, r } = c;
    // Interior wall with a warm window.
    c.add(rrect(0, 0, 1000, 600), pal.softer);
    c.add(rrect(0, 0, 1000, 600), pal.highlight, 0.08);
    const wx = r.range(160, 760);
    c.add(rrect(wx, 60, 220, 220, 110), pal.highlight, 0.35);
    c.add(rrect(wx + 16, 76, 188, 188, 94), pal.highlight, 0.55);
    c.add(rrect(wx + 107, 76, 6, 188, 0) + rrect(wx + 16, 160, 188, 6, 0), c.light, 0.9);
    rays(c, wx + 110, 170, 110, 520, 7, pal.highlight, 0.12, 0, 110, 35);
    c.shade(rrect(0, 330, 1000, 270), 0.05);
    placePeople(c, [[r.range(220, 340), 600, 470, 130], [r.range(660, 780), 600, 470, 130]], true);
    // Table.
    c.add(rrect(-20, 380, 1040, 40, 10), N.wood);
    c.add(rrect(-20, 410, 1040, 190, 0), N.woodDark);
    c.add(rrect(-20, 380, 1040, 12, 6), N.light, 0.18);
    c.add(rrect(140, 384, 720, 24, 12), c.light, 0.9);
    // Bread loaf.
    const bx = r.range(300, 420);
    c.add(ellipse(bx, 382, 100, 10), c.dark, 0.12);
    c.add(`M${bx - 92} 380C${bx - 96} 330 ${bx - 50} 300 ${bx} 300C${bx + 50} 300 ${bx + 96} 330 ${bx + 92} 380Z`, N.bread);
    c.shade(`M${bx - 92} 380C${bx - 94} 360 ${bx - 70} 352 ${bx} 352C${bx + 70} 352 ${bx + 94} 360 ${bx + 92} 380Z`, 0.08);
    for (let i = -1; i <= 1; i++) c.add(capsule([bx + i * 36 - 10, 330], [bx + i * 36 + 12, 316], 4), N.wool, 0.55);
    // Cup.
    const cx = r.range(560, 680);
    c.add(ellipse(cx, 382, 50, 8), c.dark, 0.12);
    c.add(rrect(cx - 40, 370, 80, 12, 6), N.gold);
    c.add(capsule([cx, 372], [cx, 320], 7), N.gold);
    c.add(`M${cx - 52} 250L${cx + 52} 250C${cx + 52} 300 ${cx + 30} 326 ${cx} 326C${cx - 30} 326 ${cx - 52} 300 ${cx - 52} 250Z`, N.gold);
    c.add(ellipse(cx, 250, 52, 9), pal.accent);
    c.shade(`M${cx + 10} 254L${cx + 52} 254C${cx + 52} 300 ${cx + 30} 326 ${cx} 326C${cx + 20} 310 ${cx + 14} 290 ${cx + 10} 254Z`, 0.12);
    c.glow(capsule([cx - 34, 266], [cx - 26, 300], 5), 0.4);
    // Grapes.
    const gx = r.chance(0.5) ? r.range(160, 220) : r.range(780, 860);
    let grapes = '';
    for (const [dx, dy] of [[0, 0], [18, 0], [36, 0], [9, 16], [27, 16], [18, 32], [-9, -16], [45, -16]] as const) grapes += circle(gx + dx, 340 + dy, 11);
    c.add(grapes, pal.accent);
    c.glow(circle(gx - 3, 336, 4) + circle(gx + 15, 336, 4), 0.4);
    c.add(capsule([gx + 18, 326], [gx + 22, 312], 3), N.woodDark);
    c.add(ellipse(gx + 34, 314, 14, 6), pal.primary);
    // Candle.
    const kx = r.range(470, 520);
    c.add(rrect(kx - 10, 300, 20, 80, 4), c.light);
    c.shade(rrect(kx + 3, 300, 7, 80, 2), 0.06);
    c.mover('flame', 'blink', [kx, 296], () => {
      c.add(circle(kx, 282, 30), pal.highlight, 0.25);
      c.add(`M${kx} 262C${kx + 10} 276 ${kx + 9} 296 ${kx} 298C${kx - 9} 296 ${kx - 10} 276 ${kx} 262Z`, N.gold);
      c.add(`M${kx} 276C${kx + 5} 284 ${kx + 4} 294 ${kx} 295C${kx - 4} 294 ${kx - 5} 284 ${kx} 276Z`, c.light);
    });
  },

  'open-door': (c) => {
    const { pal, r } = c;
    c.add(rrect(0, 0, 1000, 600), pal.soft);
    c.add(rrect(0, 0, 1000, 600), c.dark, 0.18);
    const dx = r.range(380, 620);
    // Floor.
    c.add(rrect(0, 470, 1000, 130), c.dark, 0.18);
    // Light spilling out of the doorway onto the floor.
    rays(c, dx, 300, 120, 600, 12, pal.highlight, 0.12);
    c.add(poly([[dx - 90, 480], [dx + 90, 480], [dx + 330, 600], [dx - 260, 600]]), pal.highlight, 0.45);
    c.add(rrect(dx - 110, 110, 220, 380, 8), N.woodDark);
    c.add(rrect(dx - 92, 126, 184, 354, 4), pal.highlight);
    c.glow(rrect(dx - 92, 126, 184, 354, 4), 0.35);
    // Beyond the door: a sunlit path and hills.
    c.add(curve([[dx - 92, 380], [dx - 30, 360], [dx + 40, 372], [dx + 92, 350]], [[dx + 92, 480], [dx - 92, 480]]), pal.primary, 0.3);
    c.add(poly([[dx - 10, 400], [dx + 10, 400], [dx + 50, 480], [dx - 50, 480]]), c.light, 0.8);
    sun(c, dx + 20, 250, 40, c.light, false);
    // The open door leaf (perspective).
    c.add(poly([[dx + 92, 126], [dx + 190, 96], [dx + 190, 520], [dx + 92, 480]]), N.wood);
    c.add(poly([[dx + 108, 160], [dx + 172, 142], [dx + 172, 290], [dx + 108, 300]]), N.woodDark, 0.35);
    c.add(poly([[dx + 108, 330], [dx + 172, 326], [dx + 172, 470], [dx + 108, 456]]), N.woodDark, 0.35);
    c.add(circle(dx + 120, 320, 7), N.gold);
    c.add(rrect(dx - 110, 470, 220, 14, 4), N.woodDark);
    // Motes of light drifting in the doorway glow.
    for (let i = 0; i < 6; i++) {
      const mx = dx + r.range(-160, 220);
      const my = r.range(150, 460);
      c.mover(`mote-${i}`, 'float', [mx, my], () => c.add(sparkle(mx, my, r.range(6, 11)), pal.highlight, 0.9), i * 0.5);
    }
    placePeople(c, [[dx - 220, 560, 320], [dx - 360, 565, 300]]);
    for (const x of [dx - 300, dx + 300]) if (x > 60 && x < 940 && !c.people.length) bush(c, x, 480, 110, pal.primary, 0.2);
  },

  lighthouse: (c) => {
    const { pal, r } = c;
    sky(c, true);
    const lx = r.chance(0.5) ? r.range(640, 780) : r.range(220, 360);
    stars(c, 26, 330, [[lx, 150, 120], [lx, 300, 90]]);
    const dir = lx > 500 ? -1 : 1;
    c.mover('beam', 'sway', [lx, 150], () => {
      c.add(poly([[lx, 140], [lx + dir * 520, 60], [lx + dir * 520, 240], [lx, 166]]), pal.highlight, 0.35);
      c.add(poly([[lx, 140], [lx - dir * 260, 110], [lx - dir * 260, 190], [lx, 166]]), pal.highlight, 0.18);
    });
    c.add(circle(lx, 152, 60), pal.highlight, 0.2);
    waterBands(c, 400, pal.primary);
    c.add(rrect(0, 400, 1000, 200), c.dark, 0.35);
    // Rocks.
    c.add(blob([[lx - 180, 470], [lx - 120, 400], [lx - 20, 380], [lx + 90, 390], [lx + 170, 430], [lx + 200, 480], [lx, 500]]), pal.muted);
    c.shade(blob([[lx - 180, 470], [lx - 60, 440], [lx + 90, 450], [lx + 200, 480], [lx, 500]]), 0.25);
    // Tower.
    const tower = poly([[lx - 50, 410], [lx - 34, 180], [lx + 34, 180], [lx + 50, 410]]);
    c.add(tower, c.light);
    for (let i = 0; i < 3; i++) {
      const y0 = 210 + i * 66;
      const t0 = (y0 - 180) / 230;
      const t1 = (y0 + 30 - 180) / 230;
      const w0 = 34 + 16 * t0;
      const w1 = 34 + 16 * t1;
      c.add(poly([[lx - w0, y0], [lx + w0, y0], [lx + w1, y0 + 30], [lx - w1, y0 + 30]]), pal.accent);
    }
    c.shade(poly([[lx + 8, 410], [lx + 6, 180], [lx + 34, 180], [lx + 50, 410]]), 0.14);
    c.add(rrect(lx - 46, 168, 92, 14, 4), c.dark, 0.8);
    c.add(rrect(lx - 26, 128, 52, 42, 4), pal.highlight);
    c.add(capsule([lx, 130], [lx, 168], 2), c.dark, 0.5);
    c.add(roundPoly([[lx - 36, 132], [lx, 98], [lx + 36, 132]], 5), pal.accent);
    c.add(rrect(lx - 12, 360, 24, 50, 12), c.dark, 0.7);
    placePeople(c, [[lx - 110, 452, 120], [lx + 105, 458, 115]]);
    waveDashes(c, 14, 430, 590, c.light, 0.35, !c.people.length);
    sailboatSmall(c, lx + dir * r.range(300, 380), 455);
  },

  'field-seeds': (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(150, 850), r.range(90, 150), 54);
    clouds(c, 3, 60, 170);
    c.tone(ridgePath(c, 300, 22, 5), pal.primary, 0.75);
    // Ploughed field: perspective furrows.
    c.add(rrect(0, 330, 1000, 270), N.kraft);
    c.add(rrect(0, 330, 1000, 270), pal.accent, 0.12);
    for (let i = 0; i < 9; i++) {
      const y = 340 + i * i * 3.4 + i * 4;
      c.add(capsule([0, y], [1000, y], 1.5 + i * 0.7), N.woodDark, 0.35);
    }
    // Sprouts at different stages growing left → right.
    const n = r.int(7, 10);
    for (let i = 0; i < n; i++) {
      const x = 70 + (860 * i) / (n - 1) + r.range(-20, 20);
      const row = r.int(3, 8);
      const y = 340 + row * row * 3.4 + row * 4;
      const s = 0.9 + row * 0.16;
      const stage = Math.min(3, Math.floor((i / n) * 4));
      c.add(ellipse(x, y, 16 * s, 5 * s), N.woodDark, 0.6);
      if (stage === 0) {
        c.add(ellipse(x, y - 4 * s, 6 * s, 4.5 * s), N.bread);
        continue;
      }
      const h = [0, 14, 24, 34][stage]! * s;
      const leaf = (k: number, ly: number, size: number) =>
        `M${x} ${ly}C${x + k * 4 * size} ${ly - 12 * size} ${x + k * 16 * size} ${ly - 16 * size} ${x + k * 22 * size} ${ly - 13 * size}C${x + k * 20 * size} ${ly - 4 * size} ${x + k * 10 * size} ${ly + 1 * size} ${x} ${ly}Z`;
      c.add(capsule([x, y], [x, y - h], 2.4 * s), pal.primary);
      c.add(leaf(-1, y - h, s * (0.7 + stage * 0.15)) + leaf(1, y - h, s * (0.7 + stage * 0.15)), pal.primary);
      c.glow(leaf(-1, y - h, s * (0.7 + stage * 0.15)), 0.18);
      if (stage >= 2) c.add(leaf(1, y - h * 0.45, s * 0.6), pal.primary);
      if (stage === 3) c.add(leaf(-1, y - h * 0.6, s * 0.6), pal.primary);
    }
    placePeople(c, [[r.range(380, 620), 585, 250], [r.range(700, 800), 590, 240]]);
    birds(c, 4, 100, 900, 60, 200);
  },

  well: (c) => {
    const { pal, r } = c;
    sky(c);
    sun(c, r.range(100, 900), r.range(90, 150), 54);
    clouds(c, 2, 60, 150);
    c.tone(ridgePath(c, 330, 24, 5), pal.accent, 0.72, pal.highlight);
    c.tone(ridgePath(c, 400, 20, 4), pal.accent, 0.58, pal.highlight);
    palmTree(c, r.range(60, 200), 430, 230, pal.primary, 1);
    if (r.chance(0.6)) palmTree(c, r.range(820, 950), 440, 200, pal.primary, -1);
    c.tone(rrect(0, 430, 1000, 170), pal.accent, 0.48, pal.highlight);
    const wx = r.range(420, 580);
    // Posts, roof, crank, rope, bucket.
    c.add(rrect(wx - 104, 270, 16, 210, 4) + rrect(wx + 88, 270, 16, 210, 4), N.woodDark);
    c.add(roundPoly([[wx - 140, 290], [wx, 210], [wx + 140, 290]], 10), pal.accent);
    c.shade(roundPoly([[wx, 210], [wx + 140, 290], [wx, 290]], 6), 0.1);
    c.add(capsule([wx - 96, 310], [wx + 96, 310], 6), N.wood);
    c.add(capsule([wx + 4, 314], [wx + 4, 360], 1.6), N.woodDark);
    c.mover('bucket', 'sway', [wx + 4, 314], () => {
      c.add(capsule([wx + 4, 314], [wx + 4, 360], 1.6), N.woodDark);
      c.add(roundPoly([[wx - 16, 360], [wx + 24, 360], [wx + 20, 392], [wx - 12, 392]], 4), N.wood);
      c.add(rrect(wx - 18, 358, 44, 8, 3), N.woodDark);
    });
    // Stone drum.
    c.add(rrect(wx - 120, 400, 240, 110, 14), N.stone);
    c.add(ellipse(wx, 400, 120, 24), N.stone);
    c.add(ellipse(wx, 400, 100, 16), c.dark, 0.6);
    c.add(ellipse(wx, 404, 80, 10), pal.primary, 0.5);
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 4; k++) c.add(rrect(wx - 112 + k * 56 + (row % 2) * 28 - (row % 2 && k === 3 ? 28 : 0), 424 + row * 28, 50, 22, 8), N.light, 0.12);
    c.shade(rrect(wx + 40, 400, 80, 110, 14), 0.1);
    placePeople(c, [[wx - 210, 560, 240], [wx + 210, 565, 240]]);
    for (let i = 0; i < 6; i++) c.add(ellipse(r.range(20, 980), r.range(520, 590), r.range(14, 26), 8), N.stone, 0.7);
    birds(c, 2, 200, 800, 60, 150);
  },

  manger: (c) => {
    const { pal, r } = c;
    sky(c, true);
    const sx = r.range(380, 620);
    stars(c, 34, 260, [[sx, 90, 120]]);
    c.add(poly([[sx - 6, 100], [sx + 6, 100], [sx + 110, 330], [sx - 110, 330]]), pal.highlight, 0.16);
    bigStar(c, sx, 90, 34);
    const far = ridgePath(c, 430, 20, 4);
    c.add(far, c.isDark ? pal.surface : pal.primary, c.isDark ? 1 : 0.5);
    c.add(far, c.isDark ? pal.primary : c.dark, c.isDark ? 0.1 : 0.3);
    // Stable.
    const bx = sx + r.range(-60, 60);
    c.add(rrect(bx - 200, 290, 400, 220, 6), N.woodDark);
    c.add(rrect(bx - 180, 310, 360, 200, 4), c.dark, 0.6);
    c.add(rrect(bx - 180, 310, 360, 200, 4), pal.highlight, 0.18);
    for (let i = 0; i < 6; i++) c.add(rrect(bx - 180 + i * 62, 310, 3, 200, 1), N.wood, 0.4);
    c.add(roundPoly([[bx - 250, 310], [bx, 220], [bx + 250, 310]], 12), N.wood);
    c.add(roundPoly([[bx - 250, 310], [bx, 220], [bx + 250, 310]], 12), pal.accent, 0.25);
    c.shade(roundPoly([[bx, 220], [bx + 250, 310], [bx, 310]], 6), 0.12);
    c.add(rrect(bx - 216, 300, 16, 210, 4) + rrect(bx + 200, 300, 16, 210, 4), N.woodDark);
    // Glow around the manger.
    c.add(circle(bx, 450, 130), pal.highlight, 0.22);
    c.add(circle(bx, 450, 80), pal.highlight, 0.25);
    // Manger with hay and the swaddled baby (simple, no facial detail beyond closed eyes).
    c.add(capsule([bx - 70, 450], [bx - 90, 510], 6) + capsule([bx + 70, 450], [bx + 90, 510], 6), N.woodDark);
    c.add(capsule([bx - 70, 510], [bx + 70, 450], 5) + capsule([bx + 70, 510], [bx - 70, 450], 5), N.woodDark, 0.9);
    let hay = '';
    for (let i = 0; i < 9; i++) hay += capsule([bx - 80 + i * 20, 438], [bx - 88 + i * 20 + r.range(-6, 6), 416 + r.range(-6, 4)], 3);
    c.add(hay, N.gold);
    c.add(ellipse(bx, 432, 54, 18), c.light);
    c.add(ellipse(bx + 10, 428, 32, 14), c.light);
    c.shade(arcShape(bx, 432, 54, 18, 0, 180), 0.08);
    c.add(circle(bx - 40, 424, 14), N.wool);
    c.add(circle(bx - 40, 426, 11), SKIN_FOR_BABY);
    c.stroke(`M${bx - 44} 426Q${bx - 41.5} 428 ${bx - 39} 426`, N.eye, 1.6);
    c.add(roundPoly([[bx - 100, 440], [bx + 100, 440], [bx + 82, 470], [bx - 82, 470]], 6), N.wood);
    c.shade(rrect(bx - 90, 458, 180, 12, 4), 0.12);
    placePeople(c, [[bx - 190, 524, 230], [bx + 190, 526, 230], [bx + 310, 545, 220]]);
    sheep(c, bx + r.pick([-1, 1]) * 300, 520, 1, r.chance(0.5));
    const g = ridgePath(c, 530, 10, 3);
    c.add(g, c.isDark ? pal.surface : pal.primary, c.isDark ? 1 : 0.7);
    c.add(g, c.dark, 0.35);
  },
};

const SKIN_FOR_BABY = SKIN_TONES[1]!;

function sailboatSmall(c: Ctx, x: number, y: number) {
  c.mover('boat', 'bob', [x, y], () => {
    c.add(rrect(x - 2, y - 60, 4, 60, 1), N.woodDark);
    c.add(`M${x + 4} ${y - 56}Q${x + 34} ${y - 30} ${x + 36} ${y - 6}L${x + 4} ${y - 6}Z`, c.light);
    c.add(`M${x - 40} ${y - 4}L${x + 44} ${y - 4}Q${x + 34} ${y + 12} ${x + 24} ${y + 12}L${x - 28} ${y + 12}Q${x - 36} ${y + 8} ${x - 40} ${y - 4}Z`, c.pal.accent);
  });
}

/** Build a scene. Same kind + palette + seed always gives the same picture; other seeds recompose it. */
export function scene(kind: SceneKind, pal: ArtPalette, seed: number, opts: { people?: CharacterSpec[] } = {}): ArtPiece {
  const c = new Ctx(pal, rand(seed * 2654435761 + hashStr(kind))) as SceneCtx;
  c.people = opts.people ?? [];
  (R[kind] ?? R.sunrise)(c);
  if (c.slots) placePeople(c, c.slots, true);
  const piece: ArtPiece = { viewBox: [1000, 600], parts: c.parts };
  if (c.movers.length) piece.movers = c.movers;
  return piece;
}
