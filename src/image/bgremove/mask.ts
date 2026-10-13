/**
 * Pure pre/post-processing for U²-Netp background removal.
 * No DOM, canvas or ONNX dependencies so it can be unit-tested in isolation
 * and shared by the worker and the Node smoke test.
 */

/** ImageNet statistics used to train U²-Net (see rembg / U-2-Net data_loader). */
export const U2NET_MEAN: readonly [number, number, number] = [0.485, 0.456, 0.406];
export const U2NET_STD: readonly [number, number, number] = [0.229, 0.224, 0.225];
export const U2NETP_INPUT_SIZE = 320;

/**
 * Convert an RGBA image (already resized to the model input size) into a
 * float32 NCHW tensor [1, 3, h, w]. Like rembg, pixel values are divided by the
 * image's maximum channel value (not a fixed 255), then normalized with mean/std.
 */
export function rgbaToNchw(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  mean: readonly [number, number, number] = U2NET_MEAN,
  std: readonly [number, number, number] = U2NET_STD,
): Float32Array {
  const plane = width * height;
  if (rgba.length < plane * 4) throw new RangeError('rgba buffer is smaller than width*height*4');
  let max = 0;
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    const m = Math.max(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!);
    if (m > max) max = m;
  }
  const scale = 1 / Math.max(max, 1e-6);
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    out[i] = (rgba[o]! * scale - mean[0]) / std[0];
    out[plane + i] = (rgba[o + 1]! * scale - mean[1]) / std[1];
    out[2 * plane + i] = (rgba[o + 2]! * scale - mean[2]) / std[2];
  }
  return out;
}

/** Min-max normalize to [0, 1] (new array). A constant input maps to all zeros. */
export function minMaxNormalize(values: ArrayLike<number>): Float32Array {
  const n = values.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = values[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo;
  if (!(range > 0) || !Number.isFinite(range)) return out;
  for (let i = 0; i < n; i++) out[i] = (values[i]! - lo) / range;
  return out;
}

/**
 * Bilinear resize of a single-channel float image using pixel-center alignment
 * (align_corners = false, edge clamped) — the same sampling as OpenCV/PIL bilinear.
 */
export function resizeBilinear(
  src: ArrayLike<number>,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) throw new RangeError('dimensions must be positive');
  if (src.length < srcW * srcH) throw new RangeError('src buffer is smaller than srcW*srcH');
  const out = new Float32Array(dstW * dstH);
  const sx = srcW / dstW;
  const sy = srcH / dstH;
  // Precompute horizontal taps once; they are identical for every row.
  const x0s = new Int32Array(dstW);
  const x1s = new Int32Array(dstW);
  const fxs = new Float32Array(dstW);
  for (let x = 0; x < dstW; x++) {
    const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), srcW - 1);
    const x0 = Math.floor(fx);
    x0s[x] = x0;
    x1s[x] = Math.min(x0 + 1, srcW - 1);
    fxs[x] = fx - x0;
  }
  for (let y = 0; y < dstH; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), srcH - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const wy = fy - y0;
    const r0 = y0 * srcW;
    const r1 = y1 * srcW;
    const ro = y * dstW;
    for (let x = 0; x < dstW; x++) {
      const x0 = x0s[x]!;
      const x1 = x1s[x]!;
      const wx = fxs[x]!;
      const top = src[r0 + x0]! + (src[r0 + x1]! - src[r0 + x0]!) * wx;
      const bot = src[r1 + x0]! + (src[r1 + x1]! - src[r1 + x0]!) * wx;
      out[ro + x] = top + (bot - top) * wy;
    }
  }
  return out;
}

/** Separable box blur (edge clamped) used as a light feather on the mask. radius 0 returns a copy. */
export function boxBlur(src: ArrayLike<number>, width: number, height: number, radius: number): Float32Array {
  const r = Math.max(0, Math.floor(radius));
  const out = Float32Array.from(src as ArrayLike<number>);
  if (r === 0) return out;
  const tmp = new Float32Array(width * height);
  const k = 2 * r + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += out[row + Math.min(Math.max(x + d, 0), width - 1)]!;
      tmp[row + x] = s / k;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += tmp[Math.min(Math.max(y + d, 0), height - 1) * width + x]!;
      out[y * width + x] = s / k;
    }
  }
  return out;
}

/**
 * Multiply each pixel's alpha by the mask value (clamped to [0, 1]) in place.
 * Existing transparency in the source is preserved. RGB is left untouched
 * (canvas ImageData is non-premultiplied).
 */
export function applyAlphaMask(rgba: Uint8ClampedArray, mask: ArrayLike<number>): Uint8ClampedArray {
  const n = rgba.length / 4;
  if (mask.length < n) throw new RangeError('mask is smaller than the image');
  for (let i = 0; i < n; i++) {
    const m = Math.min(Math.max(mask[i]!, 0), 1);
    rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3]! * m);
  }
  return rgba;
}

/**
 * Turn the raw saliency map (model resolution) into a full-resolution [0, 1] mask:
 * min-max normalize, optional feather at model resolution, then bilinear upscale.
 */
export function saliencyToMask(
  raw: ArrayLike<number>,
  modelW: number,
  modelH: number,
  outW: number,
  outH: number,
  featherRadius = 0,
): Float32Array {
  const norm = minMaxNormalize(raw);
  const feathered = featherRadius > 0 ? boxBlur(norm, modelW, modelH, featherRadius) : norm;
  return resizeBilinear(feathered, modelW, modelH, outW, outH);
}
