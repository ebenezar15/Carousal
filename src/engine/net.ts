// fetch that works in both builds: Tauri's HTTP plugin (no browser CORS limits) on desktop,
// the global fetch on the web.
import { isTauri } from '@/secrets';

let tauriFetch: typeof fetch | null = null;

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    tauriFetch ??= (await import('@tauri-apps/plugin-http')).fetch as typeof fetch;
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}
