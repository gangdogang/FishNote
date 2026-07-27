import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { getFishDetail, getFishList, getHomeData } from './fish';
import type { FishDetail, FishSummary } from '../types/fish';

const summary = {
  id: 1,
  slug: 'gwang-eo',
  name: '광어',
  imageUrl: null,
  description: null,
  priceLevel: 2,
  tasteTags: ['담백'],
  seasonMonths: [1],
  featured: true,
  avgRating: 4.5,
  reviewCount: 2,
} satisfies FishSummary;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fish v2 read with v1 rollback', () => {
  it('uses the v2 catalog read model by default', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        items: [summary],
        pageInfo: { nextCursor: null, hasNext: false, limit: 100 },
        facets: { taste: {}, season: {}, priceLevel: {}, category: {} },
      },
    });

    await expect(getFishList({ sort: 'popular' })).resolves.toEqual([summary]);
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v2\/fish$/),
      { params: { sort: 'popular', limit: 100 } },
    );
  });

  it('falls back to the compatible v1 list when v2 is disabled or unavailable', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValueOnce({ data: [summary] });

    await expect(getFishList()).resolves.toEqual([summary]);
    expect(get).toHaveBeenNthCalledWith(2, '/fish', { params: {} });
  });

  it('treats an SPA HTML fallback as an unavailable v2 endpoint', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: '<!doctype html><title>FishNote</title>' })
      .mockResolvedValueOnce({ data: [summary] });

    await expect(getFishList()).resolves.toEqual([summary]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('uses v2 detail but preserves a non-transient client error instead of masking it', async () => {
    const detail = { ...summary, nameEn: null, images: [], tasteDesc: null, ratingDistribution: {}, tips: [], similarFishes: [] } as unknown as FishDetail;
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: detail });

    await expect(getFishDetail('gwang-eo')).resolves.toEqual(detail);
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v2\/fish\/gwang-eo$/));

    get.mockReset().mockRejectedValueOnce(axiosError(400));
    await expect(getFishDetail('gwang-eo')).rejects.toMatchObject({ response: { status: 400 } });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reconstructs home from one v1 catalog request when the aggregate is disabled', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValueOnce({ data: [summary] });

    await expect(getHomeData(1)).resolves.toMatchObject({
      month: 1,
      seasonal: [summary],
      featured: [summary],
      catalog: [summary],
      facets: {
        taste: { '담백': 1 },
        season: { '1': 1 },
        priceLevel: { '2': 1 },
        category: { FISH: 1 },
      },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/fish', { params: { sort: 'popular' } });
  });
});

function axiosError(status: number) {
  return { isAxiosError: true, response: { status } };
}
