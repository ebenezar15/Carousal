// The contract between any AI provider (or the rules splitter) and the rest of the app.
// Every field is required (nullable/empty instead of optional) so the same schema works with
// Claude structured outputs and Ollama's `format` JSON-schema mode.
import { z } from 'zod';

export const SLIDE_ROLES = ['hook', 'intro', 'body', 'list', 'step', 'stat', 'quote', 'comparison', 'summary', 'cta'] as const;
export const PALETTE_MOODS = [
  'minimal', 'bold', 'professional', 'playful', 'calm', 'dark', 'tech', 'warm', 'pastel', 'luxury', 'editorial', 'colorful',
] as const;

export const SlidePlanSchema = z.object({
  role: z.enum(SLIDE_ROLES),
  headline: z.string(),
  body: z.string(),
  bullets: z.array(z.string()),
  stat: z.object({ value: z.string(), label: z.string() }).nullable(),
  quote: z.object({ text: z.string(), attribution: z.string() }).nullable(),
  emphasis: z.array(z.string()).describe('1-2 words from the headline to visually emphasize'),
  layoutHint: z.string().describe('Short free-text layout suggestion, e.g. "giant number left"'),
  iconKeywords: z.array(z.string()),
});

export const CarouselPlanSchema = z.object({
  title: z.string(),
  language: z.string().describe('BCP-47 language code of the content, e.g. "en"'),
  paletteMood: z.enum(PALETTE_MOODS),
  slides: z.array(SlidePlanSchema),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export type SlidePlan = z.infer<typeof SlidePlanSchema>;
export type CarouselPlan = z.infer<typeof CarouselPlanSchema>;

/** JSON Schema for providers that constrain output (Claude output_config.format, Ollama format). */
export function planJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(CarouselPlanSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export const emptySlide = (role: SlidePlan['role'], headline: string, body = ''): SlidePlan => ({
  role, headline, body, bullets: [], stat: null, quote: null, emphasis: [], layoutHint: '', iconKeywords: [],
});
