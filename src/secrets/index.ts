// API key storage.
// - Desktop (Tauri): stored in the OS keychain through Rust commands; never written to IndexedDB.
// - Web: there is no truly secret storage in a browser. The key is kept in memory for the session and
//   only persisted to IndexedDB if the user ticks "remember on this device" (the UI says so).
import { invoke } from '@tauri-apps/api/core';
import { settingsRepo } from '@/storage/repo';

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const memory = new Map<string, string>();
const storageKey = (name: string) => `secret:${name}`;

export async function getSecret(name: string): Promise<string | null> {
  if (memory.has(name)) return memory.get(name)!;
  if (isTauri()) {
    const v = await invoke<string | null>('secret_get', { name });
    if (v) memory.set(name, v);
    return v;
  }
  const v = await settingsRepo.get<string | null>(storageKey(name), null);
  if (v) memory.set(name, v);
  return v;
}

export async function setSecret(name: string, value: string, remember: boolean): Promise<void> {
  memory.set(name, value);
  if (isTauri()) {
    await invoke('secret_set', { name, value });
  } else if (remember) {
    await settingsRepo.set(storageKey(name), value);
  } else {
    await settingsRepo.remove(storageKey(name));
  }
}

export async function deleteSecret(name: string): Promise<void> {
  memory.delete(name);
  if (isTauri()) await invoke('secret_delete', { name });
  else await settingsRepo.remove(storageKey(name));
}

export const CLAUDE_KEY = 'anthropic_api_key';
