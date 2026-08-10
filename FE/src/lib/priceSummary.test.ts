import { describe, expect, it } from 'vitest';
import { hasCollectedPrices, shouldHidePriceSection } from './priceSummary';
import type { FishPriceObservation, FishPriceSummary } from '../types/fish';

const emptySummary: FishPriceSummary = {
  fishId: 1,
  days: 14,
  variantKey: null,
  asOf: null,
  currency: 'KRW',
  normalizedUnit: null,
  sourceCount: 0,
  noDataReason: 'NO_OBSERVATIONS_IN_RANGE',
  observationCount: 0,
  latest: null,
  recent: [],
  dailyAverage: [],
  byShop: [],
  byVariant: [],
};

const observation: FishPriceObservation = {
  observedAt: '2026-07-20T00:00:00Z',
  priceMinKrw: 10_000,
  priceMaxKrw: 20_000,
  unit: 'kg',
  origin: '국내산',
  sizeGrade: null,
  sourceLabel: '테스트 시세',
  shopName: null,
};

describe('hasCollectedPrices', () => {
  it('summary가 없거나 모든 컬렉션이 비면 false', () => {
    expect(hasCollectedPrices(undefined)).toBe(false);
    expect(hasCollectedPrices(emptySummary)).toBe(false);
  });

  it('관측·최근값·그래프 중 하나라도 있으면 true', () => {
    expect(hasCollectedPrices({ ...emptySummary, observationCount: 3 })).toBe(true);
    expect(hasCollectedPrices({ ...emptySummary, latest: observation })).toBe(true);
    expect(hasCollectedPrices({
      ...emptySummary,
      dailyAverage: [{ observedDate: '2026-07-01', priceMinKrw: 9_000, priceMaxKrw: 11_000, avgPriceKrw: 10_000, observationCount: 2 }],
    })).toBe(true);
  });

  it('유효하지 않은 그래프 지점만 있는 경우는 수집으로 치지 않는다', () => {
    expect(hasCollectedPrices({
      ...emptySummary,
      dailyAverage: [{ observedDate: 'invalid', priceMinKrw: Number.NaN, priceMaxKrw: Number.NaN, avgPriceKrw: Number.NaN, observationCount: 0 }],
    })).toBe(false);
  });
});

describe('shouldHidePriceSection', () => {
  it('성공 응답인데 관측 0건일 때만 숨긴다', () => {
    expect(shouldHidePriceSection(emptySummary, false)).toBe(true);
    expect(shouldHidePriceSection({ ...emptySummary, latest: observation }, false)).toBe(false);
  });

  it('로딩 중(summary 없음)·refetch 실패 상태는 복구 UI를 위해 숨기지 않는다', () => {
    expect(shouldHidePriceSection(undefined, false)).toBe(false);
    expect(shouldHidePriceSection(emptySummary, true)).toBe(false);
  });
});
