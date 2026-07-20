import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewHistoryPage } from './ReviewHistoryPage';

const searchCases = vi.fn();

vi.mock('@/api/cases', () => ({
  searchCases: (...args: unknown[]) => searchCases(...args),
}));

vi.mock('@/components/layout/AppHeader', () => ({
  AppHeader: () => <header>header</header>,
}));

vi.mock('@/components/layout/AppFooter', () => ({
  AppFooter: () => <footer>footer</footer>,
}));

describe('ReviewHistoryPage', () => {
  beforeEach(() => {
    searchCases.mockReset();
    searchCases.mockResolvedValue({
      count: 1,
      cases: [
        {
          case_id: 'case_hist_1',
          case_version: 1,
          path: 'x',
          review_id: 'rev_1',
          country_id: 'MY',
          category_id: 'sa.air_fryer',
          platform_id: 'META',
          ai_decision: 'PASS',
          final_decision: 'PASS',
          lifecycle_status: 'GENERATED',
          content_hash: 'h',
          created_at: '2026-07-18T08:00:00.000Z',
          updated_at: '2026-07-18T08:00:00.000Z',
          thread_id: 'thread_1',
          text_preview: 'Crispy snacks',
        },
      ],
    });
  });

  it('loads cases on mount and searches with case_id / thread filters', async () => {
    const user = userEvent.setup();
    render(<ReviewHistoryPage />);

    await waitFor(() => expect(searchCases).toHaveBeenCalled());
    expect(await screen.findByText('case_hist_1')).toBeTruthy();
    expect(screen.getByText('Crispy snacks')).toBeTruthy();
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      '#/cases/case_hist_1',
    );

    await user.type(screen.getByLabelText('case_id（精确）'), 'case_hist_1');
    await user.type(screen.getByLabelText('thread_id（精确）'), 'thread_1');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() =>
      expect(searchCases).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: 'case_hist_1',
          thread_id: 'thread_1',
          limit: 50,
        }),
      ),
    );
  });

  it('shows API errors from search', async () => {
    searchCases.mockRejectedValueOnce({ message: '后端不可用', status: 503 });
    render(<ReviewHistoryPage />);
    expect(await screen.findByText('后端不可用')).toBeTruthy();
  });
});
