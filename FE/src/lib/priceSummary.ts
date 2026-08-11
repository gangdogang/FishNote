import { normalizePriceTrendPoints } from './priceTrend';
import type { FishPriceSummary } from '../types/fish';

export function hasCollectedPrices(summary: FishPriceSummary | undefined): boolean {
  if (!summary) return false;
  return (
    summary.observationCount > 0
    || Boolean(summary.latest)
    || summary.recent.length > 0
    || summary.byShop.length > 0
    || normalizePriceTrendPoints(summary.dailyAverage ?? []).length > 0
    || (summary.byVariant ?? []).some((variant) => normalizePriceTrendPoints(variant.graph ?? []).length > 0)
  );
}

// 성공 응답인데 관측이 0건인 어종은 상세에서 가격 섹션·탭을 통째로 숨긴다.
// 로딩·오류·stale(refetch 실패) 상태는 기존 복구 UI를 유지해야 하므로 숨기지 않는다.
export function shouldHidePriceSection(summary: FishPriceSummary | undefined, isError: boolean): boolean {
  return Boolean(summary) && !isError && !hasCollectedPrices(summary);
}
