import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === 'localhost' && url.port === '5173' ? route.continue() : route.abort('internetdisconnected');
  });
});

const png = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset);
  return { w: v.getUint32(16), h: v.getUint32(20) };
};

async function generate(page: Page, preset = 'instagram-portrait-4x5') {
  await page.goto('/');
  await page.getByLabel('Platform').selectOption(preset);
  await page.getByRole('button', { name: 'Use sample' }).click();
  await page.getByLabel('Designs').selectOption('3');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('slide').first()).toBeVisible({ timeout: 30_000 });
  return page.getByTestId('slide').count();
}

async function exportAs(page: Page, tab: string, setup?: () => Promise<void>) {
  const dialog = page.getByRole('dialog', { name: 'Export' });
  if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Export…' }).click();
  await dialog.getByRole('tab', { name: tab }).click();
  await setup?.();
  const dl = page.waitForEvent('download', { timeout: 60_000 });
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  const d = await dl;
  return { name: d.suggestedFilename(), bytes: new Uint8Array(readFileSync(await d.path())) };
}

test('ZIP of PNGs and 2× JPGs: correct names and exact pixel sizes, verified in the dialog', async ({ page }) => {
  const n = await generate(page);
  const zip = await exportAs(page, 'ZIP of images');
  expect(zip.name).toMatch(/\.zip$/);
  const files = unzipSync(zip.bytes);
  const pngs = Object.keys(files).filter((f) => f.endsWith('.png')).sort();
  expect(pngs).toHaveLength(n);
  expect(pngs[0]).toMatch(/_01\.png$/);
  expect(Object.keys(files)).toContain('caption.txt');
  for (const f of pngs) expect(png(files[f]!)).toEqual({ w: 1080, h: 1350 });
  await expect(page.getByTestId('export-row')).toHaveCount(n);
  await expect(page.locator('[data-testid="export-row"][data-ok="false"]')).toHaveCount(0);

  const dialog = page.getByRole('dialog', { name: 'Export' });
  const jpgZip = await exportAs(page, 'ZIP of images', async () => {
    await dialog.getByLabel('Image format').selectOption('jpg');
    await dialog.getByLabel('Resolution').selectOption('2');
  });
  const jpgs = unzipSync(jpgZip.bytes);
  const first = Object.keys(jpgs).find((f) => f.endsWith('_01.jpg'))!;
  expect([...jpgs[first]!.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  await expect(page.locator('[data-testid="export-row"][data-ok="false"]')).toHaveCount(0);
  await expect(page.getByTestId('export-row').first()).toContainText('2160×2700');
});

test('LinkedIn PDF: one page per slide at the preset size', async ({ page }) => {
  const n = await generate(page, 'linkedin-document-portrait-4x5');
  const pdf = await exportAs(page, 'PDF');
  expect(pdf.name).toMatch(/\.pdf$/);
  const doc = await PDFDocument.load(pdf.bytes);
  expect(doc.getPageCount()).toBe(n);
  for (const p of doc.getPages()) expect(p.getSize()).toEqual({ width: 1080, height: 1350 });
  expect(doc.getTitle()).toBeTruthy();
});

test('video (MP4/WebM) and GIF slideshows', async ({ page }) => {
  test.setTimeout(120_000);
  await generate(page);
  const dialog = page.getByRole('dialog', { name: 'Export' });
  const video = await exportAs(page, 'Video / GIF', async () => {
    await dialog.getByLabel('Seconds per slide').fill('1');
  });
  if (video.name.endsWith('.mp4')) expect(new TextDecoder().decode(video.bytes.slice(4, 8))).toBe('ftyp');
  else {
    expect(video.name).toMatch(/\.webm$/);
    expect([...video.bytes.slice(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  }
  expect(video.bytes.length).toBeGreaterThan(10_000);

  const gif = await exportAs(page, 'Video / GIF', async () => {
    await dialog.getByLabel('Video type').selectOption('gif');
    await dialog.getByLabel('Transition').selectOption('fade');
  });
  expect(new TextDecoder().decode(gif.bytes.slice(0, 6))).toBe('GIF89a');
  const v = new DataView(gif.bytes.buffer);
  expect({ w: v.getUint16(6, true), h: v.getUint16(8, true) }).toEqual({ w: 540, h: 676 });
});

test('.carousel project file round-trips through delete + open', async ({ page }) => {
  await generate(page);
  const title = (await page.locator('h1').textContent())!.trim();
  const file = await exportAs(page, 'Project file');
  expect(file.name).toMatch(/\.carousel$/);
  expect(Object.keys(unzipSync(file.bytes))).toContain('project.json');
  await page.getByRole('button', { name: 'Close export' }).click();
  await page.getByTestId('project-list').getByRole('button', { name: `Delete ${title}` }).click({ force: true });
  await expect(page.getByTestId('project-list').getByRole('button', { name: title, exact: true })).toHaveCount(0);
  await page.getByLabel('Open project file').setInputFiles({ name: file.name, mimeType: 'application/zip', buffer: Buffer.from(file.bytes) });
  await expect(page.getByRole('status').filter({ hasText: `Opened “${title}”` })).toBeVisible();
  await expect(page.getByTestId('slide').first()).toBeVisible();
});
