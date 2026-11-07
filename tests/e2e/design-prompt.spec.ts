import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

type Cf = { __cf: { doc: { getState(): { carousel: { theme: { styleId: string; motion?: string; modifiers?: { continuous?: string } }; slides: { elements: { anim?: unknown }[] }[] } } } } };
const theme = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as Cf).__cf.doc.getState().carousel.theme);

test('describe the look: style chips, prompts, motion and restyle — all offline', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Cf>).__cf));
  await page.getByRole('button', { name: 'Use sample' }).click();

  // A style chip fills the prompt; the field shows what was understood.
  await page.getByRole('button', { name: 'Clay', exact: true }).click();
  await expect(page.getByTestId('design-understood')).toContainText('Clay style');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await theme(page)).styleId).toBe('clay-3d');
  await expect(page.getByTestId('variation').first().locator('h3')).toContainText('Clay');
  // Slides animate in the style's motion.
  expect(await page.evaluate(() => (window as unknown as Cf).__cf.doc.getState().carousel.slides[0]!.elements.some((e) => e.anim))).toBe(true);

  // Motion can be switched off.
  await page.getByLabel('Motion').selectOption('none');
  await expect.poll(async () => (await theme(page)).motion).toBe('none');

  // Restyle from a free-text prompt.
  await page.getByLabel('Restyle with a prompt').fill('graffiti on a dark wall with a ribbon across slides');
  await page.getByRole('button', { name: 'Apply look' }).click();
  await expect.poll(async () => (await theme(page)).styleId).toBe('graffiti-street');
  expect((await theme(page)).modifiers?.continuous).toBe('ribbon');
  await expect(page.getByRole('status').filter({ hasText: 'Graffiti style' })).toBeVisible();
});
