import { describe, expect, it } from 'vitest';
import { rankRecommendations } from './recommendation';
import type { FishSummary } from '../types/fish';

const base: Omit<FishSummary, 'id' | 'name' | 'tasteTags' | 'seasonMonths' | 'priceLevel' | 'featured'> = {
  imageUrl: null,
  description: null,
  avgRating: 0,
  reviewCount: 0,
};

function fish(overrides: Partial<FishSummary> & Pick<FishSummary, 'id' | 'name'>): FishSummary {
  return {
    ...base,
    tasteTags: [],
    seasonMonths: [],
    priceLevel: null,
    featured: false,
    ...overrides,
  };
}

describe('rankRecommendations', () => {
  it('취향·가격·제철이 모두 맞는 횟감을 가장 먼저 추천한다', () => {
    const fishes = [
      fish({ id: 1, name: '광어', tasteTags: ['담백'], seasonMonths: [8], priceLevel: 1, featured: true }),
      fish({ id: 2, name: '방어', tasteTags: ['고소'], seasonMonths: [12], priceLevel: 3 }),
      fish({ id: 3, name: '농어', tasteTags: ['담백'], seasonMonths: [8], priceLevel: 2 }),
    ];

    const [first] = rankRecommendations(fishes, { taste: '담백', budget: 2, occasion: 'SEASONAL' }, 8);

    expect(first.fish.name).toBe('농어');
    expect(first.reasons).toEqual(expect.arrayContaining(['8월 제철', '담백한 맛', '원하는 가격대']));
  });

  it('처음 먹는 조건에서는 featured 횟감을 우선한다', () => {
    const fishes = [
      fish({ id: 1, name: '광어', featured: true, priceLevel: 1 }),
      fish({ id: 2, name: '돌돔', featured: false, priceLevel: 3, avgRating: 5 }),
    ];

    expect(rankRecommendations(fishes, { taste: 'ANY', budget: 'ANY', occasion: 'BEGINNER' }, 8)[0].fish.name)
      .toBe('광어');
  });
});
