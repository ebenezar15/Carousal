import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

type Theme = { styleId: string; templateId?: string; series?: string };
type Cf = { __cf: { doc: { getState(): { carousel: { theme: Theme }; plan: { slides: { kicker?: string }[] } } } } };
const state = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const s = (window as unknown as Cf).__cf.doc.getState();
  return { theme: s.carousel.theme, kickers: s.plan.slides.map((x) => x.kicker ?? '') };
});

test('carousel type + template gallery: describe it, pick a template, swap templates — offline', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Cf>).__cf));
  await page.getByRole('button', { name: 'Use sample' }).click();

  // Describe the carousel: the type, slide count and series are understood offline.
  await page.getByLabel('Describe the carousel you want').fill('A 6-slide doctrine explainer, one claim per slide, series: Theology / Early Church');
  await expect(page.getByTestId('type-understood')).toContainText('Doctrine explainer');
  await expect(page.getByTestId('type-understood')).toContainText('6 slides');

  // Browse templates: the type's own templates are suggested first; pick one.
  await page.getByRole('button', { name: /Browse \d+ templates/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Templates' });
  await expect(dialog.getByTestId('template-card').first()).toBeVisible();
  await dialog.getByLabel('Search templates').fill('ink crimson');
  await dialog.getByRole('button', { name: /Use template: Early Church/ }).click();
  await expect(page.getByTestId('template-field')).toContainText('Early Church');

  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await state(page)).theme.templateId).toMatch(/^theology-editorial--early-church/);
  const s = await state(page);
  expect(s.theme.series).toBe('Theology / Early Church');
  expect(s.kickers.some((k) => /^CLAIM 0\d$/.test(k))).toBe(true);
  expect(await page.getByTestId('slide').count()).toBe(6);

  // Swap the design for another template without changing the words.
  await page.getByRole('button', { name: 'Templates…' }).click();
  const d2 = page.getByRole('dialog', { name: 'Templates' });
  await d2.getByRole('tab', { name: /Bible stories/ }).click();
  await d2.getByTestId('template-card').first().getByRole('button').click();
  await expect.poll(async () => (await state(page)).theme.styleId).toBe('sunday-school');
});
