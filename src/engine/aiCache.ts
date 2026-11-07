// Small persistent cache for AI results (plans, design briefs): the same request with the same
// settings is answered from here instead of spending credits again. Kept in localStorage, newest
// first, capped so it never grows without bound. Silently does nothing where storage is unavailable.

const PREFIX = 'cf-ai-cache:';

/** 53-bit string hash (cyrb53): short, stable keys for long inputs. */
export function hashKey(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function load<T>(bucket: string): [string, T][] {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + bucket) ?? '[]') as [string, T][];
  } catch {
    return [];
  }
}

export function cacheGet<T>(bucket: string, key: string): T | undefined {
  return load<T>(bucket).find(([k]) => k === key)?.[1];
}

export function cachePut<T>(bucket: string, key: string, value: T, max = 30): void {
  try {
    const rest = load<T>(bucket).filter(([k]) => k !== key);
    localStorage.setItem(PREFIX + bucket, JSON.stringify([[key, value], ...rest].slice(0, max)));
  } catch {
    /* storage full or unavailable: skip caching */
  }
}
