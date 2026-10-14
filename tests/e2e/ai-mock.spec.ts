import { expect, test } from '@playwright/test';

// Exercises the online Claude path in a real browser against a mocked Anthropic API
// (no key or network needed): plan generation, slide rewrite and headline alternatives.

const slide = (role: string, headline: string, body = '', extra: Record<string, unknown> = {}) => ({
  role, headline, body, bullets: [], stat: null, quote: null, emphasis: [], layoutHint: '', iconKeywords: [], ...extra,
});

const PLAN = {
  title: 'Ship smaller, ship sooner',
  language: 'en',
  paletteMood: 'bold',
  caption: 'Small batches beat big launches.',
  hashtags: ['shipping', 'product'],
  slides: [
    slide('hook', '5 reasons small releases win', 'A playbook for busy teams', { emphasis: ['small'] }),
    slide('intro', 'Big launches hide risk', 'When everything ships at once, nobody knows what broke.'),
    slide('list', 'What changes', '', { bullets: ['Faster feedback', 'Easier rollbacks', 'Calmer on-call'] }),
    slide('stat', 'Fewer incidents', '', { stat: { value: '46%', label: 'fewer rollbacks' } }),
    slide('cta', 'Save this for sprint planning', 'Share it with your team lead.'),
  ],
};

test('generates, rewrites a slide and suggests headlines with Claude (mocked API)', async ({ page }) => {
  const seen: { beta?: string; key?: string; body: { model: string; messages: { content: string }[]; output_config?: unknown } }[] = [];
  await page.context().route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost' && url.port === '5173') return route.continue();
    if (url.hostname !== 'api.anthropic.com') return route.abort('internetdisconnected');
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postDataJSON();
    const headers = req.headers();
    seen.push({ beta: headers['anthropic-beta'], key: headers['x-api-key'], body });
    const prompt: string = body.messages.at(-1).content;
    let text: string;
    if (prompt.includes('alternative headlines')) text = JSON.stringify({ options: ['Small releases, big wins', 'Stop shipping monoliths', 'Why tiny PRs ship faster'] });
    else if (prompt.includes('Rewrite slide')) text = JSON.stringify(slide('intro', 'Big launches bury the bug', 'Ship in slices so every change is easy to trace.'));
    else text = JSON.stringify(PLAN);
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 10, output_tokens: 10 } }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Claude (online)').click();
  await page.getByRole('textbox', { name: 'API key', exact: true }).fill('sk-ant-test-key');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByText('● saved').first()).toBeVisible();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  await page.getByLabel('Your content').fill('Shipping in small batches reduces risk and speeds up feedback.');
  await page.getByRole('button', { name: 'Generate carousel' }).click();
  await expect(page.getByTestId('generated-by')).toContainText('copy by Claude', { timeout: 30_000 });
  await expect(page.locator('h1')).toHaveText('Ship smaller, ship sooner');
  await expect(page.getByTestId('slide')).toHaveCount(5);

  const first = seen[0]!;
  expect(first.key).toBe('sk-ant-test-key');
  expect(first.beta).toContain('server-side-fallback-2026-07-01');
  expect(first.body.model).toBe('claude-opus-5-5');
  expect(first.body.output_config).toMatchObject({ format: { type: 'json_schema' } });

  // Rewrite slide 2 via AI.
  await page.getByRole('button', { name: 'Rewrite slide 2' }).click();
  await page.getByRole('button', { name: 'Show generated plan (JSON)' }).click();
  await expect(page.getByTestId('plan-json')).toContainText('Big launches bury the bug');

  // Headline alternatives for the hook.
  await page.getByRole('button', { name: 'Alternative headlines for slide 1' }).click();
  await page.getByRole('option', { name: 'Stop shipping monoliths' }).click();
  await expect(page.getByTestId('plan-json')).toContainText('Stop shipping monoliths');
});
