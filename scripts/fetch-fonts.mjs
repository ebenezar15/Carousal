#!/usr/bin/env node
// Bundles the fonts listed in research/fonts.json into assets/fonts/ for offline use.
// Source: @fontsource/<id> npm packages (same OFL/Apache files as Google Fonts).
// Output: assets/fonts/<id>/<subset>-<weight>-<normal|italic>.woff2 + LICENSE, and assets/fonts/manifest.json
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { fonts } = JSON.parse(readFileSync(join(root, 'research/fonts.json'), 'utf8'));
const outRoot = join(root, 'assets/fonts');
const only = process.argv.slice(2);
const work = mkdtempSync(join(tmpdir(), 'fontsource-'));
const manifest = { generated: new Date().toISOString().slice(0, 10), fonts: [] };
const failures = [];

for (const f of fonts) {
  if (only.length && !only.includes(f.id)) continue;
  const pkg = `@fontsource/${f.fontsource}`;
  const dir = join(work, f.id);
  mkdirSync(dir, { recursive: true });
  try {
    const tgz = execFileSync('npm', ['pack', pkg, '--silent', '--pack-destination', dir], { encoding: 'utf8' }).trim().split('\n').pop();
    execFileSync('tar', ['-xzf', join(dir, tgz), '-C', dir]);
    const pk = join(dir, 'package');
    const files = readdirSync(join(pk, 'files'));
    const dest = join(outRoot, f.id);
    mkdirSync(dest, { recursive: true });
    const entry = { id: f.id, family: f.family, license: f.license, version: JSON.parse(readFileSync(join(pk, 'package.json'), 'utf8')).version, faces: [] };
    const styles = [['normal', f.weights], ['italic', f.italics || []]];
    for (const [style, weights] of styles) for (const w of weights) for (const subset of f.subsets) {
      const name = `${f.fontsource}-${subset}-${w}-${style}.woff2`;
      if (!files.includes(name)) { failures.push(`${f.id}: missing ${name}`); continue; }
      const out = `${subset}-${w}-${style}.woff2`;
      copyFileSync(join(pk, 'files', name), join(dest, out));
      entry.faces.push({ subset, weight: w, style, file: `${f.id}/${out}` });
    }
    const lic = ['LICENSE', 'LICENSE.md', 'OFL.txt'].find(n => existsSync(join(pk, n)));
    if (lic) copyFileSync(join(pk, lic), join(dest, 'LICENSE'));
    else failures.push(`${f.id}: no LICENSE file in package`);
    manifest.fonts.push(entry);
    console.log(`ok  ${f.id} (${entry.faces.length} faces)`);
  } catch (e) {
    failures.push(`${f.id}: ${e.message.split('\n')[0]}`);
    console.log(`ERR ${f.id}`);
  }
}
rmSync(work, { recursive: true, force: true });
if (!only.length) writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (failures.length) { console.error('\nFailures:\n' + failures.join('\n')); process.exit(1); }
