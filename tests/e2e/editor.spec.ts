import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

// Editor end-to-end tests (offline). Uses the dev-only window.__cf hook to read state/geometry.

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

type El = { id: string; kind: string; x: number; y: number; width: number; height: number; text?: string; slot?: string; locked?: boolean; hidden?: boolean; fontSize?: number };

const state = (page: Page) =>
  page.evaluate(() => {
    const cf = (window as unknown as { __cf: { doc: { getState(): { carousel: { slides: { elements: El[]; id: string }[] }; plan: { slides: { headline: string }[] } } }; editor: { getState(): { slideIndex: number; selection: string[] } } } }).__cf;
    const d = cf.doc.getState();
    const e = cf.editor.getState();
    return { slides: d.carousel.slides.map((s) => ({ id: s.id, elements: s.elements })), plan: d.plan, slideIndex: e.slideIndex, selection: e.selection };
  });

/** Screen coordinates of an element's center (via Konva). */
const center = (page: Page, id: string) =>
  page.evaluate((elId) => {
    const K = (window as unknown as { __cf: { Konva: { stages: { findOne(s: string): { getClientRect(): { x: number; y: number; width: number; height: number } } | undefined; container(): HTMLElement }[] } } }).__cf.Konva;
    for (const st of K.stages) {
      const n = st.findOne(`#${elId}`);
      if (!n) continue;
      const r = n.getClientRect();
      const b = st.container().getBoundingClientRect();
      return { x: b.left + r.x + r.width / 2, y: b.top + r.y + r.height / 2 };
    }
    throw new Error('node not found');
  }, id);

async function openEditor(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use sample' }).click();
  await page.getByLabel('Designs').selectOption('3');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await page.getByRole('button', { name: 'Open in editor →' }).click();
  await expect(page.getByTestId('editor-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __cf?: unknown }).__cf));
  await expect(page.getByTestId('editor-slide-thumb')).not.toHaveCount(0);
}

function tinyPng(): Buffer {
  // 2×2 red PNG built by hand (no binary fixture needed).
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255, 0, 0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('select, drag with undo/redo, nudge, inline edit and plan sync', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-slide-thumb').nth(1).click();
  let s = await state(page);
  const head = s.slides[1]!.elements.find((e) => e.slot === 'headline')!;

  // Click to select, drag to move.
  const c = await center(page, head.id);
  await page.mouse.click(c.x, c.y);
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 70, c.y + 3, { steps: 8 });
  await page.mouse.up();
  s = await state(page);
  const moved = s.slides[1]!.elements.find((e) => e.id === head.id)!;
  expect(moved.x).toBeGreaterThan(head.x + 30);

  // Undo/redo.
  await page.keyboard.press('Control+z');
  s = await state(page);
  expect(s.slides[1]!.elements.find((e) => e.id === head.id)!.x).toBe(head.x);
  await page.keyboard.press('Control+Shift+z');
  s = await state(page);
  expect(s.slides[1]!.elements.find((e) => e.id === head.id)!.x).toBe(moved.x);

  // Arrow nudge (shift = 10px).
  await page.keyboard.press('Shift+ArrowRight');
  s = await state(page);
  expect(s.slides[1]!.elements.find((e) => e.id === head.id)!.x).toBe(moved.x + 10);

  // Double-click → inline edit → text and plan updated.
  const c2 = await center(page, head.id);
  await page.mouse.dblclick(c2.x, c2.y);
  const ta = page.getByRole('textbox', { name: 'Edit text' });
  await expect(ta).toBeVisible();
  await ta.fill('Edited on canvas');
  await page.getByRole('button', { name: 'Done' }).click();
  s = await state(page);
  expect(s.slides[1]!.elements.find((e) => e.id === head.id)!.text).toBe('Edited on canvas');
  expect(s.plan.slides[1]!.headline).toBe('Edited on canvas');

  // Theme swap from the Design tab keeps the edited text.
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByLabel('Style system').selectOption('neo-pop');
  await expect.poll(async () => (await state(page)).slides[1]!.elements.some((e) => e.text === 'Edited on canvas')).toBe(true);
});

test('insert elements, layers, group, copy/paste across slides, slide ops', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('tab', { name: 'Insert' }).click();
  for (const name of ['Heading', 'Bullet list', 'circle', 'Arrow', 'Badge', 'Callout', 'Bar chart', 'Pie chart', 'Table', 'QR code', 'Progress dots']) {
    await page.getByTestId('insert-panel').getByRole('button', { name, exact: true }).click();
  }
  await page.getByLabel('Search icons').fill('rocket');
  await page.getByRole('button', { name: 'Insert icon rocket' }).click();
  await page.getByLabel('Upload images').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: tinyPng() });
  await expect.poll(async () => (await state(page)).slides[0]!.elements.filter((e) => !e.slot).length).toBe(13);
  const kinds = new Set((await state(page)).slides[0]!.elements.filter((e) => !e.slot).map((e) => e.kind));
  for (const k of ['text', 'ellipse', 'line', 'group', 'chart', 'table', 'qr', 'path', 'image']) expect(kinds).toContain(k);

  // Layers: lock + hide the top layer.
  await page.getByRole('tab', { name: 'Layers' }).click();
  const top = page.getByTestId('layer-row').first();
  await top.hover();
  await top.getByRole('button', { name: 'Lock layer' }).click();
  await top.getByRole('button', { name: 'Hide layer' }).click();
  let s = await state(page);
  const topEl = s.slides[0]!.elements.at(-1)!;
  expect(topEl.locked).toBe(true);
  expect(topEl.hidden).toBe(true);

  // Select two inserted elements, group with Ctrl+G, copy, paste on slide 3.
  const userIds = s.slides[0]!.elements.filter((e) => !e.slot && e.kind === 'ellipse' || e.kind === 'qr').map((e) => e.id);
  await page.evaluate((ids) => (window as unknown as { __cf: { editor: { getState(): { select(i: string[]): void } } } }).__cf.editor.getState().select(ids), userIds);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.evaluate((ids) => (window as unknown as { __cf: { editor: { getState(): { select(i: string[]): void } } } }).__cf.editor.getState().select(ids), userIds);
  await page.keyboard.press('Control+g');
  s = await state(page);
  const groupEl = s.slides[0]!.elements.find((e) => e.kind === 'group' && s.selection.includes(e.id))!;
  expect(groupEl).toBeTruthy();
  await page.keyboard.press('Control+c');
  await page.getByRole('tab', { name: 'Slides' }).click();
  await page.getByTestId('editor-slide-thumb').nth(2).click();
  await page.keyboard.press('Control+v');
  s = await state(page);
  expect(s.slides[2]!.elements.some((e) => e.kind === 'group')).toBe(true);

  // Slide ops.
  const n = s.slides.length;
  await page.getByRole('button', { name: '+ Slide' }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  s = await state(page);
  expect(s.slides.length).toBe(n + 2);
  expect(s.plan.slides.length).toBe(n + 2);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  s = await state(page);
  expect(s.slides.length).toBe(n + 1);
  // Drag-reorder: move slide 1 below slide 2.
  const first = s.slides[0]!.id;
  await page.getByTestId('editor-slide-thumb').nth(0).dragTo(page.getByTestId('editor-slide-thumb').nth(1));
  s = await state(page);
  expect(s.slides[1]!.id).toBe(first);
});

test('find & replace, template save/apply, brand kit, exact export size', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('button', { name: /Find & replace/ }).click();
  await page.getByLabel('Find', { exact: true }).fill('writing');
  await page.getByLabel('Replace with').fill('documents');
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Replaced \d+ occurrence/ })).toBeVisible();

  // Brand kit.
  await page.getByRole('button', { name: /Brand kit/ }).click();
  await page.getByRole('button', { name: 'New brand kit' }).click();
  await page.getByLabel('Brand name').fill('Acme');
  await page.getByLabel('Brand handle').fill('@acme');
  await page.getByText('Watermark (logo + handle on every slide)').click();
  await page.getByRole('button', { name: 'Save kit' }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect.poll(async () => (await state(page)).slides.every((s) => s.elements.some((e) => e.slot === 'watermark'))).toBe(true);

  // Save as template, then apply a built-in template design.
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByLabel('Template name').fill('My look');
  await page.getByRole('button', { name: 'Save current design' }).click();
  await expect(page.getByTestId('template-item').filter({ hasText: 'My look' })).toBeVisible();
  await page.getByLabel('Style', { exact: true }).selectOption('dark-tech');
  await page.getByRole('button', { name: 'Apply design Dark Tech' }).click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __cf: { doc: { getState(): { carousel: { theme: { styleId: string } } } } } }).__cf.doc.getState().carousel.theme.styleId)).toBe('dark-tech');

  // Export current slide at exact size.
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await dialog.getByRole('tab', { name: 'Separate images' }).click();
  await dialog.getByText('Current slide only').click();
  const dl = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  const b = readFileSync(await (await dl).path());
  expect({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) }).toEqual({ w: 1080, h: 1350 });
});

test('image tools: upload, mask, filters and offline background removal', async ({ page }) => {
  test.setTimeout(90_000);
  await openEditor(page);
  await page.getByRole('tab', { name: 'Insert' }).click();
  await page.getByLabel('Upload images').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: tinyPng() });
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.getByLabel('Mask').selectOption('circle');
  await page.getByText('Black & white').click();
  let s = await state(page);
  const img = s.slides[0]!.elements.find((e) => e.kind === 'image') as El & { src: string; mask?: string; filters?: { grayscale?: boolean } };
  expect(img.mask).toBe('circle');
  expect(img.filters?.grayscale).toBe(true);
  await page.getByRole('button', { name: 'Remove background' }).click();
  await expect.poll(async () => {
    s = await state(page);
    return (s.slides[0]!.elements.find((e) => e.id === img.id) as El & { src: string }).src;
  }, { timeout: 60_000 }).not.toBe(img.src);
  await expect(page.getByText(/Background removal failed/)).toHaveCount(0);
});
