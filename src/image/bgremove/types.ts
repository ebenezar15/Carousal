export interface BgRemoveProgress {
  stage: 'loading-model' | 'processing';
  /** 0..1 when known. */
  progress?: number;
}

export interface BgRemoveOptions {
  onProgress?: (p: BgRemoveProgress) => void;
  signal?: AbortSignal;
}
