import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';
import {
  loadKnowledgePackDraft,
  loadKnowledgePackManifest,
  isKnowledgePackV2,
} from './knowledge-pack.js';
import { validateKnowledgePack } from './knowledge-pack-validator.js';
import { assembleAndWriteDraft, listReleasedPackIds } from './knowledge-pack-release.js';

function defaultReportsDir(): string {
  return join(process.cwd(), 'reports');
}

export type KnowledgePackDashboard = {
  generated_at: string;
  platform_snapshot: ReturnType<typeof buildKnowledgePlatformSnapshot>;
  pack: ReturnType<typeof loadKnowledgePackManifest>;
  draft: ReturnType<typeof loadKnowledgePackDraft>;
  validation: ReturnType<typeof validateKnowledgePack> | null;
  released_pack_ids: string[];
};

export function buildKnowledgePackDashboard(options?: {
  now?: Date;
}): KnowledgePackDashboard {
  const now = options?.now ?? new Date();
  const pack = loadKnowledgePackManifest();
  const draft = loadKnowledgePackDraft();
  const validation = draft ? validateKnowledgePack(draft, { now }) : null;

  return {
    generated_at: now.toISOString(),
    platform_snapshot: buildKnowledgePlatformSnapshot(now),
    pack,
    draft,
    validation,
    released_pack_ids: listReleasedPackIds(),
  };
}

export function formatKnowledgePackDashboardMarkdown(dashboard: KnowledgePackDashboard): string {
  const lines = [
    '# Knowledge Pack Dashboard',
    '',
    `Generated: ${dashboard.generated_at}`,
    '',
    '## Platform Corpora',
    '',
    '| Corpus | Entries | KQS | Errors | Warnings |',
    '|--------|--------:|----:|-------:|---------:|',
  ];

  for (const corpus of dashboard.platform_snapshot.corpora) {
    lines.push(
      `| ${corpus.corpus_type} | ${corpus.entry_count} | ${corpus.knowledge_quality_score}% | ${corpus.validation_errors} | ${corpus.governance_warnings} |`,
    );
  }

  lines.push('', '## Knowledge Pack', '');
  const active = dashboard.pack ?? dashboard.draft;
  if (!active) {
    lines.push('No Knowledge Pack assembled yet.');
  } else if (isKnowledgePackV2(active)) {
    lines.push(
      `| Pack ID | \`${active.knowledge_pack_id}\` |`,
      `| Status | ${active.release_status} |`,
      `| Fingerprint | \`${active.knowledge_pack_fingerprint.slice(0, 16)}…\` |`,
      '',
      '### Corpus Fingerprints (metadata only)',
      '',
      '| Corpus | Fingerprint | KQS |',
      '|--------|-------------|----:|',
    );
    for (const [corpusType, snapshot] of Object.entries(active.corpora).sort()) {
      lines.push(
        `| ${corpusType} | \`${snapshot.fingerprint}\` | ${snapshot.knowledge_quality_score}% |`,
      );
    }
    lines.push(
      '',
      '### Evaluation Linkage',
      '',
      `| Benchmark fingerprint | \`${active.evaluation_linkage.benchmark.content_fingerprint.slice(0, 16)}…\` |`,
      `| Case corpus coverage | ${active.evaluation_linkage.case_corpus.benchmark_coverage.covered}/${active.evaluation_linkage.case_corpus.benchmark_coverage.total} (${active.evaluation_linkage.case_corpus.benchmark_coverage.pct}%) |`,
      `| Regression baseline ref | \`${active.evaluation_linkage.regression_baseline_ref}\` |`,
    );
  } else {
    lines.push(`Legacy pack: \`${active.knowledge_pack_version}\``);
  }

  if (dashboard.validation) {
    lines.push(
      '',
      '### Pack Validation',
      '',
      `| Passed | ${dashboard.validation.passed ? 'yes' : 'no'} |`,
      `| Errors | ${dashboard.validation.error_count} |`,
      `| Warnings | ${dashboard.validation.warn_count} |`,
    );
  }

  if (dashboard.released_pack_ids.length > 0) {
    lines.push('', '### Released Packs', '', dashboard.released_pack_ids.map((id) => `- \`${id}\``).join('\n'));
  }

  return lines.join('\n');
}

export function writeKnowledgePackDashboard(options?: {
  now?: Date;
  outputDir?: string;
}): KnowledgePackDashboard {
  const dashboard = buildKnowledgePackDashboard(options);
  if (!dashboard.draft && !dashboard.pack) {
    assembleAndWriteDraft({ now: options?.now });
    return buildKnowledgePackDashboard(options);
  }
  const reportsDir = options?.outputDir ?? defaultReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = dashboard.generated_at.replace(/[:.]/g, '-');
  writeFileSync(
    join(reportsDir, `knowledge-pack-dashboard-${timestamp}.md`),
    `${formatKnowledgePackDashboardMarkdown(dashboard)}\n`,
  );
  return dashboard;
}
