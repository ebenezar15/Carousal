// Online stock photo search (Unsplash / Pexels) with the user's own API key. Photos are downloaded and
// stored locally so projects keep working offline and exports aren't blocked by CORS.
import { appFetch } from '@/engine/net';
import { getSecret } from '@/secrets';
import { storeImage } from './assets';

export const UNSPLASH_KEY = 'unsplash_access_key';
export const PEXELS_KEY = 'pexels_api_key';

export interface StockPhoto {
  id: string;
  thumb: string;
  full: string;
  author: string;
  pageUrl: string;
  source: 'unsplash' | 'pexels';
  /** Unsplash requires pinging this when a photo is used. */
  downloadLocation?: string;
  alt: string;
}

export async function stockProviders(): Promise<('unsplash' | 'pexels')[]> {
  const out: ('unsplash' | 'pexels')[] = [];
  if (await getSecret(UNSPLASH_KEY)) out.push('unsplash');
  if (await getSecret(PEXELS_KEY)) out.push('pexels');
  return out;
}

export async function searchStock(source: 'unsplash' | 'pexels', query: string, signal?: AbortSignal): Promise<StockPhoto[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Stock photo search needs an internet connection.');
  if (source === 'unsplash') {
    const key = await getSecret(UNSPLASH_KEY);
    if (!key) throw new Error('Add an Unsplash access key in Settings.');
    const res = await appFetch(`https://api.unsplash.com/search/photos?per_page=24&query=${encodeURIComponent(query)}`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal });
    if (!res.ok) throw new Error(`Unsplash error ${res.status}`);
    const j = (await res.json()) as { results: { id: string; alt_description?: string; urls: { small: string; regular: string }; user: { name: string; links: { html: string } }; links: { download_location: string } }[] };
    return j.results.map((p) => ({ id: p.id, thumb: p.urls.small, full: p.urls.regular, author: p.user.name, pageUrl: `${p.user.links.html}?utm_source=carouselforge&utm_medium=referral`, source: 'unsplash', downloadLocation: p.links.download_location, alt: p.alt_description ?? query }));
  }
  const key = await getSecret(PEXELS_KEY);
  if (!key) throw new Error('Add a Pexels API key in Settings.');
  const res = await appFetch(`https://api.pexels.com/v1/search?per_page=24&query=${encodeURIComponent(query)}`, { headers: { Authorization: key }, signal });
  if (!res.ok) throw new Error(`Pexels error ${res.status}`);
  const j = (await res.json()) as { photos: { id: number; alt: string; url: string; photographer: string; src: { medium: string; large2x: string } }[] };
  return j.photos.map((p) => ({ id: String(p.id), thumb: p.src.medium, full: p.src.large2x, author: p.photographer, pageUrl: p.url, source: 'pexels', alt: p.alt || query }));
}

/** Downloads the photo into the local asset store; returns `asset:<id>`. */
export async function importStockPhoto(p: StockPhoto): Promise<string> {
  if (p.source === 'unsplash' && p.downloadLocation) {
    const key = await getSecret(UNSPLASH_KEY);
    void appFetch(p.downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => undefined);
  }
  const res = await appFetch(p.full);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return storeImage(await res.blob(), `${p.source}-${p.id}.jpg`);
}
