const API = '';

const state = {
  demoCases: [],
  knowledge: null,
  selectedCase: null,
  running: false,
  trace: [],
  lastReviewId: null,
  caseFilter: 'all',
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
  badge.classList.remove('hidden', 'decision-REJECT', 'decision-WARN', 'decision-PASS');
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
  $('#btn-run-custom').addEventListener('click', () => useCustomCase(true));
  $('#btn-run-review').addEventListener('click', runReview);
  $('#btn-refresh-cases').addEventListener('click', loadCaseLibrary);

  const [casesRes, knowledgeRes] = await Promise.all([
    fetch('/admin-ui/demo-cases.json').then((r) => r.json()),
    fetch('/admin-ui/knowledge-manifest.json').then((r) => r.json()),
  ]);
  state.demoCases = casesRes.cases;
  state.knowledge = knowledgeRes;

  renderStepper();
  renderDemoCases();
  renderTrace();
  await checkApi();

  selectCase('demo-01-reject-cure');
}

init();
