import type { PlaybookPattern } from './playbook.js';

function parseFieldMap(sectionBody: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of sectionBody.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0 && value.length > 0) {
      fields[key] = value;
    }
  }
  return fields;
}

function patternFields(pattern: PlaybookPattern): Record<string, string> {
  return parseFieldMap(pattern.markdownBody ?? '');
}

export function renderPlaybookMarkdown(input: {
  title: string;
  packKey: string;
  packVersion: string;
  patterns: PlaybookPattern[];
}): string {
  const header = [
    `# ${input.title}`,
    '',
    `pack_version: ${input.packVersion}`,
    `playbook_id: ${input.packKey}`,
    '',
  ].join('\n');

  const sections = input.patterns.map((pattern) => {
    const extra = patternFields(pattern);
    const lines = [
      `## ${pattern.refId}`,
      '',
      `trigger_keywords: ${pattern.terms.join(', ')}`,
      `severity_hint: ${extra.severity_hint ?? 'MEDIUM'}`,
      `decision: ${extra.decision ?? 'WARN'}`,
      `guidance: ${pattern.guidance ?? ''}`,
      `typical_decision: ${extra.typical_decision ?? 'REVIEW'}`,
    ];
    if (extra.skill_module) {
      lines.push(`skill_module: ${extra.skill_module}`);
    }
    if (extra.purpose) {
      lines.push(`purpose: ${extra.purpose}`);
    }
    if (extra.suggested_rewrite) {
      lines.push(`suggested_rewrite: ${extra.suggested_rewrite}`);
    }
    if (extra.expected_severity) {
      lines.push(`expected_severity: ${extra.expected_severity}`);
    }
    return lines.join('\n');
  });

  return `${header}${sections.join('\n\n')}\n`;
}

export function buildPatternMarkdownBody(input: {
  severityHint?: string;
  decision?: string;
  typicalDecision?: string;
  skillModule?: string;
  purpose?: string;
  suggestedRewrite?: string;
  expectedSeverity?: string;
}): string {
  const lines = [
    `severity_hint: ${input.severityHint ?? 'MEDIUM'}`,
    `decision: ${input.decision ?? 'WARN'}`,
    `typical_decision: ${input.typicalDecision ?? 'REVIEW'}`,
  ];
  if (input.skillModule) {
    lines.push(`skill_module: ${input.skillModule}`);
  }
  if (input.purpose) {
    lines.push(`purpose: ${input.purpose}`);
  }
  if (input.suggestedRewrite) {
    lines.push(`suggested_rewrite: ${input.suggestedRewrite}`);
  }
  if (input.expectedSeverity) {
    lines.push(`expected_severity: ${input.expectedSeverity}`);
  }
  return lines.join('\n');
}
