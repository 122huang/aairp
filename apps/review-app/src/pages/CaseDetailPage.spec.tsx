import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseDetailPage } from './CaseDetailPage';

const fetchCase = vi.fn();

vi.mock('@/api/cases', () => ({
  fetchCase: (...args: unknown[]) => fetchCase(...args),
}));

vi.mock('@/api/case-report', () => ({
  openCaseReport: vi.fn(),
}));

vi.mock('@/components/layout/AppHeader', () => ({
  AppHeader: () => <header>header</header>,
}));

vi.mock('@/components/layout/AppFooter', () => ({
  AppFooter: () => <footer>footer</footer>,
}));

vi.mock('@/components/review/DecisionBanner', () => ({
  DecisionBanner: ({ decision }: { decision: string }) => <div>decision:{decision}</div>,
}));

vi.mock('@/components/review/FindingsList', () => ({
  FindingsList: () => <div>findings</div>,
}));

vi.mock('@/components/review/SourceMaterial', () => ({
  SourceMaterial: ({ text }: { text: string }) => <div>source:{text}</div>,
}));

describe('CaseDetailPage', () => {
  beforeEach(() => {
    fetchCase.mockReset();
  });

  it('loads case and exposes resubmit link driven by case_id', async () => {
    fetchCase.mockResolvedValue({
      case_id: 'case_detail_1',
      case_version: 1,
      review_id: 'rev_detail_1',
      advertisement_id: 'ad_1',
      thread_id: 'thread_detail',
      lifecycle_status: 'GENERATED',
      dimensions: {
        tenant_id: 'demo',
        country_id: 'SG',
        platform_id: 'META',
        category_id: 'sa.other',
        legal_reviewed_market: true,
      },
      advertisement: {
        advertisement_id: 'ad_1',
        content_hash: 'h',
        content_version: 1,
        ad_type: 'BRAND_PRODUCT',
        content: { text: 'Detail copy text', image_urls: [] },
        tags: [],
      },
      matched_rules: [],
      matched_playbooks: [],
      llm_analysis: {
        prompt_pack_version: 'p',
        skipped: true,
        findings: [],
        evaluated_at: '2026-07-18T00:00:00.000Z',
      },
      decision: {
        ai_decision: 'WARN',
        confidence: 0.7,
        rationale: 'needs review',
        finding_counts: { rule: 0, playbook: 0, llm: 0 },
        decided_at: '2026-07-18T00:00:00.000Z',
        final_decision: 'WARN',
      },
      created_at: '2026-07-18T00:00:00.000Z',
      updated_at: '2026-07-18T00:00:00.000Z',
    });

    render(<CaseDetailPage caseId="case_detail_1" />);

    await waitFor(() => expect(fetchCase).toHaveBeenCalledWith('case_detail_1'));
    expect(await screen.findByText('decision:WARN')).toBeTruthy();
    expect(screen.getByText('source:Detail copy text')).toBeTruthy();
    expect(screen.getByText(/thread_id: thread_detail/)).toBeTruthy();

    const resubmit = screen.getByRole('link', { name: '基于此案例修改后重新提交' });
    expect(resubmit).toHaveAttribute('href', '#/?parent_case_id=case_detail_1');
    expect(screen.getByRole('link', { name: /返回审核记录/ })).toHaveAttribute(
      'href',
      '#/history',
    );
  });

  it('shows load error when case is missing', async () => {
    fetchCase.mockRejectedValue({ message: 'case not found: case_missing', status: 404 });
    render(<CaseDetailPage caseId="case_missing" />);
    expect(await screen.findByText('case not found: case_missing')).toBeTruthy();
  });
});
