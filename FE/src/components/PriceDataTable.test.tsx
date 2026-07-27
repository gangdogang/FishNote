import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FishPriceTrendPoint } from '../types/fish';
import PriceDataTable from './PriceDataTable';

const points: FishPriceTrendPoint[] = [
  {
    observedDate: '2026-07-03',
    priceMinKrw: 20_000,
    avgPriceKrw: 23_000,
    priceMaxKrw: 26_000,
    observationCount: 5,
  },
  {
    observedDate: '2026-07-01',
    priceMinKrw: 10_000,
    avgPriceKrw: 12_000,
    priceMaxKrw: 14_000,
    observationCount: 3,
  },
];

describe('PriceDataTable', () => {
  it('caption과 column header를 제공하고 날짜 오름차순으로 원화·단위를 표시한다', () => {
    const originalOrder = points.map((point) => point.observedDate);
    const { container } = render(
      <PriceDataTable
        points={points}
        label="광어 최근 시세"
        currency="KRW"
        unit="kg"
        defaultOpen
      />,
    );

    const table = screen.getByRole('table', { name: '광어 최근 시세 가격 데이터 (원화/kg)' });
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '날짜',
      '최저',
      '평균',
      '최고',
      '관측 수',
    ]);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('2026. 7. 1.')).toHaveAttribute('datetime', '2026-07-01');
    expect(within(rows[0]).getByText('10,000원/kg')).toBeInTheDocument();
    expect(within(rows[0]).getByText('12,000원/kg')).toBeInTheDocument();
    expect(within(rows[0]).getByText('14,000원/kg')).toBeInTheDocument();
    expect(within(rows[0]).getByText('3건')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2026. 7. 3.')).toBeInTheDocument();
    expect(points.map((point) => point.observedDate)).toEqual(originalOrder);

    const scrollContainer = table.parentElement;
    expect(scrollContainer).toHaveClass('overflow-x-auto', 'max-w-full');
    expect(table).toHaveClass('min-w-[640px]');
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('native details/summary가 기본으로 닫혀 있고 키보드 focus와 native toggle을 제공한다', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PriceDataTable points={points} label="방어 시세" currency="KRW" />,
    );
    const details = container.querySelector('details');
    const summary = container.querySelector('summary');

    expect(details).not.toHaveAttribute('open');
    expect(summary?.tagName).toBe('SUMMARY');
    expect(summary).toHaveClass('min-h-11');
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(summary).toHaveAttribute('aria-controls');

    await user.tab();
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute('tabindex', '0');
    await user.click(summary!);
    expect(details).toHaveAttribute('open');
    expect(summary).toHaveAttribute('aria-expanded', 'true');
  });

  it('unit이 없으면 원화만 표시하고 빈 데이터는 명시적인 상태로 안내한다', () => {
    const { rerender } = render(
      <PriceDataTable
        points={[points[0]]}
        label="참돔 시세"
        currency="KRW"
        defaultOpen
      />,
    );

    expect(screen.getByText('20,000원')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '참돔 시세 가격 데이터 (원화)' })).toBeInTheDocument();

    rerender(
      <PriceDataTable
        points={[]}
        label="참돔 시세"
        currency="KRW"
        defaultOpen
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('표시할 가격 데이터가 아직 없어요.');
    expect(screen.getByText('0일')).toBeInTheDocument();
  });
});
