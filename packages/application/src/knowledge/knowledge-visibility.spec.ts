import { describe, expect, it } from 'vitest';
import { buildKnowledgeGraphSnapshot } from './knowledge-graph-builder.js';
import {
  buildKnowledgeVisibilitySnapshot,
  DRAFT_PACK_WARNING,
  VISIBILITY_SNAPSHOT_SCHEMA,
} from './knowledge-visibility-snapshot.js';

const NOW = new Date('2026-07-01T12:00:00.000Z');

describe('knowledge visibility snapshot', () => {
  it('builds snapshot with five corpora and embedded graph', () => {
    const snapshot = buildKnowledgeVisibilitySnapshot({ now: NOW });

    expect(snapshot.schema_version).toBe(VISIBILITY_SNAPSHOT_SCHEMA);
    expect(snapshot.platform.corpora).toHaveLength(5);
    expect(snapshot.graph.nodes.length).toBeGreaterThan(0);
    expect(snapshot.graph.edges.length).toBeGreaterThan(0);
    expect(snapshot.graph.indexes.skills.length).toBeGreaterThan(0);
    expect(snapshot.quality_vs_coverage.kqs_by_corpus.regulation).toBeGreaterThan(0);
    expect(snapshot.improvement_queue).toBeDefined();
    expect(snapshot.improvement_queue.p2_gaps).toBeGreaterThanOrEqual(0);
  });

  it('shows draft warning when no released pack is active', () => {
    const snapshot = buildKnowledgeVisibilitySnapshot({ now: NOW });
    if (snapshot.knowledge_pack.release_status !== 'released') {
      expect(snapshot.knowledge_pack.draft_warning).toBe(DRAFT_PACK_WARNING);
    }
  });

  it('graph includes skill-centric edges', () => {
    const graph = buildKnowledgeGraphSnapshot();
    const skillNode = graph.nodes.find((node) => node.corpus_type === 'skill');
    expect(skillNode).toBeTruthy();
    const skillEdges = graph.edges.filter((edge) => edge.from === skillNode?.id);
    expect(skillEdges.length).toBeGreaterThan(0);
    expect(skillEdges.some((edge) => edge.relation === 'governed_by')).toBe(true);
  });
});
