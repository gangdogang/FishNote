import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { normalizePriceTrendPoints } from '../lib/priceTrend';
import type { FishPriceTrendPoint } from '../types/fish';

export interface PriceDataTableProps {
  points: FishPriceTrendPoint[];
  label: string;
  currency: 'KRW';
  unit?: string | null;
  defaultOpen?: boolean;
}

export default function PriceDataTable({
  points,
  label,
  currency,
  unit,
  defaultOpen = false,
}: PriceDataTableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const generatedId = useId().replace(/:/g, '');
  const contentId = `${generatedId}-price-table-content`;
  const sortedPoints = normalizePriceTrendPoints(points);
  const normalizedUnit = unit?.trim() || null;
  const tableLabel = `${label} 가격 데이터 (${currency === 'KRW' ? '원화' : currency}${normalizedUnit ? `/${normalizedUnit}` : ''})`;

  return (
    <details
      open={open}
      onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
      className="group overflow-hidden rounded-card border border-line bg-surface"
    >
      <summary
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-body-sm font-bold text-ink transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0 flex-1">{label} 표로 보기</span>
        <span className="flex-none text-caption font-semibold tabular-nums text-ink-mute">
          {formatCount(sortedPoints.length)}일
        </span>
        <ChevronDown
          className="h-4 w-4 flex-none text-ink-mute transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div id={contentId} className="border-t border-line">
        {sortedPoints.length === 0 ? (
          <p role="status" className="m-0 px-4 py-6 text-center text-body-sm text-ink-mute">
            표시할 가격 데이터가 아직 없어요.
          </p>
        ) : (
          <div
            className="max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            role="region"
            aria-label={`${label} 가격 표`}
            tabIndex={0}
          >
            <table className="min-w-[640px] w-full border-collapse text-left text-body-sm tabular-nums text-ink">
              <caption className="sr-only">{tableLabel}</caption>
              <thead className="bg-mist text-ink-mute">
                <tr>
                  <ColumnHeader>날짜</ColumnHeader>
                  <ColumnHeader align="right">최저</ColumnHeader>
                  <ColumnHeader align="right">평균</ColumnHeader>
                  <ColumnHeader align="right">최고</ColumnHeader>
                  <ColumnHeader align="right">관측 수</ColumnHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sortedPoints.map((point, index) => (
                  <tr key={`${point.observedDate}-${index}`}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      <time dateTime={point.observedDate}>{formatObservedDate(point.observedDate)}</time>
                    </th>
                    <PriceCell value={point.priceMinKrw} unit={normalizedUnit} />
                    <PriceCell value={point.avgPriceKrw} unit={normalizedUnit} />
                    <PriceCell value={point.priceMaxKrw} unit={normalizedUnit} />
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-mute">
                      {formatObservationCount(point.observationCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

function ColumnHeader({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={[
        'whitespace-nowrap px-4 py-3 text-caption font-bold',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  );
}

function PriceCell({ value, unit }: { value: number; unit: string | null }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
      {formatKrw(value, unit)}
    </td>
  );
}

function formatObservedDate(value: string) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!dateParts) return value;

  const [, year, month, day] = dateParts;
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

function formatKrw(value: number, unit: string | null) {
  if (!Number.isFinite(value)) return '-';
  const amount = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(value));
  return `${amount}원${unit ? `/${unit}` : ''}`;
}

function formatObservationCount(value: number) {
  if (!Number.isFinite(value)) return '-';
  return `${formatCount(Math.max(0, Math.trunc(value)))}건`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
}
