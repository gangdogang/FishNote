import { describe, expect, it } from 'vitest';
import type { FishCatalogPage, FishSummary } from '../types/fish';
import { mergeFishCatalogPages } from './catalogPagination';

const facets = { taste: {}, season: {}, priceLevel: {}, category: {} };

function fish(id: number): FishSummary {
  return {
    id,
    name: `횟감 ${id}`,
    imageUrl: null,
    description: null,
    priceLevel: null,
    tasteTags: [],
    seasonMonths: [],
    featured: false,
    avgRating: 0,
    reviewCount: 0,
  };
}

function page(items: FishSummary[], hasNext: boolean): FishCatalogPage {
  return {
    items,
    facets,
    pageInfo: {
      nextCursor: hasNext ? 'next' : null,
      hasNext,
      limit: 24,
    },
  };
}

describe('mergeFishCatalogPages', () => {
  it('cursor 페이지 순서를 유지하면서 경계에서 중복된 횟감을 한 번만 남긴다', () => {
    expect(mergeFishCatalogPages([
      page([fish(1), fish(2)], true),
      page([fish(2), fish(3)], false),
    ]).map(({ id }) => id)).toEqual([1, 2, 3]);
  });
});
