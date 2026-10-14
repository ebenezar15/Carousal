import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaProvider, listOllamaModels } from '@/engine/providers/ollama';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => '' } as Response);

describe('Ollama detection', () => {
  it('lists models when the server responds', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ models: [{ name: 'qwen2.5:7b' }] })));
    expect(await listOllamaModels()).toEqual([{ name: 'qwen2.5:7b' }]);
  });

  it('returns null when the server is not running', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await listOllamaModels()).toBeNull();
  });

  it('is unavailable with no models installed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ models: [] })));
    const p = createOllamaProvider(() => ({ baseUrl: 'http://localhost:11434', model: '' }));
    expect(await p.isAvailable()).toBe(false);
  });

  it('asks for JSON mode with the schema in the system prompt and returns the message content', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/api/tags') ? json({ models: [{ name: 'llama3.2:latest' }] }) : json({ message: { content: '{"ok":true}' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const p = createOllamaProvider(() => ({ baseUrl: 'http://localhost:11434', model: 'llama3.2' }));
    expect(await p.isAvailable()).toBe(true);
    const out = await p.complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], jsonSchema: { type: 'object' } });
    expect(out).toBe('{"ok":true}');
    const body = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ model: 'llama3.2', stream: false, format: 'json', options: { num_ctx: 8192, num_predict: 4096 } });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toMatch(/^sys\n\nReply with a single JSON object only/);
    expect(body.messages[0].content).toContain('{"type":"object"}');
  });
});
