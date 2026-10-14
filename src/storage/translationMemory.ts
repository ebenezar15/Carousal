// Translation memory in IndexedDB: once a string is translated (and reviewed), the same source text is
// never sent to a model again for that language — repeated slide text, re-runs and other carousels
// with shared lines translate instantly and for free.
import type { TranslationMemory } from '@/engine/translate/translate';
import { db } from './db';

const keyOf = (lang: string, source: string) => `${lang.toLowerCase()}␟${source}`;

export const translationMemory: TranslationMemory = {
  async lookup(lang, sources) {
    const rows = await db.translations.bulkGet(sources.map((s) => keyOf(lang, s)));
    const out = new Map<string, string>();
    rows.forEach((r, i) => r && out.set(sources[i]!, r.text));
    return out;
  },
  async store(lang, pairs) {
    const at = Date.now();
    await db.translations.bulkPut(pairs.map(([source, text]) => ({ key: keyOf(lang, source), lang: lang.toLowerCase(), source, text, at })));
  },
  async count() {
    return db.translations.count();
  },
  async clear() {
    await db.translations.clear();
  },
};
