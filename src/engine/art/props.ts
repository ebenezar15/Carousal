// Single-object illustrations (viewBox 100×100): icons with a little more life — 2–3 tones, a soft
// shine, and an animated part where it makes sense (candle flames blink, stars twinkle, bells sway).

import { NEUTRALS as N, SKIN_TONES } from './characters';
import { arcBand, arcShape, capsule, circle, cloud, curve, ellipse, hashStr, heart, poly, rand, roundPoly, rrect, scaleAt, sparkle, star, translate, mul } from './geom';
import { Ctx, cross, rays, roundTree, sailboat, sheep } from './sceneKit';
import type { ArtPalette, ArtPiece, PropKind } from './types';

export const PROP_LIST: PropKind[] = [
  'bible', 'cross', 'dove', 'candle', 'lamp', 'heart', 'bread', 'cup', 'crown', 'sheep', 'star', 'sun', 'cloud', 'tree', 'boat', 'church',
  'door', 'shield', 'hands-praying', 'anchor', 'key', 'seed', 'fish', 'mountain', 'water-drop', 'flame', 'music', 'lightbulb', 'compass',
  'scroll', 'olive-branch', 'bell',
];

const flame = (c: Ctx, x: number, y: number, s: number, name = 'flame') =>
  c.mover(name, 'blink', [x, y], () => {
    c.add(circle(x, y - 8 * s, 14 * s), c.pal.highlight, 0.25);
    c.add(`M${x} ${y - 22 * s}C${x + 9 * s} ${y - 10 * s} ${x + 8 * s} ${y} ${x} ${y}C${x - 8 * s} ${y} ${x - 9 * s} ${y - 10 * s} ${x} ${y - 22 * s}Z`, N.gold);
    c.add(`M${x} ${y - 11 * s}C${x + 4 * s} ${y - 5 * s} ${x + 4 * s} ${y} ${x} ${y}C${x - 4 * s} ${y} ${x - 4 * s} ${y - 5 * s} ${x} ${y - 11 * s}Z`, c.light);
  });

const backdrop = (c: Ctx) => c.add(circle(50, 50, 44), c.pal.soft);

type Draw = (c: Ctx, seed: number) => void;

const P: Record<PropKind, Draw> = {
  bible: (c) => {
    const { pal } = c;
    c.add(rrect(22, 14, 62, 76, 6), c.light);
    c.shade(rrect(22, 14, 62, 76, 6), 0.12);
    c.add(rrect(18, 10, 60, 76, 6), pal.primary);
    c.shade(rrect(18, 10, 10, 76, 4), 0.2);
    c.add(rrect(76, 14, 6, 70, 2), c.light);
    cross(c, 52, 64, 40, N.gold);
    c.add(poly([[60, 84], [68, 84], [68, 96], [64, 92], [60, 96]]), pal.accent);
    c.glow(rrect(32, 14, 40, 4, 2), 0.3);
  },
  cross: (c) => {
    const { pal } = c;
    c.add(circle(50, 46, 40), pal.highlight, 0.25);
    rays(c, 50, 46, 26, 48, 12, pal.highlight, 0.6);
    c.add(ellipse(50, 90, 26, 6), c.dark, 0.12);
    cross(c, 50, 92, 82, pal.primary);
    c.shade(rrect(52, 10, 3.5, 82, 1), 0.15);
    c.glow(rrect(46, 12, 2.5, 18, 1), 0.35);
  },
  dove: (c) => {
    const { pal } = c;
    backdrop(c);
    c.mover('dove', 'float', [50, 50], () => {
      c.add(`M58 34C46 18 30 16 18 20C28 26 36 34 42 46Z`, N.wool);
      c.add(`M58 34C46 18 30 16 18 20C28 26 36 34 42 46Z`, c.dark, 0.08);
      c.add(`M20 58C30 50 44 46 58 46C66 46 72 42 74 36C76 32 82 30 86 34L92 38L86 40C86 54 76 64 60 66C46 68 36 72 26 80C26 72 28 66 32 62Z`, N.wool);
      c.add(`M60 48C70 30 80 18 90 14C88 30 80 46 66 56Z`, N.wool);
      c.add(`M60 48C70 30 80 18 90 14C88 30 80 46 66 56Z`, c.dark, 0.05);
      c.add(circle(80, 36, 2), N.eye);
      c.add(`M86 34L94 36L86 40Z`, N.gold);
      c.add(curve([[92, 38], [86, 48], [76, 54]]), 'none', undefined, { stroke: pal.primary, strokeWidth: 2.2 });
      c.add(ellipse(84, 47, 4, 2) + ellipse(80, 52, 4, 2), pal.primary);
    });
  },
  candle: (c) => {
    const { pal } = c;
    c.add(ellipse(50, 90, 30, 6), c.dark, 0.12);
    c.add(rrect(22, 82, 56, 8, 4), N.gold);
    c.add(rrect(36, 34, 28, 52, 5), c.light);
    c.add(rrect(36, 34, 28, 52, 5), pal.highlight, 0.2);
    c.shade(rrect(54, 34, 10, 52, 4), 0.1);
    c.add(`M36 40C40 40 42 46 41 52C44 48 46 40 50 38L36 38Z`, c.light);
    c.add(capsule([50, 34], [50, 28], 1.2), N.eye);
    flame(c, 50, 28, 1);
  },
  lamp: (c) => {
    const { pal } = c;
    c.add(ellipse(50, 84, 34, 6), c.dark, 0.12);
    // Clay oil lamp: round body, spout, and loop handle.
    c.add(arcBand(16, 66, 4.5, 10, 0, 359.9), pal.accent);
    c.add(`M14 72C14 60 30 52 50 52C66 52 78 56 86 60L92 58C94 62 92 66 86 66C82 76 66 84 48 84C28 84 14 80 14 72Z`, pal.accent);
    c.shade(`M14 72C24 80 40 82 52 82C68 82 82 74 86 66C82 76 66 84 48 84C28 84 14 80 14 72Z`, 0.18);
    c.add(ellipse(48, 56, 12, 4), c.dark, 0.35);
    c.glow(ellipse(36, 62, 10, 3), 0.3);
    flame(c, 88, 56, 1.1);
  },
  heart: (c) => {
    const { pal } = c;
    c.add(heart(50, 54, 84), pal.accent);
    c.shade(`M50 92C64 80 92 62 92 40C80 64 62 78 50 92Z`, 0.12);
    c.glow(ellipse(30, 36, 9, 6), 0.4);
    c.mover('sparkle', 'twinkle', [82, 18], () => c.add(sparkle(82, 18, 8), pal.highlight));
  },
  bread: (c) => {
    c.add(ellipse(50, 80, 40, 7), c.dark, 0.12);
    c.add(`M12 78C8 50 26 32 50 32C74 32 92 50 88 78Z`, N.bread);
    c.shade(`M12 78C10 70 12 64 16 60C30 70 70 70 84 60C88 64 90 70 88 78Z`, 0.1);
    for (const x of [32, 50, 68]) c.add(capsule([x - 6, 54], [x + 6, 44], 3), N.wool, 0.6);
    c.glow(ellipse(36, 40, 10, 4), 0.3);
  },
  cup: (c) => {
    const { pal } = c;
    c.add(ellipse(50, 90, 26, 5), c.dark, 0.12);
    c.add(rrect(30, 84, 40, 7, 3.5), N.gold);
    c.add(capsule([50, 84], [50, 58], 4), N.gold);
    c.add(`M22 16L78 16C78 44 66 60 50 60C34 60 22 44 22 16Z`, N.gold);
    c.add(ellipse(50, 17, 28, 5), pal.accent);
    c.shade(`M56 20L78 20C78 44 66 60 50 60C62 50 60 34 56 20Z`, 0.12);
    c.glow(capsule([31, 24], [34, 42], 3), 0.45);
  },
  crown: (c) => {
    const { pal } = c;
    c.add(roundPoly([[14, 74], [14, 32], [32, 50], [50, 22], [68, 50], [86, 32], [86, 74]], 4), N.gold);
    c.shade(roundPoly([[14, 66], [86, 66], [86, 74], [14, 74]], 2), 0.12);
    c.add(rrect(12, 72, 76, 12, 4), N.gold);
    c.shade(rrect(12, 78, 76, 6, 3), 0.15);
    c.add(circle(14, 30, 5) + circle(50, 20, 5) + circle(86, 30, 5), N.gold);
    c.add(circle(50, 56, 6), pal.accent);
    c.add(circle(30, 62, 4.5) + circle(70, 62, 4.5), pal.primary);
    c.glow(circle(48, 54, 2), 0.6);
  },
  sheep: (c) => {
    backdrop(c);
    sheep(c, 46, 80, 1.3);
  },
  star: (c) => {
    const { pal } = c;
    c.mover('star', 'twinkle', [50, 52], () => {
      c.add(circle(50, 52, 44), pal.highlight, 0.18);
      c.add(star(50, 54, 40, 0.48), pal.highlight);
      c.add(star(50, 54, 40, 0.48), N.gold, 0.35);
      c.glow(star(44, 46, 12, 0.5), 0.4);
    });
    c.mover('sparkle', 'twinkle', [86, 16], () => c.add(sparkle(86, 16, 7), pal.highlight), 0.6);
  },
  sun: (c) => {
    const { pal } = c;
    c.mover('rays', 'spin', [50, 50], () => {
      for (let i = 0; i < 10; i++) {
        const a = (i * 36 * Math.PI) / 180;
        c.add(capsule([50 + Math.cos(a) * 32, 50 + Math.sin(a) * 32], [50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44], 4.2, 3), N.gold);
      }
    });
    c.add(circle(50, 50, 26), pal.highlight);
    c.add(circle(50, 50, 26), N.gold, 0.45);
    c.glow(arcShape(50, 50, 20, 20, 200, 260), 0.5);
  },
  cloud: (c) => {
    backdrop(c);
    c.mover('cloud', 'drift', [50, 54], () => {
      c.add(cloud(50, 52, 78, 1), N.wool);
      c.add(rrect(13, 60, 74, 8, 4), c.dark, 0.06);
    });
  },
  tree: (c) => {
    c.add(ellipse(50, 92, 30, 5), c.dark, 0.12);
    roundTree(c, 50, 92, 86, c.pal.primary, 0, c.pal.accent);
  },
  boat: (c) => {
    c.at(mul(translate(50, 72), scaleAt(0.48, 0.48)), () => {
      c.add(rrect(-110, 6, 220, 10, 5), c.pal.primary, 0.4);
      sailboat(c, 0, 0, 1, c.pal.accent, c.light);
    });
  },
  church: (c) => {
    const { pal } = c;
    c.add(ellipse(50, 92, 40, 5), c.dark, 0.12);
    c.add(rrect(14, 52, 72, 40, 3), c.light);
    c.shade(rrect(14, 52, 72, 40, 3), 0.08);
    c.add(roundPoly([[10, 56], [24, 40], [76, 40], [90, 56]], 3), pal.accent);
    c.add(rrect(38, 30, 24, 62, 2), c.light);
    c.add(roundPoly([[34, 32], [50, 10], [66, 32]], 3), pal.accent);
    cross(c, 50, 12, 14, pal.accent);
    c.add(`M43 92L43 76C43 68 57 68 57 76L57 92Z`, N.woodDark);
    c.add(circle(50, 50, 6), pal.highlight);
    c.add(rrect(21, 62, 9, 14, 4.5) + rrect(70, 62, 9, 14, 4.5), pal.highlight);
  },
  door: (c) => {
    const { pal } = c;
    c.add(poly([[30, 92], [70, 92], [92, 100], [8, 100]]), pal.highlight, 0.5);
    c.add(`M22 94L22 34C22 14 78 14 78 34L78 94Z`, N.woodDark);
    c.add(`M28 92L28 36C28 20 72 20 72 36L72 92Z`, pal.highlight);
    c.add(ellipse(50, 50, 16, 26), c.light, 0.45);
    c.add(poly([[72, 36], [90, 28], [90, 98], [72, 92]]), N.wood);
    c.add(circle(76, 64, 2.5), N.gold);
  },
  shield: (c) => {
    const { pal } = c;
    const d = `M50 8C62 16 74 18 86 18C86 54 76 78 50 94C24 78 14 54 14 18C26 18 38 16 50 8Z`;
    c.add(d, pal.primary);
    c.shade(`M50 8C62 16 74 18 86 18C86 54 76 78 50 94Z`, 0.15);
    c.add(`M50 16C59 22 68 24 78 25C77 54 70 72 50 85C30 72 23 54 22 25C32 24 41 22 50 16Z`, c.light, 0.15);
    cross(c, 50, 74, 50, N.gold);
  },
  'hands-praying': (c, seed) => {
    const { pal } = c;
    const skin = SKIN_TONES[seed % SKIN_TONES.length]!;
    c.add(circle(50, 44, 34), pal.highlight, 0.3);
    // Sleeves.
    c.add(roundPoly([[22, 98], [30, 72], [48, 76], [44, 100]], 6), pal.primary);
    c.add(roundPoly([[78, 98], [70, 72], [52, 76], [56, 100]], 6), pal.primary);
    c.shade(roundPoly([[78, 98], [70, 72], [52, 76], [56, 100]], 6), 0.12);
    // Two hands meeting: left half and right half of a tall leaf.
    c.add(`M50 8C44 14 34 34 32 50C30 64 36 76 50 80Z`, skin);
    c.add(`M50 8C56 14 66 34 68 50C70 64 64 76 50 80Z`, skin);
    c.shade(`M50 8C56 14 66 34 68 50C70 64 64 76 50 80Z`, 0.12);
    c.add(capsule([50, 12], [50, 78], 0.8), c.dark, 0.25);
    // Thumbs resting along the seam.
    c.add(`M50 46C46 50 44 60 46 70C47 74 50 76 50 76Z`, skin);
    c.shade(`M50 46C46 50 44 60 46 70C47 74 50 76 50 76Z`, 0.1);
    c.add(rrect(29, 74, 42, 8, 4), pal.primary);
    c.mover('sparkle', 'twinkle', [82, 18], () => c.add(sparkle(82, 18, 7) + sparkle(18, 26, 5), pal.highlight));
  },
  anchor: (c) => {
    const { pal } = c;
    const col = pal.primary;
    c.add(arcBand(50, 18, 4.5, 10, 0, 359.9), col);
    c.add(capsule([50, 28], [50, 86], 5), col);
    c.add(capsule([32, 38], [68, 38], 4.5), col);
    c.add(`M14 58C16 76 32 90 50 90C68 90 84 76 86 58L78 62C76 74 64 82 50 82C36 82 24 74 22 62Z`, col);
    c.add(poly([[10, 54], [22, 52], [18, 64]]) + poly([[90, 54], [78, 52], [82, 64]]), col);
    c.shade(capsule([52, 28], [52, 86], 2.5), 0.15);
  },
  key: (c) => {
    c.mover('key', 'sway', [30, 30], () => {
      c.add(arcBand(30, 30, 8, 18, 0, 359.9), N.gold);
      c.add(capsule([42, 42], [84, 84], 6), N.gold);
      c.add(capsule([66, 66], [76, 56], 5) + capsule([76, 76], [86, 66], 5), N.gold);
      c.shade(arcShape(30, 30, 18, 18, -20, 120), 0.15);
      c.glow(arcShape(30, 30, 15, 15, 190, 250), 0.5);
    });
  },
  seed: (c) => {
    const { pal } = c;
    c.add(`M6 86C20 70 80 70 94 86Z`, N.woodDark);
    c.add(`M6 86C20 70 80 70 94 86Z`, pal.accent, 0.15);
    c.add(ellipse(40, 80, 12, 8), N.bread);
    c.glow(ellipse(36, 77, 4, 2), 0.4);
    c.mover('sprout', 'sway', [50, 78], () => {
      c.add(capsule([50, 78], [50, 36], 3), pal.primary);
      c.add(`M50 44C40 26 22 24 12 30C18 46 36 52 50 46Z`, pal.primary);
      c.add(`M50 40C58 20 76 14 88 20C84 38 66 46 50 42Z`, pal.primary);
      c.glow(`M50 44C40 26 22 24 12 30C24 32 38 38 50 44Z`, 0.3);
    });
  },
  fish: (c) => {
    const { pal } = c;
    c.mover('fish', 'bob', [50, 50], () => {
      c.add(`M10 50C24 30 52 24 72 40L90 26C88 40 88 60 90 74L72 60C52 76 24 70 10 50Z`, pal.primary);
      c.shade(`M10 50C24 70 52 76 72 60L90 74C88 64 88 58 88 54L72 52C52 64 26 64 10 50Z`, 0.15);
      c.add(circle(26, 46, 3.5), c.light);
      c.add(circle(26, 46, 2), N.eye);
      c.add(`M40 36C46 44 46 56 40 64`, 'none', undefined, { stroke: c.light, strokeWidth: 2.4, opacity: 0.6 });
    });
    c.add(circle(84, 16, 4) + circle(76, 8, 2.5), pal.primary, 0.35);
  },
  mountain: (c) => {
    const { pal } = c;
    c.add(circle(74, 26, 10), pal.highlight);
    c.add(roundPoly([[0, 90], [30, 40], [50, 66], [62, 50], [100, 90]], 4), pal.primary, 0.6);
    c.add(roundPoly([[4, 92], [42, 20], [88, 92]], 5), pal.primary);
    c.shade(roundPoly([[42, 20], [88, 92], [46, 92]], 4), 0.15);
    c.add(roundPoly([[42, 20], [52, 38], [46, 35], [41, 40], [36, 35], [32, 38]], 2), c.light);
  },
  'water-drop': (c) => {
    const { pal } = c;
    c.mover('drop', 'bob', [50, 50], () => {
      c.add(`M50 6C56 22 80 44 80 64C80 82 66 94 50 94C34 94 20 82 20 64C20 44 44 22 50 6Z`, pal.primary);
      c.shade(`M50 94C66 94 80 82 80 64C80 56 76 48 72 42C76 70 64 86 50 94Z`, 0.15);
      c.glow(`M34 62C34 52 40 42 46 36C42 46 40 54 40 64Z`, 0.55);
    });
  },
  flame: (c) => {
    const { pal } = c;
    c.add(circle(50, 58, 40), pal.highlight, 0.2);
    c.mover('flame', 'blink', [50, 90], () => {
      c.add(`M50 6C60 24 82 40 80 64C78 84 64 94 50 94C36 94 20 84 20 64C20 50 28 42 34 34C36 44 40 50 44 52C40 36 42 20 50 6Z`, pal.accent);
      c.add(`M50 36C58 50 68 58 66 72C64 84 58 90 50 90C42 90 34 84 34 72C34 62 42 58 46 50C48 56 50 58 52 58C50 50 50 42 50 36Z`, N.gold);
      c.add(`M50 62C54 68 58 74 56 80C55 86 52 88 50 88C46 88 44 84 44 80C44 74 48 70 50 62Z`, c.light);
    });
  },
  music: (c) => {
    const { pal } = c;
    c.mover('notes', 'bob', [50, 50], () => {
      c.add(ellipse(28, 76, 12, 9) + ellipse(72, 68, 12, 9), pal.primary);
      c.add(rrect(36, 22, 6, 56, 3) + rrect(80, 14, 6, 56, 3), pal.primary);
      c.add(poly([[36, 22], [86, 12], [86, 24], [36, 34]]), pal.primary);
      c.glow(ellipse(24, 73, 4, 2.5) + ellipse(68, 65, 4, 2.5), 0.4);
    });
    c.add(sparkle(14, 26, 6), pal.highlight);
  },
  lightbulb: (c) => {
    const { pal } = c;
    c.mover('glow', 'blink', [50, 40], () => {
      c.add(circle(50, 40, 40), pal.highlight, 0.22);
      rays(c, 50, 40, 34, 46, 8, pal.highlight, 0.9, 0, 220, 160);
    });
    c.add(`M50 10C66 10 76 22 76 36C76 48 66 54 62 64L38 64C34 54 24 48 24 36C24 22 34 10 50 10Z`, pal.highlight);
    c.add(`M50 10C66 10 76 22 76 36C76 48 66 54 62 64L54 64C62 52 70 42 66 26C64 18 58 12 50 10Z`, N.gold, 0.4);
    c.glow(ellipse(38, 30, 5, 8), 0.6);
    c.add(rrect(38, 64, 24, 8, 3) + rrect(40, 72, 20, 8, 3), N.stone);
    c.add(rrect(44, 80, 12, 6, 3), N.charcoal);
    c.add(curve([[44, 62], [44, 46], [50, 42], [56, 46], [56, 62]]), 'none', undefined, { stroke: N.gold, strokeWidth: 2 });
  },
  compass: (c) => {
    const { pal } = c;
    c.add(circle(50, 52, 42), pal.primary);
    c.add(circle(50, 52, 34), c.light);
    c.add(rrect(46, 4, 8, 8, 3), pal.primary);
    for (let i = 0; i < 8; i++) {
      const a = (i * 45 * Math.PI) / 180;
      c.add(capsule([50 + Math.cos(a) * 28, 52 + Math.sin(a) * 28], [50 + Math.cos(a) * 31, 52 + Math.sin(a) * 31], 1.4), c.dark, 0.4);
    }
    c.mover('needle', 'sway', [50, 52], () => {
      c.add(poly([[50, 22], [57, 52], [43, 52]]), pal.accent);
      c.add(poly([[50, 82], [57, 52], [43, 52]]), c.dark, 0.6);
    });
    c.add(circle(50, 52, 4), N.gold);
    c.glow(arcShape(50, 52, 38, 38, 200, 250), 0.25);
  },
  scroll: (c) => {
    c.add(rrect(18, 20, 64, 62, 2), N.kraft);
    c.add(rrect(18, 20, 64, 62, 2), c.light, 0.35);
    for (let i = 0; i < 5; i++) c.add(rrect(28, 32 + i * 9, i === 4 ? 26 : 44, 3, 1.5), N.woodDark, 0.45);
    c.add(capsule([14, 18], [86, 18], 7), N.kraft);
    c.shade(capsule([14, 20], [86, 20], 5), 0.12);
    c.add(capsule([14, 84], [86, 84], 7), N.kraft);
    c.shade(capsule([14, 86], [86, 86], 5), 0.12);
    c.add(circle(10, 18, 5) + circle(90, 18, 5) + circle(10, 84, 5) + circle(90, 84, 5), N.woodDark);
  },
  'olive-branch': (c) => {
    const { pal } = c;
    c.mover('branch', 'sway', [16, 86], () => {
      c.add(curve([[14, 88], [36, 66], [62, 40], [86, 14]]), 'none', undefined, { stroke: N.woodDark, strokeWidth: 3.5 });
      const leaves: [number, number, number][] = [[28, 74, -1], [40, 62, 1], [48, 54, -1], [58, 44, 1], [66, 36, -1], [76, 26, 1], [84, 16, -1]];
      for (const [x, y, s] of leaves) {
        const a = s > 0 ? -1.9 : 0.5;
        const tip: [number, number] = [x + Math.cos(a) * 20, y + Math.sin(a) * 20];
        c.add(`M${x} ${y}Q${(x + tip[0]) / 2 + 6} ${(y + tip[1]) / 2 + 4 * s} ${tip[0]} ${tip[1]}Q${(x + tip[0]) / 2 - 6} ${(y + tip[1]) / 2 - 4 * s} ${x} ${y}Z`, pal.primary);
      }
      c.add(ellipse(36, 74, 5, 6) + ellipse(62, 50, 5, 6), N.olive);
      c.add(ellipse(36, 74, 5, 6) + ellipse(62, 50, 5, 6), c.dark, 0.3);
    });
  },
  bell: (c) => {
    c.add(capsule([50, 6], [50, 14], 4), N.woodDark);
    c.mover('bell', 'sway', [50, 10], () => {
      c.add(circle(50, 84, 7), N.woodDark);
      c.add(`M50 12C66 12 72 26 72 44C72 60 78 70 86 78L14 78C22 70 28 60 28 44C28 26 34 12 50 12Z`, N.gold);
      c.shade(`M58 13C68 18 72 30 72 44C72 60 78 70 86 78L66 78C68 64 68 40 58 13Z`, 0.15);
      c.add(rrect(12, 76, 76, 8, 4), N.gold);
      c.glow(capsule([38, 26], [36, 56], 3), 0.45);
    });
  },
};

/** Build a prop. Seed tweaks small details (skin tone of hands, slight tilt) deterministically. */
export function prop(kind: PropKind, pal: ArtPalette, seed = 0): ArtPiece {
  const r = rand(seed * 40503 + hashStr(kind));
  const c = new Ctx(pal, r);
  (P[kind] ?? P.star)(c, Math.abs(Math.floor(seed)));
  const piece: ArtPiece = { viewBox: [100, 100], parts: c.parts };
  if (c.movers.length) piece.movers = c.movers;
  return piece;
}
