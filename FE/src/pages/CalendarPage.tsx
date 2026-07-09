import { useMemo, useState } from 'react';
import FishCard from '../components/FishCard';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useFishList } from '../hooks/useFish';

const months = Array.from({ length: 12 }, (_, index) => index + 1);

export default function CalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const currentMonth = new Date().getMonth() + 1;
  const {
    data: monthFishes = [],
    isLoading: isMonthLoading,
    isError: isMonthError,
  } = useFishList({ month: selectedMonth, sort: 'popular' });
  const {
    data: allFishes = [],
    isLoading: isCountsLoading,
    isError: isCountsError,
  } = useFishList({ sort: 'popular' });

  const monthCounts = useMemo(
    () =>
      months.reduce<Record<number, number>>((counts, month) => {
        counts[month] = allFishes.filter((fish) => fish.seasonMonths.includes(month)).length;
        return counts;
      }, {}),
    [allFishes],
  );

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-20 pt-9 sm:px-7">
      <h1 className="mb-2 text-[30px] font-bold tracking-[-0.03em] text-ink">제철 캘린더</h1>
      <p className="mb-[26px] text-[15.5px] leading-[1.5] text-ink-mute">달을 선택하면 그 달에 제철인 회를 모아 보여드려요.</p>

      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:-mx-7 sm:px-7 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-12 lg:gap-[7px]">
          {months.map((month) => {
            const active = selectedMonth === month;
            const current = currentMonth === month;
            const count = isCountsLoading || isCountsError ? '-' : monthCounts[month] ?? 0;

            return (
              <button
                key={month}
                type="button"
                onClick={() => setSelectedMonth(month)}
                className={
                  active
                    ? 'flex h-[58px] w-[74px] flex-none flex-col items-center justify-center rounded-[11px] border border-transparent bg-sea px-2 text-white transition lg:w-auto'
                    : 'flex h-[58px] w-[74px] flex-none flex-col items-center justify-center rounded-[11px] border border-line bg-white px-2 text-ink transition hover:border-sea hover:text-sea lg:w-auto'
                }
                aria-pressed={active}
              >
                <span className="text-[14px] font-bold leading-[1.15]">{month}월</span>
                <span className={active ? 'mt-1 text-[11px] font-semibold leading-none text-white/85' : 'mt-1 text-[11px] font-semibold leading-none text-ink-mute/70'}>
                  {current ? `지금 · ${count}종` : `${count}종`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mb-5 text-[22px] font-bold tracking-[-0.02em] text-ink">
        {selectedMonth}월 제철 <span className="text-[17px] font-medium text-ink-mute/70">· {isMonthLoading || isMonthError ? '-' : monthFishes.length}종</span>
      </h2>

      {isMonthLoading ? (
        <SkeletonCards count={4} className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]" />
      ) : null}
      {isMonthError ? <ErrorState /> : null}
      {!isMonthLoading && !isMonthError && monthFishes.length === 0 ? <EmptyState /> : null}
      {!isMonthLoading && !isMonthError && monthFishes.length > 0 ? (
        <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]">
          {monthFishes.map((fish) => (
            <FishCard key={fish.id} fish={fish} />
          ))}
        </div>
      ) : null}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[60px] text-center">
      <p className="m-0 text-[14.5px] text-ink-mute">이 달에 등록된 제철 회가 아직 없어요.</p>
    </div>
  );
}
