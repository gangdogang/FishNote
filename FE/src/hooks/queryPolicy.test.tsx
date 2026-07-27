import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHttpStatus, isValidResourceId, retryTransientQueryOnce } from '../lib/errors';
import { useFishDetail, useFishPrices } from './useFish';
import { useReviews } from './useReviews';
import { clearStoredAccessToken, setStoredAccessToken } from '../api/client';

const fishApiMocks = vi.hoisted(() => ({
  getFishDetail: vi.fn(),
  getFishList: vi.fn(),
  getFishPrices: vi.fn(),
}));

const reviewApiMocks = vi.hoisted(() => ({
  createReview: vi.fn(),
  deleteReview: vi.fn(),
  getReviews: vi.fn(),
  markReviewHelpful: vi.fn(),
}));

vi.mock('../api/fish', () => fishApiMocks);
vi.mock('../api/review', () => reviewApiMocks);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retryDelay: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function axiosLikeError(status?: number) {
  return {
    isAxiosError: true,
    response: status === undefined ? undefined : { status },
  };
}

beforeEach(() => {
  clearStoredAccessToken();
  for (const mock of Object.values(fishApiMocks)) mock.mockReset();
  for (const mock of Object.values(reviewApiMocks)) mock.mockReset();
});

describe('query policy utilities', () => {
  it.each([
    [1, true],
    [Number.MAX_SAFE_INTEGER, true],
    [0, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.MAX_SAFE_INTEGER + 1, false],
  ])('validates resource id %s', (id, expected) => {
    expect(isValidResourceId(id)).toBe(expected);
  });

  it('extracts Axios response status without assuming every error is Axios', () => {
    expect(getHttpStatus(axiosLikeError(404))).toBe(404);
    expect(getHttpStatus(new Error('network'))).toBeUndefined();
  });

  it('retries only one network or 5xx failure and never retries 4xx', () => {
    expect(retryTransientQueryOnce(0, axiosLikeError())).toBe(true);
    expect(retryTransientQueryOnce(0, axiosLikeError(503))).toBe(true);
    expect(retryTransientQueryOnce(0, axiosLikeError(404))).toBe(false);
    expect(retryTransientQueryOnce(1, axiosLikeError(503))).toBe(false);
  });
});

describe('fish section query policies', () => {
  it('separates viewer-specific review caches across an authentication boundary', async () => {
    reviewApiMocks.getReviews.mockResolvedValue({
      fishId: 1,
      avgRating: 0,
      totalCount: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      reviews: [],
      page: 0,
      size: 20,
      hasNext: false,
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useReviews(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryCache().find({
      queryKey: ['reviews', 1, 'latest', 'anonymous'],
    })).toBeDefined();

    setStoredAccessToken('test-access-token');
    rerender();
    await waitFor(() => expect(reviewApiMocks.getReviews).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryCache().find({
      queryKey: ['reviews', 1, 'latest', 'authenticated'],
    })).toBeDefined();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'does not request an invalid fish id (%s)',
    (fishId) => {
      const { result } = renderHook(
        () => ({
          detail: useFishDetail(fishId),
          prices: useFishPrices(fishId),
          reviews: useReviews(fishId),
        }),
        { wrapper: createWrapper() },
      );

      expect(result.current.detail.fetchStatus).toBe('idle');
      expect(result.current.prices.fetchStatus).toBe('idle');
      expect(result.current.reviews.fetchStatus).toBe('idle');
      expect(fishApiMocks.getFishDetail).not.toHaveBeenCalled();
      expect(fishApiMocks.getFishPrices).not.toHaveBeenCalled();
      expect(reviewApiMocks.getReviews).not.toHaveBeenCalled();
    },
  );

  it('does not retry a fish detail 404', async () => {
    fishApiMocks.getFishDetail.mockRejectedValue(axiosLikeError(404));

    const { result } = renderHook(() => useFishDetail(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fishApiMocks.getFishDetail).toHaveBeenCalledTimes(1);
  });

  it('retries a fish detail 5xx once', async () => {
    fishApiMocks.getFishDetail.mockRejectedValue(axiosLikeError(500));

    const { result } = renderHook(() => useFishDetail(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fishApiMocks.getFishDetail).toHaveBeenCalledTimes(2);
  });

  it('limits price and review section retries explicitly', async () => {
    fishApiMocks.getFishPrices.mockRejectedValue(axiosLikeError(503));
    reviewApiMocks.getReviews.mockRejectedValue(axiosLikeError());

    const { result } = renderHook(
      () => ({ prices: useFishPrices(1), reviews: useReviews(1) }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.prices.isError).toBe(true);
      expect(result.current.reviews.isError).toBe(true);
    });
    expect(fishApiMocks.getFishPrices).toHaveBeenCalledTimes(2);
    expect(reviewApiMocks.getReviews).toHaveBeenCalledTimes(2);
  });
});
