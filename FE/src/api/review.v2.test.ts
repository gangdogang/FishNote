import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { getReviews } from './review';

const review = {
  id: 10,
  fishId: 1,
  nickname: '회러버',
  rating: 5,
  content: '좋아요',
  imageUrl: null,
  helpfulCount: 0,
  createdAt: '2026-07-23T00:00:00Z',
  mine: false,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('review v2 cursor with v1 rollback', () => {
  it('normalizes the first v2 cursor page to the existing view model', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        fishId: 1,
        summary: {
          avgRating: 5,
          reviewCount: 1,
          ratingCount: 1,
          ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 },
        },
        items: [review],
        pageInfo: { nextCursor: 'opaque-next', hasNext: true, limit: 20 },
      },
    });

    await expect(getReviews(1)).resolves.toMatchObject({
      fishId: 1,
      totalCount: 1,
      reviews: [review],
      hasNext: true,
      nextCursor: 'opaque-next',
    });
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v2\/fish\/1\/reviews$/),
      { params: { sort: 'latest', limit: 20, cursor: undefined, includeSummary: true } },
    );
  });

  it('requests following pages with the opaque cursor and without repeating summary', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        fishId: 1,
        summary: null,
        items: [review],
        pageInfo: { nextCursor: null, hasNext: false, limit: 20 },
      },
    });

    await getReviews(1, 'helpful', 'opaque-next');
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v2\/fish\/1\/reviews$/),
      { params: { sort: 'helpful', limit: 20, cursor: 'opaque-next', includeSummary: false } },
    );
  });

  it('falls back to the page-based v1 endpoint when the first v2 request is unavailable', async () => {
    const legacy = {
      fishId: 1,
      avgRating: 0,
      totalCount: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      reviews: [],
      page: 0,
      size: 20,
      hasNext: false,
    };
    const get = vi.spyOn(apiClient, 'get')
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
      .mockResolvedValueOnce({ data: legacy });

    await expect(getReviews(1)).resolves.toEqual(legacy);
    expect(get).toHaveBeenNthCalledWith(2, '/fish/1/reviews', {
      params: { page: 0, size: 20, sort: 'latest' },
    });
  });

  it('falls back when a preview SPA shell is returned for the v2 route', async () => {
    const legacy = {
      fishId: 1,
      avgRating: 0,
      totalCount: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      reviews: [],
      page: 0,
      size: 20,
      hasNext: false,
    };
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: '<!doctype html><title>FishNote</title>' })
      .mockResolvedValueOnce({ data: legacy });

    await expect(getReviews(1)).resolves.toEqual(legacy);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
