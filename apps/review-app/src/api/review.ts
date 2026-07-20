import type { DemoReviewCountryId, DemoSaCategoryId } from '@aairp/shared-kernel';
import { DEMO_REVIEW_PLATFORM_ID } from '@aairp/shared-kernel';

export type ReviewUploadPayload = {
  country_id: DemoReviewCountryId;
  platform_id: typeof DEMO_REVIEW_PLATFORM_ID;
  category_id: DemoSaCategoryId;
  content: {
    text: string;
    images?: string[];
    disclaimer_text?: string;
  };
  context?: {
    ad_type?: 'BRAND_PRODUCT' | 'INFLUENCER_UGC';
  };
  tags?: string[];
  /** When set, new case joins the parent's submission thread. */
  parent_case_id?: string;
};

export type RewriteSuggestionDto = {
  suggestion_id: string;
  finding_id: string;
  risk_type: string;
  rewrite_template_id: string;
  original_span: {
    field: string;
    start?: number;
    end?: number;
    text: string;
  };
  suggested_text: string[];
  rationale: string;
  confidence: number;
};

export type EvidenceSpanDto = {
  field: string;
  start?: number;
  end?: number;
  text: string;
};

export type ReviewFindingDto = {
  finding_id: string;
  module: string;
  ref_id: string;
  severity: string;
  decision: string;
  summary: string;
  remediation_type?: string;
  evidence_spans?: EvidenceSpanDto[];
  rewrite_suggestions?: RewriteSuggestionDto[];
};

export type DemoReviewResponse = {
  review_id: string;
  advertisement_id: string;
  final_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  confidence: number;
  rationale: string;
  finding_counts: {
    rule: number;
    playbook: number;
    llm: number;
    case?: number;
    vision?: number;
  };
  report_html: string;
  summary: {
    final_decision: string;
    confidence: number;
    rationale: string;
    advertisement: {
      text_preview: string;
      country_id: string;
      platform_id: string;
      category_id: string;
    };
    findings: ReviewFindingDto[];
    open_risk_skipped: boolean;
    open_risk_skip_reason?: string;
  };
  generated_at: string;
  case_id?: string;
  thread_id?: string;
  parent_case_id?: string;
  reviewer_id?: string;
};

export type ReviewApiError = {
  message: string;
  status: number;
  details?: unknown;
};

export async function submitReview(payload: ReviewUploadPayload): Promise<DemoReviewResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await fetch('/demo/review', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string'
          ? (body as { detail: string }).detail
          : `Review request failed (${response.status})`;
      throw { message, status: response.status, details: body } satisfies ReviewApiError;
    }

    return body as DemoReviewResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw {
        message: '审核请求超时（180秒），请稍后重试或缩小图片后提交',
        status: 408,
      } satisfies ReviewApiError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
