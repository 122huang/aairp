import { describe, expect, it } from 'vitest';
import type { ClaimOpinion, DemoReviewResponse } from '@/api/review';
import {
  applyEvidenceListAction,
  captureReviewInputSnapshot,
  fingerprintFile,
  isBoundReviewResultStale,
  isReviewInputSnapshotEqual,
  reviewInputSnapshotId,
  shouldAcceptReviewResponse,
  type EvidenceListAction,
  type ReviewInputSnapshot,
} from './review-input-snapshot';

function file(name: string, size = 100, lastModified = 1): File {
  return { name, size, lastModified } as File;
}

const base = {
  countryId: 'MY',
  categoryId: 'sa.oven_steamer',
  adType: '',
  productSku: '',
  copy: 'Stainless steel reversible rack.',
  images: [] as File[],
  evidence: [] as File[],
  evidenceSourceType: 'INTERNAL_TEST',
};

function snap(overrides: Partial<typeof base> = {}): ReviewInputSnapshot {
  return captureReviewInputSnapshot({ ...base, ...overrides });
}

function createLatestMaterialStore(initial: typeof base) {
  let latest = {
    ...initial,
    evidence: [...initial.evidence],
    images: [...initial.images],
  };
  return {
    commitEvidence(action: EvidenceListAction<File>) {
      latest = {
        ...latest,
        evidence: applyEvidenceListAction(latest.evidence, action),
      };
    },
    submit() {
      return captureReviewInputSnapshot(latest);
    },
  };
}

function opinion(kind: ClaimOpinion['kind']): ClaimOpinion {
  return {
    kind,
    label: kind,
    summary: kind,
    claim_anchor: 'anchor',
    finding_ids: [],
    ref_ids: [],
  };
}

function mockReview(snapshot: ReviewInputSnapshot): DemoReviewResponse {
  const withEvidence = snapshot.evidence.length > 0;
  return {
    review_id: reviewInputSnapshotId(snapshot),
    advertisement_id: 'ad',
    final_decision: 'PASS',
    copy_decision: 'PASS',
    overall_decision: 'PASS',
    evidence_cleared: false,
    confidence: 1,
    rationale: withEvidence ? 'with-evidence' : 'copy-only',
    finding_counts: { rule: 0, playbook: 0, llm: 0 },
    report_html: '',
    summary: {
      final_decision: 'PASS',
      confidence: 1,
      rationale: withEvidence ? 'with-evidence' : 'copy-only',
      advertisement: {
        text_preview: snapshot.copy,
        country_id: snapshot.countryId,
        platform_id: 'META',
        category_id: snapshot.categoryId,
      },
      findings: withEvidence
        ? [
            {
              finding_id: 'f1',
              module: 'RULE',
              ref_id: 'ref',
              severity: 'LOW',
              decision: 'PASS',
              summary: 'with-evidence',
            },
          ]
        : [],
      open_risk_skipped: true,
    },
    generated_at: '2026-09-11T00:00:00.000Z',
    claim_opinions: withEvidence ? [opinion('unused_evidence')] : [opinion('copy_only')],
  };
}

type Session = {
  generation: number;
  result: DemoReviewResponse | null;
  resultSnapshot: ReviewInputSnapshot | null;
};

function emptySession(): Session {
  return { generation: 0, result: null, resultSnapshot: null };
}

function submit(session: Session, current: ReviewInputSnapshot): {
  session: Session;
  generation: number;
  snapshot: ReviewInputSnapshot;
} {
  const generation = session.generation + 1;
  return {
    session: { ...session, generation, result: null, resultSnapshot: null },
    generation,
    snapshot: current,
  };
}

function complete(
  session: Session,
  generation: number,
  snapshot: ReviewInputSnapshot,
  aborted = false,
): Session {
  if (
    !shouldAcceptReviewResponse({
      generation,
      latestGeneration: session.generation,
      aborted,
    })
  ) {
    return session;
  }
  return {
    ...session,
    result: mockReview(snapshot),
    resultSnapshot: snapshot,
  };
}

describe('review input snapshot', () => {
  it('treats copy-only and copy+PDF as different snapshots', () => {
    const none = snap();
    const withPdf = snap({ evidence: [file('PC201SM.pdf', 2048, 99)] });
    expect(isReviewInputSnapshotEqual(none, withPdf)).toBe(false);
  });

  it('Case 1: evidence removal stales immediately; resubmits with same snapshot match', () => {
    const copyOnly = snap();
    const withPdf = snap({ evidence: [file('manual.pdf', 10, 2)] });

    let session = emptySession();
    let pending = submit(session, copyOnly);
    session = complete(pending.session, pending.generation, pending.snapshot);
    expect(session.result?.overall_decision).toBe('PASS');

    pending = submit(session, withPdf);
    session = complete(pending.session, pending.generation, pending.snapshot);
    const resultB = session.result;
    expect(resultB).toBeTruthy();
    expect(isBoundReviewResultStale(copyOnly, session.resultSnapshot)).toBe(true);

    pending = submit(session, copyOnly);
    session = complete(pending.session, pending.generation, pending.snapshot);
    const resultC = session.result;

    pending = submit(session, copyOnly);
    session = complete(pending.session, pending.generation, pending.snapshot);
    const resultD = session.result;

    expect(isReviewInputSnapshotEqual(copyOnly, copyOnly)).toBe(true);
    expect(resultC?.overall_decision).toBe(resultD?.overall_decision);
    expect(resultC?.summary.findings).toEqual(resultD?.summary.findings);
    expect(resultC?.claim_opinions).toEqual(resultD?.claim_opinions);
    expect(reviewInputSnapshotId(copyOnly)).toBe(resultC?.review_id);
    expect(reviewInputSnapshotId(copyOnly)).toBe(resultD?.review_id);
  });

  it('Case 2: adding evidence stales the copy-only result immediately', () => {
    const copyOnly = snap();
    const withPdf = snap({ evidence: [file('a.pdf')] });
    expect(isBoundReviewResultStale(withPdf, copyOnly)).toBe(true);
  });

  it('Case 3: replacing evidence stales the previous result', () => {
    const pdfA = snap({ evidence: [file('a.pdf', 1, 1)] });
    const pdfB = snap({ evidence: [file('b.pdf', 1, 1)] });
    expect(isBoundReviewResultStale(pdfB, pdfA)).toBe(true);
  });

  it('Case 4: country switch stales the previous result', () => {
    const my = snap({ countryId: 'MY' });
    const th = snap({ countryId: 'TH' });
    expect(isBoundReviewResultStale(th, my)).toBe(true);
  });

  it('Case 5: image add/remove/replace stales the previous result', () => {
    const none = snap();
    const added = snap({ images: [file('ad.png', 50, 1)] });
    const replaced = snap({ images: [file('ad2.png', 50, 1)] });
    expect(isBoundReviewResultStale(added, none)).toBe(true);
    expect(isBoundReviewResultStale(none, added)).toBe(true);
    expect(isBoundReviewResultStale(replaced, added)).toBe(true);
  });

  it('Case 6: rapid submit — only the latest generation owns the UI result', () => {
    const withPdf = snap({ evidence: [file('manual.pdf')] });
    const copyOnly = snap();

    let session = emptySession();
    const requestA = submit(session, withPdf);
    session = requestA.session;
    const requestB = submit(session, copyOnly);
    session = requestB.session;

    session = complete(session, requestA.generation, requestA.snapshot, true);
    expect(session.result).toBeNull();

    session = complete(session, requestA.generation, requestA.snapshot, false);
    expect(session.result).toBeNull();

    session = complete(session, requestB.generation, requestB.snapshot, false);
    expect(session.resultSnapshot).toEqual(copyOnly);
    expect(session.result?.claim_opinions).toEqual(mockReview(copyOnly).claim_opinions);
  });

  it('late PDF response is stale if the user deleted evidence without a new submit', () => {
    const withPdf = snap({ evidence: [file('manual.pdf')] });
    const copyOnly = snap();
    let session = emptySession();
    const requestA = submit(session, withPdf);
    session = complete(requestA.session, requestA.generation, requestA.snapshot);
    expect(isBoundReviewResultStale(copyOnly, session.resultSnapshot)).toBe(true);
  });

  it('category, sku, and ad type participate in the snapshot', () => {
    expect(isReviewInputSnapshotEqual(snap(), snap({ categoryId: 'sa.other' }))).toBe(false);
    expect(isReviewInputSnapshotEqual(snap(), snap({ productSku: 'PC201SM' }))).toBe(false);
    expect(isReviewInputSnapshotEqual(snap(), snap({ adType: 'BRAND_PRODUCT' }))).toBe(false);
  });
});

describe('same-tick evidence mutations vs Submit', () => {
  it('1. add → same-tick submit uses the added file', () => {
    const store = createLatestMaterialStore(base);
    store.commitEvidence({ type: 'add', files: [file('added.pdf', 10, 3)] });
    expect(store.submit().evidence).toEqual([fingerprintFile(file('added.pdf', 10, 3))]);
  });

  it('2. remove → same-tick submit uses empty evidence', () => {
    const store = createLatestMaterialStore({
      ...base,
      evidence: [file('manual.pdf', 10, 2)],
    });
    store.commitEvidence({ type: 'remove', index: 0 });
    const snapshot = store.submit();
    expect(snapshot.evidence).toEqual([]);
    expect(snapshot.evidenceSourceType).toBe('');
  });

  it('3. replace → same-tick submit uses the replacement', () => {
    const store = createLatestMaterialStore({
      ...base,
      evidence: [file('a.pdf', 1, 1)],
    });
    store.commitEvidence({ type: 'replace', files: [file('b.pdf', 2, 2)] });
    expect(store.submit().evidence.map((item) => item.name)).toEqual(['b.pdf']);
  });

  it('4. clear all → same-tick submit uses empty evidence', () => {
    const store = createLatestMaterialStore({
      ...base,
      evidence: [file('a.pdf'), file('b.pdf')],
    });
    store.commitEvidence({ type: 'clear' });
    expect(store.submit().evidence).toEqual([]);
  });

  it('5. rapid double submit — latest generation owns the result', () => {
    const withPdf = snap({ evidence: [file('manual.pdf')] });
    const copyOnly = snap();
    let session = emptySession();
    const first = submit(session, withPdf);
    session = first.session;
    const second = submit(session, copyOnly);
    session = second.session;
    session = complete(session, first.generation, first.snapshot, false);
    expect(session.result).toBeNull();
    session = complete(session, second.generation, second.snapshot, false);
    expect(session.resultSnapshot).toEqual(copyOnly);
  });

  it('6. submit then mutate evidence before response — old response is stale', () => {
    const store = createLatestMaterialStore({
      ...base,
      evidence: [file('manual.pdf', 10, 2)],
    });
    const sent = store.submit();
    let session = emptySession();
    const pending = submit(session, sent);
    store.commitEvidence({ type: 'clear' });
    session = complete(pending.session, pending.generation, pending.snapshot);
    expect(isBoundReviewResultStale(store.submit(), session.resultSnapshot)).toBe(true);
  });
});
