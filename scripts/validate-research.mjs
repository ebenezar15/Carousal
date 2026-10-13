#!/usr/bin/env node
// Validates /research data: schema basics, counts, cross-references, contrast, bundled font files.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HEX = /^#[0-9A-Fa-f]{6}$/;

// Platform presets
const { presets } = load('research/platform-presets.json');
const presetIds = new Set();
for (const p of presets) {
  check(!presetIds.has(p.id), `preset duplicate id ${p.id}`); presetIds.add(p.id);
  for (const k of ['platform', 'label', 'width', 'height', 'aspectRatio', 'maxSlides', 'fileFormats', 'safeZone', 'exportKind', 'sources'])
    check(p[k] !== undefined, `preset ${p.id} missing ${k}`);
  check(Number.isInteger(p.width) && Number.isInteger(p.height), `preset ${p.id} non-integer size`);
  check(['images', 'pdf'].includes(p.exportKind), `preset ${p.id} bad exportKind`);
  check(Array.isArray(p.sources) && p.sources.length > 0 && p.sources.every(s => s.url && s.confidence), `preset ${p.id} needs sources with url+confidence`);
}
for (const plat of ['instagram', 'linkedin', 'tiktok', 'facebook', 'x', 'pinterest'])
  check(presets.some(p => p.platform === plat), `no preset for platform ${plat}`);

// Fonts
const fontsJson = load('research/fonts.json');
const fontIds = new Set(fontsJson.fonts.map(f => f.id));
const groupIds = new Set(fontsJson.groups.map(g => g.id));
check(fontsJson.fonts.length >= 60, `need >= 60 fonts, have ${fontsJson.fonts.length}`);
check(fontIds.size === fontsJson.fonts.length, 'duplicate font ids');
const manifestPath = join(root, 'assets/fonts/manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
check(manifest, 'assets/fonts/manifest.json missing (run scripts/fetch-fonts.mjs)');
for (const f of fontsJson.fonts) {
  check(['OFL-1.1', 'Apache-2.0'].includes(f.license), `font ${f.id} license ${f.license} not allowed`);
  check(groupIds.has(f.group), `font ${f.id} unknown group ${f.group}`);
  check(f.weights?.length > 0 && f.weights.length + (f.italics?.length || 0) <= 5, `font ${f.id} weights out of range`);
  if (manifest) {
    const m = manifest.fonts.find(x => x.id === f.id);
    check(m && m.faces.length > 0, `font ${f.id} not bundled`);
    m?.faces.forEach(face => check(existsSync(join(root, 'assets/fonts', face.file)), `font file missing ${face.file}`));
    check(existsSync(join(root, 'assets/fonts', f.id, 'LICENSE')), `font ${f.id} LICENSE missing`);
  }
}
const pairingIds = new Set();
check(fontsJson.pairings.length >= 30, `need >= 30 pairings, have ${fontsJson.pairings.length}`);
for (const p of fontsJson.pairings) {
  pairingIds.add(p.id);
  check(fontIds.has(p.heading) && fontIds.has(p.body), `pairing ${p.id} references unknown font`);
}

// Palettes
const { palettes } = load('research/palettes.json');
const paletteIds = new Set(palettes.map(p => p.id));
check(palettes.length >= 40, `need >= 40 palettes, have ${palettes.length}`);
check(paletteIds.size === palettes.length, 'duplicate palette ids');
for (const p of palettes) {
  const c = p.colors;
  for (const k of ['bg', 'surface', 'text', 'mutedText', 'primary', 'accent', 'highlight']) check(HEX.test(c[k] || ''), `palette ${p.id} bad color ${k}`);
  check(contrast(c.text, c.bg) >= 4.5, `palette ${p.id} text/bg contrast < 4.5`);
  check(contrast(c.mutedText, c.bg) >= 4.5, `palette ${p.id} muted/bg contrast < 4.5`);
  check(contrast(c.text, c.surface) >= 4.5, `palette ${p.id} text/surface contrast < 4.5`);
  check(contrast(c.primary, c.bg) >= 3, `palette ${p.id} primary/bg contrast < 3`);
}

// Styles
const stylesJson = load('research/styles.json');
const layouts = new Set(Object.keys(stylesJson.layoutCatalog));
check(stylesJson.styles.length >= 15, `need >= 15 styles, have ${stylesJson.styles.length}`);
for (const s of stylesJson.styles) {
  s.palettes.forEach(p => check(paletteIds.has(p), `style ${s.id} unknown palette ${p}`));
  [s.fonts, ...(s.altFonts || [])].forEach(fp => Object.values(fp).forEach(id => check(fontIds.has(id), `style ${s.id} unknown font ${id}`)));
  Object.entries(s.roleLayouts).forEach(([role, l]) => check(layouts.has(l), `style ${s.id} role ${role} unknown layout ${l}`));
}
const sigs = new Set(stylesJson.styles.map(s => `${s.fonts.heading}|${s.background.type}|${s.roleLayouts.hook}|${s.layout.alignment}`));
check(sigs.size === stylesJson.styles.length, 'two styles share identical font/background/hook/alignment signature');

// Design patterns
const dp = load('research/design-patterns.json');
for (const r of ['hook', 'intro', 'body', 'list', 'step', 'stat', 'quote', 'comparison', 'summary', 'cta']) check(dp.roles?.[r], `design-patterns missing role ${r}`);

for (const s of stylesJson.styles) Object.keys(dp.roles || {}).forEach(r => check(s.roleLayouts[r], `style ${s.id} has no layout for role ${r}`));

if (errors.length) { console.error(`✗ ${errors.length} problem(s):\n- ` + errors.join('\n- ')); process.exit(1); }
console.log(`✓ research valid: ${presets.length} presets, ${fontsJson.fonts.length} fonts, ${fontsJson.pairings.length} pairings, ${palettes.length} palettes, ${stylesJson.styles.length} styles`);
