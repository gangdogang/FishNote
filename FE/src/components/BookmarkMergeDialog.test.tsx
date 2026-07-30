import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_STORAGE_KEY } from '../api/client';
import { AUTH_SUCCESS_EVENT } from '../hooks/useAuth';
import {
  BOOKMARK_MERGE_DISMISSED_KEY,
  BOOKMARK_STORAGE_KEY,
  clearBookmarkMergeDismissed,
} from '../lib/bookmarkStorage';
import BookmarkMergeDialog from './BookmarkMergeDialog';

const bookmarkApiMocks = vi.hoisted(() => ({
  mergeMyBookmarks: vi.fn(),
}));

vi.mock('../api/bookmarks', () => ({
  bookmarksMeQueryKey: ['bookmarks', 'me'] as const,
  mergeMyBookmarks: bookmarkApiMocks.mergeMyBookmarks,
}));

function DialogHarness() {
  return (
    <>
      <button type="button" onClick={() => window.dispatchEvent(new Event(AUTH_SUCCESS_EVENT))}>
        로그인 완료
      </button>
      <BookmarkMergeDialog />
    </>
  );
}

function renderMergeDialog() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <QueryClientProvider client={queryClient}>
      <DialogHarness />
    </QueryClientProvider>,
  );

  return { invalidateQueries };
}

function primeAuthenticatedBookmarks(fishIds = [2, 7]) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'test-access-token');
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(fishIds));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  bookmarkApiMocks.mergeMyBookmarks.mockReset();
});

afterEach(() => {
  document.body.style.overflow = '';
});

describe('BookmarkMergeDialog', () => {
  it('로그인 상태로 다시 접속해도 남은 로컬 북마크 병합을 제안한다', async () => {
    primeAuthenticatedBookmarks([3, 9]);
    renderMergeDialog();

    expect(await screen.findByRole('dialog', {
      name: '이 기기에 저장한 횟감 2종이 있어요',
    })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '옮기기' })).toHaveFocus());
  });

  it('로그인 성공 후 native dialog을 열고 병합 버튼에 첫 focus를 둔다', async () => {
    const user = userEvent.setup();
    renderMergeDialog();
    primeAuthenticatedBookmarks([2, 7, 11]);

    await user.click(screen.getByRole('button', { name: '로그인 완료' }));

    const dialog = screen.getByRole('dialog', {
      name: '이 기기에 저장한 횟감 3종이 있어요',
    });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('내 도감으로 옮길까요?');
    await waitFor(() => expect(screen.getByRole('button', { name: '옮기기' })).toHaveFocus());
  });

  it('Escape, backdrop, 나중에 닫기를 공통 정책으로 처리하고 opener focus를 복원한다', async () => {
    const user = userEvent.setup();
    renderMergeDialog();
    primeAuthenticatedBookmarks();
    const opener = screen.getByRole('button', { name: '로그인 완료' });

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(BOOKMARK_MERGE_DISMISSED_KEY)).toBe('true');
    await waitFor(() => expect(opener).toHaveFocus());

    clearBookmarkMergeDismissed();
    await user.click(opener);
    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());

    clearBookmarkMergeDismissed();
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: '이번에는 건너뛰기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(BOOKMARK_MERGE_DISMISSED_KEY)).toBe('true');
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('병합 중에는 Escape·backdrop·나중에 닫기를 막고 성공 후 저장과 query를 갱신한다', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();
    bookmarkApiMocks.mergeMyBookmarks.mockReturnValueOnce(deferred.promise);
    const { invalidateQueries } = renderMergeDialog();
    primeAuthenticatedBookmarks();
    const opener = screen.getByRole('button', { name: '로그인 완료' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: '옮기기' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '옮기는 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이번에는 건너뛰기' })).toBeDisabled();
    expect(bookmarkApiMocks.mergeMyBookmarks.mock.calls[0]?.[0]).toEqual([2, 7]);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(window.localStorage.getItem(BOOKMARK_MERGE_DISMISSED_KEY)).toBeNull();

    await act(async () => deferred.resolve());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBeNull();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['bookmarks', 'me'] });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('병합 실패 시 로컬 북마크와 dialog을 유지하고 재시도 가능한 alert를 보여준다', async () => {
    const user = userEvent.setup();
    bookmarkApiMocks.mergeMyBookmarks.mockRejectedValueOnce(new Error('network failure'));
    const { invalidateQueries } = renderMergeDialog();
    primeAuthenticatedBookmarks([5]);

    await user.click(screen.getByRole('button', { name: '로그인 완료' }));
    await user.click(screen.getByRole('button', { name: '옮기기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '북마크를 옮기지 못했습니다. 다시 시도해 주세요.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '옮기기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '이번에는 건너뛰기' })).toBeEnabled();
    expect(window.localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBe('[5]');
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
