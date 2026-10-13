import { describe, expect, it } from 'vitest';
import {
  U2NET_MEAN,
  U2NET_STD,
  applyAlphaMask,
  boxBlur,
  minMaxNormalize,
  resizeBilinear,
  rgbaToNchw,
  saliencyToMask,
} from '@/image/bgremove/mask';
import { isBackgroundRemovalAvailable, removeBackground } from '@/image/bgremove';

describe('rgbaToNchw', () => {
  it('lays out channels as planar NCHW and normalizes by max + mean/std', () => {
    // 2×1 image: pixel0 = (255, 0, 0), pixel1 = (0, 255, 51)
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 51, 255]);
    const t = rgbaToNchw(rgba, 2, 1);
    expect(t).toHaveLength(6);
    const n = (v: number, c: 0 | 1 | 2) => (v - U2NET_MEAN[c]) / U2NET_STD[c];
    // R plane, G plane, B plane
    expect(t[0]).toBeCloseTo(n(1, 0), 5);
    expect(t[1]).toBeCloseTo(n(0, 0), 5);
    expect(t[2]).toBeCloseTo(n(0, 1), 5);
    expect(t[3]).toBeCloseTo(n(1, 1), 5);
    expect(t[4]).toBeCloseTo(n(0, 2), 5);
    expect(t[5]).toBeCloseTo(n(0.2, 2), 5);
  });

  it('divides by the image max (rembg behaviour), not 255', () => {
    const rgba = new Uint8ClampedArray([100, 50, 0, 255]);
    const t = rgbaToNchw(rgba, 1, 1);
    expect(t[0]).toBeCloseTo((1 - U2NET_MEAN[0]) / U2NET_STD[0], 5);
    expect(t[1]).toBeCloseTo((0.5 - U2NET_MEAN[1]) / U2NET_STD[1], 5);
  });

  it('handles an all-black image without NaN and rejects short buffers', () => {
    const t = rgbaToNchw(new Uint8ClampedArray(16), 2, 2);
    expect(Array.from(t).every(Number.isFinite)).toBe(true);
    expect(() => rgbaToNchw(new Uint8ClampedArray(4), 2, 2)).toThrow(RangeError);
  });
});

describe('minMaxNormalize', () => {
  it('maps min→0 and max→1', () => {
    expect(Array.from(minMaxNormalize([2, 4, 6]))).toEqual([0, 0.5, 1]);
  });
  it('returns zeros for constant input and empty for empty', () => {
    expect(Array.from(minMaxNormalize([3, 3, 3]))).toEqual([0, 0, 0]);
    expect(minMaxNormalize([])).toHaveLength(0);
  });
});

describe('resizeBilinear', () => {
  it('is the identity at the same size', () => {
    const src = [0, 1, 2, 3, 4, 5];
    expect(Array.from(resizeBilinear(src, 3, 2, 3, 2))).toEqual(src);
  });

  it('upscales 2×1 → 4×1 with pixel-center alignment and edge clamping', () => {
    const out = Array.from(resizeBilinear([0, 1], 2, 1, 4, 1));
    expect(out).toEqual([0, 0.25, 0.75, 1]);
  });

  it('downscales by averaging the two centre taps', () => {
    const out = resizeBilinear([0, 1, 2, 3], 4, 1, 2, 1);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(2.5);
  });

  it('interpolates in 2D and stays within source range (smooth, no overshoot)', () => {
    const out = resizeBilinear([0, 1, 1, 0], 2, 2, 8, 8);
    expect(out).toHaveLength(64);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(out[0]).toBe(0); // clamped corner
    expect(out[7]).toBe(1);
    expect(out[3 * 8 + 3]).toBeCloseTo(0.5, 1);
  });

  it('rejects bad dimensions', () => {
    expect(() => resizeBilinear([1], 1, 1, 0, 1)).toThrow(RangeError);
    expect(() => resizeBilinear([1], 2, 2, 1, 1)).toThrow(RangeError);
  });
});

describe('boxBlur', () => {
  it('radius 0 is a copy; radius 1 softens a step edge but keeps constants', () => {
    expect(Array.from(boxBlur([0, 1], 2, 1, 0))).toEqual([0, 1]);
    const flat = boxBlur(new Array(9).fill(0.4), 3, 3, 1);
    for (const v of flat) expect(v).toBeCloseTo(0.4);
    const step = boxBlur([0, 0, 1, 1], 4, 1, 1);
    expect(step[1]).toBeCloseTo(1 / 3);
    expect(step[2]).toBeCloseTo(2 / 3);
  });
});

describe('applyAlphaMask', () => {
  it('multiplies alpha by the clamped mask and leaves RGB untouched', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128, 1, 2, 3, 255, 4, 5, 6, 255]);
    applyAlphaMask(rgba, [1, 0.5, -1, 2]);
    expect(Array.from(rgba)).toEqual([10, 20, 30, 255, 40, 50, 60, 64, 1, 2, 3, 0, 4, 5, 6, 255]);
  });
  it('rejects a mask smaller than the image', () => {
    expect(() => applyAlphaMask(new Uint8ClampedArray(8), [1])).toThrow(RangeError);
  });
});

describe('saliencyToMask', () => {
  it('normalizes then upscales to the output size', () => {
    const m = saliencyToMask([-5, 5, 5, -5], 2, 2, 4, 4);
    expect(m).toHaveLength(16);
    expect(m[0]).toBe(0);
    expect(m[3]).toBe(1);
    expect(Math.max(...m)).toBeLessThanOrEqual(1);
    expect(Math.min(...m)).toBeGreaterThanOrEqual(0);
  });
});

describe('public API in jsdom', () => {
  it('reports unavailable when Worker/OffscreenCanvas are missing', async () => {
    await expect(isBackgroundRemovalAvailable()).resolves.toBe(false);
    await expect(removeBackground(new Blob([]))).rejects.toThrow(/not supported/);
  });
});
