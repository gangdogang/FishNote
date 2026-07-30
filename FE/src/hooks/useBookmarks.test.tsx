import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkProvider, useBookmarks } from './useBookmarks';

const mocks = vi.hoisted(() => ({
  addMyBookmark: vi.fn(),
  deleteMyBookmark: vi.fn(),
  getMyBookmarks: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../api/bookmarks', () => ({
  addMyBookmark: mocks.addMyBookmark,
  bookmarksMeQueryKey: ['bookmarks', 'me'] as const,
  deleteMyBookmark: mocks.deleteMyBookmark,
  getMyBookmarks: mocks.getMyBookmarks,
}));
vi.mock('./useAuth', () => ({
  useAuth: () => ({ accessToken: 'test-access-token' }),
}));
vi.mock('./useToast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

function BookmarkHarness() {
  const { isBookmarked, isBookmarkPending, toggleBookmark } = useBookmarks();
  return (
    <>
      {[1, 2].map((fishId) => (
        <button key={fishId} type="button" onClick={() => toggleBookmark(fishId)}>
          횟감 {fishId}
          <span data-testid={`fish-${fishId}-state`}>
            {isBookmarked(fishId) ? '저장됨' : '미저장'}
            {isBookmarkPending(fishId) ? '·처리중' : '·대기'}
          </span>
        </button>
      ))}
    </>
  );
}

function renderBookmarks() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BookmarkProvider>{children}</BookmarkProvider>
    </QueryClientProvider>
  );
  return render(<BookmarkHarness />, { wrapper });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  mocks.addMyBookmark.mockReset();
  mocks.deleteMyBookmark.mockReset();
  mocks.getMyBookmarks.mockReset().mockResolvedValue([]);
  mocks.showToast.mockReset();
});

describe('useBookmarks server feedback', () => {
  it('서로 다른 횟감은 독립적으로 저장하고 응답 전 성공 토스트를 표시하지 않는다', async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    mocks.addMyBookmark
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    renderBookmarks();
    await waitFor(() => expect(mocks.getMyBookmarks).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /횟감 1/ }));
    await user.click(screen.getByRole('button', { name: /횟감 2/ }));

    await waitFor(() => expect(mocks.addMyBookmark).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('fish-1-state')).toHaveTextContent('저장됨·처리중');
    expect(screen.getByTestId('fish-2-state')).toHaveTextContent('저장됨·처리중');
    expect(mocks.showToast).not.toHaveBeenCalled();

    await act(async () => first.resolve());
    await waitFor(() => expect(screen.getByTestId('fish-1-state')).toHaveTextContent('·대기'));
    expect(screen.getByTestId('fish-2-state')).toHaveTextContent('·처리중');
    expect(mocks.showToast).toHaveBeenCalledTimes(1);

    await act(async () => second.resolve());
    await waitFor(() => expect(screen.getByTestId('fish-2-state')).toHaveTextContent('·대기'));
    expect(mocks.showToast).toHaveBeenCalledTimes(2);
    expect(mocks.showToast).toHaveBeenLastCalledWith('내 도감에 저장했어요');
  });

  it('저장 실패는 해당 횟감만 원복하고 실패 이유를 알린다', async () => {
    const user = userEvent.setup();
    mocks.addMyBookmark.mockRejectedValueOnce(new Error('network'));
    renderBookmarks();
    await waitFor(() => expect(mocks.getMyBookmarks).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /횟감 1/ }));

    await waitFor(() => expect(screen.getByTestId('fish-1-state')).toHaveTextContent('미저장·대기'));
    expect(mocks.showToast).toHaveBeenCalledWith('저장하지 못했어요. 다시 시도해 주세요');
    expect(screen.getByTestId('fish-2-state')).toHaveTextContent('미저장·대기');
  });
});
