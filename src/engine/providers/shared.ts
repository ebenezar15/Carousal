// Helpers shared by providers that run in plain JSON mode (Ollama, OpenAI-compatible servers).

/**
 * The schema goes into the prompt instead of a grammar constraint: grammar-constrained decoding emits
 * keys alphabetically (role and title last), which in live tests made small models write repetitive,
 * role-less slides and run several times longer.
 */
export function schemaPrompt(system: string, jsonSchema: Record<string, unknown>): string {
  return `${system}

Reply with a single JSON object only, no prose. It must match this JSON Schema, with keys in the order listed:
${JSON.stringify(jsonSchema)}`;
}

/** Rough token estimate (≈3.5 chars/token for Latin text; scripts like Tamil use more tokens per char). */
export function estimateTokens(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 0x24f ? 1 : 0.28;
  return Math.ceil(n);
}
