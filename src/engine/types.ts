import type { CarouselPlan } from './schema';

export type Tone = 'professional' | 'playful' | 'bold' | 'educational';

export interface GenerateOptions {
  /** 'auto' lets the engine decide within the design-patterns sweet spot. */
  slideCount: number | 'auto';
  tone: Tone;
  audience: string;
  /** BCP-47 code, or 'auto' to keep the input's language. */
  language: string;
  maxSlides: number;
}

export const defaultOptions: GenerateOptions = {
  slideCount: 'auto',
  tone: 'professional',
  audience: '',
  language: 'auto',
  maxSlides: 20,
};

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  /** JSON schema the output must match; providers that support constrained decoding pass it on. */
  jsonSchema: Record<string, unknown>;
  signal?: AbortSignal;
}

export type ProviderId = 'claude' | 'ollama' | 'rules';

export interface AIProvider {
  id: Exclude<ProviderId, 'rules'>;
  label: string;
  /** Cheap check (key present / server reachable). Must not throw. */
  isAvailable(): Promise<boolean>;
  /** Returns the raw model text, expected to be JSON. Throws on transport/API errors. */
  complete(req: CompletionRequest): Promise<string>;
}

export interface GenerateResult {
  plan: CarouselPlan;
  provider: ProviderId;
  /** Why we ended up on the provider we used (e.g. fallback reason); shown to the user. */
  notice?: string;
  attempts: number;
}
