/**
 * Smoke test: loads the bundled U²-Netp model with onnxruntime-web (wasm backend, Node build)
 * and runs it on a synthetic image. Skips if the model has not been fetched or the runtime
 * cannot load. Run alone with `npm run test:bgremove`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { U2NETP_INPUT_SIZE, minMaxNormalize, rgbaToNchw, saliencyToMask } from '@/image/bgremove/mask';

const MODEL = resolve(process.cwd(), 'assets/models/u2netp.onnx');
const SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';

type Ort = typeof import('onnxruntime-web');
async function loadOrt(): Promise<Ort | null> {
  try {
    const ort = await import('onnxruntime-web');
    ort.env.wasm.numThreads = 1;
    return ort;
  } catch {
    return null;
  }
}

const ort = existsSync(MODEL) ? await loadOrt() : null;

describe.skipIf(!ort)('U²-Netp bundled model (onnxruntime-web)', () => {
  it('is the pinned file', () => {
    expect(createHash('sha256').update(readFileSync(MODEL)).digest('hex')).toBe(SHA256);
  });

  it('segments a bright circle on a dark background', async () => {
    const o = ort!;
    const session = await o.InferenceSession.create(new Uint8Array(readFileSync(MODEL)), { executionProviders: ['wasm'] });
    expect(session.inputNames).toHaveLength(1);
    expect(session.outputNames.length).toBeGreaterThanOrEqual(1);

    const S = U2NETP_INPUT_SIZE;
    const rgba = new Uint8ClampedArray(S * S * 4);
    const c = S / 2;
    const r = S * 0.28;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r;
        rgba[i] = inside ? 240 : 20;
        rgba[i + 1] = inside ? 200 : 25;
        rgba[i + 2] = inside ? 60 : 30;
        rgba[i + 3] = 255;
      }

    const input = new o.Tensor('float32', rgbaToNchw(rgba, S, S), [1, 3, S, S]);
    const results = await session.run({ [session.inputNames[0]!]: input });
    const out = results[session.outputNames[0]!]!;
    expect(out.dims).toEqual([1, 1, S, S]);

    const mask = minMaxNormalize(out.data as Float32Array);
    const at = (x: number, y: number) => mask[y * S + x]!;
    const center = at(c, c);
    const corners = [at(2, 2), at(S - 3, 2), at(2, S - 3), at(S - 3, S - 3)];
    expect(center).toBeGreaterThan(0.5);
    for (const v of corners) expect(center).toBeGreaterThan(v + 0.3);

    // Full post-processing path to a non-square output size.
    const full = saliencyToMask(out.data as Float32Array, S, S, 640, 480, 1);
    expect(full).toHaveLength(640 * 480);
    expect(full[240 * 640 + 320]!).toBeGreaterThan(full[5 * 640 + 5]!);
    await session.release();
  }, 60_000);
});

