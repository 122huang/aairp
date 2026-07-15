const API = '';

const state = {
  demoCases: [],
  knowledge: null,
  selectedCase: null,
  running: false,
  trace: [],
  lastReviewId: null,
  caseFilter: 'all',
  batchResults: [],
  batchSplitItems: [],
  batchFilter: 'all',
  batchSearch: '',
  batchCancelled: false,
  batchProgress: null,
  rulePackVersion: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pushTrace(stage, title, detail, extra = {}) {
  state.trace.push({ stage, title, detail, ...extra, at: new Date().toISOString() });
  renderTrace();
}

function setStepStatus(stepId, status) {
  const el = document.querySelector(`.step[data-step="${stepId}"]`);
  if (!el) return;
  el.classList.remove('pending', 'running', 'done', 'skipped');
  el.classList.add(status);
}

function log(msg, detail = '') {
  const box = $('#pipeline-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<strong>${msg}</strong>${detail ? `<div class="detail">${detail}</div>` : ''}`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

function clearLog() {
  $('#pipeline-log').innerHTML = '';
  state.trace = [];
}

function renderStepper() {
  const stages = state.knowledge?.pipeline_stages ?? [];
  $('#pipeline-stepper').innerHTML = stages
    .map(
      (s) =>
        `<div class="step pending" data-step="${s.id}"><span class="step-dot" aria-hidden="true"></span><span class="step-label">${s.label}</span></div>`,
    )
    .join('');
}

function filteredCases() {
  if (state.caseFilter === 'all') return state.demoCases;
  return state.demoCases.filter((c) => c.group === state.caseFilter);
}

function renderDemoCases() {
  const list = $('#demo-case-list');
  const cases = filteredCases();
  if (!cases.length) {
    list.innerHTML = '<p class="muted">该分类下暂无案例。</p>';
    return;
  }

  list.innerHTML = cases
    .map((c) => {
      const humanBadge = c.human_intent
        ? `<span class="case-card-human">人工 ${c.human_intent}</span>`
        : '';
      const decisionBadge =
        c.expected_decision === '—'
          ? ''
          : `<span class="case-card-decision decision-${c.expected_decision}">${c.expected_decision}</span>`;
      return `
    <button type="button" class="case-card" data-id="${c.id}">
      <span class="case-card-title">${c.title}${humanBadge}</span>
      <span class="case-card-sub">${c.subtitle}</span>
      ${decisionBadge}
    </button>`;
    })
    .join('');

  list.querySelectorAll('.case-card').forEach((btn) => {
    btn.addEventListener('click', () => selectCase(btn.dataset.id));
  });

  if (state.selectedCase) {
    const sel = list.querySelector(`[data-id="${state.selectedCase.id}"]`);
    if (sel) sel.classList.add('selected');
  }
}

function truncate(s, max = 80) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function splitBatchText(raw, mode, delimiter) {
  const text = raw.trim();
  if (!text) return [];

  if (mode === 'line') {
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (mode === 'blank') {
    return text.split(/\r?\n\s*\r?\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (mode === 'delimiter') {
    const sep = delimiter === '\\t' ? '\t' : delimiter;
    if (!sep) return [];
    const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.split(new RegExp(escaped)).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function getSplitMode() {
  return $('#split-mode').value;
}

function isBatchSplitMode() {
  return getSplitMode() !== 'single';
}

function getBatchSplitConfig() {
  const mode = getSplitMode();
  let delimiter = ';';
  if (mode === 'delimiter') {
    const preset = $('#delimiter-preset').value;
    delimiter = preset === '__custom__' ? $('#delimiter-custom').value : preset;
  }
  return { mode, delimiter };
}

function getBatchSplitItems() {
  const raw = $('#custom-text').value;
  if (!isBatchSplitMode()) return [];
  const { mode, delimiter } = getBatchSplitConfig();
  if (mode === 'delimiter' && !delimiter.trim()) return [];
  return splitBatchText(raw, mode, delimiter);
}

function getActionableFindings(result) {
  if (result.error) return [];
  const findings = result.summary?.findings ?? [];
  return findings.filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT' || f.decision === 'FAIL',
  );
}

function formatBatchFindings(result) {
  const actionable = getActionableFindings(result);
  if (result.error) return result.error;
  if (!actionable.length) return '—';
  return actionable.map((f) => f.ref_id ?? f.summary).join(' · ');
}

function getMainIssue(result) {
  if (result.error) return result.error.slice(0, 120);
  const actionable = getActionableFindings(result);
  if (!actionable.length) return '—';
  return actionable[0].summary ?? actionable[0].ref_id ?? '—';
}

function decisionToRisk(decision) {
  if (decision === 'REJECT') return { label: 'HIGH', class: 'risk-high' };
  if (decision === 'WARN') return { label: 'MEDIUM', class: 'risk-medium' };
  if (decision === 'PASS') return { label: 'LOW', class: 'risk-low' };
  return { label: '—', class: 'risk-none' };
}

function formatConfidence(result) {
  if (result.error || result.confidence == null) return '—';
  return `${Math.round(result.confidence * 100)}%`;
}

function getRowStatus(row, processingIndex) {
  if (row.error) return { label: '失败', class: 'status-failed' };
  if (row.status === 'processing') return { label: '处理中', class: 'status-processing' };
  if (row.status === 'pending') return { label: '等待', class: 'status-pending' };
  return { label: '完成', class: 'status-done' };
}

function countBatchDecisions(results) {
  const counts = { PASS: 0, WARN: 0, REJECT: 0, ERROR: 0 };
  for (const row of results) {
    if (row.status === 'pending' || row.status === 'processing') continue;
    const key = row.error ? 'ERROR' : row.final_decision ?? 'ERROR';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function getFilteredBatchResults() {
  const q = state.batchSearch.trim().toLowerCase();
  return state.batchResults.filter((row) => {
    if (state.batchFilter !== 'all') {
      const d = row.error ? 'ERROR' : row.final_decision;
      if (d !== state.batchFilter) return false;
    }
    if (q && !row.text.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderBatchProgress() {
  const panel = $('#batch-progress-panel');
  const p = state.batchProgress;
  if (!p || !state.running) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
  $('#batch-progress-fill').style.width = `${pct}%`;
  $('#batch-progress-label').textContent = `${pct}% · 已完成 ${p.completed} / ${p.total}${p.processing ? ` · 正在处理 #${p.processing}` : ''}`;
  $('#batch-stat-row').innerHTML = `
    <span class="batch-stat">共 <strong>${p.total}</strong></span>
    <span class="batch-stat">PASS <strong class="stat-pass">${p.pass}</strong></span>
    <span class="batch-stat">WARN <strong class="stat-warn">${p.warn}</strong></span>
    <span class="batch-stat">REJECT <strong class="stat-reject">${p.reject}</strong></span>
    <span class="batch-stat">失败 <strong>${p.failed}</strong></span>`;
}

function renderRulePackInfo() {
  const el = $('#rule-pack-info');
  const country = $('#custom-country')?.value ?? 'SG';
  const category = $('#custom-category')?.value ?? '';
  const ver = state.rulePackVersion ?? state.knowledge?.rule_pack?.pack_version ?? '—';
  el.textContent = `规则集：${country} · ${category} · ${ver}`;
}

function setInputMethod(method) {
  $$('.input-method-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.inputMethod === method),
  );
  $('#input-paste-panel').hidden = method !== 'paste';
  $('#input-file-panel').hidden = method !== 'file';
}

async function loadTxtFile(file) {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    alert('请上传 .txt 文件');
    return;
  }
  const text = await file.text();
  $('#custom-text').value = text;
  $('#split-mode').value = 'line';
  updateSplitModeUi();
  setInputMethod('paste');
  $('#file-upload-name').hidden = false;
  $('#file-upload-name').textContent = `已载入：${file.name}（${text.split(/\r?\n/).filter((l) => l.trim()).length} 行）`;
  renderSplitPreview();
}

function openBatchDetailDrawer(index) {
  const row = state.batchResults.find((r) => r.index === index);
  if (!row) return;
  const backdrop = $('#batch-drawer-backdrop');
  const drawer = $('#batch-detail-drawer');
  $('#batch-drawer-title').textContent = `文案 #${row.index} 详情`;

  if (row.error) {
    $('#batch-drawer-body').innerHTML = `
      <section class="drawer-section">
        <h4>原文</h4>
        <p class="drawer-text">${escapeHtml(row.text)}</p>
      </section>
      <section class="drawer-section">
        <p class="decision-ERROR case-card-decision">ERROR</p>
        <p class="muted">${escapeHtml(row.error)}</p>
      </section>`;
  } else {
    const risk = decisionToRisk(row.final_decision);
    const findings = getActionableFindings(row);
    const findingsHtml = findings.length
      ? findings
          .map(
            (f) => `
        <div class="drawer-finding">
          <div class="drawer-finding-head">
            <span class="module-tag module-${(f.module ?? 'rule').toLowerCase()}">${escapeHtml((f.module ?? 'RULE').toUpperCase())}</span>
            <span class="severity-tag">${escapeHtml(f.severity ?? '')}</span>
          </div>
          <p class="drawer-finding-id">${escapeHtml(f.ref_id ?? '')}</p>
          <p>${escapeHtml(f.summary ?? '')}</p>
        </div>`,
          )
          .join('')
      : '<p class="muted">无 WARN / REJECT 级别命中</p>';

    $('#batch-drawer-body').innerHTML = `
      <section class="drawer-section">
        <h4>原文</h4>
        <p class="drawer-text">${escapeHtml(row.text)}</p>
      </section>
      <section class="drawer-section drawer-summary">
        <span class="case-card-decision decision-${row.final_decision}">${row.final_decision}</span>
        <span class="risk-pill ${risk.class}">${risk.label}</span>
        <span class="muted">置信度 ${formatConfidence(row)}</span>
      </section>
      <section class="drawer-section">
        <h4>决策理由</h4>
        <p>${escapeHtml(row.rationale ?? '—')}</p>
      </section>
      <section class="drawer-section">
        <h4>触发规则 / Playbook</h4>
        ${findingsHtml}
      </section>
      ${
        row.report_html
          ? `<section class="drawer-section"><button type="button" class="btn secondary btn-sm" id="btn-drawer-full-report">查看完整 HTML 报告</button></section>`
          : ''
      }
      <p class="muted drawer-meta">review_id: ${escapeHtml(row.review_id ?? '—')}</p>`;

    const reportBtn = $('#btn-drawer-full-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        showReport(row.report_html, row.final_decision);
        closeBatchDetailDrawer();
        switchTab('report');
      });
    }
  }

  backdrop.hidden = false;
  drawer.hidden = false;
}

function closeBatchDetailDrawer() {
  $('#batch-drawer-backdrop').hidden = true;
  $('#batch-detail-drawer').hidden = true;
}

function updateSplitModeUi() {
  const mode = getSplitMode();
  const preview = $('#split-preview');
  $('#delimiter-row').hidden = mode !== 'delimiter';
  if (mode === 'delimiter') {
    updateDelimiterUi();
  }
  if (mode === 'single') {
    preview.hidden = true;
    return;
  }
  preview.hidden = false;
  renderSplitPreview();
}

function updateDelimiterUi() {
  const isCustom = $('#delimiter-preset').value === '__custom__';
  $('#delimiter-custom').hidden = !isCustom;
}

function renderSplitPreview() {
  const preview = $('#split-preview');
  if (!isBatchSplitMode()) {
    preview.hidden = true;
    return;
  }
  preview.hidden = false;

  const items = getBatchSplitItems();
  state.batchSplitItems = items;

  if (!items.length) {
    preview.innerHTML =
      '<span class="batch-preview-empty">未识别到有效文案，请检查输入与分条方式</span>';
    return;
  }

  const modeLabel = {
    line: '每行一条',
    delimiter: '字符分隔',
    blank: '空行分隔',
  }[getSplitMode()];

  const samples = items
    .slice(0, 3)
    .map(
      (t, i) =>
        `<li><span class="batch-preview-idx">${i + 1}.</span> ${escapeHtml(truncate(t, 60))}</li>`,
    )
    .join('');
  const more = items.length > 3 ? `<li class="muted">… 还有 ${items.length - 3} 条</li>` : '';

  preview.innerHTML = `
    <p class="batch-preview-count"><strong>识别 ${items.length} 条</strong> · ${modeLabel}</p>
    <ol class="batch-preview-list">${samples}${more}</ol>`;
}

function renderBatchResults() {
  const empty = $('#batch-results-empty');
  const wrap = $('#batch-results-wrap');
  const body = $('#batch-results-body');
  const summary = $('#batch-summary');
  const exportBtn = $('#btn-export-batch-csv');

  renderBatchProgress();

  if (!state.batchResults.length) {
    empty.hidden = false;
    wrap.hidden = true;
    exportBtn.disabled = true;
    summary.textContent = '选择分条方式并运行审核后，汇总将显示在此处';
    return;
  }

  const finished = state.batchResults.filter((r) => r.status === 'done' || r.error);
  const counts = countBatchDecisions(finished);
  const batchLabel = $('#batch-name').value.trim();
  summary.textContent = `${batchLabel ? `${batchLabel} · ` : ''}共 ${state.batchResults.length} 条 · PASS ${counts.PASS} · WARN ${counts.WARN} · REJECT ${counts.REJECT}${counts.ERROR ? ` · 错误 ${counts.ERROR}` : ''}${state.running ? ' · 进行中…' : ''}`;

  const visible = getFilteredBatchResults();
  if (!visible.length && finished.length) {
    empty.hidden = false;
    empty.querySelector('p').textContent = '当前筛选条件下无结果，请调整筛选或搜索词。';
    wrap.hidden = true;
    exportBtn.disabled = !finished.length;
    return;
  }

  empty.hidden = true;
  wrap.hidden = false;
  exportBtn.disabled = !finished.length;

  body.innerHTML = visible
    .map((row) => {
      const decision = row.error ? 'ERROR' : row.final_decision ?? '…';
      const decisionClass = row.error ? 'decision-ERROR' : `decision-${row.final_decision ?? 'PASS'}`;
      const risk = row.error ? { label: '—', class: 'risk-none' } : decisionToRisk(row.final_decision);
      const status = getRowStatus(row);
      return `
        <tr data-batch-index="${row.index}">
          <td>${row.index}</td>
          <td class="batch-text-cell" title="${escapeHtml(row.text)}">${escapeHtml(truncate(row.text, 100))}</td>
          <td><span class="case-card-decision ${decisionClass}">${decision}</span></td>
          <td><span class="risk-pill ${risk.class}">${risk.label}</span></td>
          <td>${formatConfidence(row)}</td>
          <td class="batch-findings-cell">${escapeHtml(truncate(getMainIssue(row), 80))}</td>
          <td><span class="status-pill ${status.class}">${status.label}</span></td>
          <td>${
            row.status === 'done' || row.error
              ? `<button type="button" class="btn-link batch-detail-btn" data-index="${row.index}">详情</button>`
              : ''
          }</td>
        </tr>`;
    })
    .join('');

  body.querySelectorAll('.batch-detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => openBatchDetailDrawer(Number(btn.dataset.index)));
  });
}

function cancelBatchReview() {
  state.batchCancelled = true;
}

function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportBatchCsv() {
  const rows = state.batchResults.filter((r) => r.status === 'done' || r.error);
  if (!rows.length) return;
  const csvRows = [
    ['序号', '文案', '决策', '风险', '置信度', '主要问题', '命中要点', '理由', 'review_id'],
  ];
  for (const row of rows) {
    const risk = row.error ? '—' : decisionToRisk(row.final_decision).label;
    csvRows.push([
      row.index,
      row.text,
      row.error ? 'ERROR' : row.final_decision,
      risk,
      row.error ? '' : formatConfidence(row).replace('%', ''),
      getMainIssue(row),
      formatBatchFindings(row),
      row.error ?? row.rationale ?? '',
      row.review_id ?? '',
    ]);
  }
  const csv =
    '\uFEFF' +
    csvRows
      .map((cells) =>
        cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','),
      )
      .join('\r\n');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = $('#batch-name').value.trim();
  const prefix = name ? name.replace(/[^\w\u4e00-\u9fff-]+/g, '_') : 'batch-review';
  downloadTextFile(`${prefix}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
}

async function runBatchReview() {
  if (state.running) return;
  const items = getBatchSplitItems();
  if (!items.length) {
    alert('未识别到有效文案，请先粘贴内容或上传 .txt');
    return;
  }

  const country = $('#custom-country').value;
  const category = $('#custom-category').value;
  const uploadBase = {
    country_id: country,
    platform_id: 'META',
    category_id: category,
    tags: ['legal-pilot:batch'],
  };

  state.running = true;
  state.batchCancelled = false;
  state.batchResults = items.map((text, i) => ({
    index: i + 1,
    text,
    status: 'pending',
  }));
  state.batchProgress = {
    total: items.length,
    completed: 0,
    processing: null,
    pass: 0,
    warn: 0,
    reject: 0,
    failed: 0,
  };

  renderBatchResults();
  $('#btn-run-custom').disabled = true;
  $('#btn-cancel-batch').disabled = false;
  switchTab('batch');

  for (let i = 0; i < items.length; i += 1) {
    if (state.batchCancelled) break;

    const text = items[i];
    const row = state.batchResults[i];
    row.status = 'processing';
    state.batchProgress.processing = i + 1;
    renderBatchResults();

    try {
      const full = await api('/demo/review', {
        ...uploadBase,
        content: { text },
      });
      Object.assign(row, {
        status: 'done',
        final_decision: full.final_decision,
        confidence: full.confidence,
        rationale: full.rationale,
        summary: full.summary,
        review_id: full.review_id,
        report_html: full.report_html,
      });
      const d = full.final_decision;
      if (d === 'PASS') state.batchProgress.pass += 1;
      else if (d === 'WARN') state.batchProgress.warn += 1;
      else if (d === 'REJECT') state.batchProgress.reject += 1;
    } catch (err) {
      row.status = 'done';
      row.error = err.message;
      state.batchProgress.failed += 1;
    }

    state.batchProgress.completed += 1;
    state.batchProgress.processing = null;
    renderBatchResults();
  }

  for (const row of state.batchResults) {
    if (row.status === 'pending' || row.status === 'processing') {
      row.status = 'done';
      if (!row.error && !row.final_decision) {
        row.error = '已取消';
        state.batchProgress.failed += 1;
      }
    }
  }

  state.batchProgress.processing = null;
  state.running = false;
  $('#btn-run-custom').disabled = false;
  $('#btn-cancel-batch').disabled = true;
  renderBatchResults();
  await loadCaseLibrary();
}

function runCustomReview() {
  if (state.running) return;
  if (isBatchSplitMode()) {
    runBatchReview();
    return;
  }
  useCustomCase(true);
}

function setCaseFilter(filter) {
  state.caseFilter = filter;
  $$('.filter-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.filter === filter));
  renderDemoCases();
}

function useCustomCase(andRun = false) {
  const text = $('#custom-text').value.trim();
  if (!text) {
    alert('请先粘贴广告文案');
    return;
  }
  if (isBatchSplitMode()) {
    alert('当前为批量分条模式，请直接点击「运行审核」');
    return;
  }
  const country = $('#custom-country').value;
  const category = $('#custom-category').value;
  const customCase = {
    id: `custom-${Date.now()}`,
    group: 'custom',
    title: '自定义文案',
    subtitle: `${country} · ${category}`,
    expected_decision: '—',
    highlight: '真实文案试跑 · 无预设人工标签',
    upload: {
      country_id: country,
      platform_id: 'META',
      category_id: category,
      content: { text },
      tags: ['legal-pilot:custom'],
    },
  };
  state.demoCases = state.demoCases.filter((c) => c.group !== 'custom' || !c.id.startsWith('custom-'));
  state.demoCases.unshift(customCase);
  setCaseFilter('all');
  selectCase(customCase.id);
  if (andRun) runReview();
}

function selectCase(id) {
  const c = state.demoCases.find((x) => x.id === id);
  if (!c) return;
  state.selectedCase = c;
  $$('.case-card').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
  $('#selected-case-title').textContent = c.title;
  const engineNote =
    c.engine_may_differ ? ' · AI 结果可能与人工预期不同（Pilot GAP 案例）' : '';
  $('#selected-case-sub').textContent = `${c.subtitle} · ${c.highlight}${engineNote}`;
  $('#btn-run-review').disabled = false;

  const u = c.upload;
  $('#ad-preview').classList.remove('empty');
  $('#ad-preview').innerHTML = `
    <div class="ad-meta">
      <span>${u.country_id}</span>
      <span>${u.category_id}</span>
      <span>${u.platform_id}</span>
    </div>
    <div>${escapeHtml(u.content.text)}</div>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTrace() {
  const box = $('#trace-timeline');
  if (!state.trace.length) {
    box.innerHTML =
      '<p class="muted">审核完成后，此处展示各阶段知识包版本与命中详情。</p>';
    return;
  }
  box.innerHTML = state.trace
    .map(
      (t) => `
    <div class="trace-card">
      <h3>${escapeHtml(t.title)}</h3>
      <p>${escapeHtml(t.detail)}</p>
      ${t.code ? `<p><code>${escapeHtml(t.code)}</code></p>` : ''}
    </div>`,
    )
    .join('');
}

function showReport(html, decision) {
  const empty = $('#report-empty');
  const frame = $('#report-frame');
  const badge = $('#report-decision-badge');
  empty.hidden = true;
  frame.hidden = false;
  frame.srcdoc = html;
  badge.classList.remove('hidden', 'decision-REJECT', 'decision-WARN', 'decision-PASS', 'decision-REVIEW');
  badge.classList.add(`decision-${decision}`);
  badge.textContent = decision;
}

async function runReview() {
  if (!state.selectedCase || state.running) return;
  state.running = true;
  $('#btn-run-review').disabled = true;
  clearLog();
  renderStepper();

  const upload = state.selectedCase.upload;
  const stages = state.knowledge.pipeline_stages.map((s) => s.id);

  for (const id of stages) setStepStatus(id, 'pending');

  try {
    setStepStatus('upload', 'running');
    log('正在上传广告…');
    const adRes = await api('/demo/advertisements', upload);
    setStepStatus('upload', 'done');
    pushTrace('upload', '广告上传', `advertisement_id: ${adRes.advertisement_id}`);
    await sleep(400);

    const adId = adRes.advertisement_id;

    setStepStatus('context', 'running');
    log('正在构建审核上下文…');
    const ctx = await api('/demo/review-context', { advertisement_id: adId });
    setStepStatus('context', 'done');
    const kv = ctx.resolved_knowledge_versions;
    pushTrace(
      'context',
      '上下文构建',
      `review_id: ${ctx.review_id} · 已绑定知识包版本`,
      {
        code: `rule=${kv.rule_pack_version} · playbook=${kv.playbook_pack_version}`,
      },
    );
    await sleep(400);

    setStepStatus('regulation', 'running');
    log('正在解析适用法规…');
    const regs = state.knowledge.regulations.filter(
      (r) => r.jurisdiction === upload.country_id || r.jurisdiction === 'SG',
    );
    setStepStatus('regulation', 'done');
    pushTrace(
      'regulation',
      '法规',
      regs.map((r) => `${r.law_name} — ${r.article}`).join(' · ') || '演示法规库',
    );
    await sleep(350);

    setStepStatus('rule', 'running');
    log('规则引擎评估…');
    const ruleRes = await api('/demo/rule-evaluation', { advertisement_id: adId });
    setStepStatus('rule', 'done');
    const ruleDetail =
      ruleRes.findings.length === 0
        ? '规则无命中'
        : ruleRes.findings
            .map((f) => {
              const cite = f.evaluation_detail?.citation;
              const citeStr = cite ? ` [${cite.law_name}]` : '';
              return `${f.ref_id} (${f.severity})${citeStr}: ${f.summary}`;
            })
            .join(' · ');
    pushTrace('rule', '规则引擎', ruleDetail, {
      code: `pack ${ruleRes.rule_pack_version} · blocker=${ruleRes.has_blocker}`,
    });
    log('规则评估完成', ruleDetail);
    await sleep(450);

    setStepStatus('playbook', 'running');
    log('Playbook 模式匹配…');
    const pbRes = await api('/demo/playbook-evaluation', { advertisement_id: adId });
    setStepStatus('playbook', 'done');
    const pbDetail =
      pbRes.findings.length === 0
        ? 'Playbook 无命中'
        : pbRes.findings.map((f) => `${f.ref_id}: ${f.summary}`).join(' · ');
    pushTrace('playbook', 'Playbook', pbDetail, {
      code: `pack ${pbRes.playbook_pack_version}`,
    });
    log('Playbook 完成', pbDetail);
    await sleep(450);

    setStepStatus('llm', 'running');
    log('Prompt + Open Risk LLM…');
    const llmRes = await api('/demo/open-risk-discovery', { advertisement_id: adId });
    if (llmRes.skipped) {
      setStepStatus('llm', 'skipped');
      pushTrace(
        'llm',
        'Prompt + LLM（已跳过）',
        `BLOCKER 已 decisive — skip_reason: ${llmRes.skip_reason ?? 'HAS_BLOCKER'}`,
        { code: llmRes.prompt_pack_version },
      );
      log('LLM 已跳过', llmRes.skip_reason ?? 'HAS_BLOCKER');
    } else {
      setStepStatus('llm', 'done');
      const llmDetail =
        llmRes.findings.length === 0
          ? '无额外 open-risk 发现'
          : llmRes.findings.map((f) => f.summary).join(' · ');
      pushTrace('llm', 'Prompt + LLM', llmDetail, { code: llmRes.prompt_pack_version });
      log('LLM 完成', llmDetail);
    }
    await sleep(450);

    setStepStatus('decision', 'running');
    log('决策引擎融合…');
    const decRes = await api('/demo/decision', { advertisement_id: adId });
    setStepStatus('decision', 'done');
    pushTrace(
      'decision',
      '决策引擎',
      `${decRes.final_decision}（置信度 ${decRes.confidence}）— ${decRes.rationale}`,
      {
        code: `rule=${decRes.finding_counts.rule} playbook=${decRes.finding_counts.playbook} llm=${decRes.finding_counts.llm}`,
      },
    );
    log('决策结果', `${decRes.final_decision} · ${decRes.rationale}`);
    await sleep(400);

    setStepStatus('report', 'running');
    log('正在生成报告并写入案例库…');
    const full = await api('/demo/review', upload);
    setStepStatus('report', 'done');
    state.lastReviewId = full.review_id;
    $('#footer-review-id').textContent = `review_id: ${full.review_id}`;

    pushTrace(
      'report',
      '审核报告',
      `${full.summary.findings.length} 条 finding · open_risk_skipped=${full.summary.open_risk_skipped}`,
    );
    showReport(full.report_html, full.final_decision);

    setStepStatus('case', 'running');
    await sleep(300);
    setStepStatus('case', 'done');
    pushTrace('case', '案例库', '案例已自动保存，可在「案例库」标签页查看。');

    log('审核完成', `决策: ${full.final_decision} · review_id: ${full.review_id}`);

    if (state.selectedCase.human_intent && state.selectedCase.human_intent !== full.final_decision) {
      log(
        '人工对比',
        `人工预期 ${state.selectedCase.human_intent} · AI 输出 ${full.final_decision}（Pilot GAP — 可记录反馈）`,
      );
    }

    await loadCaseLibrary();

    switchTab('report');
  } catch (err) {
    log('错误', err.message);
    console.error(err);
  } finally {
    state.running = false;
    $('#btn-run-review').disabled = !state.selectedCase;
  }
}

async function loadCaseLibrary() {
  const grid = $('#case-library-grid');
  grid.innerHTML = '<p class="muted">加载中…</p>';
  try {
    const data = await apiGet('/admin/cases?limit=50');
    if (!data.cases?.length) {
      grid.innerHTML = '<p class="muted">暂无案例。请先运行一次审核。</p>';
      return;
    }
    grid.innerHTML = data.cases
      .map(
        (c) => `
      <div class="library-card" data-case-id="${escapeHtml(c.case_id)}">
        <h4>${escapeHtml(c.case_id.slice(0, 28))}</h4>
        <span class="case-card-decision decision-${c.final_decision}">${c.final_decision}</span>
        <p class="muted">${c.country_id} · ${c.category_id}</p>
        <p class="muted">${c.lifecycle_status}</p>
      </div>`,
      )
      .join('');

    grid.querySelectorAll('.library-card').forEach((card) => {
      card.addEventListener('click', () => showCaseDetail(card.dataset.caseId));
    });
  } catch (err) {
    grid.innerHTML = `<p class="muted">无法加载案例库：${escapeHtml(err.message)}</p>`;
  }
}

async function showCaseDetail(caseId) {
  const panel = $('#case-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">加载详情…</p>';
  try {
    const record = await apiGet(`/admin/cases/${encodeURIComponent(caseId)}`);
    const rules = record.matched_rules?.length ?? 0;
    const pbs = record.matched_playbooks?.length ?? 0;
    panel.innerHTML = `
      <h4>${escapeHtml(record.case_id)}</h4>
      <p><strong>${record.decision.final_decision}</strong> · ${escapeHtml(record.decision.rationale)}</p>
      <p class="muted">Rule ${rules} · Playbook ${pbs} · review ${escapeHtml(record.review_id)}</p>
      <pre>${escapeHtml(JSON.stringify(record.reference_regulations, null, 2))}</pre>`;
  } catch (err) {
    panel.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => {
    const id = p.id.replace('panel-', '');
    p.hidden = id !== name;
    p.classList.toggle('active', id === name);
  });
  if (name === 'cases') loadCaseLibrary();
}

async function checkApi() {
  const el = $('#api-status');
  try {
    const h = await apiGet('/health');
    el.textContent = `API ${h.status ?? 'ok'}`;
    el.className = 'status-pill status-ok';
    return true;
  } catch {
    el.textContent = 'API 离线';
    el.className = 'status-pill status-bad';
    return false;
  }
}

async function init() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  $$('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setCaseFilter(btn.dataset.filter));
  });
  $('#btn-use-custom').addEventListener('click', () => useCustomCase(false));
  $('#btn-run-custom').addEventListener('click', runCustomReview);
  $('#btn-run-review').addEventListener('click', runReview);
  $('#btn-refresh-cases').addEventListener('click', loadCaseLibrary);

  $('#split-mode').addEventListener('change', updateSplitModeUi);
  $('#delimiter-preset').addEventListener('change', () => {
    updateDelimiterUi();
    renderSplitPreview();
  });
  $('#delimiter-custom').addEventListener('input', renderSplitPreview);
  $('#custom-text').addEventListener('input', () => {
    if (isBatchSplitMode()) renderSplitPreview();
  });
  $('#btn-export-batch-csv').addEventListener('click', exportBatchCsv);
  $('#btn-cancel-batch').addEventListener('click', cancelBatchReview);
  $('#btn-close-batch-drawer').addEventListener('click', closeBatchDetailDrawer);
  $('#batch-drawer-backdrop').addEventListener('click', closeBatchDetailDrawer);
  $('#batch-decision-filter').addEventListener('change', (e) => {
    state.batchFilter = e.target.value;
    renderBatchResults();
  });
  $('#batch-search').addEventListener('input', (e) => {
    state.batchSearch = e.target.value;
    renderBatchResults();
  });
  $('#custom-country').addEventListener('change', renderRulePackInfo);
  $('#custom-category').addEventListener('change', renderRulePackInfo);

  $$('.input-method-btn').forEach((btn) => {
    btn.addEventListener('click', () => setInputMethod(btn.dataset.inputMethod));
  });
  const dropZone = $('#file-drop-zone');
  const fileInput = $('#batch-file-input');
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadTxtFile(file);
    fileInput.value = '';
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) loadTxtFile(file);
  });

  const [casesRes, knowledgeRes] = await Promise.all([
    fetch('/demo-ui/demo-cases.json').then((r) => r.json()),
    fetch('/demo-ui/knowledge-manifest.json').then((r) => r.json()),
  ]);
  state.demoCases = casesRes.cases;
  state.knowledge = knowledgeRes;
  state.rulePackVersion = knowledgeRes.rule_pack?.pack_version ?? null;

  renderStepper();
  renderDemoCases();
  renderTrace();
  renderBatchResults();
  updateSplitModeUi();
  renderRulePackInfo();
  $('#btn-cancel-batch').disabled = true;
  await checkApi();

  selectCase('demo-01-reject-cure');
}

init();
