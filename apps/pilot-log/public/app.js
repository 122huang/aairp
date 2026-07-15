const $ = (sel) => document.querySelector(sel);

/** @type {Array<Record<string, unknown>>} */
let allCases = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function textPreview(record) {
  const content = record.advertisement?.content ?? {};
  const text = content.text?.trim() || content.ocr_text?.trim() || '（无文案 / 仅图片）';
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function findingCount(record) {
  const rules = record.matched_rules?.length ?? 0;
  const playbooks = record.matched_playbooks?.length ?? 0;
  const llm = record.llm_analysis?.findings?.length ?? 0;
  return rules + playbooks + llm;
}

function applyFilters() {
  const country = $('#filter-country').value;
  const decision = $('#filter-decision').value;
  const query = $('#filter-text').value.trim().toLowerCase();

  return allCases.filter((record) => {
    if (country && record.dimensions?.country_id !== country) return false;
    if (decision && record.decision?.final_decision !== decision) return false;
    if (query) {
      const hay = textPreview(record).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = applyFilters();
  const tbody = $('#records-body');
  $('#record-count').textContent = `共 ${rows.length} 条（总计 ${allCases.length} 条）`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无记录。请同事在 /review/ 提交审查后刷新。</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((record) => {
      const decision = record.decision?.final_decision ?? '—';
      return `
        <tr data-case-id="${escapeHtml(record.case_id)}">
          <td>${escapeHtml(formatTime(record.created_at))}</td>
          <td>${escapeHtml(record.dimensions?.country_id)}</td>
          <td>${escapeHtml(record.dimensions?.category_id)}</td>
          <td class="text-preview">${escapeHtml(textPreview(record))}</td>
          <td><span class="decision decision-${escapeHtml(decision)}">${escapeHtml(decision)}</span></td>
          <td>${findingCount(record)}</td>
          <td><button type="button" class="btn link btn-detail">详情</button></td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('.btn-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const caseId = btn.closest('tr')?.dataset.caseId;
      const record = allCases.find((c) => c.case_id === caseId);
      if (record) showDetail(record);
    });
  });
}

function showDetail(record) {
  const content = record.advertisement?.content ?? {};
  const rules = record.matched_rules ?? [];
  const playbooks = record.matched_playbooks ?? [];
  const llmFindings = record.llm_analysis?.findings ?? [];

  const findingItems = [
    ...rules.map((f) => `[规则] ${f.summary ?? f.ref_id}`),
    ...playbooks.map((f) => `[Playbook] ${f.summary ?? f.ref_id}`),
    ...llmFindings.map((f) => `[LLM] ${f.summary ?? f.ref_id}`),
  ];

  $('#detail-title').textContent = `案例 · ${record.case_id}`;
  $('#detail-body').innerHTML = `
    <dl class="meta-grid">
      <div><dt>审查 ID</dt><dd>${escapeHtml(record.review_id)}</dd></div>
      <div><dt>国家</dt><dd>${escapeHtml(record.dimensions?.country_id)}</dd></div>
      <div><dt>品类</dt><dd>${escapeHtml(record.dimensions?.category_id)}</dd></div>
      <div><dt>结论</dt><dd><span class="decision decision-${escapeHtml(record.decision?.final_decision)}">${escapeHtml(record.decision?.final_decision)}</span></dd></div>
      <div><dt>提交时间</dt><dd>${escapeHtml(formatTime(record.created_at))}</dd></div>
      <div><dt>状态</dt><dd>${escapeHtml(record.lifecycle_status)}</dd></div>
      <div><dt>Pipeline</dt><dd>${escapeHtml(record.metadata?.pipeline_version || '—')}</dd></div>
      <div><dt>Rule pack</dt><dd>${escapeHtml(record.context_builder_output?.resolved_knowledge_versions?.rulePackVersion || '—')}</dd></div>
      <div><dt>Playbook pack</dt><dd>${escapeHtml(record.context_builder_output?.resolved_knowledge_versions?.playbookPackVersion || '—')}</dd></div>
      <div><dt>Open Risk prompt</dt><dd>${escapeHtml(record.llm_analysis?.prompt_pack_version || '—')}</dd></div>
    </dl>
    <section class="detail-section">
      <h3>测试文案</h3>
      <div class="text-block">${escapeHtml(content.text || '（无）')}</div>
    </section>
    ${
      content.ocr_text
        ? `<section class="detail-section"><h3>图片 OCR</h3><div class="text-block">${escapeHtml(content.ocr_text)}</div></section>`
        : ''
    }
    <section class="detail-section">
      <h3>结论说明</h3>
      <div class="text-block">${escapeHtml(record.decision?.rationale || '—')}</div>
    </section>
    <section class="detail-section">
      <h3>人工反馈</h3>
      ${
        record.human_feedback
          ? `<div class="text-block">${escapeHtml(record.human_feedback.agreement_with_ai || '—')} · ${escapeHtml(record.human_feedback.decision || '—')}<br/>${escapeHtml(record.human_feedback.comment || '（无备注）')}<br/><span class="muted">${escapeHtml(formatTime(record.human_feedback.submitted_at))}</span></div>`
          : '<p class="muted">尚未写入 human_feedback（confirm 时可提交）。Vision finding / 真实模型名仍待 CaseRecord 字段补齐。</p>'
      }
    </section>
    <section class="detail-section">
      <h3>风险项 (${findingItems.length})</h3>
      ${
        findingItems.length
          ? `<ul class="finding-list">${findingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : '<p class="muted">无</p>'
      }
    </section>`;

  $('#detail-dialog').showModal();
}

async function apiGet(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }
  return response.json();
}

async function checkHealth() {
  const el = $('#api-status');
  try {
    const health = await apiGet('/health');
    el.textContent = `API ${health.status ?? 'ok'}`;
    el.className = 'status-pill ok';
    return true;
  } catch {
    el.textContent = 'API 离线';
    el.className = 'status-pill bad';
    return false;
  }
}

async function loadRecords() {
  const tbody = $('#records-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty">加载中…</td></tr>';

  try {
    const data = await apiGet('/kos/v1/cases/export');
    allCases = (data.cases ?? []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">加载失败：${escapeHtml(err.message)}</td></tr>`;
  }
}

function bindFilters() {
  for (const id of ['filter-country', 'filter-decision']) {
    $(id).addEventListener('change', renderTable);
  }
  $('#filter-text').addEventListener('input', renderTable);
}

async function init() {
  bindFilters();
  $('#btn-refresh').addEventListener('click', loadRecords);
  await checkHealth();
  await loadRecords();
}

init();
