import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FishPriceObservation, FishPriceSummary, FishPriceTrendPoint } from '../types/fish';
import PriceSection from './PriceSection';

function point(date: string, average: number): FishPriceTrendPoint {
  return {
    observedDate: date,
    priceMinKrw: average - 1_000,
    priceMaxKrw: average + 1_000,
    avgPriceKrw: average,
    observationCount: 2,
  };
}

function observation(unit: string, minimum = 10_000, maximum = 20_000): FishPriceObservation {
  return {
    observedAt: '2026-07-20T00:00:00Z',
    priceMinKrw: minimum,
    priceMaxKrw: maximum,
    unit,
    origin: '국내산',
    sizeGrade: null,
    sourceLabel: '테스트 시세',
    shopName: null,
  };
}

const emptySummary: FishPriceSummary = {
  fishId: 1,
  days: 14,
  resolution: 'DAY',
  maxPoints: 30,
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

const summary: FishPriceSummary = {
  ...emptySummary,
  resolution: 'WEEK',
  maxPoints: 12,
  asOf: '2026-07-20T00:00:00Z',
  normalizedUnit: 'kg',
  sourceCount: 2,
  noDataReason: null,
  observationCount: 4,
  latest: observation('혼합'),
  recent: [observation('kg')],
  dailyAverage: [point('2026-07-01', 11_000)],
  byVariant: [
    {
      variantKey: 'kg',
      variantLabel: '국내산 양식',
      farming: '양식',
      origin: '국내산',
      unit: 'kg',
      observationCount: 2,
      latest: observation('kg', 12_000, 18_000),
      graph: [point('2026-07-01', 15_000), point('2026-07-02', 16_000)],
    },
    {
      variantKey: 'piece',
      variantLabel: '자연산 대형',
      farming: '자연산',
      origin: '국내산',
      unit: '마리',
      observationCount: 2,
      latest: observation('마리', 70_000, 90_000),
      graph: [point('2026-07-01', 80_000)],
    },
  ],
};

describe('PriceSection', () => {
  it('초기 loading/error는 복구 UI를 주고 success-empty는 섹션을 렌더하지 않는다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <PriceSection fishName="광어" isLoading isError={false} onRetry={onRetry} />,
    );
    expect(screen.getByRole('status', { name: '가격 정보를 불러오는 중' })).toBeInTheDocument();

    rerender(<PriceSection fishName="광어" isLoading={false} isError onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '가격 다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();

    // 성공 응답인데 관측 0건이면 빈 선반 대신 섹션 자체를 접는다 (docs/15 M1)
    rerender(
      <PriceSection fishName="광어" summary={emptySummary} isLoading={false} isError={false} onRetry={onRetry} />,
    );
    expect(screen.queryByText('가격 현황')).not.toBeInTheDocument();
    expect(screen.queryByText('최근 14일 범위에는 수집된 시세가 없습니다')).not.toBeInTheDocument();
  });

  it('가격 freshness 메타를 표시하고, empty summary는 stale(refetch 실패)에서만 사유를 노출한다', () => {
    const { rerender } = render(
      <PriceSection fishName="광어" summary={summary} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );

    const freshness = screen.getByLabelText('가격 데이터 기준');
    expect(within(freshness).getByText('주별 최대 12개 지점')).toBeInTheDocument();
    expect(within(freshness).getByText('출처 2곳')).toBeInTheDocument();
    expect(within(freshness).getByText('KRW / kg')).toBeInTheDocument();
    expect(freshness.querySelector('time')).toHaveAttribute('datetime', '2026-07-20T00:00:00Z');

    const variantEmptySummary = {
      ...emptySummary,
      variantKey: '양식|제주|kg',
      noDataReason: 'VARIANT_NOT_FOUND',
    } as const;

    // 성공 응답이면 variant no-data도 섹션을 렌더하지 않는다
    rerender(
      <PriceSection fishName="광어" summary={variantEmptySummary} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.queryByText('가격 현황')).not.toBeInTheDocument();

    // cached empty summary에서 refetch가 실패하면 복구 UI를 위해 섹션과 사유를 유지한다
    rerender(
      <PriceSection fishName="광어" summary={variantEmptySummary} isLoading={false} isError onRetry={vi.fn()} />,
    );
    expect(screen.getByText('선택 규격 양식 · 제주 · kg')).toBeInTheDocument();
    expect(screen.getByText('선택한 규격(양식 · 제주 · kg)과 일치하는 시세가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('최근 14일 범위에는 수집된 시세가 없습니다')).not.toBeInTheDocument();
  });

  it('query가 데이터 없이 idle로 끝나도 제목만 남기지 않고 복구 동작을 제공한다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <PriceSection fishName="광어" isLoading={false} isError={false} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('가격 정보를 불러오지 못했어요.');
    await user.click(screen.getByRole('button', { name: '가격 다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('서로 다른 단위 variant를 한 번에 하나만 차트와 표에 전달한다', async () => {
    const user = userEvent.setup();
    render(
      <PriceSection fishName="광어" summary={summary} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );

    const group = screen.getByRole('group', { name: '가격 규격 선택' });
    const kg = within(group).getByRole('button', { name: '국내산 양식 · kg' });
    const piece = within(group).getByRole('button', { name: '자연산 대형 · 마리' });
    expect(kg).toHaveClass('min-h-11', 'min-w-11');
    expect(piece).toHaveClass('min-h-11', 'min-w-11');
    expect(kg).toHaveAttribute('aria-pressed', 'true');
    expect(piece).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /전체|일별 평균/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img').querySelector('title')).toHaveTextContent('광어 국내산 양식 · kg 가격 추이');

    await user.click(piece);
    expect(piece).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img').querySelector('title')).toHaveTextContent('광어 자연산 대형 · 마리 가격 추이');
    await user.click(screen.getByText('광어 자연산 대형 · 마리 표로 보기'));
    expect(screen.getByRole('table')).toHaveAccessibleName('광어 자연산 대형 · 마리 가격 데이터 (원화/마리)');
    expect(screen.getByText('79,000원/마리')).toBeInTheDocument();
  });

  it('선택 key가 refetch에서 사라지면 첫 유효 variant로 복구한다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PriceSection fishName="광어" summary={summary} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: '자연산 대형 · 마리' }));

    const nextSummary = { ...summary, byVariant: [summary.byVariant[0]] };
    rerender(
      <PriceSection fishName="광어" summary={nextSummary} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('img').querySelector('title')).toHaveTextContent('광어 국내산 양식 · kg 가격 추이');
  });

  it('cached data 갱신 실패에는 데이터를 유지하고 중복 retry를 막는다', () => {
    render(
      <PriceSection
        fishName="광어"
        summary={summary}
        isLoading={false}
        isFetching
        isError
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('이전 내용을 보여드려요');
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 불러오는 중...' })).toBeDisabled();
  });
});
