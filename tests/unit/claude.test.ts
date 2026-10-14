import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClaudeProvider, ClaudeRefusalError } from '@/engine/providers/claude';
import { CLAUDE_KEY, deleteSecret, setSecret } from '@/secrets';

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteSecret(CLAUDE_KEY);
});

function messageResponse(body: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 1, output_tokens: 1 }, ...body }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('Claude provider', () => {
  it('is unavailable without a key', async () => {
    expect(await createClaudeProvider(() => 'claude-opus-5-5').isAvailable()).toBe(false);
  });

  it('sends structured-output config, server-side fallback and the user key', async () => {
    await setSecret(CLAUDE_KEY, 'sk-ant-test', false);
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => messageResponse({ content: [{ type: 'text', text: '{"ok":true}' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = createClaudeProvider(() => 'claude-opus-5-5');
    expect(await p.isAvailable()).toBe(true);
    const out = await p.complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], jsonSchema: { type: 'object' } });
    expect(out).toBe('{"ok":true}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v1/messages');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('sk-ant-test');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      system: [{ type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } }],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
    expect(body.betas).toBeUndefined(); // the SDK moves betas into the header
  });

  it('runs quick tasks on the fast model at low effort', async () => {
    await setSecret(CLAUDE_KEY, 'sk-ant-test', false);
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => messageResponse({ content: [{ type: 'text', text: '{}' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await createClaudeProvider(() => 'claude-opus-5-5', () => 'claude-haiku-5-5').complete({ system: 's', messages: [{ role: 'user', content: 'x' }], jsonSchema: {}, tier: 'fast' });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } });
    expect(body.fallbacks).toBeUndefined();
  });

  it('surfaces refusals as a typed error', async () => {
    await setSecret(CLAUDE_KEY, 'sk-ant-test', false);
    vi.stubGlobal('fetch', vi.fn(async () => messageResponse({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'nope' } })));
    await expect(createClaudeProvider(() => 'claude-opus-5-5').complete({ system: '', messages: [{ role: 'user', content: 'x' }], jsonSchema: {} })).rejects.toBeInstanceOf(ClaudeRefusalError);
  });
});
