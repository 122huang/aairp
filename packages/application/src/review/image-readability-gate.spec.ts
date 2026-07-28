import { describe, expect, it } from 'vitest';
import type { ReviewContext, VisionDiscoveryResult } from '@aairp/shared-kernel';
import {
  applyImageReadabilityGate,
  assessImageReadability,
  createInsufficientVisibleTextFinding,
  MIN_READABLE_SOURCE_WIDTH,
} from './image-readability-gate.js';
import { DecisionEngineService } from './decision-engine.service.js';

const baseContext = {
  reviewId: 'rev_gate',
  advertisementId: 'ad_gate',
  contentHash: 'hash',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'SHOPEE',
    categoryId: 'sa.other',
  },
  normalizedContent: {
    text: '',
    imageUrls: ['https://demo/pdp.jpg'],
  },
  resolvedKnowledgeVersions: {
    rulePack: 'demo',
    playbook: 'demo',
    openRiskPrompt: 'demo',
    visionPrompt: 'demo',
  },
  advertisementContext: {},
  tags: [],
  builtAt: '2026-07-28T00:00:00.000Z',
} as ReviewContext;

describe('image-readability-gate', () => {
  it('does not trigger without images', () => {
    const result = assessImageReadability({
      adText: '',
      imageUrls: [],
    });
    expect(result.triggered).toBe(false);
  });

  it('triggers on narrow chat-compressed source width', () => {
    const result = assessImageReadability({
      adText: 'Long enough marketing copy for the text branch to look fine.',
      imageUrls: ['https://demo/pdp.jpg'],
      imagePreprocess: [
        {
          sourceWidth: MIN_READABLE_SOURCE_WIDTH - 1,
          sourceHeight: 1024,
        },
      ],
    });
    expect(result.triggered).toBe(true);
    expect(result.reasons).toContain('narrow_source');
  });

  it('triggers when image-only extract is too short', () => {
    const result = assessImageReadability({
      adText: '',
      ocrText: '',
      extractedText: ['Hi'],
      imageUrls: ['https://demo/pdp.jpg'],
      imageDimensions: [{ width: 790, height: 19060 }],
    });
    expect(result.triggered).toBe(true);
    expect(result.reasons).toContain('insufficient_text');
  });

  it('triggers on multiple unreadable markers', () => {
    const result = assessImageReadability({
      adText: 'Panel copy present with enough characters for length.',
      extractedText: ['[unreadable@top]', 'ok', '[unreadable@footer]'],
      imageUrls: ['https://demo/pdp.jpg'],
      imageDimensions: [{ width: 800, height: 2000 }],
    });
    expect(result.triggered).toBe(true);
    expect(result.reasons).toContain('unreadable_markers');
  });

  it('does not trigger when vision extract is rich enough', () => {
    const result = assessImageReadability({
      adText: '',
      extractedText: [
        'Non-stick inner pot',
        'Tender beef stew in 30 minutes, not 3 hours',
        'Stew up to 2 kg beef',
      ],
      imageUrls: ['https://demo/pdp.jpg'],
      imageDimensions: [{ width: 790, height: 19060 }],
    });
    expect(result.triggered).toBe(false);
  });

  it('applyImageReadabilityGate appends REVIEW finding and forces decision REVIEW', () => {
    const visionResult: VisionDiscoveryResult = {
      reviewId: 'rev_gate',
      promptPackVersion: 'demo-vision-1.0.0',
      manifests: [],
      findings: [],
      hasBlocker: false,
      skipped: false,
      extractedText: ['x'],
      imagePreprocess: [
        {
          sourceImageIndex: 0,
          upscaled: true,
          sharpened: true,
          sourceWidth: 42,
          sourceHeight: 1024,
          width: 738,
          height: 18000,
        },
      ],
      evaluatedAt: '2026-07-28T00:00:00.000Z',
    };

    const gated = applyImageReadabilityGate(baseContext, visionResult, {
      createFindingId: () => 'gate-id',
    });
    expect(gated?.findings.some((f) => f.refId === 'insufficient-visible-text')).toBe(true);
    expect(gated?.findings[0]?.decision).toBe('REVIEW');
    expect(gated?.findings[0]?.evaluationDetail?.suggestedAction).toBe('MANUAL_REVIEW');

    const decision = new DecisionEngineService().fuseFromFindings({
      reviewId: 'rev_gate',
      countryId: 'SG',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      visionFindings: gated?.findings ?? [],
    });
    expect(decision.finalDecision).toBe('REVIEW');
    expect(decision.branchVerdicts?.image).toBe('REVIEW');
  });

  it('createInsufficientVisibleTextFinding uses stable risk id', () => {
    const finding = createInsufficientVisibleTextFinding({
      detail: 'test',
      reasons: ['insufficient_text'],
      createFindingId: () => 'fixed',
    });
    expect(finding.findingId).toBe('vf_fixed');
    expect(finding.refId).toBe('insufficient-visible-text');
  });
});
