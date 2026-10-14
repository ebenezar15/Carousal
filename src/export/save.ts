// Saving files: native "Save as" dialog on desktop (Tauri), browser download on the web.
import { isTauri } from '@/secrets';

export async function saveBlob(blob: Blob, fileName: string): Promise<'saved' | 'cancelled'> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const ext = fileName.split('.').pop() ?? '';
    const path = await save({ defaultPath: fileName, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined });
    if (!path) return 'cancelled';
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return 'saved';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);
