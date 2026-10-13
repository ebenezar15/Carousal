/**
 * Offline background removal (U²-Netp, Apache-2.0) running in a Web Worker on
 * onnxruntime-web's wasm backend. The worker — and with it onnxruntime and the
 * model — is only loaded on first use.
 */
import type { WorkerRequest, WorkerResponse } from './protocol';
import type { BgRemoveOptions, BgRemoveProgress } from './types';

export type { BgRemoveOptions, BgRemoveProgress } from './types';

interface Pending {
  resolve: (msg: WorkerResponse) => void;
  reject: (err: Error) => void;
  onProgress?: (p: BgRemoveProgress) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let availability: Promise<boolean> | null = null;

function environmentSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  );
}

function failAll(err: Error) {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'bgremove' });
  w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.progress);
      return;
    }
    pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(msg);
  };
  w.onerror = (ev) => {
    ev.preventDefault();
    failAll(new Error(`Background-removal worker failed: ${ev.message || 'unknown error'}`));
    resetWorker();
  };
  worker = w;
  return w;
}

/** Terminates the worker (this is how an in-flight inference is cancelled); the next call starts a new one. */
function resetWorker() {
  worker?.terminate();
  worker = null;
}

function abortError(): Error {
  return new DOMException('Background removal was aborted', 'AbortError');
}

function request(
  build: (id: number) => WorkerRequest,
  opts: BgRemoveOptions = {},
): Promise<WorkerResponse> {
  const { signal, onProgress } = opts;
  if (signal?.aborted) return Promise.reject(abortError());
  const id = nextId++;
  return new Promise<WorkerResponse>((resolve, reject) => {
    const onAbort = () => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(abortError());
      // Stop the CPU work; other in-flight requests on this worker fail too.
      resetWorker();
      failAll(abortError());
    };
    pending.set(id, {
      resolve: (m) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(m);
      },
      reject: (e) => {
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
      onProgress,
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      getWorker().postMessage(build(id));
    } catch (err) {
      pending.delete(id);
      signal?.removeEventListener('abort', onAbort);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Removes the background from an image. Returns a PNG with an alpha channel at the
 * input's original resolution. Rejects with an AbortError when `signal` aborts.
 */
export async function removeBackground(input: Blob, opts?: BgRemoveOptions): Promise<Blob> {
  if (!environmentSupported()) throw new Error('Background removal is not supported in this environment');
  const msg = await request((id) => ({ type: 'remove', id, input }), opts);
  if (msg.type !== 'result') throw new Error('Unexpected worker response');
  return msg.output;
}

/**
 * Resolves true when the runtime and bundled model load in this environment.
 * The first call loads the model in the worker (≈4.6 MB), so later removals start faster.
 */
export function isBackgroundRemovalAvailable(): Promise<boolean> {
  if (!availability) {
    availability = environmentSupported()
      ? request((id) => ({ type: 'init', id })).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false);
    void availability.then((ok) => {
      if (!ok) availability = null; // let a later call retry (e.g. after a transient fetch failure)
    });
  }
  return availability;
}
