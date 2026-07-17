import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResilientLlmGateway } from '../review/llm-gateway.utils.js';
import { StubLlmGateway } from '../review/stub-llm.gateway.js';
import type { ILlmGateway } from '../review/stub-llm.gateway.types.js';
import { OpenRiskLlmGateway, resolveOpenRiskLlmMode } from '../review/open-risk-llm.gateway.js';

const defaultStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/evidence-judgment.stub.json',
);

export function resolveEvidenceJudgmentLlmMode(): 'live' | 'stub' {
  const raw = process.env.AAIRP_EVIDENCE_JUDGMENT_MODE?.trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'stub') return 'stub';
  return resolveOpenRiskLlmMode();
}

export function createDefaultEvidenceJudgmentLlmGateway(options?: {
  stubResponsePath?: string;
  readTextFile?: (path: string) => string;
}): ILlmGateway {
  const readTextFile = options?.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const stubResponsePath = options?.stubResponsePath ?? defaultStubPath;
  const inner: ILlmGateway =
    resolveEvidenceJudgmentLlmMode() === 'live'
      ? new OpenRiskLlmGateway()
      : new StubLlmGateway({ responsePath: stubResponsePath, readTextFile });

  return createResilientLlmGateway(inner, {
    timeoutMs: Number(process.env.EVIDENCE_JUDGMENT_TIMEOUT_MS ?? 45_000),
    maxRetries: 1,
  });
}