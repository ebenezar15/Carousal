// Build the offline Lucide icon library used by the layout engine / editor.
// Reads lucide-static's icon-nodes.json ([tag, attrs][] per icon) + tags.json and converts every
// SVG element (path, circle, ellipse, rect incl. rx/ry, line, polyline, polygon) to SVG path data
// so icons can be drawn with Konva.Path. Output: src/styles/generated/lucide-icons.json (+ license).
// Usage: npm run icons:build
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = dirname(require.resolve('lucide-static/package.json'));
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const nodes = JSON.parse(readFileSync(join(pkgDir, 'icon-nodes.json'), 'utf8'));
const tags = JSON.parse(readFileSync(join(pkgDir, 'tags.json'), 'utf8'));
const outDir = join(root, 'src/styles/generated');

/** Round to 3 decimals and print compactly ("0.5" -> ".5", "-0.5" -> "-.5"). */
const n = (v) => {
  let s = String(Math.round(Number(v) * 1000) / 1000);
  if (s === '-0') s = '0';
  return s.replace(/^(-?)0\./, '$1.');
};
const num = (a, k, d = 0) => (a[k] === undefined ? d : Number(a[k]));

/** Join tokens compactly: commands need no separator; a number needs a space unless it starts with '-'. */
function seq(values) {
  let out = '';
  for (const v of values) {
    const s = typeof v === 'number' ? n(v) : v;
    if (out && typeof v === 'number' && !/[a-zA-Z]$/.test(out) && !s.startsWith('-')) out += ' ';
    out += s;
  }
  return out;
}

function points(str) {
  const p = String(str).trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  return pts;
}

function toPath(tag, a) {
  switch (tag) {
    case 'path':
      return String(a.d).replace(/\s+/g, ' ').replace(/\s*([a-zA-Z])\s*/g, '$1').replace(/ ?, ?/g, ',').trim();
    case 'circle': {
      const cx = num(a, 'cx'), cy = num(a, 'cy'), r = num(a, 'r');
      return seq(['M', cx - r, cy, 'a', r, r, 0, 1, 0, 2 * r, 0, 'a', r, r, 0, 1, 0, -2 * r, 0, 'z']);
    }
    case 'ellipse': {
      const cx = num(a, 'cx'), cy = num(a, 'cy'), rx = num(a, 'rx'), ry = num(a, 'ry');
      return seq(['M', cx - rx, cy, 'a', rx, ry, 0, 1, 0, 2 * rx, 0, 'a', rx, ry, 0, 1, 0, -2 * rx, 0, 'z']);
    }
    case 'rect': {
      const x = num(a, 'x'), y = num(a, 'y'), w = num(a, 'width'), h = num(a, 'height');
      let rx = a.rx !== undefined ? Number(a.rx) : a.ry !== undefined ? Number(a.ry) : 0;
      let ry = a.ry !== undefined ? Number(a.ry) : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return seq(['M', x, y, 'h', w, 'v', h, 'h', -w, 'z']);
      return seq([
        'M', x + rx, y, 'h', w - 2 * rx,
        'a', rx, ry, 0, 0, 1, rx, ry, 'v', h - 2 * ry,
        'a', rx, ry, 0, 0, 1, -rx, ry, 'h', -(w - 2 * rx),
        'a', rx, ry, 0, 0, 1, -rx, -ry, 'v', -(h - 2 * ry),
        'a', rx, ry, 0, 0, 1, rx, -ry, 'z',
      ]);
    }
    case 'line':
      return seq(['M', num(a, 'x1'), num(a, 'y1'), 'L', num(a, 'x2'), num(a, 'y2')]);
    case 'polyline':
    case 'polygon': {
      const pts = points(a.points);
      const parts = [];
      pts.forEach(([x, y], i) => parts.push(i === 0 ? 'M' : 'L', x, y));
      if (tag === 'polygon') parts.push('z');
      return seq(parts);
    }
    default:
      throw new Error(`Unsupported SVG element <${tag}>`);
  }
}

const icons = {};
let elements = 0;
for (const name of Object.keys(nodes).sort()) {
  const d = [];
  for (const [tag, attrs] of nodes[name]) {
    const p = toPath(tag, attrs);
    if (!p) throw new Error(`Empty path for ${name} <${tag}>`);
    d.push(p);
    elements++;
  }
  if (!d.length) throw new Error(`Icon ${name} has no elements`);
  icons[name] = { d, tags: Array.isArray(tags[name]) ? tags[name] : [] };
}

const out = {
  version: pkg.version,
  license: 'ISC',
  source: `lucide@${pkg.version}`,
  viewBox: 24,
  // Every Lucide icon is stroke-only: stroke currentColor, stroke-width 2, round caps/joins, no fill.
  // (A few tiny r=.5/1 "dot" circles are fill=currentColor in the source; stroking at width 2 renders them identically.)
  render: { fill: 'none', strokeWidth: 2, lineCap: 'round', lineJoin: 'round' },
  icons,
};

mkdirSync(outDir, { recursive: true });
const json = JSON.stringify(out);
writeFileSync(join(outDir, 'lucide-icons.json'), json);
copyFileSync(join(pkgDir, 'LICENSE'), join(outDir, 'LUCIDE_LICENSE.txt'));
console.log(`lucide@${pkg.version}: ${Object.keys(icons).length} icons, ${elements} paths, ${(json.length / 1024).toFixed(1)} KiB`);
