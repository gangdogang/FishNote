import { describe, expect, it } from 'vitest';
import { normalizePriceTrendPoints } from '../lib/priceTrend';
import type { FishPriceTrendPoint } from '../types/fish';

const basePoint: FishPriceTrendPoint = {
  observedDate: '2026-07-02',
  priceMinKrw: 10_000,
  priceMaxKrw: 20_000,
  avgPriceKrw: 15_000,
  observationCount: 2,
};

describe('normalizePriceTrendPoints', () => {
  it('날짜를 정규화·정렬하고 역전 범위와 관측 수를 교정하되 입력은 변경하지 않는다', () => {
    const input = [
      { ...basePoint, observedDate: ' 2026-07-03 ', priceMinKrw: 30_000, priceMaxKrw: 10_000, avgPriceKrw: 40_000, observationCount: -2 },
      { ...basePoint, observedDate: '2026-07-01' },
    ];
    const snapshot = structuredClone(input);

    const result = normalizePriceTrendPoints(input);

    expect(result.map((point) => point.observedDate)).toEqual(['2026-07-01', '2026-07-03']);
    expect(result[1]).toMatchObject({
      priceMinKrw: 10_000,
      avgPriceKrw: 30_000,
      priceMaxKrw: 30_000,
      observationCount: 0,
    });
    expect(input).toEqual(snapshot);
  });

  it('유효한 경계에서 평균을 안전하게 만들고 잘못된 날짜·가격 행은 제거한다', () => {
    const result = normalizePriceTrendPoints([
      { ...basePoint, avgPriceKrw: Number.NaN },
      { ...basePoint, observedDate: '2026-02-30' },
      {
        ...basePoint,
        observedDate: '2026-07-04',
        priceMinKrw: Number.NaN,
        priceMaxKrw: Number.POSITIVE_INFINITY,
        avgPriceKrw: Number.NEGATIVE_INFINITY,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].avgPriceKrw).toBe(15_000);
  });
});
