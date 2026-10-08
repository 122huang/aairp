/** Shared DeepSeek descriptive interpreter. Meaning-only; no Legal decision. */

export const SEMANTIC_DESCRIPTIVE_MODEL = 'deepseek-v4-pro';

export const DESCRIPTIVE_INSTRUCTIONS = [
  'You write a grounded descriptive semantic proposal for advertising copy.',
  'Say what the sentence means to a consumer: the metric, the numeric relation, and the predicate in ordinary words.',
  'Copy primary_grounding_span from the copy. Do not invent a span.',
  'Do not output PASS, WARN, REVIEW, REJECT, A-F grades, legal policy, remediation, rewrite, evidence sufficiency, or a final finding.',
  'Do not force an ontology enum. If the number is a discount, date, model, SKU, ticket, or an unrelated count, set material false and propositions empty.',
  'Return JSON with key propositions. Each item: primary_grounding_span, supporting_grounding_spans, material, consumer_meaning, metric, relation, predicate, quantity_value, quantity_low, quantity_high, unit.',
].join(' ');

export type SemanticDescriptiveGateway = (input: {
  copy: string;
  country: string;
  category: string;
  anchors: unknown[];
  key: string;
  timeoutMs: number;
}) => Promise<{ propositions: unknown[]; error?: string }>;

function messageText(response: {
  output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
}): string {
  return (response.output ?? [])
    .filter((item) => item.type === 'message')
    .map((item) => (item.content ?? []).map((part) => part.text ?? '').join(''))
    .join('');
}

function parseJson(text: string): { propositions?: unknown[] } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('no json object');
  }
  return JSON.parse(text.slice(start, end + 1)) as { propositions?: unknown[] };
}

export const invokeSemanticDescriptiveGateway: SemanticDescriptiveGateway = async (input) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const res = await fetch('https://api.deepseek.com/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SEMANTIC_DESCRIPTIVE_MODEL,
        store: false,
        temperature: 0,
        instructions: DESCRIPTIVE_INSTRUCTIONS,
        input: JSON.stringify({
          copy: input.copy,
          country: input.country,
          category: input.category,
          anchors: input.anchors,
        }),
        text: { format: { type: 'json_object' } },
      }),
    });
    const json = (await res.json()) as {
      output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
    };
    if (!res.ok) {
      return { propositions: [], error: 'http' };
    }
    return { propositions: parseJson(messageText(json)).propositions ?? [] };
  } catch {
    return { propositions: [], error: 'provider' };
  } finally {
    clearTimeout(timer);
  }
};
