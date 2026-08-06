import type { FishSummary } from '../types/fish';

export type RecommendationTaste = 'ANY' | '담백' | '고소' | '쫄깃' | '부드러운';
export type RecommendationBudget = 'ANY' | 1 | 2 | 3;
export type RecommendationOccasion = 'ANY' | 'BEGINNER' | 'SEASONAL' | 'ADVENTURE';

export interface RecommendationPreferences {
  taste: RecommendationTaste;
  budget: RecommendationBudget;
  occasion: RecommendationOccasion;
}

export interface RankedRecommendation {
  fish: FishSummary;
  score: number;
  reasons: string[];
}

export function rankRecommendations(
  fishes: FishSummary[],
  preferences: RecommendationPreferences,
  currentMonth: number,
  limit = 3,
): RankedRecommendation[] {
  return fishes
    .map((fish) => scoreFish(fish, preferences, currentMonth))
    .sort((left, right) => right.score - left.score
      || right.fish.avgRating - left.fish.avgRating
      || left.fish.name.localeCompare(right.fish.name, 'ko'))
    .slice(0, limit);
}

function scoreFish(
  fish: FishSummary,
  preferences: RecommendationPreferences,
  currentMonth: number,
): RankedRecommendation {
  let score = 0;
  const reasons: string[] = [];
  const inSeason = fish.seasonMonths.includes(currentMonth);

  if (inSeason) {
    score += preferences.occasion === 'SEASONAL' ? 8 : 3;
    reasons.push(`${currentMonth}월 제철`);
  }

  if (preferences.taste !== 'ANY' && fish.tasteTags.includes(preferences.taste)) {
    score += 6;
    reasons.push(`${preferences.taste}한 맛`);
  }

  if (preferences.budget !== 'ANY' && fish.priceLevel !== null) {
    const distance = Math.abs(fish.priceLevel - preferences.budget);
    if (distance === 0) {
      score += 5;
      reasons.push('원하는 가격대');
    } else if (distance === 1) {
      score += 1;
    }
  }

  if (preferences.occasion === 'BEGINNER') {
    if (fish.featured) {
      score += 5;
      reasons.push('처음 먹기 좋은 선택');
    }
    if (fish.priceLevel !== null && fish.priceLevel <= 2) score += 1;
  }

  if (preferences.occasion === 'ADVENTURE') {
    if (!fish.featured) score += 2;
    if (fish.tasteTags.includes('고급') || fish.priceLevel === 3) {
      score += 2;
      reasons.push('새롭게 도전할 별미');
    }
  }

  if (preferences.occasion === 'SEASONAL' && !inSeason) score -= 3;
  score += Math.min(fish.avgRating, 5) * 0.35;
  score += Math.min(fish.reviewCount, 20) * 0.02;

  if (reasons.length === 0) reasons.push('취향에 가까운 균형 잡힌 선택');
  return { fish, score, reasons: reasons.slice(0, 3) };
}
