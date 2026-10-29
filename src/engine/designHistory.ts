// Remembers which styles were offered recently (on this device, across projects) so new carousels
// lead with designs the user hasn't just seen. Silently does nothing where storage is unavailable.
const KEY = 'cf-recent-styles';

export function recentStyles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function rememberStyles(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids, ...recentStyles()].slice(0, 40)));
  } catch {
    /* ignore */
  }
}
