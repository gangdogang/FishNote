import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedPage from './SavedPage';

const hookMocks = vi.hoisted(() => ({
  useBookmarks: vi.fn(),
  useFishList: vi.fn(),
  refetchBookmarks: vi.fn(),
  refetchFishList: vi.fn(),
}));

vi.mock('../hooks/useBookmarks', () => ({
  useBookmarks: hookMocks.useBookmarks,
}));

vi.mock('../hooks/useFish', () => ({
  useFishList: hookMocks.useFishList,
}));

vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(hookMocks)) mock.mockReset();
  hookMocks.useBookmarks.mockReturnValue({
    bookmarkedIdSet: new Set<number>(),
    bookmarkedFishes: [],
    bookmarkCount: 0,
    isServerMode: true,
    isLoading: false,
    isError: false,
    refetchBookmarks: hookMocks.refetchBookmarks,
  });
  hookMocks.useFishList.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: hookMocks.refetchFishList,
  });
});

describe('SavedPage retry', () => {
  it('회원 북마크 조회 실패를 같은 query로 다시 시도한다', async () => {
    const user = userEvent.setup();
    hookMocks.useBookmarks.mockReturnValue({
      bookmarkedIdSet: new Set<number>(),
      bookmarkedFishes: [],
      bookmarkCount: 0,
      isServerMode: true,
      isLoading: false,
      isError: true,
      refetchBookmarks: hookMocks.refetchBookmarks,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(hookMocks.refetchBookmarks).toHaveBeenCalledOnce();
    expect(hookMocks.refetchFishList).not.toHaveBeenCalled();
  });

  it('비회원 도감 조회 실패는 전체 어종 query를 다시 시도한다', async () => {
    const user = userEvent.setup();
    hookMocks.useBookmarks.mockReturnValue({
      bookmarkedIdSet: new Set<number>([2]),
      bookmarkedFishes: [],
      bookmarkCount: 1,
      isServerMode: false,
      isLoading: false,
      isError: false,
      refetchBookmarks: hookMocks.refetchBookmarks,
    });
    hookMocks.useFishList.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: hookMocks.refetchFishList,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(hookMocks.refetchFishList).toHaveBeenCalledOnce();
    expect(hookMocks.refetchBookmarks).not.toHaveBeenCalled();
  });
});
