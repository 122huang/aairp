import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from '@aairp/shared-kernel';
import { DeterministicHashEmbeddingProvider } from './deterministic-hash-embedding.provider.js';

describe('DeterministicHashEmbeddingProvider', () => {
  const provider = new DeterministicHashEmbeddingProvider();

  it('returns normalized vectors with configured dimensions', () => {
    const vector = provider.embed('cure diabetes clinically proven');
    expect(vector).toHaveLength(128);
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('ranks similar ad copy higher than unrelated copy', () => {
    const left = provider.embed(
      'country=SG category=health.supplement content=Clinically proven to cure diabetes',
    );
    const near = provider.embed(
      'country=SG category=health.supplement content=Clinically proven cure for diabetes fast',
    );
    const far = provider.embed(
      'country=SG category=electronics content=Wireless earbuds with noise cancellation',
    );

    expect(cosineSimilarity(left, near)).toBeGreaterThan(cosineSimilarity(left, far));
  });
});
