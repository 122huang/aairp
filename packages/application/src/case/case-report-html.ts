import type { CaseRecord } from '@aairp/shared-kernel';
import type { CaseEffectiveStatusView } from './case-effective-status.js';
import type {
  BusinessHandoffEligibility,
  CaseReportEvidenceLink,
  CaseReportFinding,
  CaseReportModel,
  EvidenceReportView,
  PublishTodoItem,
  ThreadCaseView,
} from './case-report.model.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sharedStyles(): string {
  return `body { font-family: "IBM Plex Sans", "Noto Sans SC", sans-serif; margin: 0; color: #1c1917; line-height: 1.55; background: linear-gradient(180deg, #f4f7f5 0%, #eef2f0 40%, #f7f5f1 100%); }
    .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-family: "Source Serif 4", "Noto Serif SC", Georgia, serif; font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
    h2 { font-size: 16px; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d6ddd8; }
    .brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #3f6f5a; font-weight: 600; margin-bottom: 10px; }
    .meta { color: #57534e; font-size: 13px; }
    .decision { display: inline-block; font-weight: 700; padding: 6px 12px; border-radius: 4px; }
    .decision-PASS { background: #e7f3eb; color: #14532d; }
    .decision-WARN { background: #fff4df; color: #9a3412; }
    .decision-REVIEW { background: #e8eef8; color: #1e3a8a; }
    .decision-REJECT { background: #fde8e8; color: #991b1b; }
    .card { background: rgba(255,255,255,0.72); border: 1px solid #d7dfd9; border-radius: 8px; padding: 14px 16px; margin-top: 10px; }
    .badge { display: inline-block; font-size: 12px; background: #e7ece8; border-radius: 4px; padding: 2px 8px; margin-right: 6px; }
    .empty { background: #f8faf8; border-left: 4px solid #3f6f5a; padding: 12px 14px; margin-top: 12px; }
    .blocked { background: #fff7ed; border-left: 4px solid #c2410c; padding: 12px 14px; margin-top: 12px; }
    .blocked ul { margin: 8px 0 0 18px; padding: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { border: 1px solid #d6ddd8; padding: 8px; text-align: left; vertical-align: top; background: rgba(255,255,255,0.8); }
    th { background: #edf2ef; }
    .current-row td { background: #eef6f1; }
    .excerpt { white-space: pre-wrap; font-size: 13px; color: #44403c; margin: 6px 0 0; }
    .muted { color: #78716c; font-size: 12px; }
    .conclusion {
      margin: 18px 0 22px;
      padding: 22px 22px 20px;
      border-radius: 10px;
      border: 1px solid transparent;
      box-shadow: 0 10px 28px rgba(28, 25, 23, 0.06);
    }
    .conclusion-kicker {
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 700;
      margin: 0 0 8px;
      opacity: 0.85;
    }
    .conclusion-headline {
      font-family: "Source Serif 4", "Noto Serif SC", Georgia, serif;
      font-size: 24px;
      line-height: 1.35;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    .conclusion-lines { margin: 0 0 12px; padding-left: 18px; }
    .conclusion-lines li { margin: 4px 0; }
    .conclusion-audit {
      margin: 12px 0 0;
      padding-top: 10px;
      border-top: 1px solid rgba(28, 25, 23, 0.12);
      font-size: 12px;
      opacity: 0.78;
      font-weight: 500;
    }
    .tone-pass { background: #e8f6ee; border-color: #86efac; color: #14532d; }
    .tone-resolved { background: #e8f0fb; border-color: #93c5fd; color: #1e3a8a; }
    .tone-open { background: #fff4e5; border-color: #fdba74; color: #9a3412; }
    .tone-blocked { background: #fde8e8; border-color: #fca5a5; color: #991b1b; }
    .todos {
      margin: 8px 0 20px;
      padding: 16px 18px;
      border-radius: 8px;
      background: rgba(255,255,255,0.78);
      border: 1px solid #d7dfd9;
    }
    .todos h2 { margin-top: 0; border-bottom: none; padding-bottom: 0; }
    .todos ol { margin: 8px 0 0 18px; padding: 0; }
    .todos li { margin: 8px 0; }
    .details-section { margin-top: 28px; }
    .details-section > summary {
      cursor: pointer;
      list-style: none;
      font-size: 15px;
      font-weight: 650;
      color: #44403c;
      padding: 10px 0;
      border-bottom: 1px solid #d6ddd8;
    }
    .details-section > summary::-webkit-details-marker { display: none; }
    .details-section > summary::before {
      content: "▸ ";
      color: #78716c;
    }
    .details-section[open] > summary::before { content: "▾ "; }
    .details-body { opacity: 0.92; }
    .audit-chip {
      display: inline-block;
      font-size: 12px;
      color: #57534e;
      background: #e7ece8;
      border-radius: 4px;
      padding: 2px 8px;
      margin-left: 8px;
      font-weight: 500;
    }`;
}

function decisionClass(decision: string): string {
  if (decision === 'PASS' || decision === 'WARN' || decision === 'REVIEW' || decision === 'REJECT') {
    return `decision decision-${decision}`;
  }
  return 'decision';
}

function renderShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

function caseHeader(
  caseRecord: CaseRecord,
  generatedAt: string,
  subtitle: string,
  options?: { showDecisionBadge?: boolean },
): string {
  const ad = caseRecord.advertisement.content;
  const preview = ad.text.length > 280 ? `${ad.text.slice(0, 280)}...` : ad.text;
  const showDecision = options?.showDecisionBadge !== false;
  return `<p class="brand">AAIRP Case Report</p>
  <h1>${escapeHtml(subtitle)}</h1>
  <p class="meta">案例 ${escapeHtml(caseRecord.case_id)} · 审查 ${escapeHtml(caseRecord.review_id)} · 生成于 ${escapeHtml(generatedAt)}</p>
  <p class="meta">${escapeHtml(caseRecord.dimensions.country_id)} / ${escapeHtml(caseRecord.dimensions.category_id)} / ${escapeHtml(caseRecord.advertisement.ad_type)}</p>
  ${
    showDecision
      ? `<p><span class="${decisionClass(caseRecord.decision.final_decision)}">${escapeHtml(caseRecord.decision.final_decision)}</span></p>
  <p class="meta"><strong>结论说明：</strong>${escapeHtml(caseRecord.decision.rationale)}</p>`
      : ''
  }
  <div class="card"><p class="muted">广告文案摘录</p><p class="excerpt">${escapeHtml(preview)}</p></div>`;
}

function renderHandoffFinding(finding: CaseReportFinding): string {
  return `<article class="card">
    <div><span class="badge">${escapeHtml(finding.ref_id)}</span><span class="badge">${escapeHtml(finding.decision)}</span><span class="badge">${escapeHtml(finding.severity)}</span><span class="badge">${escapeHtml(finding.remediation_type ?? '')}</span></div>
    <p style="margin:10px 0 0">${escapeHtml(finding.summary)}</p>
  </article>`;
}

function renderBlocked(eligibility: Extract<BusinessHandoffEligibility, { eligible: false }>): string {
  const items = eligibility.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('');
  return `<div class="blocked">
    <p><strong>本案例暂不可导出业务提醒摘要</strong>（${escapeHtml(eligibility.code)}）</p>
    <p class="meta">按门槛：PASS/WARN 可导出；REVIEW 仅当全部 REVIEW finding 均为证据关联类且已 HUMAN_CONFIRMED/HUMAN_OVERRODE。REJECT 与纯人工语境 REVIEW 不可导出。</p>
    <ul>${items}</ul>
  </div>`;
}

export function renderBusinessHandoffHtml(model: CaseReportModel): string {
  const { case: caseRecord, handoff_findings, business_handoff, generated_at } = model;

  if (!business_handoff.eligible) {
    return renderShell(
      `业务提醒摘要（不可导出） ${caseRecord.case_id}`,
      `${caseHeader(caseRecord, generated_at, '业务提醒摘要')}
      ${renderBlocked(business_handoff)}`,
    );
  }

  const findingsBlock =
    handoff_findings.length === 0
      ? `<div class="empty">本次审核无需要业务在发布环节额外处理的事项。</div>`
      : `<h2>需要业务处理的事项（${handoff_findings.length}）</h2>
      <p class="meta">仅包含外部状态核验（EXTERNAL_STATUS_VERIFICATION）与披露提醒（NOT_APPLICABLE_DISCLOSURE）。不含证据细节与决策路径。</p>
      ${handoff_findings.map(renderHandoffFinding).join('\n')}`;

  return renderShell(
    `业务提醒摘要 ${caseRecord.case_id}`,
    `${caseHeader(caseRecord, generated_at, '业务提醒摘要')}
    ${findingsBlock}`,
  );
}

function toEvidenceViews(links: CaseReportEvidenceLink[]): EvidenceReportView[] {
  return links.map((link) => {
    const judgment = link.ai_judgment;
    const metadataOnly =
      !judgment ||
      judgment.relevance === 'none' ||
      judgment.prescreen_excluded === true;

    return {
      link_id: link.link_id,
      finding_id: link.finding_id,
      status: link.status,
      evidence_title: link.evidence.title,
      evidence_source_type: link.evidence.evidence_source_type,
      issuing_institution: link.evidence.issuing_institution,
      filename: link.evidence.file.filename,
      disclosure: metadataOnly ? 'metadata_only' : 'judgment_excerpt',
      ...(judgment
        ? {
            ai_judgment: {
              relevance: judgment.relevance,
              sufficiency: judgment.sufficiency,
              relevance_reasoning: judgment.relevance_reasoning,
              sufficiency_reasoning: judgment.sufficiency_reasoning,
              extracted_key_facts: judgment.extracted_key_facts,
              prescreen_excluded: judgment.prescreen_excluded,
              source_rule_applied: judgment.source_rule_applied,
            },
          }
        : {}),
      override_reason: link.override_reason,
      confirmed_at: link.confirmed_at,
    };
  });
}

function renderEvidenceView(view: EvidenceReportView): string {
  const judgmentBlock =
    view.disclosure === 'judgment_excerpt' && view.ai_judgment
      ? `<p class="meta"><strong>相关性：</strong>${escapeHtml(view.ai_judgment.relevance)} · <strong>充分性：</strong>${escapeHtml(view.ai_judgment.sufficiency)}</p>
         <p class="excerpt">${escapeHtml(view.ai_judgment.relevance_reasoning)}</p>
         <p class="excerpt">${escapeHtml(view.ai_judgment.sufficiency_reasoning)}</p>
         <p class="excerpt"><strong>关键事实摘录：</strong>${escapeHtml(
           view.ai_judgment.extracted_key_facts.length > 400
             ? `${view.ai_judgment.extracted_key_facts.slice(0, 400)}...`
             : view.ai_judgment.extracted_key_facts,
         )}</p>`
      : `<p class="muted">证据披露级别：仅元数据（relevance=none 或 prescreen 排除；不含原文附件）。</p>`;

  return `<article class="card">
    <div><span class="badge">${escapeHtml(view.status)}</span><span class="badge">${escapeHtml(view.evidence_source_type)}</span><span class="badge">${escapeHtml(view.disclosure)}</span></div>
    <p style="margin:8px 0 0"><strong>${escapeHtml(view.evidence_title)}</strong></p>
    <p class="meta">finding ${escapeHtml(view.finding_id)} · 文件 ${escapeHtml(view.filename)}${view.issuing_institution ? ` · ${escapeHtml(view.issuing_institution)}` : ''}</p>
    ${judgmentBlock}
    ${view.override_reason ? `<p class="meta"><strong>人工覆写理由：</strong>${escapeHtml(view.override_reason)}</p>` : ''}
    ${view.confirmed_at ? `<p class="muted">确认时间 ${escapeHtml(view.confirmed_at)}</p>` : ''}
  </article>`;
}

function toThreadViews(model: CaseReportModel): ThreadCaseView[] {
  return model.thread_cases.map((entry) => ({
    case_id: entry.case_id,
    review_id: entry.review_id,
    parent_case_id: entry.parent_case_id,
    final_decision: entry.decision.final_decision,
    created_at: entry.created_at,
    rationale: entry.decision.rationale,
    finding_counts: entry.decision.finding_counts,
    is_current: entry.case_id === model.case.case_id,
  }));
}

function renderFindingPath(finding: CaseReportFinding): string {
  return `<tr>
    <td>${escapeHtml(finding.module)}</td>
    <td>${escapeHtml(finding.ref_id)}</td>
    <td>${escapeHtml(finding.decision)}</td>
    <td>${escapeHtml(finding.severity)}</td>
    <td>${escapeHtml(finding.remediation_type ?? '—')}</td>
    <td>${escapeHtml(finding.summary)}</td>
  </tr>`;
}

function renderConclusionCard(effective: CaseEffectiveStatusView): string {
  const lines =
    effective.detail_lines.length === 0
      ? ''
      : `<ul class="conclusion-lines">${effective.detail_lines
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')}</ul>`;

  // Dual lines: (1) human effective conclusion  (2) immutable audit snapshot — neither overwrites the other.
  const auditRow = effective.applies
    ? `<p class="conclusion-audit">审核快照（未改写）：${escapeHtml(effective.audit_final_decision)}${
        effective.status ? ` · 有效状态 ${escapeHtml(effective.status)}` : ''
      }</p>`
    : `<p class="conclusion-audit">审核快照（未改写）：${escapeHtml(effective.audit_final_decision)} · REJECT 不参与 effective_status 流转</p>`;

  return `<section class="conclusion tone-${escapeHtml(effective.tone)}" aria-label="审核结论">
    <p class="conclusion-kicker">审核结论</p>
    <p class="conclusion-headline">${escapeHtml(effective.headline)}</p>
    ${lines}
    ${auditRow}
  </section>`;
}

function renderPublishTodos(todos: PublishTodoItem[]): string {
  if (todos.length === 0) return '';
  const items = todos
    .map(
      (todo) =>
        `<li><strong>发布前需完成：</strong>${escapeHtml(todo.summary)} <span class="muted">（${escapeHtml(todo.ref_id)}）</span></li>`,
    )
    .join('\n');
  return `<section class="todos" aria-label="发布前待办">
    <h2>发布前待办清单</h2>
    <p class="meta">外部状态核验与披露类事项，供业务在发布环节交接处理。</p>
    <ol>${items}</ol>
  </section>`;
}

function renderDetailsSection(title: string, body: string, open = false): string {
  return `<details class="details-section"${open ? ' open' : ''}>
    <summary>${escapeHtml(title)}</summary>
    <div class="details-body">${body}</div>
  </details>`;
}

export function renderLegalAuditHtml(model: CaseReportModel): string {
  const { case: caseRecord, findings, evidence_links, generated_at, effective, publish_todos } =
    model;
  const evidenceViews = toEvidenceViews(evidence_links);
  const threadViews = toThreadViews(model);
  const threadRows = threadViews
    .map(
      (entry) => `<tr class="${entry.is_current ? 'current-row' : ''}">
        <td>${escapeHtml(entry.case_id)}${entry.is_current ? '（当前）' : ''}</td>
        <td>${escapeHtml(entry.created_at)}</td>
        <td>${escapeHtml(entry.final_decision)}</td>
        <td>${escapeHtml(entry.parent_case_id ?? '—')}</td>
        <td>R${entry.finding_counts.rule}/P${entry.finding_counts.playbook}/L${entry.finding_counts.llm}</td>
        <td>${escapeHtml(entry.rationale)}</td>
      </tr>`,
    )
    .join('\n');

  const evidenceBlock =
    evidenceViews.length === 0
      ? `<p class="meta">本线程无证据关联记录。</p>`
      : evidenceViews.map(renderEvidenceView).join('\n');

  const decisionPath = `<div class="card">
      <p><strong>AI 决策：</strong>${escapeHtml(caseRecord.decision.ai_decision)} → <strong>最终：</strong>${escapeHtml(caseRecord.decision.final_decision)}<span class="audit-chip">审计快照 · 未改写</span></p>
      <p class="meta">判定于 ${escapeHtml(caseRecord.decision.decided_at)}${
        effective.applies && effective.status
          ? ` · 有效状态 ${escapeHtml(effective.status)}`
          : ' · REJECT 不参与 effective_status 流转'
      }</p>
      <p>${escapeHtml(caseRecord.decision.rationale)}</p>
      ${caseRecord.human_feedback ? `<p class="meta">人工反馈：${escapeHtml(caseRecord.human_feedback.decision)} · ${escapeHtml(caseRecord.human_feedback.comment ?? '')}</p>` : '<p class="muted">无整案人工反馈记录</p>'}
    </div>`;

  const findingsTable = `<table>
      <thead><tr><th>模块</th><th>Ref</th><th>Decision</th><th>Severity</th><th>Remediation</th><th>摘要</th></tr></thead>
      <tbody>${findings.map(renderFindingPath).join('\n')}</tbody>
    </table>`;

  const threadTable = `<table>
      <thead><tr><th>Case</th><th>时间</th><th>结论</th><th>Parent</th><th>计数</th><th>理由</th></tr></thead>
      <tbody>${threadRows}</tbody>
    </table>`;

  return renderShell(
    `完整审核报告 ${caseRecord.case_id}`,
    `${caseHeader(caseRecord, generated_at, '完整审核报告', { showDecisionBadge: false })}
    ${renderConclusionCard(effective)}
    ${renderPublishTodos(publish_todos)}
    ${renderDetailsSection('详情 · 决策路径', decisionPath)}
    ${renderDetailsSection(`详情 · Finding 清单（${findings.length}）`, findingsTable)}
    ${renderDetailsSection(
      '详情 · 证据判断（不含原始文件字节）',
      `<p class="meta">relevance=none / prescreen 仅展示元数据；strong / partial 展示判断与短摘录。</p>${evidenceBlock}`,
    )}
    ${renderDetailsSection(
      `详情 · 提交线程历史（thread_id=${caseRecord.thread_id ?? caseRecord.case_id}）`,
      threadTable,
    )}`,
  );
}
