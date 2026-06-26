const API = '';

const state = {
  demoCases: [],
  knowledge: null,
  selectedCase: null,
  running: false,
  trace: [],
  lastReviewId: null,
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
        `<div class="step pending" data-step="${s.id}"><span class="step-icon">${s.icon}</span><span class="step-label">${s.label}</span></div>`,
    )
    .join('');
}

function renderDemoCases() {
  const list = $('#demo-case-list');
  list.innerHTML = state.demoCases
    .map(
      (c) => `
    <button type="button" class="case-card" data-id="${c.id}">
      <span class="case-card-title">${c.title}</span>
      <span class="case-card-sub">${c.subtitle}</span>
      <span class="case-card-decision decision-${c.expected_decision}">${c.expected_decision}</span>
    </button>`,
    )
    .join('');

  list.querySelectorAll('.case-card').forEach((btn) => {
    btn.addEventListener('click', () => selectCase(btn.dataset.id));
  });
}

function selectCase(id) {
  const c = state.demoCases.find((x) => x.id === id);
  if (!c) return;
  state.selectedCase = c;
  $$('.case-card').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
  $('#selected-case-title').textContent = c.title;
  $('#selected-case-sub').textContent = `${c.subtitle} · ${c.highlight}`;
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
    box.innerHTML = '<p class="muted">完成审核后，Knowledge Trace 将在此展示各阶段版本与命中。</p>';
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
    log('上传广告…');
    const adRes = await api('/demo/advertisements', upload);
    setStepStatus('upload', 'done');
    pushTrace('upload', 'Advertisement Upload', `advertisement_id: ${adRes.advertisement_id}`);
    await sleep(400);

    const adId = adRes.advertisement_id;

    setStepStatus('context', 'running');
    log('构建审核上下文…');
    const ctx = await api('/demo/review-context', { advertisement_id: adId });
    setStepStatus('context', 'done');
    const kv = ctx.resolved_knowledge_versions;
    pushTrace(
      'context',
      'Context Builder',
      `review_id: ${ctx.review_id} · 绑定知识包版本`,
      {
        code: `rule=${kv.rule_pack_version} · playbook=${kv.playbook_pack_version}`,
      },
    );
    await sleep(400);

    setStepStatus('regulation', 'running');
    log('解析适用法规…');
    const regs = state.knowledge.regulations.filter(
      (r) => r.jurisdiction === upload.country_id || r.jurisdiction === 'SG',
    );
    setStepStatus('regulation', 'done');
    pushTrace(
      'regulation',
      'Regulation',
      regs.map((r) => `${r.law_name} — ${r.article}`).join(' · ') || 'Demo regulation corpus',
    );
    await sleep(350);

    setStepStatus('rule', 'running');
    log('Rule Engine 评估…');
    const ruleRes = await api('/demo/rule-evaluation', { advertisement_id: adId });
    setStepStatus('rule', 'done');
    const ruleDetail =
      ruleRes.findings.length === 0
        ? '无 Rule 命中'
        : ruleRes.findings
            .map((f) => {
              const cite = f.evaluation_detail?.citation;
              const citeStr = cite ? ` [${cite.law_name}]` : '';
              return `${f.ref_id} (${f.severity})${citeStr}: ${f.summary}`;
            })
            .join(' · ');
    pushTrace('rule', 'Rule Engine', ruleDetail, {
      code: `pack ${ruleRes.rule_pack_version} · blocker=${ruleRes.has_blocker}`,
    });
    log('Rule 完成', ruleDetail);
    await sleep(450);

    setStepStatus('playbook', 'running');
    log('Playbook 模式匹配…');
    const pbRes = await api('/demo/playbook-evaluation', { advertisement_id: adId });
    setStepStatus('playbook', 'done');
    const pbDetail =
      pbRes.findings.length === 0
        ? '无 Playbook 命中'
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
        'Prompt + LLM (skipped)',
        `BLOCKER 已 decisive — skip_reason: ${llmRes.skip_reason ?? 'HAS_BLOCKER'}`,
        { code: llmRes.prompt_pack_version },
      );
      log('LLM 跳过', llmRes.skip_reason ?? 'HAS_BLOCKER');
    } else {
      setStepStatus('llm', 'done');
      const llmDetail =
        llmRes.findings.length === 0
          ? '无额外开放风险'
          : llmRes.findings.map((f) => f.summary).join(' · ');
      pushTrace('llm', 'Prompt + LLM', llmDetail, { code: llmRes.prompt_pack_version });
      log('LLM 完成', llmDetail);
    }
    await sleep(450);

    setStepStatus('decision', 'running');
    log('Decision Engine 融合…');
    const decRes = await api('/demo/decision', { advertisement_id: adId });
    setStepStatus('decision', 'done');
    pushTrace(
      'decision',
      'Decision Engine',
      `${decRes.final_decision} (confidence ${decRes.confidence}) — ${decRes.rationale}`,
      {
        code: `rule=${decRes.finding_counts.rule} playbook=${decRes.finding_counts.playbook} llm=${decRes.finding_counts.llm}`,
      },
    );
    log('Decision', `${decRes.final_decision} · ${decRes.rationale}`);
    await sleep(400);

    setStepStatus('report', 'running');
    log('生成报告 & 写入 Case Library…');
    const full = await api('/demo/review', upload);
    setStepStatus('report', 'done');
    state.lastReviewId = full.review_id;
    $('#footer-review-id').textContent = `review_id: ${full.review_id}`;

    pushTrace(
      'report',
      'Review Report',
      `${full.summary.findings.length} findings · open_risk_skipped=${full.summary.open_risk_skipped}`,
    );
    showReport(full.report_html, full.final_decision);

    setStepStatus('case', 'running');
    await sleep(300);
    setStepStatus('case', 'done');
    pushTrace('case', 'Case Library', '判例已自动保存（sidecar），可在 Case Library 浏览');

    log('审核完成', `决策: ${full.final_decision} · review_id: ${full.review_id}`);
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
      grid.innerHTML = '<p class="muted">暂无 Case。请先运行一次审核。</p>';
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
    grid.innerHTML = `<p class="muted">无法加载 Case Library: ${escapeHtml(err.message)}</p>`;
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
  $('#btn-run-review').addEventListener('click', runReview);
  $('#btn-refresh-cases').addEventListener('click', loadCaseLibrary);

  const [casesRes, knowledgeRes] = await Promise.all([
    fetch('/demo-ui/demo-cases.json').then((r) => r.json()),
    fetch('/demo-ui/knowledge-manifest.json').then((r) => r.json()),
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
