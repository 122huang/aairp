const API = '';

import { cleanOcrResult } from './ocr-segment-filter.js';
import { mountKnowledgeBasis, clearKnowledgeBasisCache } from './knowledge-basis.js';

const state = {
  taxonomy: null,
  selectedCountries: new Set(['SG']),
  imageFile: null,
  imagePreviewUrl: null,
  imageNaturalWidth: 0,
  imageNaturalHeight: 0,
  rawOcrText: '',
  ocrSegments: [],
  structuredUnderstanding: null,
  ocrCapabilities: null,
  ocrPromise: null,
  ocrProvider: 'browser',
  ocrProviderLabel: '',
  results: [],
  activeCountry: null,
  running: false,
  ocrBusy: false,
};

const OCR_PROGRESS_STEPS = ['prepare', 'ocr', 'llm', 'done'];
const OCR_WAIT_TIPS = [
  '长图会自动分片识别，可能需要数分钟',
  '仍在处理中，请勿关闭或刷新页面',
  '首次 PaddleOCR 较慢，后续会快一些',
  '完成后文案将自动填入右侧确认框',
];

let ocrProgressTimer = null;
let ocrTipTimer = null;
let ocrProgressStartedAt = 0;
let ocrTipIndex = 0;

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showOcrProgressPanel() {
  const box = $('#ocr-progress');
  box.classList.remove('hidden', 'ocr-progress--error', 'ocr-progress--done');
  box.setAttribute('aria-busy', 'true');
  $('#ocr-status').textContent = '';
  $('#text-pane').classList.add('text-pane--busy');
  state.ocrBusy = true;
}

function clearOcrProgressTimers() {
  if (ocrProgressTimer) {
    clearInterval(ocrProgressTimer);
    ocrProgressTimer = null;
  }
  if (ocrTipTimer) {
    clearInterval(ocrTipTimer);
    ocrTipTimer = null;
  }
}

function hideOcrProgressPanel() {
  clearOcrProgressTimers();
  $('#ocr-progress').classList.add('hidden');
  $('#ocr-progress').setAttribute('aria-busy', 'false');
  $('#text-pane').classList.remove('text-pane--busy');
  state.ocrBusy = false;
}

function setOcrProgressStep(stepId, { title, detail } = {}) {
  const idx = OCR_PROGRESS_STEPS.indexOf(stepId);
  $('#ocr-progress-steps').querySelectorAll('li').forEach((li) => {
    const si = OCR_PROGRESS_STEPS.indexOf(li.dataset.step ?? '');
    li.classList.remove('is-active', 'is-done');
    if (si >= 0 && si < idx) li.classList.add('is-done');
    else if (si === idx) li.classList.add('is-active');
  });
  if (title) $('#ocr-progress-title').textContent = title;
  if (detail !== undefined) {
    const el = $('#ocr-progress-detail');
    el.textContent = detail;
    delete el.dataset.locked;
  }
}

function setOcrProgressDetail(detail, { lock = true } = {}) {
  const el = $('#ocr-progress-detail');
  el.textContent = detail;
  if (lock) el.dataset.locked = '1';
  else delete el.dataset.locked;
}

function startOcrProgress(stepId, title, detail) {
  ocrProgressStartedAt = Date.now();
  ocrTipIndex = 0;
  showOcrProgressPanel();
  setOcrProgressStep(stepId, { title, detail });
  $('#ocr-progress-elapsed').textContent = '已用时 0:00';

  ocrProgressTimer = setInterval(() => {
    $('#ocr-progress-elapsed').textContent = `已用时 ${formatElapsed(Date.now() - ocrProgressStartedAt)}`;
  }, 1000);

  ocrTipTimer = setInterval(() => {
    const detailEl = $('#ocr-progress-detail');
    if (detailEl?.dataset.locked === '1') return;
    const active = $('#ocr-progress-steps li.is-active');
    const step = active?.dataset.step;
    if (step !== 'ocr' && step !== 'llm') return;
    ocrTipIndex = (ocrTipIndex + 1) % OCR_WAIT_TIPS.length;
    const elapsed = formatElapsed(Date.now() - ocrProgressStartedAt);
    detailEl.textContent = `已运行 ${elapsed} · ${OCR_WAIT_TIPS[ocrTipIndex]}`;
  }, 8000);
}

function finishOcrProgress(success, finalStatus) {
  clearOcrProgressTimers();
  $('#text-pane').classList.remove('text-pane--busy');
  state.ocrBusy = false;

  const box = $('#ocr-progress');
  box.setAttribute('aria-busy', 'false');

  if (success) {
    box.classList.add('ocr-progress--done');
    setOcrProgressStep('done', {
      title: '广告文案已填入',
      detail: '请对照下方原图核对广告文案后再提交',
    });
    window.setTimeout(() => {
      box.classList.add('hidden');
      box.classList.remove('ocr-progress--done');
      if (finalStatus) $('#ocr-status').textContent = finalStatus;
    }, 2400);
    return;
  }

  box.classList.add('ocr-progress--error');
  setOcrProgressStep('ocr', {
    title: '处理失败',
    detail: finalStatus ?? '请重试或手动粘贴文案',
  });
  window.setTimeout(() => {
    hideOcrProgressPanel();
    box.classList.remove('ocr-progress--error');
    if (finalStatus) $('#ocr-status').textContent = `识别失败：${finalStatus}`;
  }, 4000);
}

const $ = (sel) => document.querySelector(sel);

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text.slice(0, 280);
    try {
      const json = JSON.parse(text);
      detail = json.detail || json.title || detail;
    } catch {
      /* plain text error */
    }
    if (res.status === 413) {
      throw new Error('图片过大，请换较小文件或手动粘贴文案');
    }
    throw new Error(detail);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderActionSuggestions(findings, decision) {
  if (decision === 'PASS' || !findings?.length) {
    return '';
  }
  const actionable = findings.filter((f) => f.decision === 'WARN' || f.decision === 'REJECT');
  if (actionable.length === 0) {
    return '';
  }
  const items = actionable
    .map((f) => {
      const module = escapeHtml(f.module ?? '');
      const refId = f.ref_id ? escapeHtml(f.ref_id) : '';
      const summary = escapeHtml(f.summary ?? '');
      const label = refId ? `${module} · ${refId}` : module;
      return `<li><span class="suggestion-module">${label}</span> ${summary}</li>`;
    })
    .join('');
  return `
    <div class="result-suggestions">
      <h4>降低风险建议</h4>
      <p class="field-hint">来自审核规则与 Playbook，含举证要求；供修改文案参考，最终结论以上方决策为准。</p>
      <ul class="suggestion-list">${items}</ul>
    </div>`;
}

function getAdText() {
  return $('#ad-text').value;
}

function setAdText(value) {
  $('#ad-text').value = value;
}

function buildUpload(countryId, text, categoryId) {
  const confirmed = text.trim();
  const content = { text: confirmed };
  const raw = state.rawOcrText?.trim();
  if (raw && raw !== confirmed) {
    content.ocr_text = raw;
  }
  if (state.imagePreviewUrl || state.imageFile) {
    content.images = [state.imagePreviewUrl || 'upload://local-image'];
  }

  const productSku = $('#product-sku')?.value?.trim();
  const aiRendered = $('#ai-rendered-image')?.checked === true;

  return {
    country_id: countryId,
    platform_id: 'META',
    category_id: categoryId,
    content,
    context: {
      ...(productSku ? { product_sku: productSku } : {}),
      ...(aiRendered ? { ai_rendered_image: true } : {}),
    },
    tags: ['review-ui:user', 'industry:small_appliance', `market:${countryId}`],
  };
}

function renderCountries() {
  const box = $('#country-checkboxes');
  box.innerHTML = state.taxonomy.countries
    .map(
      (c) => `
    <label class="checkbox-chip">
      <input type="checkbox" value="${c.id}" ${state.selectedCountries.has(c.id) ? 'checked' : ''} />
      ${c.id} ${escapeHtml(c.label)}
    </label>`,
    )
    .join('');

  box.querySelectorAll('input[type=checkbox]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) state.selectedCountries.add(input.value);
      else state.selectedCountries.delete(input.value);
    });
  });
}

function renderCategories() {
  const sel = $('#category-select');
  const options = state.taxonomy.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`)
    .join('');
  sel.innerHTML = `<option value="" disabled selected>请选择产品类目</option>${options}`;
  sel.classList.add('field-select--placeholder');
  sel.addEventListener('change', () => {
    sel.classList.toggle('field-select--placeholder', !sel.value);
    refreshSubmitEnabled();
  });
}

function getCategoryId() {
  return $('#category-select').value?.trim() ?? '';
}

function canSubmitReview() {
  if (state.running || state.ocrBusy) return false;
  if (!getCategoryId()) return false;
  const text = getAdText().trim();
  if (text) return true;
  return Boolean(state.imageFile);
}

function refreshSubmitEnabled() {
  $('#btn-submit').disabled = !canSubmitReview();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_WIDTH = 2400;

async function loadImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('无法读取图片文件'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareImagePayload(file) {
  try {
    const img = await loadImageElement(file);
    const naturalWidth = img.naturalWidth;
    const boosted = Math.min(
      MAX_UPLOAD_WIDTH,
      naturalWidth < MAX_UPLOAD_WIDTH ? Math.round(naturalWidth * 1.75) : MAX_UPLOAD_WIDTH,
    );
    const targetWidth =
      naturalWidth > MAX_UPLOAD_WIDTH ? MAX_UPLOAD_WIDTH : Math.max(naturalWidth, boosted);
    const scale = targetWidth / naturalWidth;
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    return {
      base64: dataUrl.split(',')[1],
      mime_type: 'image/jpeg',
      width,
      height,
    };
  } catch {
    const dataUrl = await readFileAsBase64(file);
    return {
      base64: dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl,
      mime_type: file.type || 'image/png',
      width: null,
      height: null,
    };
  }
}

function revokeImagePreview() {
  if (state.imagePreviewUrl) {
    URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = null;
  }
}

function showImagePane(file) {
  revokeImagePreview();
  state.imagePreviewUrl = URL.createObjectURL(file);
  const img = $('#image-preview');
  img.onload = () => {
    state.imageNaturalWidth = img.naturalWidth;
    state.imageNaturalHeight = img.naturalHeight;
    syncHighlightCanvasSize();
  };
  img.src = state.imagePreviewUrl;

  $('#image-pane').classList.remove('hidden');
  $('#content-split').classList.remove('hidden', 'content-split--text-only');
  $('#ocr-disclaimer')?.classList.remove('hidden');

  const resultImg = $('#result-image');
  resultImg.src = state.imagePreviewUrl;
  $('#result-image-pane').classList.remove('hidden');
}

function hideImagePane() {
  revokeImagePreview();
  state.imageNaturalWidth = 0;
  state.imageNaturalHeight = 0;
  state.rawOcrText = '';
  state.ocrSegments = [];
  $('#image-preview').removeAttribute('src');
  $('#image-pane').classList.add('hidden');
  $('#content-split').classList.add('hidden', 'content-split--text-only');
  $('#ocr-disclaimer')?.classList.add('hidden');
  $('#ocr-segments').innerHTML = '';
  $('#ocr-structured').classList.add('hidden');
  $('#ocr-structured').innerHTML = '';
  state.structuredUnderstanding = null;
  clearSegmentHighlight();
  $('#result-image').removeAttribute('src');
  $('#result-image-pane').classList.add('hidden');
}

function syncHighlightCanvasSize() {
  const img = $('#image-preview');
  const canvas = $('#image-highlight');
  if (!img.clientWidth || !img.clientHeight) return;
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
}

function clearSegmentHighlight() {
  const canvas = $('#image-highlight');
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  $('#ocr-segments')
    .querySelectorAll('.ocr-segment-chip.active')
    .forEach((el) => el.classList.remove('active'));
}

function highlightSegment(segment, chipEl) {
  const img = $('#image-preview');
  const scroll = $('#image-preview-scroll');
  const canvas = $('#image-highlight');
  if (!img.naturalWidth || !state.imageNaturalHeight) return;

  syncHighlightCanvasSize();
  const scaleX = canvas.width / state.imageNaturalWidth;
  const scaleY = canvas.height / state.imageNaturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
  ctx.lineWidth = 2;
  const x = segment.x0 * scaleX;
  const y = segment.y0 * scaleY;
  const w =
    segment.x1 != null
      ? (segment.x1 - segment.x0) * scaleX
      : Math.max(48, segment.text.length * 7 * scaleX);
  const h =
    segment.y1 != null ? (segment.y1 - segment.y0) * scaleY : Math.max(18, 28 * scaleY);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  scroll.scrollTop = Math.max(0, y - 24);

  $('#ocr-segments')
    .querySelectorAll('.ocr-segment-chip.active')
    .forEach((el) => el.classList.remove('active'));
  chipEl?.classList.add('active');
}

function insertSegmentText(text) {
  const textarea = $('#ad-text');
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const glue = before && !before.endsWith('\n') ? '\n' : '';
  const next = `${before}${glue}${text}${after ? `\n${after}` : ''}`;
  setAdText(next);
  textarea.focus();
}

function renderOcrSegments(segments, filterDropped = 0) {
  const box = $('#ocr-segments');
  if (!segments?.length) {
    box.innerHTML = filterDropped
      ? `<p class="field-hint">已过滤 ${filterDropped} 条低质量 OCR 片段（噪声/乱码）</p>`
      : '';
    return;
  }

  const filterNote =
    filterDropped > 0
      ? `<p class="field-hint ocr-filter-note">已自动过滤 ${filterDropped} 条低置信/噪声片段 · 单击定位 · 双击插入</p>`
      : `<p class="field-hint">OCR 分段：单击定位原图 · 双击插入该行到文案</p>`;
  box.innerHTML = filterNote;
  segments.forEach((segment, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ocr-segment-chip';
    const preview =
      segment.text.length > 48 ? `${segment.text.slice(0, 48)}…` : segment.text;
    btn.textContent = `${index + 1}. ${preview}`;
    btn.title = `${segment.text}\n（双击插入文案）`;
    btn.addEventListener('click', () => highlightSegment(segment, btn));
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      insertSegmentText(segment.text);
    });
    box.appendChild(btn);
  });
}

function renderStructuredUnderstanding(smart) {
  const box = $('#ocr-structured');
  if (!smart) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const includedKit =
    smart.structured?.included_title || smart.structured?.included_items?.length
      ? [
          [
            '包装清单',
            [
              ...(smart.structured.included_title
                ? [`【${smart.structured.included_title}】`]
                : []),
              ...(smart.structured.included_items ?? []),
            ],
          ],
        ]
      : [];

  const sections = [
    ['标题 / Headline', smart.structured?.headlines],
    ['卖点', smart.structured?.selling_points],
    ...includedKit,
    ['型号对比表', smart.structured?.comparison_rows],
    ['参数 / 规格', smart.structured?.specs],
    ['免责声明', smart.structured?.disclaimers],
    ['行动号召', smart.structured?.calls_to_action],
  ]
    .filter(([, items]) => items?.length)
    .map(
      ([title, items]) =>
        `<h4>${escapeHtml(title)}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    )
    .join('');

  const uncertain = (smart.uncertain ?? [])
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.text)}</strong> — ${escapeHtml(item.reason)}</li>`,
    )
    .join('');

  const notes = (smart.notes ?? [])
    .map((note) => `<p class="understand-notes">${escapeHtml(note)}</p>`)
    .join('');

  box.innerHTML = `
    <p class="field-label">LLM 读懂结构（${escapeHtml(smart.understand_provider ?? '')}）</p>
    ${sections || '<p class="field-hint">暂无结构化分类</p>'}
    ${
      uncertain
        ? `<h4 class="understand-uncertain">待人工确认</h4><ul class="understand-uncertain">${uncertain}</ul>`
        : ''
    }
    ${notes}`;
  box.classList.remove('hidden');
}

function formatSmartStatus(smart, ocrMeta) {
  const ocrPart = smart.ocr_provider ?? ocrMeta?.provider ?? 'ocr';
  const up = smart.ocr_upscaled || ocrMeta?.upscaled ? ' · 已放大抓小字' : '';
  const tiles = smart.ocr_tile_count || ocrMeta?.tile_count || 1;
  return `完成：${ocrPart}（${tiles} 段${up}）→ ${smart.understand_provider} 校正 · 请对照原图确认右侧文案`;
}

async function runSmartUnderstand(ocrDraft) {
  const payload = await prepareImagePayload(state.imageFile);
  const categoryId = $('#category-select').value;
  return api('/demo/ocr/smart-extract', {
    image_base64: payload.base64,
    mime_type: payload.mime_type,
    ocr_draft: ocrDraft,
    category_id: categoryId,
  });
}

function applyOcrResult(res, { fillTextarea, replace }) {
  const cleaned = cleanOcrResult(res);
  const ocrText = (cleaned.ocr_text ?? '').trim();
  if (!ocrText) {
    throw new Error('未识别到文字，请换一张更清晰的图片或手动粘贴文案');
  }
  state.rawOcrText = ocrText;
  state.ocrSegments = cleaned.segments ?? [];
  if (res.image_width && res.image_height) {
    state.imageNaturalWidth = res.image_width;
    state.imageNaturalHeight = res.image_height;
  }
  renderOcrSegments(state.ocrSegments, cleaned.filter_dropped ?? 0);

  if (fillTextarea) {
    const existing = getAdText().trim();
    setAdText(replace || !existing ? ocrText : `${existing}\n\n${ocrText}`);
  }
  res.filter_dropped = cleaned.filter_dropped ?? 0;
  res.segments = cleaned.segments;
  res.ocr_text = ocrText;
  return ocrText;
}

function formatOcrStatus(res, payload) {
  const tiles = res.tile_count ?? 1;
  const dims =
    res.image_width && res.image_height
      ? ` · ${res.image_width}×${res.image_height}px`
      : payload?.width && payload?.height
        ? ` · ${payload.width}×${payload.height}px`
        : '';
  const mode =
    res.provider === 'browser_tesseract' || res.provider === 'browser_tesseract_upscaled'
      ? '本地 OCR'
      : res.provider === 'paddleocr_local'
        ? 'PaddleOCR'
        : res.provider ?? 'OCR';
  const segHint = state.ocrSegments.length
    ? ` · ${state.ocrSegments.length} 行分段可对照`
    : '';
  const filterHint = res.filter_dropped ? ` · 已滤 ${res.filter_dropped} 条噪声` : '';
  return `识别完成（${mode} · ${tiles} 段${dims}${segHint}${filterHint}）· 请对照原图修改右侧文案`;
}

async function runServerOcr(file) {
  const providerLabel =
    state.ocrProvider === 'paddle'
      ? 'PaddleOCR 本地识别'
      : state.ocrProvider === 'google'
        ? 'Google Vision'
        : '服务端 OCR';
  setOcrProgressDetail(`正在上传图片并调用 ${providerLabel}（长图约 2–10 分钟）`, { lock: true });
  const payload = await prepareImagePayload(file);
  setOcrProgressDetail(`${providerLabel} 分片识别中…`, { lock: false });
  const res = await api('/demo/ocr/extract', {
    image_base64: payload.base64,
    mime_type: payload.mime_type,
  });
  return { res, payload };
}

async function runBrowserOcr(file) {
  const { extractTextFromImageFile } = await import('./local-ocr.js');
  const res = await extractTextFromImageFile(file, {
    onProgress: (message) => {
      setOcrProgressDetail(message, { lock: true });
    },
  });
  return { res, payload: null };
}

function shouldUseBrowserOcr() {
  return state.ocrProvider === 'browser';
}

function shouldUseServerOcr() {
  return state.ocrProvider === 'paddle' || state.ocrProvider === 'google';
}

function shouldFallbackToBrowser(err) {
  const message = String(err?.message ?? err);
  return (
    message.includes('GOOGLE_VISION_API_KEY') ||
    message.includes('未配置') ||
    message.includes('PaddleOCR Python') ||
    message.includes('未找到 PaddleOCR')
  );
}

async function runOcr({ fillTextarea = true, replace = false } = {}) {
  if (!state.imageFile) return null;

  const ocrTitle = shouldUseBrowserOcr()
    ? '浏览器 OCR 抓字中…'
    : shouldUseServerOcr()
      ? 'PaddleOCR 服务端识别中…'
      : 'OCR 识别中…';
  startOcrProgress(
    'prepare',
    ocrTitle,
    shouldUseServerOcr()
      ? '长图将自动分片，请保持页面打开'
      : '正在加载 OCR 引擎…',
  );

  $('#btn-ocr').disabled = true;
  $('#btn-submit').disabled = true;

  try {
    setOcrProgressStep('prepare', {
      title: '准备图片…',
      detail: state.imageFile.name,
    });

    let result;
    if (shouldUseBrowserOcr()) {
      setOcrProgressStep('ocr', { title: '浏览器 OCR 抓字中…', detail: '本地识别，无需外网 Key' });
      result = await runBrowserOcr(state.imageFile);
    } else if (shouldUseServerOcr()) {
      setOcrProgressStep('ocr', {
        title: 'PaddleOCR 服务端识别中…',
        detail: '长图约 2–10 分钟，进度条持续动即表示仍在运行',
      });
      try {
        result = await runServerOcr(state.imageFile);
      } catch (err) {
        if (shouldFallbackToBrowser(err)) {
          setOcrProgressStep('ocr', {
            title: '改用浏览器 OCR…',
            detail: 'Paddle 不可用，已切换本地识别',
          });
          result = await runBrowserOcr(state.imageFile);
        } else {
          throw err;
        }
      }
    } else {
      try {
        setOcrProgressStep('ocr', { title: 'OCR 识别中…', detail: '正在调用服务端…' });
        result = await runServerOcr(state.imageFile);
      } catch (err) {
        if (shouldFallbackToBrowser(err)) {
          setOcrProgressStep('ocr', {
            title: '改用浏览器 OCR…',
            detail: '云端 OCR 不可用，已切换本地识别',
          });
          result = await runBrowserOcr(state.imageFile);
        } else {
          throw err;
        }
      }
    }

    let ocrDraft = applyOcrResult(result.res, { fillTextarea, replace });

    try {
      setOcrProgressStep('llm', {
        title: 'LLM 整理广告文案…',
        detail: '根据 OCR 草稿校正排版与错字（DeepSeek / Claude）',
      });
      const smart = await runSmartUnderstand(ocrDraft);
      state.rawOcrText = smart.ocr_draft ?? ocrDraft;
      state.structuredUnderstanding = smart;
      if (fillTextarea) {
        setAdText(smart.confirmed_text ?? ocrDraft);
      }
      renderStructuredUnderstanding(smart);
      const statusMsg = formatSmartStatus(smart, result.res);
      finishOcrProgress(true, statusMsg);
      return smart.confirmed_text ?? ocrDraft;
    } catch (smartErr) {
      renderStructuredUnderstanding(null);
      const statusMsg = `${formatOcrStatus(result.res, result.payload)} · LLM 跳过：${smartErr.message}`;
      finishOcrProgress(true, statusMsg);
      return ocrDraft;
    }
  } catch (err) {
    finishOcrProgress(false, err.message);
    throw err;
  } finally {
    $('#btn-ocr').disabled = !state.imageFile;
    $('#btn-submit').disabled = state.running;
    refreshSubmitEnabled();
  }
}

async function ensureOcrText({ fillTextarea = true, replace = false } = {}) {
  if (state.ocrPromise) {
    return state.ocrPromise;
  }
  if (!state.imageFile) return null;

  state.ocrPromise = runOcr({ fillTextarea, replace }).finally(() => {
    state.ocrPromise = null;
  });
  return state.ocrPromise;
}

async function submitReview() {
  if (state.running) return;

  const countries = [...state.selectedCountries];
  if (!countries.length) {
    alert('请至少选择一个目标市场（SG / MY / TH）');
    return;
  }

  const categoryId = getCategoryId();
  if (!categoryId) {
    alert('请选择产品类目后再提交');
    $('#category-select').focus();
    return;
  }

  let text = getAdText().trim();

  if (!text && state.imageFile) {
    try {
      await ensureOcrText({ fillTextarea: true });
      text = getAdText().trim();
    } catch {
      alert(
        `图片识别失败：${$('#ocr-status').textContent.replace(/^识别失败：/, '') || '请查看下方提示'}`,
      );
      return;
    }
  }

  if (!text) {
    alert('请粘贴广告文案，或上传长图（将自动识别文字）后再提交');
    return;
  }

  if (state.imageFile && state.rawOcrText && text === state.rawOcrText.trim()) {
    const ok = window.confirm(
      '文案与 OCR 原文完全相同，是否已对照原图核对？\n\n建议修改明显错误后再提交；规则仅检测上方广告文案。',
    );
    if (!ok) return;
  }

  state.running = true;
  $('#btn-submit').disabled = true;
  $('#results-empty').hidden = true;
  $('#results-body').classList.remove('hidden');
  $('#country-tabs').classList.remove('hidden');
  $('#results-summary').classList.remove('hidden');
  $('#results-summary').innerHTML = '<p class="muted">审核进行中…</p>';
  $('#report-wrap').classList.add('hidden');
  state.results = [];
  clearKnowledgeBasisCache();
  $('#knowledge-basis-wrap').classList.add('hidden');

  if (state.imagePreviewUrl) {
    $('#result-image').src = state.imagePreviewUrl;
    $('#result-image-pane').classList.remove('hidden');
    $('#results-body').classList.remove('results-body--no-image');
  } else {
    $('#results-body').classList.add('results-body--no-image');
  }

  try {
    for (const countryId of countries) {
      const upload = buildUpload(countryId, text, categoryId);
      const result = await api('/demo/review', upload);
      state.results.push({ countryId, result, claimText: text, categoryId });
    }

    state.activeCountry = state.results[0]?.countryId ?? null;
    renderResults();
  } catch (err) {
    $('#results-summary').innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  } finally {
    state.running = false;
    refreshSubmitEnabled();
  }
}

function renderResults() {
  const tabs = $('#country-tabs');
  tabs.innerHTML = state.results
    .map((r) => {
      const d = r.result.final_decision;
      const active = r.countryId === state.activeCountry ? 'active' : '';
      return `<button type="button" class="country-tab ${active} decision-${d}" data-country="${r.countryId}">${r.countryId} · ${d}</button>`;
    })
    .join('');

  tabs.querySelectorAll('.country-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCountry = btn.dataset.country;
      renderResults();
    });
  });

  const active = state.results.find((r) => r.countryId === state.activeCountry);
  if (!active) return;

  const r = active.result;
  const skipped = r.summary?.open_risk_skipped;
  const suggestions = renderActionSuggestions(r.summary?.findings, r.final_decision);
  $('#results-summary').innerHTML = `
    <div class="result-card">
      <h3>${active.countryId} · <span class="decision-${r.final_decision}">${r.final_decision}</span></h3>
      <p class="muted">${escapeHtml(r.rationale ?? '')}</p>
      <p class="muted">Findings: Rule ${r.finding_counts?.rule ?? 0} · Playbook ${r.finding_counts?.playbook ?? 0} · LLM ${r.finding_counts?.llm ?? 0}${skipped ? ' · LLM 已跳过' : ''}</p>
      ${
        state.imagePreviewUrl
          ? '<p class="field-hint">下方原图可持续对照；规则依据为你提交的广告文案。</p>'
          : ''
      }
      ${suggestions}
    </div>`;

  $('#report-wrap').classList.remove('hidden');
  $('#report-frame').srcdoc = r.report_html ?? '<p>无报告</p>';

  void mountKnowledgeBasis($('#knowledge-basis-wrap'), {
    claimText: active.claimText,
    country: active.countryId,
    category: active.categoryId,
  });
}

async function loadOcrStatus() {
  const hint = $('#ocr-mode-hint');
  try {
    const res = await fetch(`${API}/demo/ocr/status`);
    if (!res.ok) throw new Error('status unavailable');
    const data = await res.json();
    state.ocrCapabilities = data.capabilities ?? null;
    state.ocrProvider =
      data.provider === 'paddle' || data.provider === 'google' ? data.provider : 'browser';

    const caps = [];
    caps.push(
      data.provider === 'paddle'
        ? '① 本地 PaddleOCR'
        : data.provider === 'google'
          ? '① Google OCR'
          : '① 浏览器 OCR',
    );
    if (data.capabilities?.vision_llm) {
      caps.push(`② 视觉 LLM 读懂（${data.capabilities.vision_llm_provider}）`);
    } else if (data.capabilities?.text_llm) {
      caps.push('② 文字 LLM 校正（无图）');
    } else {
      caps.push('② 规则分段（在 .env 配置 DEEPSEEK_API_KEY 启用 LLM 读懂）');
    }
    caps.push('③ 人工对照原图确认');
    hint.textContent = caps.join(' → ');
  } catch {
    state.ocrProvider = 'browser';
    hint.textContent =
      '流程：OCR 放大抓字 → LLM 读懂（需 API Key）→ 人工对照原图确认';
  }
}

async function checkApi() {
  const el = $('#api-status');
  try {
    const res = await fetch(`${API}/health`);
    if (!res.ok) throw new Error('bad');
    el.textContent = 'API ok';
    el.className = 'status-pill status-ok';
  } catch {
    el.textContent = 'API 离线';
    el.className = 'status-pill status-bad';
  }
}

async function init() {
  state.taxonomy = await fetch('/review/taxonomy.json').then((r) => r.json());
  renderCountries();
  renderCategories();
  await loadOcrStatus();

  $('#ad-text').addEventListener('input', refreshSubmitEnabled);

  window.addEventListener('resize', () => {
    syncHighlightCanvasSize();
    clearSegmentHighlight();
  });

  $('#ad-image').addEventListener('change', async (e) => {
    state.imageFile = e.target.files?.[0] ?? null;
    $('#btn-ocr').disabled = !state.imageFile;

    if (!state.imageFile) {
      hideOcrProgressPanel();
      $('#ocr-status').textContent = '';
      hideImagePane();
      refreshSubmitEnabled();
      return;
    }

    showImagePane(state.imageFile);
    try {
      await ensureOcrText({ fillTextarea: true });
    } catch {
      /* ensureOcrText / runOcr updates progress & status */
    }
  });

  $('#btn-ocr').addEventListener('click', () =>
    ensureOcrText({ fillTextarea: true, replace: true }),
  );
  $('#btn-submit').addEventListener('click', submitReview);

  refreshSubmitEnabled();
  await checkApi();
}

init();
