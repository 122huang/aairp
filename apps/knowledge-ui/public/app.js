/** @typedef {import('./knowledge-visibility.snapshot.json')} VisibilitySnapshot */

const SNAPSHOT_URL = '/knowledge/knowledge-visibility.snapshot.json';

/** @type {VisibilitySnapshot | null} */
let snapshot = null;

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${tab}`);
  });
}

function initTabs() {
  for (const button of document.querySelectorAll('.tab')) {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  }
}

function applyDeepLinkFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const skill = params.get('skill');
  if (tab && ['dashboard', 'explorer', 'preview'].includes(tab)) {
    switchTab(tab);
  }
  if (skill) {
    window.__preselectedSkill = skill;
  }
}

function renderPackStatus() {
  if (!snapshot) {
    return;
  }
  const pack = snapshot.knowledge_pack;
  const pill = $('#pack-status-pill');
  const banner = $('#draft-banner');

  if (pack.release_status === 'released') {
    pill.textContent = 'Released';
    pill.className = 'status-pill status-released';
    banner.classList.add('hidden');
  } else if (pack.release_status === 'draft') {
    pill.textContent = 'Draft preview';
    pill.className = 'status-pill status-draft';
    banner.classList.remove('hidden');
    banner.textContent =
      pack.draft_warning ?? 'Draft knowledge pack. Not approved for compliance use.';
  } else {
    pill.textContent = 'No pack';
    pill.className = 'status-pill status-draft';
    banner.classList.remove('hidden');
    banner.textContent =
      pack.draft_warning ?? 'Draft knowledge pack. Not approved for compliance use.';
  }
}

function renderDashboard() {
  if (!snapshot) {
    return;
  }

  $('#snapshot-meta').textContent = `Snapshot ${snapshot.generated_at} · schema ${snapshot.schema_version}`;

  const pack = snapshot.knowledge_pack;
  $('#pack-header').innerHTML = [
    stat('Pack ID', pack.knowledge_pack_id ?? '—'),
    stat('Release status', pack.release_status),
    stat('Fingerprint', pack.knowledge_pack_fingerprint?.slice(0, 16) ?? '—'),
    stat('Released at', pack.released_at ?? '—'),
    stat('Total entries', String(snapshot.platform.total_entries)),
    stat('Platform version', snapshot.platform.platform_version),
  ].join('');

  $('#corpus-grid').innerHTML = snapshot.platform.corpora
    .map((corpus) => {
      const kqs = corpus.knowledge_quality_score;
      return `
        <article class="corpus-card">
          <h3>${escapeHtml(corpus.corpus_type)}</h3>
          <div class="metric-row"><span>Entries</span><strong>${corpus.entry_count}</strong></div>
          <div class="metric-row"><span>KQS</span><strong>${kqs.toFixed(1)}</strong></div>
          <div class="kqs-bar"><div class="kqs-fill" style="width:${Math.min(100, kqs)}%"></div></div>
          <div class="metric-row"><span>Freshness G/Y/R</span>
            <span>${corpus.freshness.green}/${corpus.freshness.yellow}/${corpus.freshness.red}</span>
          </div>
          <div class="metric-row"><span>Validation errors</span><span>${corpus.validation_errors}</span></div>
          <div class="metric-row"><span>Governance warnings</span><span>${corpus.governance_warnings}</span></div>
        </article>`;
    })
    .join('');

  const qc = snapshot.quality_vs_coverage;
  const kqsRows = Object.entries(qc.kqs_by_corpus)
    .map(([type, score]) => `<div class="metric-row"><span>${escapeHtml(type)} KQS</span><strong>${score.toFixed(1)}</strong></div>`)
    .join('');

  $('#quality-coverage').innerHTML = `
    <div>
      <div class="pack-stat"><div class="label">Knowledge Quality (KQS)</div>${kqsRows}</div>
    </div>
    <div>
      <div class="pack-stat"><div class="label">Benchmark coverage</div>
        <div class="value">${
          qc.case_benchmark_coverage_pct != null
            ? `${qc.case_benchmark_coverage_pct}% (${qc.case_benchmark_covered}/${qc.case_benchmark_total})`
            : '—'
        }</div>
      </div>
    </div>
    <div>
      <div class="pack-stat"><div class="label">Regulation countries</div>
        <div class="value">${(qc.regulation_countries ?? []).join(', ') || '—'}</div>
      </div>
    </div>`;
}

function renderImprovementQueue() {
  if (!snapshot?.improvement_queue) {
    return;
  }
  const q = snapshot.improvement_queue;
  $('#improvement-queue').innerHTML = [
    queueStat('P1 gaps', q.p1_gaps),
    queueStat('P2 gaps', q.p2_gaps),
    queueStat('P3 gaps', q.p3_gaps),
    queueStat('P4 gaps', q.p4_gaps),
    queueStat('P5 gaps', q.p5_gaps),
    queueStat('Evidence gaps', q.evidence_gaps),
    queueStat('Unmapped claims', q.unmapped_claims),
  ].join('');
}

function queueStat(label, value) {
  return `<div class="queue-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div></div>`;
}

function stat(label, value) {
  return `<div class="pack-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function nodeMap() {
  const map = new Map();
  for (const node of snapshot?.graph.nodes ?? []) {
    map.set(node.id, node);
  }
  return map;
}

function edgesForSkill(skillId) {
  return (snapshot?.graph.edges ?? []).filter((edge) => edge.from === skillId);
}

function initExplorer() {
  const skillSelect = $('#skill-select');
  const claimFilter = $('#claim-filter');
  const skills = snapshot?.graph.indexes.skills ?? [];

  skillSelect.innerHTML = skills
    .map((skill) => `<option value="${escapeHtml(skill.id)}">${escapeHtml(skill.label)}</option>`)
    .join('');

  if (window.__preselectedSkill && skills.some((s) => s.id === window.__preselectedSkill)) {
    skillSelect.value = window.__preselectedSkill;
    delete window.__preselectedSkill;
  }

  const claimTypes = new Set();
  for (const skill of skills) {
    for (const claimType of skill.claim_types ?? []) {
      claimTypes.add(claimType);
    }
  }
  claimFilter.innerHTML =
    '<option value="">All claim types</option>' +
    [...claimTypes]
      .sort()
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
      .join('');

  const render = () => {
    const skillId = skillSelect.value;
    const claimType = claimFilter.value;
    renderSkillTree(skillId, claimType);
  };

  skillSelect.addEventListener('change', render);
  claimFilter.addEventListener('change', render);
  render();
}

function renderSkillTree(skillId, claimTypeFilter) {
  const nodes = nodeMap();
  const skill = nodes.get(skillId);
  const tree = $('#graph-tree');
  if (!skill) {
    tree.innerHTML = '<p class="muted">No skill selected.</p>';
    return;
  }

  const edges = edgesForSkill(skillId);
  const groups = {
    governed_by: [],
    linked_rule: [],
    requires_evidence: [],
    rewrite_guidance: [],
    validates: [],
  };

  for (const edge of edges) {
    const target = nodes.get(edge.to);
    if (!target) {
      continue;
    }
    if (claimTypeFilter && !(target.claim_types ?? []).includes(claimTypeFilter)) {
      continue;
    }
    groups[edge.relation]?.push(target);
  }

  const branch = (label, items) => {
    if (items.length === 0) {
      return '';
    }
    return `
      <div class="tree-branch">
        <div class="branch-label">${escapeHtml(label)}</div>
        ${items.map((node) => nodeButton(node)).join('')}
      </div>`;
  };

  tree.innerHTML = `
    <div class="tree-root">
      <div class="tree-skill">${escapeHtml(skill.label)}</div>
      <div class="tree-branches">
        ${branch('Regulations', groups.governed_by)}
        ${branch('Rules', groups.linked_rule)}
        ${branch('Evidence', groups.requires_evidence)}
        ${branch('Rewrites', groups.rewrite_guidance)}
        ${branch('Cases', groups.validates)}
      </div>
    </div>`;

  tree.querySelectorAll('.tree-node').forEach((el) => {
    el.addEventListener('click', () => {
      tree.querySelectorAll('.tree-node').forEach((n) => n.classList.remove('selected'));
      el.classList.add('selected');
      const nodeId = el.dataset.nodeId;
      showNodeDetail(nodes.get(nodeId));
    });
  });
}

function nodeButton(node) {
  return `
    <button type="button" class="tree-node" data-node-id="${escapeHtml(node.id)}">
      <div class="node-type">${escapeHtml(node.corpus_type)}</div>
      <div>${escapeHtml(node.label)}</div>
    </button>`;
}

function showNodeDetail(node) {
  const panel = $('#node-detail');
  if (!node) {
    panel.innerHTML = '<p class="muted">Node not found.</p>';
    return;
  }
  const extras = [
    node.country ? `Country: ${node.country}` : '',
    node.requirement_level ? `Requirement: ${node.requirement_level}` : '',
    node.strategy ? `Strategy: ${node.strategy}` : '',
    node.benchmark_ref ? `Benchmark: ${node.benchmark_ref}` : '',
    node.verification_status ? `Verification: ${node.verification_status}` : '',
  ]
    .filter(Boolean)
    .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
    .join('');

  panel.innerHTML = `
    <h3>${escapeHtml(node.label)}</h3>
    <div class="muted">${escapeHtml(node.corpus_type)} · ${escapeHtml(node.id)}</div>
    ${extras}
    <p style="margin-top:12px">${escapeHtml(node.summary)}</p>`;
}

function initPreviewForm() {
  const form = $('#preview-form');
  const result = $('#preview-result');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const claimText = $('#claim-text').value.trim();
    const country = $('#preview-country').value.trim();
    const category = $('#preview-category').value.trim();

    result.classList.remove('hidden');
    result.innerHTML = '<p class="muted">Generating preview…</p>';

    try {
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
        throw new Error(err.detail ?? `HTTP ${response.status}`);
      }
      const report = await response.json();
      renderPreviewReport(report);
    } catch (error) {
      result.innerHTML = `<p class="preview-disclaimer">Preview failed: ${escapeHtml(error.message)}</p>`;
    }
  });
}

function renderPreviewReport(report) {
  const result = $('#preview-result');
  const draftBlock = report.draft_warning
    ? `<div class="preview-disclaimer" role="alert">${escapeHtml(report.draft_warning)}</div>`
    : '';

  const skills = report.matched_skills
    .map((skill) => {
      const primary = skill.knowledge_id === report.primary_skill ? ' primary' : '';
      return `<span class="skill-chip${primary}">${escapeHtml(skill.label)} — ${escapeHtml(skill.match_reason)}</span>`;
    })
    .join('');

  const list = (items, formatter) =>
    items.length === 0
      ? '<p class="muted">None linked.</p>'
      : `<ul>${items.map((item) => `<li>${formatter(item)}</li>`).join('')}</ul>`;

  result.innerHTML = `
    ${draftBlock}
    <div class="preview-disclaimer">${escapeHtml(report.disclaimer)}</div>
    <h2>${escapeHtml(report.headline)}</h2>
    <p class="muted">Pack: ${escapeHtml(report.knowledge_pack_id ?? '—')} (${escapeHtml(report.knowledge_pack_release_status)})</p>
    <div class="preview-section">
      <h3>Matched skills</h3>
      ${skills || '<p class="muted">No skills matched.</p>'}
      ${report.primary_skill_label ? `<p class="muted">Primary (presentation): ${escapeHtml(report.primary_skill_label)}</p>` : ''}
    </div>
    <div class="preview-section">
      <h3>Linked regulations</h3>
      ${list(report.linked_knowledge.regulations, (item) => escapeHtml(`${item.label}: ${item.summary.slice(0, 120)}…`))}
    </div>
    <div class="preview-section">
      <h3>Required evidence</h3>
      ${list(report.linked_knowledge.evidence, (item) => escapeHtml(`${item.label} (${item.requirement_level ?? 'n/a'})`))}
    </div>
    <div class="preview-section">
      <h3>Rewrite guidance</h3>
      ${list(report.linked_knowledge.rewrites, (item) => escapeHtml(`${item.label} (${item.strategy ?? 'n/a'})`))}
    </div>
    <div class="preview-section">
      <h3>Related cases</h3>
      ${list(report.linked_knowledge.cases, (item) =>
        escapeHtml(`${item.label}${item.benchmark_ref ? ` · ${item.benchmark_ref}` : ''}`),
      )}
    </div>
    <div class="preview-section">
      <h3>Was this knowledge useful?</h3>
      <div class="feedback-row" id="feedback-buttons">
        <button type="button" class="btn-feedback" data-feedback="yes">Yes</button>
        <button type="button" class="btn-feedback" data-feedback="needs_update">Needs update</button>
      </div>
      <p id="feedback-status" class="feedback-thanks hidden"></p>
    </div>`;

  bindFeedbackHandlers(report);
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
      matched_skills: report.matched_skills.map((skill) => skill.knowledge_id),
      matched_corpus_entries: [
        ...report.linked_knowledge.regulations.map((item) => item.knowledge_id),
        ...report.linked_knowledge.evidence.map((item) => item.knowledge_id),
        ...report.linked_knowledge.rewrites.map((item) => item.knowledge_id),
        ...report.linked_knowledge.cases.map((item) => item.knowledge_id),
      ],
      country: report.input_summary.country ?? null,
      linked_knowledge: report.linked_knowledge,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${response.status}`);
  }
  return response.json();
}

function bindFeedbackHandlers(report) {
  const status = $('#feedback-status');
  const buttons = document.querySelectorAll('#feedback-buttons .btn-feedback');
  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      buttons.forEach((el) => {
        el.disabled = true;
      });
      try {
        await submitPreviewFeedback(report, button.dataset.feedback);
        status.textContent = 'Feedback recorded. Thank you.';
        status.classList.remove('hidden');
      } catch (error) {
        status.textContent = `Feedback failed: ${error.message}`;
        status.classList.remove('hidden');
        buttons.forEach((el) => {
          el.disabled = false;
        });
      }
    });
  });
}

async function loadSnapshot() {
  const response = await fetch(SNAPSHOT_URL);
  if (!response.ok) {
    $('#snapshot-meta').textContent =
      'Snapshot not found — run pnpm knowledge:build-visibility-snapshot';
    return;
  }
  snapshot = await response.json();
  renderPackStatus();
  renderDashboard();
  renderImprovementQueue();
  initExplorer();
}

initTabs();
applyDeepLinkFromUrl();
initPreviewForm();
loadSnapshot();
