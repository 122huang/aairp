/**
 * S6.2 — Knowledge Basis panel for Review Result.
 * Calls deterministic preview API only; no review pipeline coupling.
 */

const previewCache = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchKnowledgePreview({ claimText, country, category }) {
  const response = await fetch('/api/knowledge/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claim_text: claimText,
      country: country || undefined,
      category: category || undefined,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Preview HTTP ${response.status}`);
  }
  return response.json();
}

async function submitPreviewFeedback(report, feedbackType) {
  const response = await fetch('/api/knowledge/preview/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preview_id: report.preview_id,
      feedback_type: feedbackType,
      claim_text_hash: report.claim_text_hash,
      primary_skill: report.primary_skill,
      matched_skills: report.matched_skills.map((s) => s.knowledge_id),
      matched_corpus_entries: [
        ...report.linked_knowledge.regulations.map((i) => i.knowledge_id),
        ...report.linked_knowledge.evidence.map((i) => i.knowledge_id),
        ...report.linked_knowledge.rewrites.map((i) => i.knowledge_id),
        ...report.linked_knowledge.cases.map((i) => i.knowledge_id),
      ],
      country: report.input_summary.country ?? null,
      linked_knowledge: report.linked_knowledge,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Feedback HTTP ${response.status}`);
  }
  return response.json();
}

function explorerUrl(primarySkill) {
  const base = '/knowledge/index.html';
  if (!primarySkill) {
    return base;
  }
  return `${base}?tab=explorer&skill=${encodeURIComponent(primarySkill)}`;
}

function renderGuidanceSuggestions(report) {
  const parts = [];
  const { review_guidance: reviewGuidance, rewrite_hint: rewriteHint } =
    report.guidance_excerpt ?? {};

  if (rewriteHint?.trim()) {
    parts.push(`<p class="kb-suggestion-lead">${escapeHtml(rewriteHint.trim())}</p>`);
  }

  const rewrites = (report.linked_knowledge?.rewrites ?? []).slice(0, 2);
  if (rewrites.length > 0) {
    const rewriteItems = rewrites
      .map((item) => {
        const strategy = item.strategy ? ` · ${escapeHtml(item.strategy)}` : '';
        return `<li><strong>${escapeHtml(item.label)}</strong>${strategy} — ${escapeHtml(item.summary)}</li>`;
      })
      .join('');
    parts.push(`<ul class="kb-list kb-suggestion-list">${rewriteItems}</ul>`);
  }

  if (reviewGuidance?.trim()) {
    parts.push(
      `<details class="kb-guidance-details"><summary>审核要点（知识库）</summary><p class="kb-guidance-text">${escapeHtml(reviewGuidance.trim())}</p></details>`,
    );
  }

  if (parts.length === 0) {
    return '';
  }

  return `
    <div class="kb-section kb-suggestions">
      <h4>降低风险建议</h4>
      <p class="field-hint">来自治理知识库，供改写与举证参考；不构成新的合规结论。</p>
      ${parts.join('')}
    </div>`;
}

function renderPreviewContent(report) {
  const draftBlock = report.draft_warning
    ? `<div class="kb-disclaimer kb-draft" role="alert">${escapeHtml(report.draft_warning)}</div>`
    : '';

  const skills =
    report.matched_skills.length === 0
      ? '<p class="muted">No skills matched this claim text.</p>'
      : report.matched_skills
          .map((skill) => {
            const primary = skill.knowledge_id === report.primary_skill ? ' kb-chip-primary' : '';
            return `<span class="kb-chip${primary}">${escapeHtml(skill.label)}</span>`;
          })
          .join('');

  const regList = report.linked_knowledge.regulations
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(item.label)}</li>`)
    .join('');
  const evidenceList = report.linked_knowledge.evidence
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(item.label)} (${escapeHtml(item.requirement_level ?? 'n/a')})</li>`)
    .join('');

  return `
    ${draftBlock}
    <p class="kb-disclaimer">${escapeHtml(report.disclaimer)}</p>
    <p class="kb-headline">${escapeHtml(report.headline)}</p>
    <p class="kb-meta muted">Pack: ${escapeHtml(report.knowledge_pack_id ?? '—')} · ${escapeHtml(report.knowledge_pack_release_status)}</p>
    <div class="kb-section">
      <h4>Matched skills</h4>
      <div class="kb-chips">${skills}</div>
    </div>
    <div class="kb-section">
      <h4>Linked regulations</h4>
      <ul class="kb-list">${regList || '<li class="muted">None</li>'}</ul>
    </div>
    <div class="kb-section">
      <h4>Required evidence</h4>
      <ul class="kb-list">${evidenceList || '<li class="muted">None</li>'}</ul>
    </div>
    ${renderGuidanceSuggestions(report)}
    <div class="kb-actions">
      <a class="link-muted" href="${explorerUrl(report.primary_skill)}" target="_blank" rel="noopener">Open in Knowledge Explorer →</a>
    </div>
    <div class="kb-section">
      <h4>Was this knowledge useful?</h4>
      <div class="kb-feedback-row">
        <button type="button" class="btn-kb-feedback" data-feedback="yes">Yes</button>
        <button type="button" class="btn-kb-feedback" data-feedback="needs_update">Needs update</button>
      </div>
      <p class="kb-feedback-status hidden"></p>
    </div>`;
}

function bindFeedback(root, report) {
  const status = root.querySelector('.kb-feedback-status');
  root.querySelectorAll('.btn-kb-feedback').forEach((button) => {
    button.addEventListener('click', async () => {
      root.querySelectorAll('.btn-kb-feedback').forEach((el) => {
        el.disabled = true;
      });
      try {
        await submitPreviewFeedback(report, button.dataset.feedback);
        status.textContent = 'Feedback recorded. Thank you.';
        status.classList.remove('hidden');
      } catch (error) {
        status.textContent = error.message;
        status.classList.remove('hidden');
        root.querySelectorAll('.btn-kb-feedback').forEach((el) => {
          el.disabled = false;
        });
      }
    });
  });
}

/**
 * Mount or refresh Knowledge Basis panel.
 * @param {HTMLElement} wrap - outer container (#knowledge-basis-wrap)
 * @param {{ claimText: string, country: string, category?: string }} context
 */
export async function mountKnowledgeBasis(wrap, context) {
  const content = wrap.querySelector('.kb-content');
  if (!content) {
    return;
  }

  const claimText = context.claimText?.trim();
  if (!claimText) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  const cacheKey = `${context.country}:${claimText.slice(0, 64)}`;

  if (previewCache.has(cacheKey)) {
    const report = previewCache.get(cacheKey);
    content.innerHTML = renderPreviewContent(report);
    bindFeedback(content, report);
    return;
  }

  content.innerHTML = '<p class="muted">Loading governed knowledge…</p>';

  try {
    const report = await fetchKnowledgePreview({
      claimText,
      country: context.country,
      category: context.category,
    });
    previewCache.set(cacheKey, report);
    content.innerHTML = renderPreviewContent(report);
    bindFeedback(content, report);
  } catch (error) {
    content.innerHTML = `
      <p class="kb-disclaimer">Knowledge preview unavailable: ${escapeHtml(error.message)}</p>
      <p class="muted"><a class="link-muted" href="/knowledge/index.html?tab=preview">Try standalone Knowledge Preview →</a></p>`;
  }
}

export function clearKnowledgeBasisCache() {
  previewCache.clear();
}
