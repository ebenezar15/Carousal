// Procedural flat-vector people: rounded shapes, dot eyes, 2–3 tone shading via translucent overlays.
// Built in adult art units (viewBox 200×320, feet on y≈314, facing right); children and flips are
// produced by transforming the finished paths, so every pose works for both.

import type { ArtMover, ArtPalette, ArtPart, ArtPiece, CharacterSpec, Expression, HairStyle, Pose } from './types';
import {
  arcLine,
  arcShape,
  capsule,
  circle,
  ellipse,
  flipX,
  hashStr,
  IDENTITY,
  type Mat,
  mul,
  apply,
  type Pt,
  rand,
  rrect,
  roundPoly,
  blob,
  scaleAt,
  transformPath,
  translate,
} from './geom';
import { contrast } from '@/styles/color';

export const SKIN_TONES: string[] = ['#FBDCC7', '#F1C29D', '#DFA27A', '#C48356', '#9C6641', '#73492F', '#4B3024'];
export const HAIR_COLORS: string[] = ['#1F1A17', '#3B2A20', '#6B4429', '#8E3B1F', '#D6A35A', '#A9A39C', '#E4DED5'];
/** Fixed neutrals used by people and props (shoes, eyes, pages, wood, bread, shading overlays). */
export const NEUTRALS = {
  shoe: '#3A302A',
  eye: '#2B2422',
  blush: '#F0806E',
  page: '#FFFDF7',
  wood: '#B07A4F',
  woodDark: '#7E5236',
  kraft: '#D9B07F',
  bread: '#E2A35C',
  shade: '#1E1830',
  light: '#FFFFFF',
  denim: '#3D5A80',
  charcoal: '#3F4148',
  cream: '#EFE6D2',
  olive: '#7A8450',
  rust: '#B8643A',
  stone: '#A8A29A',
  wool: '#F7F3EA',
  gold: '#F2C14E',
} as const;
export const NEUTRAL_COLORS: string[] = Object.values(NEUTRALS);

const N = NEUTRALS;
const SHADE_OP = 0.15;

type Group = 'body' | 'head';
interface Tagged extends ArtPart {
  g: Group;
}

interface ArmSpec {
  elbow: Pt;
  hand: Pt;
  /** Animated (emitted as a mover pivoting on the shoulder). */
  loop?: ArtMover['loop'];
  phase?: number;
  /** Extended index finger direction. */
  finger?: boolean;
  /** No round hand (hands drawn elsewhere, e.g. praying hands). */
  noHand?: boolean;
}

interface PoseSpec {
  L: ArmSpec;
  R: ArmSpec;
  legs: 'stand' | 'walk' | 'kneel' | 'sit';
  item?: 'book' | 'basket' | 'pray';
  look?: Pt;
  expr: Expression;
}

const SL: Pt = [77, 110];
const SR: Pt = [123, 110];

const HANG_L: ArmSpec = { elbow: [69, 156], hand: [67, 198] };
const HANG_R: ArmSpec = { elbow: [131, 156], hand: [133, 198] };
const PRAY_L: ArmSpec = { elbow: [67, 164], hand: [97, 148], noHand: true };
const PRAY_R: ArmSpec = { elbow: [133, 164], hand: [103, 148], noHand: true };

const POSES: Record<Pose, PoseSpec> = {
  stand: { L: HANG_L, R: HANG_R, legs: 'stand', expr: 'smile' },
  wave: { L: HANG_L, R: { elbow: [157, 84], hand: [163, 40], loop: 'wave' }, legs: 'stand', expr: 'smile' },
  pray: { L: PRAY_L, R: PRAY_R, legs: 'stand', item: 'pray', expr: 'closed' },
  read: { L: { elbow: [70, 160], hand: [64, 176] }, R: { elbow: [130, 160], hand: [136, 176] }, legs: 'stand', item: 'book', look: [3, 4], expr: 'calm' },
  point: { L: HANG_L, R: { elbow: [158, 120], hand: [182, 100], finger: true, loop: 'bob' }, legs: 'stand', expr: 'smile' },
  kneel: { L: PRAY_L, R: PRAY_R, legs: 'kneel', item: 'pray', expr: 'closed' },
  worship: {
    L: { elbow: [54, 80], hand: [42, 38], loop: 'sway' },
    R: { elbow: [146, 80], hand: [158, 38], loop: 'sway', phase: 0.7 },
    legs: 'stand',
    expr: 'closed',
  },
  walk: { L: { elbow: [70, 156], hand: [80, 196], loop: 'sway' }, R: { elbow: [132, 154], hand: [128, 196], loop: 'sway', phase: 1 }, legs: 'walk', expr: 'smile' },
  sit: { L: { elbow: [70, 158], hand: [104, 184] }, R: { elbow: [132, 158], hand: [138, 190] }, legs: 'sit', expr: 'smile' },
  think: { L: { elbow: [80, 160], hand: [126, 156] }, R: { elbow: [140, 150], hand: [114, 96] }, legs: 'stand', look: [3, -3], expr: 'calm' },
  hug: { L: { elbow: [50, 140], hand: [26, 124] }, R: { elbow: [150, 140], hand: [174, 124] }, legs: 'stand', expr: 'smile' },
  carry: { L: { elbow: [70, 160], hand: [66, 180] }, R: { elbow: [130, 160], hand: [134, 180] }, legs: 'stand', item: 'basket', expr: 'smile' },
};

export const POSE_LIST = Object.keys(POSES) as Pose[];
export const HAIR_LIST: HairStyle[] = ['short', 'long', 'bun', 'curly', 'bald', 'scarf', 'braids'];
export const EXPRESSIONS: Expression[] = ['smile', 'calm', 'closed', 'wonder'];

const HEAD: Pt = [100, 58];
const HR = 30;

export function character(spec: CharacterSpec): ArtPiece {
  const P = POSES[spec.pose] ?? POSES.stand;
  const expr = spec.expression ?? P.expr;
  const h = hashStr(`${spec.top}|${spec.bottom}|${spec.hair}|${spec.skin}`);
  const skirt = (spec.hair === 'long' || spec.hair === 'bun' || spec.hair === 'scarf' || spec.hair === 'braids') && h % 3 !== 0;
  const shortSleeve = h % 4 === 1 && spec.hair !== 'scarf';
  const parts: Tagged[] = [];
  const movers: { m: ArtMover; g: Group }[] = [];
  const add = (g: Group, d: string, fill: string, extra: Partial<ArtPart> = {}) => parts.push({ g, d, fill, ...extra });
  const shade = (g: Group, d: string, op = SHADE_OP) => add(g, d, N.shade, { opacity: op });

  // Upper body sits lower when kneeling or sitting.
  const dy = P.legs === 'kneel' ? 52 : P.legs === 'sit' ? 46 : 0;
  const up = (p: Pt): Pt => [p[0], p[1] + dy];

  // --- stool ---------------------------------------------------------------------------------
  if (P.legs === 'sit') {
    add('body', capsule([74, 250], [68, 312], 5), N.woodDark);
    add('body', capsule([126, 250], [132, 312], 5), N.woodDark);
    add('body', capsule([100, 252], [100, 296], 4), N.woodDark);
    add('body', rrect(58, 236, 84, 14, 7), N.wood);
  }

  // --- back hair -----------------------------------------------------------------------------
  hairBack(spec.hair, spec.hairColor, (d, fill, op) => add('head', transformPath(d, translate(0, dy)), fill, op ? { opacity: op } : {}));

  // --- legs ----------------------------------------------------------------------------------
  legs(P.legs, spec, skirt, add, shade);

  // --- torso ---------------------------------------------------------------------------------
  const torso = roundPoly(
    [
      [69, 99],
      [131, 99],
      [137, 194],
      [63, 194],
    ].map((p) => up(p as Pt)),
    18,
  );
  add('body', torso, spec.top);
  // Side shade on the back side of the torso + collar.
  shade('body', torso, 0.1);
  shade('body', roundPoly([up([69, 99]), up([82, 99]), up([78, 194]), up([63, 194])], 10), 0.08);
  if (spec.hair !== 'scarf') {
    add('body', capsule(up([100, 84]), up([100, 100]), 9), spec.skin);
    shade('body', arcShape(100, 100 + dy - 6, 9, 7, 180, 360, false), 0.18);
    add('body', arcShape(100, 99 + dy, 15, 9, 0, 180), spec.skin);
    shade('body', arcShape(100, 99 + dy, 15, 9, 0, 180), 0.08);
  }

  // --- head ----------------------------------------------------------------------------------
  head(spec, expr, P.look ?? [0, 0], (d, fill, extra) => add('head', transformPath(d, translate(0, dy)), fill, extra));

  // --- arms ----------------------------------------------------------------------------------
  const armParts = (S: Pt, a: ArmSpec, back: boolean): ArtPart[] => {
    const out: ArtPart[] = [];
    const E = up(a.elbow);
    const H = up(a.hand);
    const S2 = up(S);
    const sleeveEnd: Pt = shortSleeve ? [S2[0] + (E[0] - S2[0]) * 0.55, S2[1] + (E[1] - S2[1]) * 0.55] : E;
    const skinD = capsule(E, H, 9.5, 8.5) + (shortSleeve ? capsule(S2, E, 10.5, 9.5) : '');
    out.push({ d: skinD, fill: shortSleeve ? spec.skin : spec.top });
    if (!shortSleeve) out[0] = { d: capsule(S2, E, 11.5, 10.5) + capsule(E, H, 10.5, 9.5), fill: spec.top };
    else out.push({ d: capsule(S2, sleeveEnd, 12, 11.5), fill: spec.top });
    if (!a.noHand) {
      let hd = circle(H[0], H[1], 9.5);
      if (a.finger) {
        const dx = H[0] - E[0];
        const dyy = H[1] - E[1];
        const l = Math.hypot(dx, dyy);
        hd += capsule(H, [H[0] + (dx / l) * 15, H[1] + (dyy / l) * 15], 4.2, 3.6);
      }
      out.push({ d: hd, fill: spec.skin });
    }
    if (back) for (const p of [...out]) out.push({ d: p.d, fill: N.shade, opacity: 0.2 });
    // Arms crossing the torso get a soft drop shadow so they read against same-colored clothes.
    if (a.hand[0] > 74 && a.hand[0] < 126 && a.hand[1] > 120) {
      const sh = out.filter((p) => p.fill !== N.shade).map((p) => p.d).join('');
      out.unshift({ d: transformPath(sh, translate(back ? 2 : -2, 3)), fill: N.shade, opacity: 0.16 });
    }
    return out;
  };

  const emitArm = (S: Pt, a: ArmSpec, back: boolean, name: string) => {
    const ps = armParts(S, a, back);
    if (a.loop) movers.push({ m: { name, parts: ps, pivot: up(S), loop: a.loop, phase: a.phase ?? 0 }, g: 'body' });
    else for (const p of ps) parts.push({ ...p, g: 'body' });
  };

  emitArm(SL, P.L, true, 'arm-back');

  if (P.item === 'book') book(up, add);
  if (P.item === 'basket') basket(up, add);
  emitArm(SR, P.R, false, 'arm-front');
  if (P.item === 'pray') {
    const [x, y] = up([100, 146]);
    add('body', `M${x} ${y - 30}C${x + 7} ${y - 22} ${x + 11} ${y - 6} ${x + 10} ${y + 6}C${x + 9} ${y + 13} ${x + 4} ${y + 15} ${x} ${y + 15}C${x - 4} ${y + 15} ${x - 9} ${y + 13} ${x - 10} ${y + 6}C${x - 11} ${y - 6} ${x - 7} ${y - 22} ${x} ${y - 30}Z`, spec.skin);
    shade('body', `M${x} ${y - 30}C${x - 7} ${y - 22} ${x - 11} ${y - 6} ${x - 10} ${y + 6}C${x - 9} ${y + 13} ${x - 4} ${y + 15} ${x} ${y + 15}Z`, 0.16);
  }
  if (P.item === 'book') bookHands(up, P, spec.skin, add);
  if (P.item === 'basket') {
    // Hands grip the rim, drawn over the basket.
    add('body', circle(...up([66, 180]), 9.5) + circle(...up([134, 180]), 9.5), spec.skin);
  }

  // --- child + flip transforms ----------------------------------------------------------------
  let body: Mat = IDENTITY;
  let headM: Mat = IDENTITY;
  if (spec.child) {
    body = scaleAt(0.64, 0.64, 100, 314);
    headM = mul(body, scaleAt(1.32, 1.32, 100, 92 + dy));
  }
  if (spec.flip) {
    body = mul(flipX(200), body);
    headM = mul(flipX(200), headM);
  }
  const tx = (g: Group) => (g === 'head' ? headM : body);
  const out = (p: Tagged): ArtPart => {
    const { g, ...rest } = p;
    return tx(g) === IDENTITY ? rest : { ...rest, d: transformPath(rest.d, tx(g)) };
  };
  const piece: ArtPiece = { viewBox: [200, 320], parts: parts.map(out) };
  if (movers.length)
    piece.movers = movers.map(({ m, g }) => ({
      ...m,
      pivot: apply(tx(g), m.pivot),
      parts: tx(g) === IDENTITY ? m.parts : m.parts.map((p) => ({ ...p, d: transformPath(p.d, tx(g)) })),
    }));
  return piece;
}

type Add = (g: Group, d: string, fill: string, extra?: Partial<ArtPart>) => void;

function legs(kind: PoseSpec['legs'], spec: CharacterSpec, skirt: boolean, add: Add, shade: (g: Group, d: string, op?: number) => void) {
  const pants = spec.bottom;
  const legFill = skirt ? spec.skin : pants;
  const lr = skirt ? 9 : 12.5;
  const shoe = (x: number, y: number, dir = 1) => add('body', rrect(dir > 0 ? x - 11 : x - 19, y - 12, 30, 14, 7), N.shoe);
  if (kind === 'stand') {
    if (!skirt) add('body', rrect(66, 170, 68, 40, 14), pants);
    const back = capsule([87, 186], [86, 302], lr);
    add('body', back, legFill);
    shade('body', back);
    add('body', capsule([113, 186], [114, 302], lr), legFill);
    shoe(86, 314);
    shoe(115, 314);
    if (skirt) add('body', roundPoly([[71, 176], [129, 176], [143, 262], [57, 262]], 12), pants);
  } else if (kind === 'walk') {
    if (!skirt) add('body', rrect(68, 170, 64, 40, 14), pants);
    const back = capsule([94, 190], [86, 246], lr) + capsule([86, 246], [72, 300], lr);
    add('body', back, legFill);
    shade('body', back);
    add('body', capsule([106, 190], [120, 246], lr) + capsule([120, 246], [126, 302], lr), legFill);
    shoe(72, 312);
    shoe(128, 314);
    if (skirt) add('body', roundPoly([[72, 176], [128, 176], [146, 258], [56, 258]], 12), pants);
  } else if (kind === 'kneel') {
    // Side view: thighs straight down to the knees, shins folded back along the ground.
    const t = skirt ? 12 : 13.5;
    const backLeg = capsule([92, 236], [100, 290], t) + capsule([100, 296], [46, 302], 11, 10);
    add('body', backLeg, skirt ? spec.skin : pants);
    shade('body', backLeg);
    add('body', capsule([106, 236], [116, 292], t) + capsule([116, 298], [58, 302], 11.5, 10), skirt ? spec.skin : pants);
    add('body', rrect(30, 296, 26, 16, 8), N.shoe);
    if (skirt) add('body', blob([[70, 224], [130, 222], [134, 284], [124, 304], [84, 304], [66, 260]]), pants);
    else add('body', rrect(74, 222, 54, 34, 14), pants);
  } else {
    // Sitting on a stool, side-view legs pointing the way the character faces.
    const backLeg = capsule([86, 236], [146, 236], 12.5) + capsule([146, 236], [144, 300], 11);
    add('body', backLeg, legFill);
    shade('body', backLeg);
    add('body', capsule([98, 240], [160, 240], 13) + capsule([160, 240], [162, 302], 11.5), legFill);
    add('body', rrect(138, 300, 30, 14, 7), N.shoe);
    add('body', rrect(156, 302, 30, 13, 6.5), N.shoe);
    if (skirt) add('body', blob([[70, 220], [128, 220], [172, 230], [172, 258], [96, 258], [66, 248]]), pants);
    else add('body', rrect(68, 218, 64, 36, 14), pants);
  }
}

function book(up: (p: Pt) => Pt, add: Add) {
  const o = (x: number, y: number) => up([x, y]);
  const P = (pts: [number, number][]) => pts.map(([x, y]) => o(x, y));
  // Cover (slightly larger than the pages), then two curved pages and a spine shadow.
  add('body', roundPoly(P([[54, 160], [100, 168], [146, 160], [148, 190], [100, 197], [52, 190]]), 4), N.woodDark);
  const [a, b] = [o(58, 156), o(100, 163)];
  const [c, d] = [o(56, 186), o(100, 192)];
  const [e, g] = [o(142, 156), o(144, 186)];
  add('body', `M${a[0]} ${a[1]}Q${78} ${a[1] - 4} ${b[0]} ${b[1]}L${d[0]} ${d[1]}Q${78} ${c[1] - 2} ${c[0]} ${c[1]}Z`, N.page);
  add('body', `M${e[0]} ${e[1]}Q${122} ${e[1] - 4} ${b[0]} ${b[1]}L${d[0]} ${d[1]}Q${122} ${g[1] - 2} ${g[0]} ${g[1]}Z`, N.page);
  add('body', `M${e[0]} ${e[1]}Q${122} ${e[1] - 4} ${b[0]} ${b[1]}L${d[0]} ${d[1]}Q${122} ${g[1] - 2} ${g[0]} ${g[1]}Z`, N.shade, { opacity: 0.07 });
  // Text lines.
  for (let i = 0; i < 3; i++) {
    const y = 168 + i * 6;
    add('body', rrect(...o(64, y), 28, 2.4, 1.2), N.stone, { opacity: 0.8 });
    add('body', rrect(...o(108, y), 28, 2.4, 1.2), N.stone, { opacity: 0.8 });
  }
}

function bookHands(up: (p: Pt) => Pt, P: PoseSpec, skin: string, add: Add) {
  add('body', circle(...up(P.L.hand), 9.5) + circle(...up(P.R.hand), 9.5), skin);
}

function basket(up: (p: Pt) => Pt, add: Add) {
  const o = (x: number, y: number) => up([x, y]);
  const [hx, hy] = o(100, 168);
  add('body', arcShape(hx, hy, 30, 26, 180, 360) + arcShape(hx, hy, 24, 20, 360, 180), N.woodDark);
  add('body', circle(...o(84, 166), 11) + circle(...o(104, 162), 12) + circle(...o(120, 168), 10), N.bread);
  add('body', circle(...o(104, 158), 4), N.light, { opacity: 0.3 });
  add('body', roundPoly([o(60, 170), o(140, 170), o(130, 210), o(70, 210)], 8), N.wood);
  add('body', rrect(...o(60, 168), 80, 9, 4.5), N.woodDark);
  for (let i = 0; i < 2; i++) add('body', rrect(...o(68 + i * 1.5, 184 + i * 12), 64 - i * 3, 3, 1.5), N.woodDark, { opacity: 0.45 });
}

type HairAdd = (d: string, fill: string, op?: number) => void;

function hairBack(style: HairStyle, color: string, add: HairAdd) {
  const [cx, cy] = HEAD;
  if (style === 'long') add(blob([[cx - 32, cy - 14], [cx, cy - 34], [cx + 32, cy - 12], [cx + 36, cy + 40], [cx + 30, cy + 76], [cx - 30, cy + 76], [cx - 36, cy + 40]]), color);
  if (style === 'curly') {
    let d = '';
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * (0.9 + (i / 8) * 1.2)) as number;
      d += circle(cx + Math.cos(a) * 30, cy - 4 + Math.sin(a) * 30, 14);
    }
    d += circle(cx - 30, cy + 18, 12) + circle(cx + 30, cy + 14, 11);
    add(d, color);
  }
  if (style === 'scarf') {
    add(ellipse(cx + 1, cy + 2, 38, 40) + roundPoly([[cx - 34, cy + 20], [cx + 36, cy + 20], [cx + 40, cy + 58], [cx, cy + 74], [cx - 40, cy + 58]], 14), color);
    add(roundPoly([[cx - 34, cy + 20], [cx - 10, cy + 30], [cx - 40, cy + 58]], 6), N.shade, SHADE_OP);
  }
  if (style === 'braids') {
    for (const s of [-1, 1]) {
      let d = '';
      for (let i = 0; i < 6; i++) d += ellipse(cx + s * 27, cy + 14 + i * 11, 7.5 - i * 0.4, 7);
      add(d, color);
      add(circle(cx + s * 27, cy + 80, 5), color);
    }
  }
  if (style === 'bun') add(circle(cx - 6, cy - 34, 15), color);
  if (style === 'bald') add(ellipse(cx - 27, cy + 6, 6, 10) + ellipse(cx + 28, cy + 4, 5, 9), color);
}

function head(spec: CharacterSpec, expr: Expression, look: Pt, add: (d: string, fill: string, extra?: Partial<ArtPart>) => void) {
  const [cx, cy] = HEAD;
  const scarf = spec.hair === 'scarf';
  const fx = 5 + look[0];
  const fy = look[1];
  // Back ear (the face turns slightly toward +x).
  if (!scarf && spec.hair !== 'long') {
    add(circle(cx - HR + 3, cy + 6, 7.5), spec.skin);
    add(circle(cx - HR + 3, cy + 6, 4), N.shade, { opacity: 0.12 });
  }
  if (scarf) add(ellipse(cx + 4, cy + 6, 23, 25), spec.skin);
  else add(ellipse(cx, cy, HR - 1, HR), spec.skin);
  // Cheek shading on the far side.
  add(scarf ? arcShape(cx + 4, cy + 6, 23, 25, 100, 200) : arcShape(cx, cy, HR - 1, HR, 95, 215), N.shade, { opacity: 0.08 });

  hairFront(spec.hair, spec.hairColor, (d, fill, op) => add(d, fill, op ? { opacity: op } : {}));

  const ex = cx + fx;
  const ey = cy + 6 + fy;
  const L: Pt = [ex - 11, ey];
  const R: Pt = [ex + 11, ey];
  add(ellipse(L[0] - 3, ey + 9, 6, 3.6) + ellipse(R[0] + 3, ey + 9, 6, 3.6), N.blush, { opacity: 0.4 });
  if (expr === 'closed') {
    for (const p of [L, R]) add(arcLine(p[0], p[1] - 1, 4.6, 3.6, 20, 160), 'none', { stroke: N.eye, strokeWidth: 2.4 });
  } else {
    const r = expr === 'wonder' ? 3.8 : 3.4;
    add(ellipse(L[0], L[1], r, r * 1.15) + ellipse(R[0], R[1], r, r * 1.15), N.eye);
    add(circle(L[0] + 1.2, L[1] - 1.4, 1.1) + circle(R[0] + 1.2, R[1] - 1.4, 1.1), N.light, { opacity: 0.9 });
  }
  // Nose: a tiny soft bump toward the facing side.
  add(ellipse(ex + 2, ey + 6, 2.6, 2.2), N.shade, { opacity: 0.12 });
  const mx = ex + 1;
  const my = ey + 14;
  if (expr === 'smile') add(arcShape(mx, my - 1, 7.5, 6.5, 0, 180), N.eye);
  else if (expr === 'wonder') add(ellipse(mx, my + 1, 3.6, 4.4), N.eye);
  else add(arcLine(mx, my - 3, 5.5, 3.6, 25, 155), 'none', { stroke: N.eye, strokeWidth: 2.4 });
}

function hairFront(style: HairStyle, color: string, add: HairAdd) {
  const [cx, cy] = HEAD;
  const shine = (d: string) => add(d, N.light, 0.18);
  switch (style) {
    case 'short':
      add(`M${cx - 31} ${cy + 8}C${cx - 36} ${cy - 30} ${cx - 8} ${cy - 40} ${cx + 8} ${cy - 34}C${cx + 26} ${cy - 30} ${cx + 36} ${cy - 14} ${cx + 30} ${cy + 2}C${cx + 22} ${cy - 12} ${cx + 4} ${cy - 18} ${cx - 10} ${cy - 14}C${cx - 18} ${cy - 10} ${cx - 22} ${cy - 2} ${cx - 24} ${cy + 8}Z`, color);
      shine(`M${cx - 12} ${cy - 30}C${cx - 2} ${cy - 34} ${cx + 10} ${cy - 32} ${cx + 16} ${cy - 27}C${cx + 6} ${cy - 28} ${cx - 4} ${cy - 27} ${cx - 12} ${cy - 30}Z`);
      break;
    case 'long':
      add(`M${cx - 33} ${cy + 40}C${cx - 40} ${cy - 10} ${cx - 22} ${cy - 36} ${cx + 4} ${cy - 34}C${cx + 30} ${cy - 32} ${cx + 38} ${cy - 6} ${cx + 33} ${cy + 26}C${cx + 26} ${cy + 4} ${cx + 22} ${cy - 10} ${cx + 12} ${cy - 18}C${cx - 4} ${cy - 8} ${cx - 16} ${cy - 6} ${cx - 22} ${cy - 2}C${cx - 24} ${cy + 14} ${cx - 24} ${cy + 30} ${cx - 33} ${cy + 40}Z`, color);
      shine(`M${cx - 18} ${cy - 26}C${cx - 6} ${cy - 32} ${cx + 8} ${cy - 31} ${cx + 18} ${cy - 25}C${cx + 6} ${cy - 27} ${cx - 6} ${cy - 25} ${cx - 18} ${cy - 26}Z`);
      break;
    case 'bun':
      add(`M${cx - 30} ${cy + 4}C${cx - 32} ${cy - 26} ${cx - 10} ${cy - 34} ${cx + 4} ${cy - 32}C${cx + 24} ${cy - 30} ${cx + 34} ${cy - 14} ${cx + 30} ${cy + 2}C${cx + 22} ${cy - 14} ${cx + 4} ${cy - 20} ${cx - 8} ${cy - 18}C${cx - 18} ${cy - 15} ${cx - 25} ${cy - 6} ${cx - 30} ${cy + 4}Z`, color);
      shine(`M${cx - 14} ${cy - 28}C${cx - 4} ${cy - 31} ${cx + 8} ${cy - 30} ${cx + 14} ${cy - 26}C${cx + 4} ${cy - 27} ${cx - 6} ${cy - 26} ${cx - 14} ${cy - 28}Z`);
      break;
    case 'curly': {
      let d = '';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.08 + (i / 6) * 0.84);
        d += circle(cx + 2 + Math.cos(a) * 26, cy - 6 + Math.sin(a) * 24, 10.5);
      }
      add(d, color);
      break;
    }
    case 'braids':
      add(`M${cx - 30} ${cy + 6}C${cx - 32} ${cy - 26} ${cx - 12} ${cy - 34} ${cx + 2} ${cy - 33}C${cx + 22} ${cy - 32} ${cx + 34} ${cy - 16} ${cx + 30} ${cy + 6}C${cx + 26} ${cy - 10} ${cx + 16} ${cy - 18} ${cx + 4} ${cy - 20}L${cx + 2} ${cy - 14}L${cx - 2} ${cy - 20}C${cx - 14} ${cy - 18} ${cx - 26} ${cy - 10} ${cx - 30} ${cy + 6}Z`, color);
      break;
    case 'scarf':
      // Band framing the forehead.
      add(`M${cx - 22} ${cy + 2}C${cx - 18} ${cy - 22} ${cx + 22} ${cy - 24} ${cx + 28} ${cy + 2}C${cx + 18} ${cy - 10} ${cx - 10} ${cy - 12} ${cx - 22} ${cy + 2}Z`, color);
      add(`M${cx - 10} ${cy - 30}C${cx} ${cy - 35} ${cx + 14} ${cy - 34} ${cx + 22} ${cy - 27}C${cx + 10} ${cy - 30} ${cx} ${cy - 29} ${cx - 10} ${cy - 30}Z`, N.light, 0.22);
      break;
    case 'bald':
      add(ellipse(cx - 8, cy - 20, 10, 5), N.light, 0.22);
      break;
  }
}

/** Palette-driven random person: skin, hair and clothes picked deterministically from the seed. */
export function randomCharacter(seed: number, pal: ArtPalette, pose?: Pose): CharacterSpec {
  const r = rand(seed * 7919 + 13);
  const hair = r.pick(HAIR_LIST);
  const clothes = [pal.primary, pal.accent, pal.highlight, pal.muted, N.denim, N.charcoal, N.cream, N.olive, N.rust].filter(
    (c) => c.toUpperCase() !== pal.bg.toUpperCase() && contrast(c, pal.bg) > 1.25,
  );
  const top = r.pick(clothes.length ? clothes : [N.denim]);
  const bottoms = [N.denim, N.charcoal, N.cream, N.olive, pal.primary, pal.muted].filter((c) => c !== top && c.toUpperCase() !== pal.bg.toUpperCase());
  const bottom = r.pick(bottoms);
  const hairColor = hair === 'scarf' ? r.pick([pal.accent, pal.primary, N.olive, N.rust, N.cream].filter((c) => c !== top)) : r.pick(HAIR_COLORS);
  return {
    pose: pose ?? r.pick(POSE_LIST),
    skin: r.pick(SKIN_TONES),
    hair,
    hairColor,
    top,
    bottom,
    flip: r.chance(0.3),
  };
}
