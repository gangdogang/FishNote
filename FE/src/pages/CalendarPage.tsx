import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router';
import FishCard from '../components/FishCard';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useFishList } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';

const months = Array.from({ length: 12 }, (_, index) => index + 1);

export default function CalendarPage() {
  usePageMeta('제철 캘린더', '월별로 지금 제철인 회를 한눈에 확인해보세요.');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const currentMonth = new Date().getMonth() + 1;
  const activeMonthRef = useRef<HTMLButtonElement>(null);
  const {
    data: monthFishes = [],
    isLoading: isMonthLoading,
    isFetching: isMonthFetching,
    isPlaceholderData: isMonthPlaceholderData,
    isError: isMonthError,
    refetch: refetchMonth,
  } = useFishList({ month: selectedMonth, sort: 'popular' });
  const {
    data: allFishes = [],
    isLoading: isCountsLoading,
    isError: isCountsError,
    refetch: refetchCounts,
  } = useFishList({ sort: 'popular' });

  const monthCounts = useMemo(
    () =>
      months.reduce<Record<number, number>>((counts, month) => {
        counts[month] = allFishes.filter((fish) => fish.seasonMonths.includes(month)).length;
        return counts;
      }, {}),
    [allFishes],
  );

  useLayoutEffect(() => {
    activeMonthRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selectedMonth]);

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-9 sm:px-7">
      <h1 className="mb-2 text-30 font-bold tracking-[-0.03em] text-ink">제철 캘린더</h1>
      <p className="mb-[26px] text-[15.5px] leading-[1.5] text-ink-mute">달을 선택하면 그 달에 제철인 회를 모아 보여드려요.</p>

      <aside
        aria-label="제철 표시 기준"
        className="mb-7 flex items-start gap-3 rounded-[14px] bg-accent-soft/[0.62] px-4 py-3.5 text-body-sm text-ink"
      >
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-surface text-accent shadow-[0_4px_12px_rgba(10,40,54,0.08)]">
          <Info className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-pretty leading-[1.6]">
            <strong className="font-bold">대표 제철 기준</strong>
            <span className="text-ink-mute"> · 자연산 중심의 대표 월이며, 양식·수입종은 연중으로 표시될 수 있어요.</span>
          </p>
          <Link
            to="/sources"
            className="mt-1 inline-flex min-h-11 items-center font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            근거와 검수 방식 보기 →
          </Link>
        </div>
      </aside>

      <div className="-mx-4 mb-8 snap-x snap-mandatory overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        <div
          className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-12 lg:gap-1.75"
          role="group"
          aria-label="월 선택"
        >
          <span
            aria-hidden="true"
            className="w-[calc(50vw-53px)] flex-none sm:w-[calc(50vw-65px)] lg:hidden"
            data-month-rail-spacer
          />
          {months.map((month) => {
            const active = selectedMonth === month;
            const current = currentMonth === month;
            const count = isCountsLoading || isCountsError ? '-' : monthCounts[month] ?? 0;

            return (
              <button
                key={month}
                ref={active ? activeMonthRef : undefined}
                type="button"
                onClick={() => setSelectedMonth(month)}
                className={[
                  'calendar-month-button flex h-[58px] min-h-11 w-[74px] min-w-11 flex-none flex-col items-center justify-center rounded-[12px] border px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 lg:w-auto',
                  active
                    ? 'border-transparent bg-primary text-on-primary'
                    : 'border-line/80 bg-surface text-ink hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent motion-reduce:transform-none',
                ].join(' ')}
                aria-current={active ? 'date' : undefined}
                aria-pressed={active}
              >
                <span className="text-14 font-bold leading-[1.15]">{month}월</span>
                <span className={active ? 'mt-1 text-caption font-semibold leading-none text-on-primary' : 'mt-1 text-caption font-semibold leading-none text-ink-mute'}>
                  {current ? `지금 · ${count}종` : `${count}종`}
                </span>
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="w-[calc(50vw-53px)] flex-none sm:w-[calc(50vw-65px)] lg:hidden"
            data-month-rail-spacer
          />
        </div>
      </div>

      <h2 className="mb-5 text-[22px] font-bold tracking-[-0.02em] text-ink">
        {selectedMonth}월 제철 <span className="text-17 font-medium text-ink-mute">· {isMonthLoading || isMonthError || isMonthPlaceholderData ? '-' : monthFishes.length}종</span>
      </h2>

      {isMonthLoading ? (
        <SkeletonCards count={4} className="grid gap-5.5 [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]" />
      ) : null}
      {isMonthError ? (
        <ErrorState onRetry={() => void Promise.all([refetchMonth(), refetchCounts()])} />
      ) : null}
      {isMonthFetching && !isMonthLoading ? (
        <p role="status" aria-live="polite" className="m-0 mb-3 text-body-sm text-ink-mute">
          {selectedMonth}월 제철 목록을 업데이트하는 중...
        </p>
      ) : null}
      {!isMonthLoading && !isMonthError && monthFishes.length === 0 ? <EmptyState /> : null}
      {!isMonthLoading && !isMonthError && monthFishes.length > 0 ? (
        <div
          key={selectedMonth}
          aria-busy={isMonthFetching}
          className={[
            'season-results-enter grid gap-5.5 transition-opacity [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))] motion-reduce:transition-none',
            isMonthPlaceholderData ? 'opacity-[0.55]' : 'opacity-100',
          ].join(' ')}
        >
          {monthFishes.map((fish, index) => (
            <FishCard key={fish.id} fish={fish} analyticsSection="calendar_month" analyticsPosition={index + 1} sort="popular" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[60px] text-center">
      <p className="m-0 text-14.5 text-ink-mute">이 달에 등록된 제철 회가 아직 없어요.</p>
    </div>
  );
}
