import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishDetail } from '../types/fish';
import { useCreateReview, useDeleteReview } from './useReviews';

const reviewApiMocks = vi.hoisted(() => ({
  createReview: vi.fn(),
  deleteReview: vi.fn(),
  getReviews: vi.fn(),
  markReviewHelpful: vi.fn(),
}));

vi.mock('../api/review', () => reviewApiMocks);

const targetFish = { id: 42, name: '광어' } as FishDetail;
const otherFish = { id: 77, name: '방어' } as FishDetail;

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(['fish', 'detail', 'gwang-eo'], targetFish);
  queryClient.setQueryData(['fish', 'detail', '42'], targetFish);
  queryClient.setQueryData(['fish', 'detail', 'bang-eo'], otherFish);
  queryClient.setQueryData(['fish', 42, 'prices', 14], { fishId: 42 });
  queryClient.setQueryData(['fish', { sort: 'popular' }], { content: [targetFish] });
  queryClient.setQueryData(['reviews', 42, 'latest'], { pages: [], pageParams: [] });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

function expectInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
  expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
}

function expectFresh(queryClient: QueryClient, queryKey: readonly unknown[]) {
  expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false);
}

beforeEach(() => {
  for (const mock of Object.values(reviewApiMocks)) mock.mockReset();
  reviewApiMocks.createReview.mockResolvedValue({ id: 1, fishId: 42 });
  reviewApiMocks.deleteReview.mockResolvedValue(undefined);
});

describe('review rating cache invalidation', () => {
  it('후기 생성 성공 시 key가 slug인 동일 어종 상세까지 canonical ID로 무효화한다', async () => {
    const { queryClient, Wrapper } = createHarness();
    const { result } = renderHook(() => useCreateReview(42), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ content: '좋아요', rating: 5 });
    });

    await expectRatingCachesInvalidated(queryClient);
  });

  it('후기 삭제 성공 시 key가 slug인 동일 어종 상세까지 canonical ID로 무효화한다', async () => {
    const { queryClient, Wrapper } = createHarness();
    const { result } = renderHook(() => useDeleteReview(42), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 9 });
    });

    await expectRatingCachesInvalidated(queryClient);
  });
});

async function expectRatingCachesInvalidated(queryClient: QueryClient) {
  await waitFor(() => {
    expectInvalidated(queryClient, ['fish', 'detail', 'gwang-eo']);
    expectInvalidated(queryClient, ['fish', 'detail', '42']);
    expectInvalidated(queryClient, ['fish', { sort: 'popular' }]);
    expectInvalidated(queryClient, ['reviews', 42, 'latest']);
  });

  expectFresh(queryClient, ['fish', 'detail', 'bang-eo']);
  expectFresh(queryClient, ['fish', 42, 'prices', 14]);
}
