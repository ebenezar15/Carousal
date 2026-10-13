import { describe, expect, it, vi } from 'vitest';
import { extractJson, generatePlan, parsePlan, runProvider } from '@/engine/generate';
import { planFromText } from '@/engine/rules';
import { planJsonSchema } from '@/engine/schema';
import { defaultOptions, type AIProvider } from '@/engine/types';
import { ARTICLE } from './fixtures';

const validPlan = planFromText(ARTICLE, defaultOptions);

function fakeProvider(responses: (string | Error)[], available = true): AIProvider & { calls: number; lastMessages: unknown[] } {
  const p = {
    id: 'ollama' as const,
    label: 'Fake',
    calls: 0,
    lastMessages: [] as unknown[],
    isAvailable: async () => available,
    complete: vi.fn(async (req: { messages: unknown[] }) => {
      p.lastMessages = [...req.messages];
      const r = responses[Math.min(p.calls++, responses.length - 1)]!;
      if (r instanceof Error) throw r;
      return r;
    }),
  };
  return p;
}

describe('extractJson', () => {
  it('handles fenced, chatty and plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":{"b":2}} Hope that helps')).toEqual({ a: { b: 2 } });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parsePlan', () => {
  it('accepts a valid plan', () => {
    expect(parsePlan(JSON.stringify(validPlan)).ok).toBe(true);
  });
  it('reports schema errors with paths', () => {
    const bad = { ...validPlan, slides: [{ ...validPlan.slides[0], role: 'banner' }] };
    const r = parsePlan(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('slides.0.role');
  });
  it('rejects empty slide lists', () => {
    expect(parsePlan(JSON.stringify({ ...validPlan, slides: [] })).ok).toBe(false);
  });
});

describe('planJsonSchema', () => {
  it('is a plain object schema with required slides', () => {
    const s = planJsonSchema() as { type: string; required: string[]; $schema?: string };
    expect(s.type).toBe('object');
    expect(s.required).toContain('slides');
    expect(s.$schema).toBeUndefined();
  });
});

describe('runProvider repair loop', () => {
  it('repairs invalid output and sends the errors back', async () => {
    const p = fakeProvider(['not json', '{"title": 3}', JSON.stringify(validPlan)]);
    const { plan, attempts } = await runProvider(p, ARTICLE, defaultOptions);
    expect(attempts).toBe(3);
    expect(plan.slides[0]!.role).toBe('hook');
    const last = p.lastMessages.at(-1) as { content: string };
    expect(last.content).toContain('did not match the required schema');
  });

  it('gives up after the max repairs', async () => {
    const p = fakeProvider(['nope']);
    await expect(runProvider(p, ARTICLE, defaultOptions)).rejects.toThrow(/after 2 repair attempts/);
    expect(p.calls).toBe(3);
  });
});

describe('generatePlan provider selection', () => {
  it('uses rules directly when requested', async () => {
    const p = fakeProvider([JSON.stringify(validPlan)]);
    const r = await generatePlan(ARTICLE, defaultOptions, 'rules', [p]);
    expect(r.provider).toBe('rules');
    expect(p.calls).toBe(0);
  });

  it('uses an available provider', async () => {
    const r = await generatePlan(ARTICLE, defaultOptions, 'auto', [fakeProvider([JSON.stringify(validPlan)])]);
    expect(r.provider).toBe('ollama');
    expect(r.notice).toBeUndefined();
  });

  it('falls back to rules with a notice when the provider is unavailable', async () => {
    const r = await generatePlan(ARTICLE, defaultOptions, 'auto', [fakeProvider([], false)]);
    expect(r.provider).toBe('rules');
    expect(r.notice).toMatch(/unavailable.*built-in rules/);
  });

  it('falls back to rules when the provider errors', async () => {
    const r = await generatePlan(ARTICLE, defaultOptions, 'ollama', [fakeProvider([new Error('boom')])]);
    expect(r.provider).toBe('rules');
    expect(r.notice).toContain('boom');
  });

  it('normalizes AI output (hook first, CTA last)', async () => {
    const shuffled = { ...validPlan, slides: [...validPlan.slides].reverse() };
    const r = await generatePlan(ARTICLE, defaultOptions, 'auto', [fakeProvider([JSON.stringify(shuffled)])]);
    expect(r.plan.slides[0]!.role).toBe('hook');
    expect(r.plan.slides.at(-1)!.role).toBe('cta');
  });
});
