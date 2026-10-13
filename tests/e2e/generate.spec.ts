import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** PNG width/height live in the IHDR chunk at bytes 16-23. */
function pngSize(path: string) {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

test.beforeEach(async ({ context }) => {
  // Simulate having no internet: only the local app server is reachable (no Claude, no Ollama).
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

test('generates a carousel offline, persists it, and exports exact-size PNGs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use sample' }).click();
  await page.getByRole('button', { name: 'Generate carousel' }).click();

  const slides = page.getByTestId('slide');
  await expect(slides.first()).toBeVisible({ timeout: 20_000 });
  expect(await slides.count()).toBeGreaterThanOrEqual(5);
  await expect(slides.first()).toHaveAttribute('data-role', 'hook');
  await expect(slides.last()).toHaveAttribute('data-role', 'cta');
  await expect(page.getByRole('status').filter({ hasText: 'built-in rules' })).toBeVisible();
  await expect(page.getByTestId('generated-by')).toContainText('1080×1350');
  await expect(page.locator('canvas').first()).toBeVisible();

  // Export slide 1 and verify the pixel size matches the Instagram 4:5 preset exactly.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download slide 1 as PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_01\.png$/);
  expect(pngSize(await download.path())).toEqual({ width: 1080, height: 1350 });

  // Switching style re-lays out the same content.
  await page.getByLabel('Style').selectOption('dark-tech');
  await expect(slides.first()).toBeVisible();

  // Persisted in IndexedDB: survives a reload.
  const title = (await page.locator('h1').textContent())!.trim();
  await page.reload();
  const list = page.getByTestId('project-list');
  await expect(list.getByRole('button', { name: title, exact: true })).toBeVisible();
  await list.getByRole('button', { name: title, exact: true }).click();
  await expect(slides.first()).toBeVisible();
});

test('LinkedIn landscape preset renders 1920x1080', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Platform').selectOption('linkedin-document-landscape-16x9');
  await page.getByLabel('Your content').fill('Three lessons from shipping weekly. Small batches reduce risk. Feedback arrives sooner. Teams stay motivated when progress is visible.');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download slide 1 as PNG' }).click();
  expect(pngSize(await (await downloadPromise).path())).toEqual({ width: 1920, height: 1080 });
});
