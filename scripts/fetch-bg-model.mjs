#!/usr/bin/env node
// Bundles the U²-Netp background-removal model into assets/models/ for offline use.
// Source: @planby-tech/rmbg-webgpu (npm), which redistributes rembg's u2netp.onnx release
// artifact (the U-2-Net project's U²-Netp weights, Apache-2.0) together with its license text.
// The package's JavaScript is never executed: we only `npm pack` the tarball and extract files.
// Output: assets/models/u2netp.onnx, u2netp.LICENSE.txt (Apache-2.0), u2netp.NOTICE.md
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PKG = '@planby-tech/rmbg-webgpu@0.2.1';
const MODEL_IN_PKG = 'models/u2netp.onnx';
// sha256 of rembg's u2netp.onnx (md5 8e83ca70e441ab06c318d82300c84806 = rembg's pinned hash).
const SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets/models');
const outModel = join(outDir, 'u2netp.onnx');
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

if (existsSync(outModel) && sha256(outModel) === SHA256 && !process.argv.includes('--force')) {
  console.log(`ok  ${outModel} already present (sha256 verified)`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'bgmodel-'));
try {
  const tgz = execFileSync('npm', ['pack', PKG, '--silent', '--ignore-scripts', '--pack-destination', work], { encoding: 'utf8' })
    .trim().split('\n').pop();
  execFileSync('tar', ['-xzf', join(work, tgz), '-C', work, 'package/' + MODEL_IN_PKG, 'package/LICENSES/Apache-2.0.txt', 'package/THIRD_PARTY_NOTICES.md', 'package/package.json']);
  const pk = join(work, 'package');
  const meta = JSON.parse(readFileSync(join(pk, 'package.json'), 'utf8'));
  if (meta.license !== 'MIT AND Apache-2.0') throw new Error(`unexpected package license: ${meta.license}`);
  const got = sha256(join(pk, MODEL_IN_PKG));
  if (got !== SHA256) throw new Error(`sha256 mismatch for ${MODEL_IN_PKG}: ${got} (expected ${SHA256})`);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(join(pk, MODEL_IN_PKG), outModel);
  copyFileSync(join(pk, 'LICENSES/Apache-2.0.txt'), join(outDir, 'u2netp.LICENSE.txt'));
  copyFileSync(join(pk, 'THIRD_PARTY_NOTICES.md'), join(outDir, 'u2netp.NOTICE.md'));
  console.log(`ok  ${outModel} from ${PKG} (sha256 ${got})`);
} catch (e) {
  console.error(`ERR ${e.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
