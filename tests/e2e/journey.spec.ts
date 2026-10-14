import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

test('first run: sample → pick design → edit → check → caption → export ZIP (offline)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  // Onboarding is shown on first launch.
  await expect(page.getByTestId('welcome')).toContainText('Welcome to CarouselForge');
  await page.getByRole('button', { name: /Pricing lessons/ }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('generated-by')).toContainText('1080×1350');
  await page.getByTestId('variation').nth(1).getByRole('button', { name: 'Use this design' }).click();

  // Caption on the Generate page (offline writer).
  await page.getByTestId('caption-panel').getByRole('button', { name: 'Write caption' }).click();
  await expect(page.getByLabel('Caption', { exact: true })).not.toHaveValue('');
  await expect(page.getByLabel('Hashtags', { exact: true })).toHaveValue(/#\w+/);

  // Edit in the editor.
  await page.getByRole('button', { name: 'Open in editor →' }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __cf?: unknown }).__cf));
  await page.getByTestId('editor-slide-thumb').nth(0).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByTestId('layer-row').filter({ hasText: 'pricing mistakes' }).first().click();
  await page.getByLabel('Text content').fill('Pricing mistakes costing you customers');
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as unknown as { __cf: { doc: { getState(): { carousel: unknown } } } }).__cf.doc.getState().carousel)))
    .toContain('Pricing mistakes costing you customers');

  // Readability check: no errors on the generated design.
  await page.getByRole('tab', { name: 'Check' }).click();
  await expect(page.getByTestId('check-panel')).not.toContainText('Checking…', { timeout: 30_000 });
  await expect(page.locator('[data-testid="issue"][data-severity="error"]')).toHaveCount(0);

  // Export a ZIP: images + caption with hashtags and alt text.
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog.getByTestId('export-a11y')).toContainText(/No contrast or size problems|warnings/);
  await dialog.getByRole('tab', { name: 'ZIP of images' }).click();
  const dl = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  const zip = unzipSync(new Uint8Array(readFileSync(await (await dl).path())));
  const pngs = Object.keys(zip).filter((n) => n.endsWith('.png'));
  expect(pngs.length).toBeGreaterThanOrEqual(5);
  const caption = strFromU8(zip['caption.txt']!);
  expect(caption).toMatch(/#\w+/);
  expect(caption).toContain('Alt text');
  await expect(page.locator('[data-testid="export-row"][data-ok="false"]')).toHaveCount(0);
});

test('every built-in style passes the real-pixel contrast check', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('button', { name: /Remote team habits/ }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __cf?: unknown }).__cf));
  const failures = await page.evaluate(async () => {
    type CF = Record<string, (...a: unknown[]) => unknown> & { doc: { getState(): { carousel: { presetId: string }; plan: unknown } } };
    const cf = (window as unknown as { __cf: CF }).__cf;
    const { carousel, plan } = cf.doc.getState();
    const styles = ['minimal-swiss', 'bold-gradient', 'editorial-magazine', 'brutalist', 'glassmorphism', 'neo-pop', 'corporate-clean', 'dark-tech', 'pastel-soft', 'retro-print', 'hand-drawn-notes', 'data-infographic', 'quote-card', 'tweet-style', 'step-tutorial', 'luxury-serif', 'panoramic-flow', 'neo-retro-grid'];
    const out: string[] = [];
    for (const id of styles) {
      const c = (await cf.layoutCarousel({ plan, presetId: carousel.presetId, theme: cf.themeFor(id) })) as never;
      const issues = (await cf.checkCarousel(c, cf.canvasSampler(carousel.presetId))) as { kind: string; severity: string; slideIndex: number; message: string }[];
      for (const i of issues) if (i.kind === 'contrast' && i.severity === 'error') out.push(`${id} slide ${i.slideIndex + 1}: ${i.message}`);
    }
    return out;
  });
  expect(failures).toEqual([]);
});
