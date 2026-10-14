import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

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

async function generateSample(page: Page, variations = '4') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use sample' }).click();
  await page.getByLabel('Designs').selectOption(variations);
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
}

test('generates design variations offline, regenerates, persists and exports exact-size PNGs', async ({ page }) => {
  await generateSample(page, '5');
  const slides = page.getByTestId('slide');
  expect(await slides.count()).toBeGreaterThanOrEqual(5);
  await expect(slides.first()).toHaveAttribute('data-role', 'hook');
  await expect(slides.last()).toHaveAttribute('data-role', 'cta');
  await expect(page.getByRole('status').filter({ hasText: 'built-in rules' })).toBeVisible();

  // 5 distinct designs side by side.
  const variations = page.getByTestId('variation');
  await expect(variations).toHaveCount(5);
  const labels = await variations.locator('h3').allTextContents();
  expect(new Set(labels.map((l) => l.split(' · ')[0])).size).toBe(5);

  // Pick the third design.
  await variations.nth(2).getByRole('button', { name: 'Use this design' }).click();
  await expect(variations.nth(2).getByRole('button', { name: 'Selected' })).toBeVisible();

  // Per-slide: new layout changes slide 2's layout (offline).
  const before = await slides.nth(1).getAttribute('data-layout');
  await page.getByRole('button', { name: 'New layout for slide 2' }).click();
  await expect(slides.nth(1)).not.toHaveAttribute('data-layout', before!);

  // AI-only actions are disabled offline with an explanation.
  await expect(page.getByRole('button', { name: 'Rewrite slide 2' })).toBeDisabled();

  // Make it more … works offline.
  await page.getByRole('button', { name: 'Bolder' }).click();
  await page.getByRole('button', { name: 'More minimal' }).click();
  const continuous = page.getByLabel('Continuous slides');
  await expect(continuous).toBeEnabled();
  await continuous.selectOption('ribbon');
  await expect(continuous).toHaveValue('ribbon'); // re-layout is async; state reflects the rebuilt carousel

  // New designs re-picks the set.
  await page.getByRole('button', { name: '↻ New designs' }).click();
  await expect(variations).toHaveCount(5);

  // Export slide 1 at the exact Instagram 4:5 size.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download slide 1 as PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_01\.png$/);
  expect(pngSize(await download.path())).toEqual({ width: 1080, height: 1350 });

  // Persisted in IndexedDB: survives a reload, including the variations.
  const title = (await page.locator('h1').textContent())!.trim();
  await page.reload();
  const list = page.getByTestId('project-list');
  await list.getByRole('button', { name: title, exact: true }).click();
  await expect(slides.first()).toBeVisible();
  await expect(variations).toHaveCount(5);
});

test('LinkedIn landscape preset renders 1920x1080', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Platform').selectOption('linkedin-document-landscape-16x9');
  await page.getByLabel('Your content').fill('Three lessons from shipping weekly. Small batches reduce risk. Feedback arrives sooner. Teams stay motivated when progress is visible.');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download slide 1 as PNG' }).click();
  expect(pngSize(await (await downloadPromise).path())).toEqual({ width: 1920, height: 1080 });
});

test('imports a markdown file and explains that URL import needs internet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'File' }).click();
  await page.getByLabel('Upload file').setInputFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Pricing lessons\n\nCharge for value, not hours.\n\n- Anchor high\n- Offer three tiers\n- Review yearly\n'),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Imported' })).toBeVisible();
  await expect(page.getByLabel('Your content')).toHaveValue(/# Pricing lessons/);

  await page.context().setOffline(true);
  await page.getByRole('tab', { name: 'URL' }).click();
  await page.getByLabel('Article URL').fill('https://example.com/post');
  await page.getByRole('button', { name: 'Import article' }).click();
  await expect(page.getByRole('status').filter({ hasText: /offline/i })).toBeVisible();
  await page.context().setOffline(false);
});
