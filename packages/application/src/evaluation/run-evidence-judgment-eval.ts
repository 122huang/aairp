import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvidenceJudgmentContext, EvidenceRecord, IEvidenceStore } from '@aairp/shared-kernel';
import type { ILlmGateway } from '../review/stub-llm.gateway.types.js';
import { EvidenceJudgmentService } from '../evidence/evidence-judgment.service.js';
import {
  buildExpiredJudgment,
  buildPrescreenJudgment,
  buildUnreadableJudgment,
  isEvidenceExpired,
  structuralScopeExcludes,
} from '../evidence/evidence-judgment-rules.js';
import {
  loadEvidenceJudgmentFixture,
  type EvidenceJudgmentFixtureCase,
} from './load-evidence-judgment-fixture.js';

class FixtureEvidenceStore implements IEvidenceStore {
  constructor(private readonly records: Map<string, EvidenceRecord>) {}

  createEvidence = async () => {
    throw new Error('not implemented');
  };
  findEvidenceById = async (id: string) => this.records.get(id) ?? null;
  attachToFinding = async () => {
    throw new Error('not implemented');
  };
  updateLink = async () => {
    throw new Error('not implemented');
  };
  findLinkById = async () => null;
  listLinksForFinding = async () => [];
  listLinksForReview = async () => [];
  confirmLink = async () => {
    throw new Error('not implemented');
  };
  readEvidenceFile = async () => Buffer.from('');
}

function caseStubGateway(c: EvidenceJudgmentFixtureCase): ILlmGateway {
  return {
    complete: async () => ({
      content: JSON.stringify(
        c.llm_stub_response ?? {
          relevance: 'strong',
          sufficiency: 'sufficient',
          relevance_reasoning: 'default stub',
          sufficiency_reasoning: 'default stub',
          extracted_key_facts: '',
        },
      ),
    }),
  };
}

function toEvidenceRecord(c: EvidenceJudgmentFixtureCase): EvidenceRecord {
  return {
    evidence_id: `ev_${c.case_id}`,
    title: c.evidence.title,
    evidence_source_type: c.evidence.evidence_source_type,
    valid_until: c.evidence.valid_until,
    scope: c.evidence.scope ?? {},
    claim_risk_types: [c.context.risk_type],
    file: { filename: 'fixture.txt', mime_type: 'text/plain', storage_path: 'fixture.txt' },
    created_at: new Date().toISOString(),
  };
}

function toContext(c: EvidenceJudgmentFixtureCase): EvidenceJudgmentContext {
  return {
    review_id: 'eval-review',
    finding_id: 'rf_eval',
    country_id: c.context.country_id,
    category_id: c.context.category_id,
    product_sku: c.context.product_sku,
    ad_text: c.context.ad_text,
    finding_summary: c.context.finding_summary,
    remediation_type: c.context.remediation_type,
    risk_type: c.context.risk_type,
    claim_anchor_text: c.context.claim_anchor_text,
  };
}

export type EvidenceJudgmentEvalResult = {
  case_id: string;
  pass: boolean;
  actual: { relevance: string; sufficiency: string; source_rule_applied?: boolean };
  expect: EvidenceJudgmentFixtureCase['expect'];
  notes?: string;
};

export async function runEvidenceJudgmentEval(): Promise<{
  fixture_id: string;
  total: number;
  passed: number;
  results: EvidenceJudgmentEvalResult[];
}> {
  const fixture = loadEvidenceJudgmentFixture();
  const results: EvidenceJudgmentEvalResult[] = [];

  for (const c of fixture.cases) {
    const evidence = toEvidenceRecord(c);
    const store = new FixtureEvidenceStore(new Map([[evidence.evidence_id, evidence]]));
    const service = new EvidenceJudgmentService({
      evidenceStore: store,
      llmGateway: caseStubGateway(c),
    });

    let judgment;
    if (c.expect.text_unreadable || !c.evidence.evidence_text.trim()) {
      judgment = buildUnreadableJudgment();
    } else if (
      structuralScopeExcludes(evidence, {
        country_id: c.context.country_id,
        category_id: c.context.category_id,
        product_sku: c.context.product_sku,
      })
    ) {
      judgment = buildPrescreenJudgment('fixture structural exclude');
    } else if (c.expect.expired || isEvidenceExpired(evidence.valid_until)) {
      judgment = buildExpiredJudgment(evidence.valid_until!);
    } else {
      judgment = await service.judgeAttachedEvidence(evidence, toContext(c), {
        evidenceTextOverride: c.evidence.evidence_text,
      });
    }

    const pass =
      judgment.relevance === c.expect.relevance &&
      judgment.sufficiency === c.expect.sufficiency &&
      (c.expect.source_rule_applied ? Boolean(judgment.source_rule_applied) : true) &&
      (c.expect.text_unreadable ? Boolean(judgment.text_unreadable) : true) &&
      (c.expect.expired ? judgment.sufficiency === 'insufficient' : true);

    results.push({
      case_id: c.case_id,
      pass,
      actual: {
        relevance: judgment.relevance,
        sufficiency: judgment.sufficiency,
        source_rule_applied: judgment.source_rule_applied,
      },
      expect: c.expect,
      notes: c.notes,
    });
  }

  const passed = results.filter((r) => r.pass).length;
  return { fixture_id: fixture.fixture_id, total: results.length, passed, results };
}

async function main() {
  const report = await runEvidenceJudgmentEval();
  const outPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../reports/evidence-judgment-eval.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Evidence judgment eval: ${report.passed}/${report.total} passed → ${outPath}`);
  for (const r of report.results.filter((x) => !x.pass)) {
    console.log(
      `  FAIL ${r.case_id}: expected ${r.expect.relevance}/${r.expect.sufficiency}, got ${r.actual.relevance}/${r.actual.sufficiency}`,
    );
  }
  process.exit(report.passed === report.total ? 0 : 1);
}

void main();
