import { useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createReview, deleteReview, getReviews, markReviewHelpful } from '../api/review';
import type { ReviewRequest, ReviewSort } from '../types/review';

export function useReviews(fishId: number, sort: ReviewSort = 'latest') {
  return useInfiniteQuery({
    queryKey: ['reviews', fishId, sort],
    queryFn: ({ pageParam }) => getReviews(fishId, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    select: (data) => {
      const firstPage = data.pages[0];
      if (!firstPage) return undefined;
      return {
        ...firstPage,
        reviews: data.pages.flatMap((page) => page.reviews),
      };
    },
    enabled: Number.isFinite(fishId),
  });
}

// 후기 생성/삭제 시 평점·후기 수가 바뀌는 쿼리만 골라 무효화한다.
// ['fish'] 전체 무효화는 무관한 다른 어종 상세·시세까지 리페치하므로 피한다.
function invalidateRatingQueries(queryClient: QueryClient, fishId: number) {
  // 해당 어종 상세(['fish', id])만 정확히 — 시세(['fish', id, 'prices', ...])는 후기와 무관
  void queryClient.invalidateQueries({ queryKey: ['fish', fishId], exact: true });
  // 목록(['fish', params]) — 카드에 평점/후기 수가 표시되므로 stale 처리
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'fish' &&
      query.queryKey.length === 2 &&
      typeof query.queryKey[1] === 'object',
  });
}

export function useCreateReview(fishId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ReviewRequest) => createReview(fishId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', fishId] });
      invalidateRatingQueries(queryClient, fishId);
    },
  });
}

export function useMarkReviewHelpful(fishId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: number) => markReviewHelpful(reviewId),
    onSuccess: () => {
      // 도움돼요 수는 후기 목록에만 표시됨 — fish 쿼리는 건드릴 필요 없음
      queryClient.invalidateQueries({ queryKey: ['reviews', fishId] });
    },
  });
}

export function useDeleteReview(fishId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, password }: { reviewId: number; password?: string }) => deleteReview(reviewId, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', fishId] });
      invalidateRatingQueries(queryClient, fishId);
    },
  });
}
