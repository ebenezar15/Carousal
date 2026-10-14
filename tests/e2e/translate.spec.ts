import { expect, test, type Page } from '@playwright/test';

// Translation keeps the exact design: same elements, fonts, colors and positions; only text changes.
// Claude is mocked: it "translates" each word to a Tamil word and keeps the style tags, like a real model.

const TAMIL = ['சிறிய', 'விலை', 'வாடிக்கையாளர்', 'தவறுகள்', 'பாடங்கள்', 'வளர்ச்சி', 'திட்டம்', 'முக்கியம்'];
const tamilize = (text: string) =>
  text
    .split(/(<\/?(?:em|s\d+)>|&(?:amp|lt|gt);)/)
    .map((part) => (/^<|^&/.test(part) ? part : part.replace(/[A-Za-z]+/g, (w) => TAMIL[w.length % TAMIL.length]!)))
    .join('');

type Cf = { __cf: { doc: { getState(): { carousel: { slides: { elements: Record<string, unknown>[] }[] } } }; projects: { getState(): { current: { name: string; translation?: { lang: string } } } } } };

async function mockClaude(page: Page) {
  const calls: number[] = [];
  await page.context().route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost' && url.port === '5173') return route.continue();
    if (url.hostname !== 'api.anthropic.com') return route.abort('internetdisconnected');
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postDataJSON();
    const prompt: string = body.messages.at(-1).content;
    const items = JSON.parse(prompt.slice(prompt.indexOf('{'))).items as { id: string; text: string }[];
    calls.push(items.length);
    const text = JSON.stringify({ items: items.map((i) => ({ id: i.id, text: tamilize(i.text) })) });
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 10, output_tokens: 10 } }),
    });
  });
  return calls;
}

const snapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as Cf).__cf.doc.getState().carousel.slides.map((s) => s.elements.map((e) => ({ kind: e.kind, x: e.x, y: e.y, w: e.width, fontId: e.fontId, fill: e.fill, text: e.text }))));

test('translates a carousel into Tamil with the same design, then reuses the translation memory', async ({ page }) => {
  test.setTimeout(120_000);
  const calls = await mockClaude(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Pricing lessons/ }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  // Add a Claude key only now, so the sample itself was laid out offline.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'API key', exact: true }).fill('sk-ant-test-key');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Cf>).__cf));
  const before = await snapshot(page);
  const originalName = await page.getByLabel('Project name').inputValue();

  await page.getByRole('button', { name: 'Translate…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Translate carousel' });
  await dialog.getByLabel('Language', { exact: true }).selectOption('ta');
  await expect(dialog.getByRole('radio', { name: /AI model/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Translate' }).click();
  await expect(dialog.getByTestId('tr-summary')).toContainText('translated', { timeout: 30_000 });
  expect(calls.length).toBeGreaterThan(0);
  // Review: fix one line by hand before creating the copy.
  await dialog.getByLabel('Only lines that need attention').uncheck();
  const first = dialog.getByRole('textbox').first();
  await first.fill(`${await first.inputValue()} ✓`);
  await dialog.getByRole('button', { name: 'Create Tamil copy' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  await expect.poll(() => page.evaluate(() => (window as unknown as Cf).__cf.projects.getState().current.translation?.lang)).toBe('ta');
  await expect(page.getByLabel('Project name')).toHaveValue(/தமிழ்/);
  const after = await snapshot(page);
  // Same design: element count, kinds, positions and fonts are unchanged; text is Tamil.
  expect(after.map((s) => s.length)).toEqual(before.map((s) => s.length));
  after.forEach((slide, i) =>
    slide.forEach((el, j) => {
      const b = before[i]![j]!;
      expect({ kind: el.kind, x: el.x, y: el.y, w: el.w, fontId: el.fontId, fill: el.fill }).toEqual({ kind: b.kind, x: b.x, y: b.y, w: b.w, fontId: b.fontId, fill: b.fill });
      if (el.kind === 'text' && /[A-Za-z]{3}/.test(String(b.text)) && !/^[@#]/.test(String(b.text))) expect(String(el.text)).toMatch(/[஀-௿]/);
    }),
  );
  // The Tamil fallback fonts were loaded (sans and/or serif/display variants of the design's fonts).
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].filter((f) => f.family.startsWith('cf-fb-') && f.status === 'loaded').length))
    .toBeGreaterThan(0);

  // Translating the original again uses the memory: no model calls.
  calls.length = 0;
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: originalName, exact: true }).click();
  await expect(page.locator('h1')).toHaveText(originalName);
  await page.getByRole('button', { name: 'Translate…' }).click();
  const again = page.getByRole('dialog', { name: 'Translate carousel' });
  await again.getByLabel('Language', { exact: true }).selectOption('ta');
  await again.getByRole('button', { name: 'Translate' }).click();
  await expect(again.getByTestId('tr-summary')).toContainText('from memory', { timeout: 30_000 });
  expect(calls.length).toBe(0);
});

test('manual translation works fully offline', async ({ page }) => {
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Pricing lessons/ }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Translate…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Translate carousel' });
  await dialog.getByLabel('Language', { exact: true }).selectOption('hi');
  await dialog.getByRole('radio', { name: /Type it myself/ }).check();
  await dialog.getByRole('button', { name: 'Start' }).click();
  const boxes = dialog.getByRole('textbox');
  await expect(boxes.first()).toBeVisible();
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).fill('मूल्य निर्धारण');
  await dialog.getByRole('button', { name: 'Create Hindi copy' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue(/हिन्दी/, { timeout: 30_000 });
});
