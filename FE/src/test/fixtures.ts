import type { FishSummary } from '../types/fish';

export const fishFixture: FishSummary = {
  id: 1,
  slug: 'gwangeo',
  category: 'FISH',
  name: '광어',
  imageUrl: '/fish/gwangeo.jpg',
  description: '담백하고 쫄깃한 입문용 횟감',
  priceLevel: 2,
  tasteTags: ['담백한', '쫄깃한'],
  seasonMonths: [3, 4, 5],
  featured: true,
  avgRating: 4.5,
  reviewCount: 12,
};
