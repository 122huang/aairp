import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  EvidenceAiJudgment,
  EvidenceJudgmentContext,
  EvidenceRecord,
  IEvidenceStore,
  RemediationType,
} from '@aairp/shared-kernel';
import type { ILlmGateway } from '../review/stub-llm.gateway.types.js';
import { extractEvidenceText } from './evidence-text-extractor.js';
import {
  applySourceTypeRules,
  buildExpiredJudgment,
  buildPrescreenJudgment,
  buildUnreadableJudgment,
  isEvidenceExpired,
  renderEvidenceJudgmentPrompt,
  sliceEvidenceTextForPrompt,
  structuralScopeExcludes,
} from './evidence-judgment-rules.js';
import { parseEvidenceJudgmentResponse } from './evidence-judgment-response.parser.js';
import {
  createDefaultEvidenceJudgmentLlmGateway,
  resolveEvidenceJudgmentLlmMode,
} from './evidence-judgment-llm.gateway.js';

export type EvidenceJudgmentServiceConfig = {
  evidenceStore: IEvidenceStore;
  llmGateway?: ILlmGateway;
  promptPath?: string;
  readTextFile?: (path: string) => string;
};

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/evidence-judgment.prompt.txt',
);

export class EvidenceJudgmentService {
  private readonly promptTemplate: string;

  constructor(private readonly config: EvidenceJudgmentServiceConfig) {
    const readText = config.readTextFile ?? ((p: string) => readFileSync(p, 'utf8'));
    this.promptTemplate = readText(config.promptPath ?? defaultPromptPath);
  }

  private llm(): ILlmGateway {
    return this.config.llmGateway ?? createDefaultEvidenceJudgmentLlmGateway();
  }

  private stamp(
    judgment: EvidenceAiJudgment,
    llmModel?: string,
  ): EvidenceAiJudgment {
    const mode = resolveEvidenceJudgmentLlmMode();
    return {
      ...judgment,
      judgment_mode: mode,
      llm_model: llmModel ?? (mode === 'stub' ? 'stub' : llmModel),
    };
  }

  async judgeAttachedEvidence(
    evidence: EvidenceRecord,
    context: EvidenceJudgmentContext,
    options?: { evidenceTextOverride?: string },
  ): Promise<EvidenceAiJudgment> {
    const productContext = {
      country_id: context.country_id,
      category_id: context.category_id,
      product_sku: context.product_sku,
    };

    if (structuralScopeExcludes(evidence, productContext)) {
      return this.stamp(
        buildPrescreenJudgment(
          `Evidence scope (${JSON.stringify(evidence.scope)}) does not overlap with case context (${context.country_id}/${context.category_id}/${context.product_sku ?? 'no SKU'}).`,
        ),
      );
    }

    if (isEvidenceExpired(evidence.valid_until)) {
      return this.stamp(buildExpiredJudgment(evidence.valid_until!));
    }

    let evidenceText = options?.evidenceTextOverride;
    if (!evidenceText) {
      const fileBuffer = await this.config.evidenceStore.readEvidenceFile(evidence.file.storage_path);
      const extracted = await extractEvidenceText(
        fileBuffer,
        evidence.file.mime_type,
        evidence.file.filename,
      );
      if (!extracted.ok) {
        return this.stamp(buildUnreadableJudgment());
      }
      evidenceText = extracted.text;
    }

    const preSourceCheck = applySourceTypeRules(
      {
        relevance: 'partial',
        relevance_reasoning: 'Pending semantic review.',
        sufficiency: 'insufficient',
        sufficiency_reasoning: 'Pending semantic review.',
        extracted_key_facts: '',
        judged_at: new Date().toISOString(),
      },
      context.remediation_type as RemediationType | undefined,
      evidence.evidence_source_type,
      context.risk_type,
    );
    if (preSourceCheck.source_rule_applied && context.remediation_type === 'EXTERNAL_STATUS_VERIFICATION') {
      return this.stamp({ ...preSourceCheck, prescreen_excluded: false });
    }

    const textWindow = sliceEvidenceTextForPrompt(evidenceText);
    console.info('[evidence-judgment] evidence_text_window', {
      evidence_id: evidence.evidence_id,
      filename: evidence.file.filename,
      review_id: context.review_id,
      finding_id: context.finding_id,
      full_len: textWindow.full_len,
      prompt_len: textWindow.prompt_len,
      truncated: textWindow.truncated,
      limit: textWindow.limit,
    });

    const prompt = renderEvidenceJudgmentPrompt(this.promptTemplate, {
      ...context,
      evidence,
      evidence_text: evidenceText,
    });

    const { content, model } = await this.llm().complete(prompt);
    const parsed = parseEvidenceJudgmentResponse(content);

    const withRules = applySourceTypeRules(
      {
        ...parsed,
        judged_at: new Date().toISOString(),
        text_full_len: textWindow.full_len,
        text_prompt_len: textWindow.prompt_len,
        ...(textWindow.truncated ? { text_truncated: true } : {}),
      },
      context.remediation_type as RemediationType | undefined,
      evidence.evidence_source_type,
      context.risk_type,
    );

    return this.stamp(withRules, model);
  }
}
