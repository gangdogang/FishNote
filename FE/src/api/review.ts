import axios from 'axios';
import { apiClient, apiVersionUrl } from './client';
import type { Review, ReviewHelpfulResponse, ReviewList, ReviewRequest, ReviewSort } from '../types/review';

interface ReviewCursorV2Response {
  fishId: number;
  summary: {
    avgRating: number;
    reviewCount: number;
    ratingCount: number;
    ratingDistribution: ReviewList['ratingDistribution'];
  } | null;
  items: Review[];
  pageInfo: {
    nextCursor: string | null;
    hasNext: boolean;
    limit: number;
  };
}

// 운영은 명시적으로 opt-in해야 한다. BE 기능 플래그보다 FE가 먼저 켜지는
// 배포 순서 오류를 막고, 개발·테스트에서는 기존의 v2 우선 검증 흐름을 유지한다.
const reviewV2Enabled = import.meta.env.PROD
  ? import.meta.env.VITE_REVIEW_V2_ENABLED === 'true'
  : import.meta.env.VITE_REVIEW_V2_ENABLED !== 'false';

export async function getReviews(
  fishId: number,
  sort: ReviewSort = 'latest',
  pageParam: number | string = 0,
  size = 20,
) {
  if (reviewV2Enabled && typeof pageParam !== 'number') {
    return getReviewsV2(fishId, sort, pageParam, size, false);
  }

  if (reviewV2Enabled && pageParam === 0) {
    try {
      return await getReviewsV2(fishId, sort, undefined, size, true);
    } catch (error) {
      if (!canFallbackToV1(error)) throw error;
    }
  }

  const { data } = await apiClient.get<ReviewList>(`/fish/${fishId}/reviews`, {
    params: { page: pageParam, size, sort },
  });
  return data;
}

async function getReviewsV2(
  fishId: number,
  sort: ReviewSort,
  cursor: string | undefined,
  limit: number,
  includeSummary: boolean,
): Promise<ReviewList> {
  const { data } = await apiClient.get<ReviewCursorV2Response>(
    apiVersionUrl(2, `fish/${fishId}/reviews`),
    { params: { sort, limit, cursor, includeSummary } },
  );
  if (!isReviewCursorV2Response(data)) throw new V2UnavailableError();
  const summary = data.summary;
  return {
    fishId: data.fishId,
    avgRating: summary?.avgRating ?? 0,
    totalCount: summary?.reviewCount ?? 0,
    ratingCount: summary?.ratingCount ?? 0,
    ratingDistribution: summary?.ratingDistribution ?? emptyRatingDistribution(),
    reviews: data.items,
    page: 0,
    size: data.pageInfo.limit,
    hasNext: data.pageInfo.hasNext,
    nextCursor: data.pageInfo.nextCursor,
  };
}

function emptyRatingDistribution(): ReviewList['ratingDistribution'] {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
}

function canFallbackToV1(error: unknown) {
  if (error instanceof V2UnavailableError) return true;
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 404 || status >= 500;
}

function isReviewCursorV2Response(value: unknown): value is ReviewCursorV2Response {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<ReviewCursorV2Response>;
  return typeof response.fishId === 'number'
    && Number.isSafeInteger(response.fishId)
    && Array.isArray(response.items)
    && Boolean(response.pageInfo && typeof response.pageInfo.hasNext === 'boolean');
}

class V2UnavailableError extends Error {}

export async function createReview(fishId: number, request: ReviewRequest) {
  const { data } = await apiClient.post<Review>(`/fish/${fishId}/reviews`, request);
  return data;
}

export async function deleteReview(reviewId: number, password?: string) {
  await apiClient.delete(`/reviews/${reviewId}`, password ? { data: { password } } : undefined);
}

export async function markReviewHelpful(reviewId: number) {
  const { data } = await apiClient.post<ReviewHelpfulResponse>(`/reviews/${reviewId}/helpful`);
  return data;
}
