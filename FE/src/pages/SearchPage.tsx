import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chipClass } from '../components/FilterChips';
import FishCard from '../components/FishCard';
import FishPlaceholder from '../components/FishPlaceholder';
import StateText from '../components/StateText';
import { useFishList } from '../hooks/useFish';
import { SEASONS, TASTE_TAGS } from '../lib/filters';
import { formatPriceLevel } from '../lib/format';
import type { FishSort, Season } from '../types/fish';

const months = Array.from({ length: 12 }, (_, index) => index + 1);

const priceLevels = [
  { value: 1, label: formatPriceLevel(1, { withLabel: true }) },
  { value: 2, label: formatPriceLevel(2, { withLabel: true }) },
  { value: 3, label: formatPriceLevel(3, { withLabel: true }) },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(
    () => ({
      search: searchParams.get('search') || undefined,
      season: (searchParams.get('season') || undefined) as Season | undefined,
      taste: searchParams.get('taste') || undefined,
      month: searchParams.get('month') ? Number(searchParams.get('month')) : undefined,
      priceLevel: searchParams.get('priceLevel') ? Number(searchParams.get('priceLevel')) : undefined,
      sort: ((searchParams.get('sort') || 'popular') as FishSort),
    }),
    [searchParams],
  );
  const { data: fishes = [], isLoading, isError } = useFishList(params);
  const activeFilterPills = [
    params.search ? { key: 'search', label: params.search } : undefined,
    params.season ? { key: 'season', label: SEASONS.find((season) => season.value === params.season)?.label ?? params.season } : undefined,
    params.taste ? { key: 'taste', label: params.taste } : undefined,
    params.month ? { key: 'month', label: `${params.month}월 제철` } : undefined,
    params.priceLevel ? { key: 'priceLevel', label: priceLevels.find((price) => price.value === params.priceLevel)?.label ?? String(params.priceLevel) } : undefined,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  function update(next: Record<string, string | number | undefined>) {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        merged.delete(key);
      } else {
        merged.set(key, String(value));
      }
    });
    setSearchParams(merged);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-20 pt-8 sm:px-7">
      <h1 className="mb-[22px] text-2xl font-bold tracking-[-0.025em] text-ink">검색</h1>

      <div className="flex flex-wrap items-start gap-8">
        <aside className="w-full flex-none rounded-card border border-line bg-white px-[22px] py-5 lg:sticky lg:top-[90px] lg:w-60">
          <div className="mb-[18px] flex items-center justify-between">
            <span className="text-[15px] font-bold text-ink">필터</span>
            <button type="button" onClick={resetFilters} className="text-[12.5px] font-semibold text-sea transition hover:text-sea">
              초기화
            </button>
          </div>

          <FilterGroup label="제철">
            {SEASONS.map((season) => (
              <FilterChip
                key={season.value}
                active={params.season === season.value}
                onClick={() => update({ season: params.season === season.value ? undefined : season.value, month: undefined })}
              >
                {season.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="제철 달">
            {months.map((month) => (
              <FilterChip
                key={month}
                active={params.month === month}
                onClick={() => update({ month: params.month === month ? undefined : month, season: undefined })}
              >
                {month}월
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="맛">
            {TASTE_TAGS.map((taste) => (
              <FilterChip key={taste} active={params.taste === taste} onClick={() => update({ taste: params.taste === taste ? undefined : taste })}>
                {taste}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="가격대" className="mb-0">
            {priceLevels.map((price) => (
              <FilterChip
                key={price.value}
                active={params.priceLevel === price.value}
                onClick={() => update({ priceLevel: params.priceLevel === price.value ? undefined : price.value })}
              >
                {price.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </aside>

        <section className="min-w-[280px] flex-1">
          <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[15px] text-ink-mute">
              {params.search ? <b className="font-bold text-ink">'{params.search}'</b> : null}
              {params.search ? ' ' : null}
              검색 결과 <b className="font-bold text-ink">{isLoading ? '-' : fishes.length}</b>건
            </span>
            <select
              value={params.sort}
              onChange={(event) => update({ sort: event.target.value as FishSort })}
              className="h-10 w-fit rounded-[10px] border border-line bg-white px-[13px] text-sm text-ink outline-none transition hover:border-sea focus:border-sea"
            >
              <option value="popular">인기순</option>
              <option value="name">이름순</option>
            </select>
          </div>

          {activeFilterPills.length > 0 ? (
            <div className="mb-5 flex flex-wrap gap-[7px]">
              {activeFilterPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => update({ [pill.key]: undefined })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sea-soft px-3 py-1.5 text-[13px] font-semibold text-sea transition hover:bg-sea-soft"
                >
                  {pill.label}
                  <span className="text-sm leading-none" aria-hidden>
                    ×
                  </span>
                  <span className="sr-only">필터 제거</span>
                </button>
              ))}
            </div>
          ) : null}

          {isLoading ? <StateText text="검색 중입니다." /> : null}
          {isError ? <StateText text="검색 결과를 불러오지 못했습니다." /> : null}
          {!isLoading && !isError && fishes.length === 0 ? <EmptyState onReset={resetFilters} /> : null}
          {!isLoading && !isError && fishes.length > 0 ? (
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
              {fishes.map((fish) => (
                <FishCard key={fish.id} fish={fish} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function FilterGroup({ label, children, className = 'mb-5' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2.5 text-[12.5px] font-semibold text-ink-mute/70">{label}</div>
      <div className="flex flex-wrap gap-[7px]">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={chipClass(active)}>
      {children}
      {active ? <span aria-hidden>✕</span> : null}
    </button>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[72px] text-center">
      <div className="mx-auto mb-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-chipbg">
        <FishPlaceholder className="h-[29px] w-[46px] stroke-ink-mute/40" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-ink">검색 결과가 없어요</h3>
      <p className="mb-5 text-[14.5px] leading-[1.5] text-ink-mute">
        검색어나 필터를 바꿔보세요.
        <br />
        예: <b className="font-bold text-ink">광어, 방어, 연어</b>
      </p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-[10px] border border-sea bg-white px-[22px] py-[11px] text-sm font-semibold text-sea transition hover:bg-sea-soft"
      >
        필터 초기화
      </button>
    </div>
  );
}
