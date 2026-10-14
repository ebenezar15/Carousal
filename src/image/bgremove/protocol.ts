/** Messages exchanged between the main thread (index.ts) and the background-removal worker. */
import type { BgRemoveProgress } from './types';

export type WorkerRequest =
  | { type: 'init'; id: number }
  | { type: 'remove'; id: number; input: Blob };

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: BgRemoveProgress }
  | { type: 'ready'; id: number }
  | { type: 'result'; id: number; output: Blob }
  | { type: 'error'; id: number; message: string };
