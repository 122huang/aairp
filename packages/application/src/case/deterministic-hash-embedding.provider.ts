import { createHash } from 'node:crypto';
import type { IEmbeddingProvider } from '@aairp/shared-kernel';
import {
  DEFAULT_CASE_EMBEDDING_DIMENSIONS,
  DEFAULT_CASE_EMBEDDING_MODEL,
  l2Normalize,
} from '@aairp/shared-kernel';

function hashToken(token: string): number {
  const digest = createHash('sha256').update(token).digest();
  return digest.readUInt32BE(0);
}

export class DeterministicHashEmbeddingProvider implements IEmbeddingProvider {
  readonly modelId: string;
  readonly dimensions: number;

  constructor(
    modelId: string = DEFAULT_CASE_EMBEDDING_MODEL,
    dimensions: number = DEFAULT_CASE_EMBEDDING_DIMENSIONS,
  ) {
    this.modelId = modelId;
    this.dimensions = dimensions;
  }

  embed(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const normalized = text.toLowerCase().trim();
    if (normalized.length === 0) {
      return vector;
    }

    const tokens = normalized.split(/\W+/).filter((token) => token.length > 0);
    const grams = tokens.flatMap((token, index) => {
      const next = tokens[index + 1];
      return next ? [`${token}`, `${token}_${next}`] : [`${token}`];
    });

    for (const gram of grams) {
      const bucket = hashToken(gram) % this.dimensions;
      vector[bucket] += 1;
    }

    return l2Normalize(vector);
  }
}
