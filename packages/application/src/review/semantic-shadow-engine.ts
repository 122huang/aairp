// @ts-nocheck — frozen P0.5E.2 quantity-structure engine, ported for non-authoritative shadow only.
/** P0.5E.2 quantity-structure anchors + exact/range/null contract. Not a P0.5E case map. */

const WRITTEN = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const UNIT_WORD = [
  [/percent|퍼센트|เปอร์เซ็นต์|%/i, 'percent'],
  [/decibels?|\bdB\b|เดซิเบล|데시벨/i, 'decibel'],
  [/watts?|\bW\b/i, 'watt'],
  [/volts?|\bV\b/i, 'volt'],
  [/minutes?|\bmin\b|นาที|분|minit/i, 'minute'],
  [/litres?|liters?|\bL\b/i, 'volume'],
];

const UPPER = /at most|no more than|no greater than|up to|tidak lebih|sehingga|최대한|최대|สูงสุด|ceiling/i;
const LOWER = /at least|no less than|no fewer than|sekurang-kurangnya|sekurang|อย่างน้อย|이상|최소/i;
const APPROX = /\babout\b|\baround\b|approximately|kira-kira|ประมาณ|약/i;
const COMPARATIVE = /\bthan\b|\bversus\b|daripada|보다|กว่า|\bmore\b|\bless\b|quieter|senyap|เงียบ/i;
const MULTIPLIER = /\btimes\b|배|เท่า|kali/i;
const EXACT_MARK = /nameplate|rated|equals|\bis\b|ialah|คือ|입니다/i;

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function extractAnchors(copy) {
  const anchors = [];
  const digits = [...copy.matchAll(/\d+(?:\.\d+)?/g)].map((match) => ({
    value: Number(match[0]),
    span: match[0],
    index: match.index,
  }));
  for (const hit of digits) {
    anchors.push({ kind: 'value', value: hit.value, span: hit.span });
  }
  if (/%/.test(copy) || /percent/i.test(copy)) {
    anchors.push({ kind: 'explicit_percentage', span: copy.match(/%|percent/i)?.[0] ?? '%' });
  }
  for (const [pattern, unit] of UNIT_WORD) {
    const found = copy.match(pattern);
    if (found) anchors.push({ kind: 'unit', unit, span: found[0] });
  }
  const range = copy.match(/from\s+(\d+(?:\.\d+)?)\s*\w*\s+to\s+(\d+(?:\.\d+)?)/i)
    ?? copy.match(/between\s+(\d+(?:\.\d+)?)\s+\w*\s*and\s+(\d+(?:\.\d+)?)/i)
    ?? copy.match(/(\d+(?:\.\d+)?)\s*L\s*에서\s*(\d+(?:\.\d+)?)/i)
    ?? copy.match(/(\d+(?:\.\d+)?)\s*L\s+to\s+(\d+(?:\.\d+)?)/i)
    ?? copy.match(/จาก\s*(\d+(?:\.\d+)?)\s*\w*\s*ถึง\s*(\d+(?:\.\d+)?)/i)
    ?? copy.match(/(\d+(?:\.\d+)?)\s*L\s*ถึง\s*(\d+(?:\.\d+)?)/i)
    ?? copy.match(/dari\s+(\d+(?:\.\d+)?)\s*\w*\s+hingga\s+(\d+(?:\.\d+)?)/i)
    ?? copy.match(/ระหว่าง\s*(\d+(?:\.\d+)?)\s*\w*\s*ถึง\s*(\d+(?:\.\d+)?)/i);
  if (range) {
    anchors.push({
      kind: 'range',
      low: Number(range[1]),
      high: Number(range[2]),
      span: range[0],
    });
  }
  if (UPPER.test(copy)) anchors.push({ kind: 'explicit_bound', relation: 'upper_bound', span: 'ceiling' });
  if (LOWER.test(copy)) anchors.push({ kind: 'explicit_bound', relation: 'lower_bound', span: 'floor' });
  if (APPROX.test(copy)) anchors.push({ kind: 'explicit_bound', relation: 'approximate', span: 'approx' });
  if (COMPARATIVE.test(copy)) anchors.push({ kind: 'explicit_comparator', span: 'comparator' });
  if (MULTIPLIER.test(copy)) anchors.push({ kind: 'explicit_multiplier', span: 'multiplier' });
  if (EXACT_MARK.test(copy)) anchors.push({ kind: 'explicit_exact', span: 'exact' });
  if (/\bnot\b|\bbukan\b|ไม่ได้|않/i.test(copy)) {
    anchors.push({ kind: 'explicit_negation', span: 'negation' });
  }
  const year = copy.match(/\b(19|20)\d{2}\b/);
  if (year && !/[WVdv%]/.test(copy.slice(Math.max(0, year.index - 2), year.index + year[0].length + 2))) {
    anchors.push({ kind: 'date', value: Number(year[0]), span: year[0] });
  }
  const ident = copy.match(/\bSKU-\d+\b|\bIR-\d+\b|\bBN-\d+\b|\b[A-Z]{1,3}-\d{2,5}\b|\bKX\d+\b/i);
  if (ident) anchors.push({ kind: 'identifier', span: ident[0] });
  const written = writtenValue(copy);
  if (written != null) anchors.push({ kind: 'written_number', value: written.value, span: written.span });
  return anchors;
}

function writtenValue(copy) {
  const lower = copy.toLowerCase();
  const half = lower.match(/\bone and a half\b/);
  if (half) return { value: 1.5, span: half[0] };
  const pair = lower.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/);
  if (pair) return { value: WRITTEN[pair[1]] + WRITTEN[pair[2]], span: pair[0] };
  const single = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
  if (single && /\btimes\b/.test(lower)) return { value: WRITTEN[single[1]], span: single[0] };
  return null;
}

function features(copy) {
  return {
    nutrient: /vitamin|nutrient|mineral|비타민|วิตามิน|mineral/i.test(copy),
    retain: /keep|retain|preserv|hold|simpan|menyimpan|คง|유지|남/i.test(copy),
    noise: /decibel|\bdB\b|quieter|senyap|조용|เงียบ|เดซิเบล|데시벨/i.test(copy),
    power: /watt|\bW\b|power draw|กำลังไฟ|와트/i.test(copy),
    voltage: /\bvolts?\b|\b\d+(?:\.\d+)?\s*V\b|voltan/i.test(copy),
    capacity: /litre|liter|\bL\b|ความจุ|용량/i.test(copy),
    duration: /minute|\bmin\b|นาที|분|minit/i.test(copy),
    energy: /energy|tenaga|에너지/i.test(copy),
    faster: /faster|\btimes\b|배|เท่า/i.test(copy),
    discount: /%\s*off|\boff the\b|discount|diskaun|harga|할인|ลด/i.test(copy),
    unrelated: /cups|แก้ว|spoons|photo shows|ในรูป/i.test(copy),
    identifier: /\bSKU-\d+\b|\bIR-\d+\b|\bBN-\d+\b|\b[A-Z]{1,3}-\d{2,5}\b|\bKX\d+\b|model code|모델명|order the/i.test(copy),
  };
}

const DESCRIPTIVE_RELATION = [
  [/upper|ceiling|at most|up to|no more|no greater|maximum|max|lte|sehingga|สูงสุด/i, 'upper_bound'],
  [/lower|floor|at least|no less|minimum|min|sekurang|อย่างน้อย|최소/i, 'lower_bound'],
  [/approx|about|around|kira-kira|ประมาณ|약/i, 'approximate'],
  [/range|from|between|dari|จาก|에서|ถึง|hingga/i, 'range'],
  [/compar|delta|than|versus|more|less|quieter|reduction|kurang|น้อย|보다/i, 'comparative_delta'],
  [/multipl|times|factor|kali|배/i, 'multiplicative'],
  [/exact|equal|nameplate|rated|equals/i, 'exact'],
];

export function descriptiveRelation(proposal) {
  const blob = [proposal?.relation, proposal?.consumer_meaning, proposal?.predicate].filter(Boolean).join(' ');
  if (!blob) return null;
  for (const [pattern, relation] of DESCRIPTIVE_RELATION) {
    if (pattern.test(blob)) return relation;
  }
  return null;
}

export function structuralRelation(anchors) {
  const bound = anchors.find((anchor) => anchor.kind === 'explicit_bound');
  if (bound) return bound.relation;
  if (anchors.some((anchor) => anchor.kind === 'range')) return 'range';
  if (anchors.some((anchor) => anchor.kind === 'explicit_multiplier')) return 'multiplicative';
  if (anchors.some((anchor) => anchor.kind === 'explicit_comparator')) return 'comparative_delta';
  if (anchors.some((anchor) => anchor.kind === 'explicit_exact')) return 'exact';
  return null;
}

function resolveRelation(anchors, proposal) {
  const structural = structuralRelation(anchors);
  const descriptive = descriptiveRelation(proposal);
  if (structural && descriptive && structural !== descriptive) {
    return { relation: null, conflict: true, reason: 'RELATION_CONFLICT' };
  }
  const relation = structural ?? descriptive;
  if (!relation) return { relation: 'unknown', conflict: false };
  return { relation, conflict: false };
}

function primaryValue(copy, anchors, relation) {
  if (relation === 'range') return null;
  const written = anchors.find((anchor) => anchor.kind === 'written_number');
  if (written && /litre|times|percent/i.test(copy)) return written.value;
  const dated = new Set(anchors.filter((anchor) => anchor.kind === 'date').map((anchor) => anchor.value));
  const values = anchors.filter((anchor) => anchor.kind === 'value').map((anchor) => anchor.value).filter((value) => !dated.has(value));
  return values[0] ?? written?.value ?? null;
}

function unitOf(copy, anchors, metric) {
  if (anchors.some((anchor) => anchor.kind === 'explicit_percentage') || metric === 'nutrient' || metric === 'energy') {
    if (/%|percent/i.test(copy) || metric === 'nutrient') return 'percent';
  }
  const unit = anchors.find((anchor) => anchor.kind === 'unit');
  if (unit?.unit === 'percent') return 'percent';
  if (metric === 'noise') return 'decibel';
  if (metric === 'power') return 'watt';
  if (metric === 'voltage') return 'volt';
  if (metric === 'duration') return 'minute';
  if (metric === 'capacity') return 'volume';
  if (metric === 'performance') return 'count';
  return unit?.unit ?? null;
}

function quantityConflicts(anchors, proposal, relation, value, range) {
  const conflicts = [];
  const proposed = finiteNumber(proposal?.quantity_value);
  const low = finiteNumber(proposal?.quantity_low);
  const high = finiteNumber(proposal?.quantity_high);
  if (relation === 'range') {
    if (range && low != null && low !== range.low) conflicts.push('CONSISTENCY_CONFLICT');
    if (range && high != null && high !== range.high) conflicts.push('CONSISTENCY_CONFLICT');
    return conflicts;
  }
  if (proposed != null && value != null && proposed !== value) conflicts.push('CONSISTENCY_CONFLICT');
  if (proposal?.status_semantics === 'obtained' && anchors.some((anchor) => anchor.kind === 'explicit_negation')) {
    conflicts.push('CONSISTENCY_CONFLICT');
  }
  return conflicts;
}

export function normalize(copy, anchors, proposal) {
  const span = proposal?.primary_grounding_span;
  if (proposal && span && !copy.includes(span)) {
    return { status: 'drop', reason: 'SEMANTIC-HALLUCINATION' };
  }
  const feat = features(copy);
  if (feat.discount || feat.unrelated || feat.identifier || (anchors.some((anchor) => anchor.kind === 'date') && !feat.power && !feat.nutrient && !feat.noise && !feat.capacity && !feat.duration && !feat.voltage && !feat.energy)) {
    return { status: 'abstain', reason: 'NON_MATERIAL_NUMBER', proposition: null };
  }
  let predicate = null;
  let claim = null;
  let metric = null;
  if (feat.nutrient && feat.retain) {
    predicate = 'nutrient_retention';
    claim = 'quantified_product_benefit';
    metric = 'nutrient';
  } else if (feat.noise && (anchors.some((anchor) => anchor.kind === 'explicit_comparator') || descriptiveRelation(proposal) === 'comparative_delta')) {
    predicate = 'comparative_performance';
    claim = 'quantified_comparative';
    metric = 'noise';
  } else if (feat.noise) {
    predicate = 'measurable_specification';
    claim = 'bare_specification';
    metric = 'noise';
  } else if (feat.faster || anchors.some((anchor) => anchor.kind === 'explicit_multiplier')) {
    predicate = 'comparative_performance';
    claim = 'quantified_comparative';
    metric = 'performance';
  } else if (feat.energy && (anchors.some((anchor) => anchor.kind === 'explicit_comparator') || descriptiveRelation(proposal) === 'comparative_delta')) {
    predicate = 'comparative_performance';
    claim = 'quantified_comparative';
    metric = 'energy';
  } else if (feat.power && (anchors.some((anchor) => anchor.kind === 'explicit_comparator' || anchor.kind === 'explicit_percentage') || descriptiveRelation(proposal) === 'comparative_delta')) {
    predicate = 'comparative_performance';
    claim = 'quantified_comparative';
    metric = 'power';
  } else if (feat.power) {
    predicate = 'measurable_specification';
    claim = 'bare_specification';
    metric = 'power';
  } else if (feat.voltage) {
    predicate = 'measurable_specification';
    claim = 'bare_specification';
    metric = 'voltage';
  } else if (feat.capacity) {
    predicate = 'measurable_specification';
    claim = 'bare_specification';
    metric = 'capacity';
  } else if (feat.duration) {
    predicate = 'measurable_specification';
    claim = 'bare_specification';
    metric = 'duration';
  } else {
    return { status: 'abstain', reason: 'CANNOT_CANONICALIZE_SAFELY', proposition: null };
  }
  const resolved = resolveRelation(anchors, proposal);
  if (resolved.conflict) {
    return { status: 'abstain', reason: 'CONSISTENCY_CONFLICT', proposition: null, conflicts: ['CONSISTENCY_CONFLICT'] };
  }
  let relation = resolved.relation;
  if (relation === 'exact' && !anchors.some((anchor) => anchor.kind === 'explicit_exact') && descriptiveRelation(proposal) !== 'exact') {
    relation = 'unknown';
  }
  if (feat.nutrient && feat.retain && relation === 'comparative_delta') {
    claim = 'quantified_comparative';
  }
  const range = anchors.find((anchor) => anchor.kind === 'range');
  const value = primaryValue(copy, anchors, relation);
  const conflicts = quantityConflicts(anchors, proposal, relation, value, range);
  const proposition = {
    predicate,
    claim_form: claim,
    relation,
    value: relation === 'range' ? null : value,
    low: range?.low ?? null,
    high: range?.high ?? null,
    unit: unitOf(copy, anchors, metric),
    metric,
    primary_grounding_span: span && copy.includes(span) ? span : null,
    conflicts,
  };
  if (!proposition.primary_grounding_span) {
    return { status: 'drop', reason: 'SEMANTIC-HALLUCINATION', proposition: null };
  }
  if (relation === 'unknown') {
    return { status: 'abstain', reason: 'QUANTITY_RELATION_UNKNOWN', proposition };
  }
  if (conflicts.includes('CONSISTENCY_CONFLICT')) {
    return { status: 'abstain', reason: 'CONSISTENCY_CONFLICT', proposition };
  }
  return { status: 'canonical', proposition };
}

export { finiteNumber };
