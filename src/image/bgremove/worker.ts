/**
 * Background-removal worker: U²-Netp (Apache-2.0) on onnxruntime-web's single-threaded
 * wasm backend. Everything (model, wasm) is served from the app bundle, so it works offline.
 */
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { BG_MASK_FEATHER, BG_MODEL_FILE } from './config';
import { U2NETP_INPUT_SIZE, applyAlphaMask, rgbaToNchw, saliencyToMask } from './mask';
import type { WorkerRequest, WorkerResponse } from './protocol';
import type { BgRemoveProgress } from './types';

/** Minimal typing of the dedicated-worker global (the app tsconfig uses the DOM lib, not WebWorker). */
interface WorkerScope {
  location: Location;
  postMessage(message: WorkerResponse): void;
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
}
const scope = globalThis as unknown as WorkerScope;

ort.env.wasm.numThreads = 1; // no SharedArrayBuffer / COOP+COEP needed
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, scope.location.href).href };

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function post(msg: WorkerResponse) {
  scope.postMessage(msg);
}

async function fetchModel(onProgress: (p: BgRemoveProgress) => void): Promise<Uint8Array> {
  const url = new URL(import.meta.env.BASE_URL + BG_MODEL_FILE, scope.location.origin).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Background-removal model not found (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const out = new Uint8Array(total);
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > total) {
      // content-length was wrong (e.g. compressed transfer); fall back to concatenation
      const grown = new Uint8Array(received + value.length);
      grown.set(out.subarray(0, received));
      grown.set(value, received);
      return finishRead(reader, grown);
    }
    out.set(value, received);
    received += value.length;
    onProgress({ stage: 'loading-model', progress: received / total });
  }
  return out.subarray(0, received);
}

async function finishRead(reader: ReadableStreamDefaultReader<Uint8Array>, head: Uint8Array): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [head];
  let len = head.length;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    len += value.length;
  }
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function getSession(onProgress: (p: BgRemoveProgress) => void): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      onProgress({ stage: 'loading-model', progress: 0 });
      const bytes = await fetchModel(onProgress);
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      onProgress({ stage: 'loading-model', progress: 1 });
      return session;
    })();
    sessionPromise.catch(() => {
      sessionPromise = null; // allow a retry
    });
  }
  return sessionPromise;
}

async function removeBackground(input: Blob, onProgress: (p: BgRemoveProgress) => void): Promise<Blob> {
  const session = await getSession(onProgress);
  onProgress({ stage: 'processing', progress: 0 });

  const bitmap = await createImageBitmap(input);
  const width = bitmap.width;
  const height = bitmap.height;
  try {
    if (!width || !height) throw new Error('Image has no pixels');
    const S = U2NETP_INPUT_SIZE;

    // Model input: browser-resampled 320×320 copy.
    const small = new OffscreenCanvas(S, S);
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (!sctx) throw new Error('2D canvas unavailable in worker');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(bitmap, 0, 0, S, S);
    const tensorData = rgbaToNchw(sctx.getImageData(0, 0, S, S).data, S, S);

    const inputName = session.inputNames[0]!;
    const outputName = session.outputNames[0]!; // d0: fused saliency map
    const results = await session.run({ [inputName]: new ort.Tensor('float32', tensorData, [1, 3, S, S]) });
    const out = results[outputName];
    if (!out) throw new Error('Model returned no output');
    const raw = out.data as Float32Array;
    onProgress({ stage: 'processing', progress: 0.6 });

    // Full-resolution original + upscaled mask → alpha.
    const full = new OffscreenCanvas(width, height);
    const fctx = full.getContext('2d', { willReadFrequently: true });
    if (!fctx) throw new Error('2D canvas unavailable in worker');
    fctx.drawImage(bitmap, 0, 0);
    const img = fctx.getImageData(0, 0, width, height);
    const mask = saliencyToMask(raw, S, S, width, height, BG_MASK_FEATHER);
    applyAlphaMask(img.data, mask);
    fctx.putImageData(img, 0, 0);
    onProgress({ stage: 'processing', progress: 0.9 });

    const blob = await full.convertToBlob({ type: 'image/png' });
    for (const t of Object.values(results)) t.dispose();
    onProgress({ stage: 'processing', progress: 1 });
    return blob;
  } finally {
    bitmap.close();
  }
}

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  const onProgress = (progress: BgRemoveProgress) => post({ type: 'progress', id: msg.id, progress });
  try {
    if (msg.type === 'init') {
      await getSession(onProgress);
      post({ type: 'ready', id: msg.id });
    } else {
      const output = await removeBackground(msg.input, onProgress);
      post({ type: 'result', id: msg.id, output });
    }
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
