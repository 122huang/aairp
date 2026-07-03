import {
  completeTextForProvider,
  completeVisionForProvider,
  resolveTextLlmProvider,
  resolveVisionLlmProvider,
} from './llm-providers.js';

export type OcrStructuredUnderstanding = {
  headlines: string[];
  selling_points: string[];
  specs: string[];
  /** Product comparison table rows: "Row label | left model | right model" */
  comparison_rows: string[];
  /** What's Included / in-the-box section title, e.g. "What's Included" */
  included_title: string;
  /** Part labels from callout diagram, e.g. "Measuring Cup", "Crystal Ceramic Inner Pot" */
  included_items: string[];
  disclaimers: string[];
  calls_to_action: string[];
};

export type OcrUncertainItem = {
  text: string;
  reason: string;
};

export type OcrUnderstandResult = {
  confirmed_text: string;
  structured: OcrStructuredUnderstanding;
  uncertain: OcrUncertainItem[];
  understand_provider: string;
  notes: string[];
};

const EMPTY_STRUCTURED: OcrStructuredUnderstanding = {
  headlines: [],
  selling_points: [],
  specs: [],
  comparison_rows: [],
  included_title: '',
  included_items: [],
  disclaimers: [],
  calls_to_action: [],
};

const TABLE_UNDERSTAND_RULES = `
## Product comparison tables (critical)
E-commerce long banners often include side-by-side model comparison tables (2+ columns).
OCR will garble these into nonsense lines — do NOT copy OCR table fragments verbatim.

When the image or OCR draft shows a comparison table:
1. Read by TABLE STRUCTURE: row label (left) → value for model/column A → value for model/column B.
2. Each row in "structured.comparison_rows" MUST use this format:
   "Row label | Column A value | Column B value"
   Example: "Inner Pot Material | ①304 Stainless Steel Inner Pot*1; ②Ceramic Coated Inner Pot*1 | ①316 Stainless Steel Inner Pot*1; ②Ceramic Coated Inner Pot*1"
3. Rows that span both columns (e.g. Rated Power, Capacity) use the same value twice OR format as:
   "Rated Power | 1000 W | 1000 W"
4. Put ALL comparison table rows in "comparison_rows", not scattered in specs/selling_points.
5. In "confirmed_text", include a readable block:
   [Model comparison]
   <one comparison_rows entry per line>
6. If a cell is unreadable in the image/draft, put the row in "uncertain" — do NOT invent 304 vs 316 etc.`;

const INCLUDED_KIT_RULES = `
## What's Included / in-the-box callout diagrams (critical)
Product images often show a section title plus numbered labels pointing at parts (Main Unit, Measuring Cup, Inner Pot, etc.).
OCR treats each label as a separate noisy line — do NOT leave them as mechanical fragments.

When the image or OCR draft shows "What's Included", "In the Box", or similar:
1. Treat the ENTIRE block as ONE semantic unit: title + list of included parts.
2. Set "structured.included_title" to the section heading (e.g. "What's Included").
3. Set "structured.included_items" to clean part names ONLY — one string per part, reading order:
   Example: ["Main Unit", "Measuring Cup", "Crystal Ceramic Inner Pot", "Inner Pot"]
4. Strip OCR junk from labels: leading "mm", trailing "| | ...", random symbols/CJK (e.g. "本 ge", "_|").
   Keep badge numbers when visible: "② Measuring Cup".
5. Do NOT scatter these items across specs/selling_points/headlines.
6. In "confirmed_text", format as:
   [What's Included]
   - Main Unit
   - Measuring Cup
   ...
7. Use the IMAGE callout arrows/lines to match labels to parts; OCR line order may be wrong.`;

function buildUnderstandPrompt(ocrDraft: string, categoryId?: string): string {
  const categoryHint = categoryId ? `Product category: ${categoryId}.` : '';
  return `You are an advertising copy transcription assistant for legal compliance review.

${categoryHint}

## Machine OCR draft (may contain wrong characters, wrong order, or line breaks)
"""
${ocrDraft}
"""

## Instructions
1. Use the attached ad image AND the OCR draft together. For comparison tables, TRUST THE IMAGE layout over OCR line order.
2. Produce accurate reading-order ad copy for legal review in "confirmed_text".
3. Every phrase in confirmed_text MUST be visibly supported by the image OR present in the OCR draft (you may fix obvious OCR typos only).
4. Do NOT invent claims, numbers, or superlatives that are not visible.
5. Mark anything you cannot verify in "uncertain".
6. Classify copy into structured buckets when applicable.
${TABLE_UNDERSTAND_RULES}
${INCLUDED_KIT_RULES}
7. Output JSON only (no markdown fences).

## Output JSON schema
{
  "confirmed_text": "string",
  "structured": {
    "headlines": ["string"],
    "selling_points": ["string"],
    "specs": ["string"],
    "comparison_rows": ["Row label | Column A | Column B"],
    "included_title": "What's Included",
    "included_items": ["Main Unit", "Measuring Cup"],
    "disclaimers": ["string"],
    "calls_to_action": ["string"]
  },
  "uncertain": [{ "text": "string", "reason": "string" }],
  "notes": ["string"]
}`;
}

function buildTextOnlyPrompt(ocrDraft: string, categoryId?: string): string {
  const categoryHint = categoryId ? `Product category: ${categoryId}.` : '';
  return `You are cleaning a machine OCR draft for an e-commerce ad long banner.

${categoryHint}

## OCR draft
"""
${ocrDraft}
"""

## Instructions
1. Fix obvious OCR typos and restore natural reading order.
2. Common errors from photo overlays (steam, glare, product reflections on text):
   - letter swaps: g↔e, d misread as ¢, rn↔m, l↔I, o↔0
   - spurious spaces inside words: "¢ ishes" → "dishes", "Joyound" → "Joyoung"
   - truncated endings: "befor" → "before", "braisgd" → "braised"
   Use surrounding words and kitchen/appliance ad context to recover, but only when the intended word is clearly implied by the garbled draft.
3. Do NOT invent new marketing claims, numbers, or superlatives not present in the draft.
4. If a fragment is too garbled to recover without the image, move it to "uncertain" instead of guessing.
${TABLE_UNDERSTAND_RULES}
${INCLUDED_KIT_RULES}
5. Without the image, comparison table cells you cannot read from the draft MUST go to "uncertain".
6. Without the image, group obvious "What's Included" blocks from nearby lines (title + Main Unit / Measuring Cup / Inner Pot) into included_items; strip "|" junk.
7. Output JSON only.

{
  "confirmed_text": "string",
  "structured": {
    "headlines": ["string"],
    "selling_points": ["string"],
    "specs": ["string"],
    "comparison_rows": ["Row label | Column A | Column B"],
    "included_title": "What's Included",
    "included_items": ["Main Unit", "Measuring Cup"],
    "disclaimers": ["string"],
    "calls_to_action": ["string"]
  },
  "uncertain": [{ "text": "string", "reason": "string" }],
  "notes": ["string"]
}`;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('LLM response did not contain JSON object');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseUnderstandPayload(raw: string, ocrDraft: string): OcrUnderstandResult {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const confirmed =
    typeof parsed.confirmed_text === 'string' && parsed.confirmed_text.trim()
      ? parsed.confirmed_text.trim()
      : ocrDraft.trim();

  const structuredRaw = parsed.structured;
  const structured =
    structuredRaw && typeof structuredRaw === 'object'
      ? {
          headlines: asStringArray((structuredRaw as Record<string, unknown>).headlines),
          selling_points: asStringArray(
            (structuredRaw as Record<string, unknown>).selling_points,
          ),
          specs: asStringArray((structuredRaw as Record<string, unknown>).specs),
          comparison_rows: asStringArray(
            (structuredRaw as Record<string, unknown>).comparison_rows,
          ),
          included_title:
            typeof (structuredRaw as Record<string, unknown>).included_title === 'string'
              ? String((structuredRaw as Record<string, unknown>).included_title).trim()
              : '',
          included_items: asStringArray(
            (structuredRaw as Record<string, unknown>).included_items,
          ),
          disclaimers: asStringArray((structuredRaw as Record<string, unknown>).disclaimers),
          calls_to_action: asStringArray(
            (structuredRaw as Record<string, unknown>).calls_to_action,
          ),
        }
      : { ...EMPTY_STRUCTURED };

  const uncertain = Array.isArray(parsed.uncertain)
    ? parsed.uncertain
        .filter(
          (item): item is OcrUncertainItem =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as OcrUncertainItem).text === 'string' &&
            typeof (item as OcrUncertainItem).reason === 'string',
        )
        .map((item) => ({
          text: item.text.trim(),
          reason: item.reason.trim(),
        }))
        .filter((item) => item.text.length > 0)
    : [];

  const notes = asStringArray(parsed.notes);

  return {
    confirmed_text: confirmed,
    structured,
    uncertain,
    understand_provider: 'llm',
    notes,
  };
}

export function heuristicUnderstand(ocrDraft: string): OcrUnderstandResult {
  const lines = ocrDraft
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const uniqueLines: string[] = [];
  for (const line of lines) {
    if (uniqueLines[uniqueLines.length - 1] !== line) {
      uniqueLines.push(line);
    }
  }

  const headlines: string[] = [];
  const selling_points: string[] = [];
  const comparison_rows: string[] = [];
  const specs: string[] = [];
  let included_title = '';
  const included_items: string[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < uniqueLines.length; i += 1) {
    if (isIncludedSectionHeader(uniqueLines[i])) {
      included_title = uniqueLines[i];
      consumed.add(i);
      for (let j = i + 1; j < uniqueLines.length; j += 1) {
        if (!isLikelyIncludedItemLine(uniqueLines[j])) break;
        included_items.push(cleanIncludedLabel(uniqueLines[j]));
        consumed.add(j);
      }
    }
  }

  for (let i = 0; i < uniqueLines.length; i += 1) {
    if (consumed.has(i)) continue;
    const line = uniqueLines[i];
    if (/\|\s*.+\|\s*.+/.test(line) || /^\S.+\s+\d+\s*kPa\s*\|/i.test(line)) {
      comparison_rows.push(line);
    } else if (line.length <= 18) {
      headlines.push(line);
    } else if (/\d/.test(line) || /mm|cm|ml|W|V|Hz|℃|°|kPa|L\b/i.test(line)) {
      specs.push(line);
    } else {
      selling_points.push(line);
    }
  }

  const otherLines = uniqueLines.filter((_, i) => !consumed.has(i));
  const includedBlock =
    included_title && included_items.length
      ? [`[${included_title}]`, ...included_items.map((item) => `- ${item}`)].join('\n')
      : '';

  return {
    confirmed_text: [includedBlock, otherLines.join('\n')].filter(Boolean).join('\n\n'),
    structured: {
      headlines,
      selling_points,
      specs,
      comparison_rows,
      included_title,
      included_items,
      disclaimers: [],
      calls_to_action: [],
    },
    uncertain: [],
    understand_provider: 'heuristic',
    notes: [
      '未配置 LLM，已用 OCR 草稿 + 规则分段。',
      included_items.length
        ? `检测到包装清单区块「${included_title}」（${included_items.length} 项）；建议启用 LLM 或对照原图核对配件名称。`
        : "「What's Included」类标注图常被 OCR 拆成乱行；请对照原图整组填写配件清单。",
      comparison_rows.length
        ? '检测到对比表格式行；建议对照原图整理左/右列。'
        : '若含型号对比表，请对照原图逐行填写规格。',
      '建议配置 DEEPSEEK_API_KEY 启用 LLM 读懂；标注图/对比表最佳方案为视觉 LLM。',
    ],
  };
}

const INCLUDED_HEADER =
  /^what'?s?\s+included|in\s+the\s+box|package\s+contents|box\s+contains|items?\s+included|包装清单|包装内容|内含/i;

function isIncludedSectionHeader(line: string): boolean {
  return INCLUDED_HEADER.test(line.trim());
}

function isLikelyIncludedItemLine(line: string): boolean {
  const text = line.trim();
  if (!text || text.length > 72) return false;
  if (INCLUDED_HEADER.test(text)) return false;
  if (/^\d+\s*kPa/i.test(text) || /max pressure|rated power|capacity/i.test(text)) return false;
  if (/^\S.+\s+\d+\s*kPa\s*\|/i.test(text)) return false;
  return (
    /main unit|measuring cup|inner pot|outer pot|ceramic|stainless|lid|spatula|steamer|power cord|manual|recipe|accessory|spoon|ladle/i.test(
      text,
    ) || (text.length <= 36 && !/\|\s*.+\|\s*.+/.test(text))
  );
}

/** Strip callout OCR junk: "mm Measuring Cup | | 本 ge |" → "Measuring Cup" */
export function cleanIncludedLabel(line: string): string {
  let text = line.trim();
  text = stripTrailingPipeJunk(text);
  text = text.replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩]+\.?\s*/u, '');
  text = text.replace(/^mm\s+/i, '');
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text;
}

function stripTrailingPipeJunk(text: string): string {
  const pipeIdx = text.indexOf('|');
  if (pipeIdx < 0) return text.trim();
  const head = text.slice(0, pipeIdx).trim();
  const after = text.slice(pipeIdx + 1).trim();
  if (/^\d/.test(after) || /\d+\s*kPa|\|\s*\d/i.test(after)) return text.trim();
  if (!/[A-Za-z]{3,}/.test(after)) return head;
  return text.trim();
}

export async function understandAdCopyFromOcr(input: {
  ocrDraft: string;
  imageBase64?: string;
  mimeType?: string;
  categoryId?: string;
}): Promise<OcrUnderstandResult> {
  const ocrDraft = input.ocrDraft.trim();
  if (!ocrDraft) {
    throw new Error('OCR 草稿为空，无法做读懂校正');
  }

  const visionProvider = resolveVisionLlmProvider();
  if (visionProvider && input.imageBase64) {
    const prompt = buildUnderstandPrompt(ocrDraft, input.categoryId);
    const request = {
      prompt,
      imageBase64: input.imageBase64,
      mimeType: input.mimeType ?? 'image/jpeg',
    };
    try {
      const raw = await completeVisionForProvider(visionProvider, request);
      const parsed = parseUnderstandPayload(raw, ocrDraft);
      return {
        ...parsed,
        understand_provider: `${visionProvider}_vision`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'vision LLM failed';
      const textProvider = resolveTextLlmProvider();
      if (!textProvider) {
        throw error;
      }
      const prompt = buildTextOnlyPrompt(ocrDraft, input.categoryId);
      const raw = await completeTextForProvider(textProvider, { prompt });
      const parsed = parseUnderstandPayload(raw, ocrDraft);
      return {
        ...parsed,
        understand_provider: `${textProvider}_text`,
        notes: [
          ...parsed.notes,
          `视觉 LLM 不可用（${message}），已改用文字模型校正 OCR 草稿。`,
          '建议对照左侧原图人工确认关键宣传语与数字。',
        ],
      };
    }
  }

  const textProvider = resolveTextLlmProvider();
  if (textProvider) {
    const prompt = buildTextOnlyPrompt(ocrDraft, input.categoryId);
    const raw = await completeTextForProvider(textProvider, { prompt });
    const parsed = parseUnderstandPayload(raw, ocrDraft);
    return {
      ...parsed,
      understand_provider: `${textProvider}_text`,
      notes: [
        ...parsed.notes,
        '未配置视觉 LLM（Anthropic/OpenAI），已基于 OCR 草稿做文字校正（请对照原图确认）。',
        '型号对比表需对照原图左/右列核对；OCR 分段中的乱码行（如 Inner Pot Material）不可直接使用。',
      ],
    };
  }

  return heuristicUnderstand(ocrDraft);
}
