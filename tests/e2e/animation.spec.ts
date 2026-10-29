import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

type Cf = { __cf: { doc: { getState(): { carousel: { slides: { elements: { anim?: { text?: string } ; slot?: string }[] }[] } } } } };

test('animate all slides, preview, tweak one element and export an animated clip per slide', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByRole('button', { name: /Remote team habits/ }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Open in editor →' }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Cf>).__cf));

  // Nothing selected → slide panel shows the Animation section (open: every style animates by default).
  const section = page.getByRole('button', { name: /^Animation/ });
  await expect(section).toBeVisible();
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
  await page.getByLabel('Animation style').selectOption('kinetic');
  await page.getByRole('button', { name: 'Animate all slides' }).click();
  const headlineAnim = () => page.evaluate(() => (window as unknown as Cf).__cf.doc.getState().carousel.slides[0]!.elements.find((e) => e.slot === 'headline')?.anim?.text);
  await expect.poll(headlineAnim).toBe('word-pop');

  // Preview plays the timeline.
  await page.getByRole('button', { name: 'Preview animation' }).first().click();
  const preview = page.getByRole('dialog', { name: 'Animation preview' });
  await expect(preview.getByTestId('animation-stage').locator('canvas').first()).toBeVisible();
  await expect.poll(async () => Number(await preview.getByLabel('Timeline').inputValue())).toBeGreaterThan(0.2);
  await preview.getByRole('button', { name: 'Close preview' }).click();

  // Fine-tune: select the headline in Layers and switch it to a typewriter.
  await page.getByRole('tab', { name: 'Layers' }).click();
  const headlineText = await page.evaluate(() => ((window as unknown as Cf).__cf.doc.getState().carousel.slides[0]!.elements.find((e) => e.slot === 'headline') as unknown as { text: string }).text);
  await page.getByTestId('layer-row').filter({ hasText: headlineText.split(/\s+/).slice(0, 3).join(' ') }).first().click();
  if ((await page.getByLabel('Word animation').count()) === 0) await page.getByRole('button', { name: /^Animation/ }).click();
  await page.getByLabel('Word animation').selectOption('typewriter');
  await expect.poll(headlineAnim).toBe('typewriter');

  // Export the current slide as an animated clip (ZIP with one video).
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await dialog.getByRole('tab', { name: 'Video / GIF' }).click();
  await dialog.getByLabel('Video type').selectOption('clips');
  await expect(dialog.getByLabel('Animation')).toHaveValue('mine');
  await dialog.getByLabel('Seconds per slide').fill('1');
  await dialog.getByText('Current slide only').click();
  const dl = page.waitForEvent('download', { timeout: 90_000 });
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  const zip = unzipSync(new Uint8Array(readFileSync(await (await dl).path())));
  const clips = Object.keys(zip);
  expect(clips).toHaveLength(1);
  expect(clips[0]).toMatch(/-01\.(mp4|webm)$/);
  expect(zip[clips[0]!]!.length).toBeGreaterThan(5_000);
});
