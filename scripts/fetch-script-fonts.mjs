#!/usr/bin/env node
// Bundles the script fallback fonts listed in research/script-fonts.json (Tamil, Devanagari, Arabic, …)
// into assets/fonts/script/ for offline use, and writes src/styles/generated/scriptFonts.json with each
// face's file, weight range and unicode range.
// Source: @fontsource-variable/<id> (preferred: one file covers every weight) or @fontsource/<id>.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'research/script-fonts.json'), 'utf8'));
const outRoot = join(root, 'assets/fonts/script');
const work = mkdtempSync(join(tmpdir(), 'fontsource-script-'));
const failures = [];

// Which subsets each package must provide.
const need = new Map();
for (const s of catalog.scripts) {
  for (const pkg of new Set([...Object.values(s.fonts), ...(s.alternatives ?? [])])) {
    const set = need.get(pkg) ?? new Set();
    [s.subset, ...(s.extraSubsets ?? [])].forEach((x) => set.add(x));
    need.set(pkg, set);
  }
}

function pack(name, dir) {
  const tgz = execFileSync('npm', ['pack', name, '--silent', '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop();
  execFileSync('tar', ['-xzf', join(dir, tgz), '-C', dir]);
  return join(dir, 'package');
}

/** Static weights → contiguous CSS weight ranges split at midpoints, so every requested weight maps to the nearest file. */
function weightRanges(weights) {
  const ws = [...weights].sort((a, b) => a - b);
  return ws.map((w, i) => {
    const lo = i === 0 ? 1 : Math.floor((ws[i - 1] + w) / 2) + 1;
    const hi = i === ws.length - 1 ? 1000 : Math.floor((w + ws[i + 1]) / 2);
    return { weight: w, range: `${lo} ${hi}` };
  });
}

const out = { generated: new Date().toISOString().slice(0, 10), packages: {}, ranges: {} };
rmSync(outRoot, { recursive: true, force: true });

for (const [pkg, subsets] of need) {
  const dir = join(work, pkg);
  mkdirSync(dir, { recursive: true });
  let pk;
  let variable = true;
  try {
    pk = pack(`@fontsource-variable/${pkg}`, dir);
  } catch {
    variable = false;
    try {
      pk = pack(`@fontsource/${pkg}`, dir);
    } catch (e) {
      failures.push(`${pkg}: ${e.message.split('\n')[0]}`);
      continue;
    }
  }
  const meta = JSON.parse(readFileSync(join(pk, 'metadata.json'), 'utf8'));
  const unicode = JSON.parse(readFileSync(join(pk, 'unicode.json'), 'utf8'));
  const files = readdirSync(join(pk, 'files'));
  const dest = join(outRoot, pkg);
  mkdirSync(dest, { recursive: true });
  const entry = { family: meta.family, license: meta.license?.type ?? 'OFL-1.1', version: JSON.parse(readFileSync(join(pk, 'package.json'), 'utf8')).version, faces: [] };
  for (const subset of subsets) {
    if (!unicode[subset]) { failures.push(`${pkg}: no ${subset} subset`); continue; }
    out.ranges[subset] = unicode[subset];
    if (variable) {
      const name = `${pkg}-${subset}-wght-normal.woff2`;
      if (!files.includes(name)) { failures.push(`${pkg}: missing ${name}`); continue; }
      copyFileSync(join(pk, 'files', name), join(dest, `${subset}-wght.woff2`));
      const w = meta.variable?.wght ?? { min: '100', max: '900' };
      entry.faces.push({ subset, file: `script/${pkg}/${subset}-wght.woff2`, weight: `${w.min} ${w.max}` });
    } else {
      for (const { weight, range } of weightRanges(meta.weights)) {
        const name = `${pkg}-${subset}-${weight}-normal.woff2`;
        if (!files.includes(name)) { failures.push(`${pkg}: missing ${name}`); continue; }
        copyFileSync(join(pk, 'files', name), join(dest, `${subset}-${weight}.woff2`));
        entry.faces.push({ subset, file: `script/${pkg}/${subset}-${weight}.woff2`, weight: range });
      }
    }
  }
  const lic = ['LICENSE', 'LICENSE.md', 'OFL.txt'].find((n) => existsSync(join(pk, n)));
  if (lic) copyFileSync(join(pk, lic), join(dest, 'LICENSE'));
  else failures.push(`${pkg}: no LICENSE file in package`);
  out.packages[pkg] = entry;
  console.log(`ok  ${pkg} (${variable ? 'variable' : 'static'}, ${entry.faces.length} faces)`);
}
rmSync(work, { recursive: true, force: true });
writeFileSync(join(root, 'src/styles/generated/scriptFonts.json'), JSON.stringify(out, null, 2) + '\n');
if (failures.length) { console.error('\nFailures:\n' + failures.join('\n')); process.exit(1); }
