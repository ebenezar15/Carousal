import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAIProvider, listOpenAIModels } from '@/engine/providers/openai';
import { contextFor, createOllamaProvider, pullOllamaModel } from '@/engine/providers/ollama';
import { deleteSecret, setSecret } from '@/secrets';

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteSecret('openrouter_api_key');
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('OpenAI-compatible provider (free / local models)', () => {
  it('needs a key for online services and a model', async () => {
    const p = createOpenAIProvider(() => ({ preset: 'openrouter', baseUrl: '', model: 'meta-llama/llama-3.3-70b-instruct:free' }));
    expect(await p.isAvailable()).toBe(false);
    await setSecret('openrouter_api_key', 'or-key', false);
    expect(await p.isAvailable()).toBe(true);
    expect(await createOpenAIProvider(() => ({ preset: 'openrouter', baseUrl: '', model: '' })).isAvailable()).toBe(false);
  });

  it('lists only free OpenRouter models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ data: [{ id: 'a/paid', pricing: { prompt: '0.000001', completion: '0.000002' } }, { id: 'b/free:free', pricing: { prompt: '0', completion: '0' } }] })));
    expect(await listOpenAIModels({ preset: 'openrouter', baseUrl: '' })).toEqual([{ id: 'b/free:free', free: true }]);
  });

  it('sends JSON mode with the schema in the prompt, the key, and the quick-task model', async () => {
    await setSecret('openrouter_api_key', 'or-key', false);
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => ok({ choices: [{ message: { content: 'Here: ```json\n{"ok":true}\n```' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = createOpenAIProvider(() => ({ preset: 'openrouter', baseUrl: '', model: 'big:free', fastModel: 'small:free' }));
    const out = await p.complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], jsonSchema: { type: 'object' }, tier: 'fast' });
    expect(JSON.parse(out)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer or-key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'small:free', response_format: { type: 'json_object' } });
    expect(body.messages[0].content).toContain('{"type":"object"}');
  });

  it('retries without response_format for local servers that reject it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"response_format json_object is not supported"}', { status: 400 }))
      .mockResolvedValueOnce(ok({ choices: [{ message: { content: '{"ok":1}' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = createOpenAIProvider(() => ({ preset: 'lmstudio', baseUrl: '', model: 'local-model' }));
    expect(await p.complete({ system: 's', messages: [{ role: 'user', content: 'x' }], jsonSchema: {} })).toBe('{"ok":1}');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).response_format).toBeUndefined();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:1234/v1/chat/completions');
  });

  it('explains free-tier rate limits', async () => {
    await setSecret('openrouter_api_key', 'k', false);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));
    const p = createOpenAIProvider(() => ({ preset: 'openrouter', baseUrl: '', model: 'm' }));
    await expect(p.complete({ system: 's', messages: [{ role: 'user', content: 'x' }], jsonSchema: {} })).rejects.toThrow(/rate limit/);
  });
});

describe('Ollama efficiency and model manager', () => {
  it('sizes the context window to the request', () => {
    expect(contextFor(500, 4096)).toBe(6144);
    expect(contextFor(9000, 4096)).toBe(14336);
    expect(contextFor(100000, 4096)).toBe(32768);
  });

  it('uses the quick-task model for fast requests and keeps the model loaded', async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => ok({ message: { content: '{}' } }));
    vi.stubGlobal('fetch', fetchMock);
    const p = createOllamaProvider(() => ({ baseUrl: 'http://localhost:11434', model: 'gemma3:12b', fastModel: 'gemma3:4b' }));
    await p.complete({ system: 's', messages: [{ role: 'user', content: 'x' }], jsonSchema: {}, tier: 'fast' });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({ model: 'gemma3:4b', keep_alive: '30m' });
  });

  it('streams pull progress line by line and surfaces errors', async () => {
    const lines = ['{"status":"pulling manifest"}', '{"status":"downloading","completed":50,"total":100}', '{"status":"success"}'];
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(lines[0] + '\n' + lines[1]!.slice(0, 10)));
        c.enqueue(enc.encode(lines[1]!.slice(10) + '\n' + lines[2] + '\n'));
        c.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));
    const seen: string[] = [];
    await pullOllamaModel('http://localhost:11434', 'gemma3:4b', (p) => seen.push(`${p.status}${p.completed ? `:${p.completed}/${p.total}` : ''}`));
    expect(seen).toEqual(['pulling manifest', 'downloading:50/100', 'success']);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"pull model manifest: file does not exist"}\n', { status: 200 })));
    await expect(pullOllamaModel('http://localhost:11434', 'nope', () => {})).rejects.toThrow(/does not exist/);
  });
});
