import { describe, expect, it } from 'vitest';
import { parseVisionResponseContent } from './vision-response.parser.js';

describe('parseVisionResponseContent', () => {
  it('parses empty findings stub payload', () => {
    const parsed = parseVisionResponseContent(
      JSON.stringify({
        prompt_pack_version: 'demo-vision-1.0.0',
        extracted_text: [],
        findings: [],
      }),
    );

    expect(parsed.findings).toEqual([]);
    expect(parsed.extracted_text).toEqual([]);
  });

  it('parses image-grounded evidence spans', () => {
    const parsed = parseVisionResponseContent(
      JSON.stringify({
        prompt_pack_version: 'demo-vision-1.0.0',
        findings: [
          {
            risk_type: 'chinese-panel-unreplaced',
            description: 'Chinese control panel visible on SG listing',
            severity: 'HIGH',
            suggested_action: 'WARN',
            confidence: 0.88,
            scan_dimension: 'panel_language',
            evidence_spans: [
              {
                field: 'image',
                slice_index: 0,
                region_description: 'centre product panel',
                text: '开始',
              },
            ],
          },
        ],
      }),
    );

    expect(parsed.findings[0]?.evidence_spans?.[0]?.slice_index).toBe(0);
    expect(parsed.findings[0]?.evidence_spans?.[0]?.region_description).toBe(
      'centre product panel',
    );
  });
});
