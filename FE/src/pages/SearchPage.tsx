import { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { chipClass } from '../lib/uiClasses';
import AppliedFilterBar, { type AppliedFilterPill } from '../components/AppliedFilterBar';
import FilterPanel from '../components/FilterPanel';
import FilterSheet from '../components/FilterSheet';
import FishCard from '../components/FishCard';
import FishPlaceholder from '../components/FishPlaceholder';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import SortSegment from '../components/SortSegment';
import { useFishList, useInfiniteFishList } from '../hooks/useFish';
import { SEASONS, TASTE_TAGS } from '../lib/filters';
import { formatPriceLevel } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackAnalyticsEvent } from '../lib/analytics';
import { mergeFishCatalogPages } from '../lib/catalogPagination';
import type { FishListParams, FishSort, Season } from '../types/fish';
import type { SearchFilterValues } from '../types/search';

const FILTER_KEYS = ['season', 'month', 'taste', 'priceLevel'] as const;

interface SearchViewParams extends SearchFilterValues {
  search?: string;
  sort: FishSort;
}

export default function SearchPage() {
  usePageMeta('검색', '제철·맛·가격 필터로 원하는 회를 찾아보세요.', null, { noindex: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const canonicalSearchParams = useMemo(() => serializeSearchParams(params), [params]);
  const committedFilters = useMemo(() => pickFilters(params), [params]);
  const searchParamsKey = searchParams.toString();
  const canonicalSearchParamsKey = canonicalSearchParams.toString();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<SearchFilterValues>({});
  const [draftSource, setDraftSource] = useState('');
  const lastTrackedResultsKey = useRef<string | null>(null);
  const effectiveDraftFilters = draftSource === searchParamsKey ? draftFilters : committedFilters;
  const {
    data: catalogData,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteFishList(params);
  const fishes = useMemo(
    () => mergeFishCatalogPages(catalogData?.pages ?? []),
    [catalogData],
  );
  const catalogFacets = catalogData?.pages[0]?.facets;
  const isInitialError = isError && fishes.length === 0;
  const draftQueryParams = useMemo<FishListParams>(
    () => ({ search: params.search, sort: params.sort, ...effectiveDraftFilters }),
    [effectiveDraftFilters, params.search, params.sort],
  );
  const {
    data: draftFishes = [],
    isFetching: isDraftResultLoading,
    isError: isDraftResultError,
  } = useFishList(draftQueryParams, { enabled: filterSheetOpen });
  const activeFilterPills = useMemo(() => createActivePills(params), [params]);
  const activeFilterCount = FILTER_KEYS.reduce(
    (count, key) => count + (committedFilters[key] === undefined ? 0 : 1),
    0,
  );

  useEffect(() => {
    if (searchParamsKey !== canonicalSearchParamsKey) {
      setSearchParams(canonicalSearchParams, { replace: true });
    }
  }, [canonicalSearchParams, canonicalSearchParamsKey, searchParamsKey, setSearchParams]);

  useEffect(() => {
    if (isLoading || isInitialError || lastTrackedResultsKey.current === canonicalSearchParamsKey) return;
    lastTrackedResultsKey.current = canonicalSearchParamsKey;
    trackAnalyticsEvent('search_results_viewed', {
      resultCount: fishes.length,
      zeroResult: fishes.length === 0,
      filterCount: activeFilterCount,
    });
  }, [activeFilterCount, canonicalSearchParamsKey, fishes.length, isInitialError, isLoading]);

  function update(next: Record<string, string | number | undefined>) {
    const merged = new URLSearchParams(canonicalSearchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        merged.delete(key);
      } else {
        merged.set(key, String(value));
      }
    });
    setSearchParams(serializeSearchParams(parseSearchParams(merged)));
  }

  function commitFilters(filters: SearchFilterValues) {
    const merged = new URLSearchParams(canonicalSearchParams);
    FILTER_KEYS.forEach((key) => {
      const value = filters[key];
      if (value === undefined) merged.delete(key);
      else merged.set(key, String(value));
    });
    setSearchParams(serializeSearchParams(parseSearchParams(merged)));
  }

  function resetAll() {
    const next = new URLSearchParams();
    if (params.sort !== 'popular') next.set('sort', params.sort);
    setSearchParams(next);
  }

  function removeAppliedFilter(key: string) {
    if (key === 'search') {
      update({ search: undefined });
      return;
    }

    if (!FILTER_KEYS.includes(key as (typeof FILTER_KEYS)[number])) return;
    const nextFilters = { ...committedFilters };
    delete nextFilters[key as keyof SearchFilterValues];
    commitFilters(nextFilters);
  }

  function openFilterSheet() {
    setDraftFilters({ ...committedFilters });
    setDraftSource(searchParamsKey);
    setFilterSheetOpen(true);
  }

  function applyDraftFilters() {
    commitFilters(effectiveDraftFilters);
    setFilterSheetOpen(false);
  }

  function updateDraftFilters(nextFilters: SearchFilterValues) {
    setDraftFilters(nextFilters);
    setDraftSource(searchParamsKey);
  }

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-6 sm:px-7 sm:pt-8">
      <h1 className="mb-4 text-2xl font-bold tracking-[-0.025em] text-ink">검색</h1>

      <div className="mb-3 flex min-h-11 min-w-0 items-center justify-between gap-3 lg:hidden">
        <ResultCount
          params={params}
          count={fishes.length}
          hasMore={Boolean(hasNextPage)}
          loading={isLoading}
          error={isInitialError}
        />
        <button
          type="button"
          onClick={openFilterSheet}
          aria-haspopup="dialog"
          aria-expanded={filterSheetOpen}
          className="inline-flex min-h-11 flex-none items-center gap-2 rounded-btn border border-line bg-surface px-3.5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}개` : ''}
        </button>
      </div>

      <FilterSheet
        open={filterSheetOpen}
        value={effectiveDraftFilters}
        resultCount={draftFishes.length}
        isResultLoading={isDraftResultLoading}
        isResultError={isDraftResultError}
        onChange={updateDraftFilters}
        onReset={() => updateDraftFilters({})}
        onClose={() => setFilterSheetOpen(false)}
        onApply={applyDraftFilters}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-[90px] hidden rounded-card border border-line bg-surface px-5.5 py-5 lg:block">
          <FilterPanel
            idPrefix="desktop-search-filter"
            value={committedFilters}
            onChange={commitFilters}
            onReset={() => commitFilters({})}
            facets={catalogFacets}
          />
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex justify-end lg:items-center lg:justify-between">
            <div className="hidden lg:block">
              <ResultCount
                params={params}
                count={fishes.length}
                hasMore={Boolean(hasNextPage)}
                loading={isLoading}
                error={isInitialError}
              />
            </div>
            <SortSegment value={params.sort} onChange={(sort) => update({ sort })} />
          </div>

          {activeFilterPills.length > 0 ? (
            <div className="mb-4">
              <AppliedFilterBar pills={activeFilterPills} onRemove={removeAppliedFilter} onClear={resetAll} />
            </div>
          ) : null}

          {isLoading ? (
            <SkeletonCards count={4} className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]" />
          ) : null}
          {isInitialError ? <ErrorState onRetry={() => void refetch()} /> : null}
          {isError && !isInitialError && !isFetchNextPageError ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-btn bg-accent-soft/45 px-3.5 py-2.5">
              <p className="m-0 text-body-sm text-ink-mute">최신 검색 결과를 불러오지 못해 이전 내용을 보여드려요.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex min-h-11 items-center rounded-btn px-2 text-body-sm font-bold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-60"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          {isFetching && !isFetchingNextPage && fishes.length > 0 ? (
            <p role="status" aria-live="polite" className="m-0 mb-3 text-body-sm text-ink-mute">
              검색 결과를 업데이트하는 중...
            </p>
          ) : null}
          {!isLoading && !isInitialError && fishes.length === 0 ? (
            <EmptyState onReset={resetAll} onExample={(name) => setSearchParams(new URLSearchParams({ search: name }))} />
          ) : null}
          {!isInitialError && fishes.length > 0 ? (
            <div aria-busy={isFetching}>
              <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
                {fishes.map((fish, index) => (
                  <FishCard key={fish.id} fish={fish} analyticsSection="search_results" analyticsPosition={index + 1} sort={params.sort} />
                ))}
              </div>

              {hasNextPage || isFetchNextPageError ? (
                <div className="mt-5">
                  {isFetchNextPageError ? (
                    <p role="alert" className="m-0 mb-2 text-center text-body-sm text-red-700 dark:text-red-400">
                      다음 검색 결과를 불러오지 못했어요.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    aria-busy={isFetchingNextPage}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-btn border border-line bg-surface px-5 py-3 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-ink-mute"
                  >
                    {isFetchingNextPage
                      ? '검색 결과를 더 불러오는 중...'
                      : isFetchNextPageError
                        ? '더 보기 다시 시도'
                        : '검색 결과 더 보기'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ResultCount({
  params,
  count,
  hasMore,
  loading,
  error,
}: {
  params: SearchViewParams;
  count: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}) {
  return (
    <span className="block min-w-0 truncate text-body-sm text-ink-mute" aria-live="polite" aria-atomic="true">
      {params.search ? <b className="font-bold text-ink">'{params.search}'</b> : null}
      {params.search ? ' ' : null}
      {error ? (
        '검색 결과를 불러오지 못했어요'
      ) : (
        <>
          검색 결과 <b className="font-bold text-ink">{loading ? '-' : count}</b>
          {!loading && hasMore ? '건 이상' : '건'}
        </>
      )}
    </span>
  );
}

function parseSearchParams(searchParams: URLSearchParams): SearchViewParams {
  const rawSeason = searchParams.get('season');
  const parsedSeason = SEASONS.some((item) => item.value === rawSeason)
    ? rawSeason as Season
    : undefined;
  const month = parseBoundedInteger(searchParams.get('month'), 1, 12);
  const season = month === undefined ? parsedSeason : undefined;
  const priceLevel = parseBoundedInteger(searchParams.get('priceLevel'), 1, 3);
  const rawSort = searchParams.get('sort');
  const sort: FishSort = rawSort === 'name' ? 'name' : 'popular';
  const search = normalizeQueryText(searchParams.get('search'), 80);
  const rawTaste = normalizeQueryText(searchParams.get('taste'), 30);
  const taste = rawTaste && TASTE_TAGS.includes(rawTaste) ? rawTaste : undefined;

  return { search, season, month, taste, priceLevel, sort };
}

function serializeSearchParams(params: SearchViewParams) {
  const serialized = new URLSearchParams();
  if (params.search) serialized.set('search', params.search);
  if (params.season) serialized.set('season', params.season);
  if (params.month !== undefined) serialized.set('month', String(params.month));
  if (params.taste) serialized.set('taste', params.taste);
  if (params.priceLevel !== undefined) serialized.set('priceLevel', String(params.priceLevel));
  if (params.sort !== 'popular') serialized.set('sort', params.sort);
  return serialized;
}

function normalizeQueryText(value: string | null, maximumLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maximumLength) : undefined;
}

function parseBoundedInteger(value: string | null, minimum: number, maximum: number) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function pickFilters(params: SearchViewParams): SearchFilterValues {
  const { season, month, taste, priceLevel } = params;
  return { season, month, taste, priceLevel };
}

function createActivePills(params: SearchViewParams): AppliedFilterPill[] {
  const pills: AppliedFilterPill[] = [];
  if (params.search) pills.push({ key: 'search', label: params.search });
  if (params.season) {
    pills.push({
      key: 'season',
      label: SEASONS.find((season) => season.value === params.season)?.label ?? params.season,
    });
  }
  if (params.month) pills.push({ key: 'month', label: `${params.month}월 제철` });
  if (params.taste) pills.push({ key: 'taste', label: params.taste });
  if (params.priceLevel) {
    pills.push({
      key: 'priceLevel',
      label: formatPriceLevel(params.priceLevel, { withLabel: true }),
    });
  }
  return pills;
}

const exampleSearches = ['광어', '방어', '연어', '참돔'];

function EmptyState({ onReset, onExample }: { onReset: () => void; onExample: (name: string) => void }) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[72px] text-center">
      <div className="mx-auto mb-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-chipbg">
        <FishPlaceholder className="h-[29px] w-[46px] stroke-ink-mute/40" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-ink">검색 결과가 없어요</h3>
      <p className="mb-4 text-14.5 leading-[1.5] text-ink-mute">검색어나 필터를 바꿔보세요. 이런 횟감은 어때요?</p>
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {exampleSearches.map((name) => (
          <button key={name} type="button" onClick={() => onExample(name)} className={chipClass(false)}>
            {name}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="rounded-btn border border-accent bg-surface px-5.5 py-[11px] text-sm font-semibold text-accent transition hover:bg-accent-soft"
      >
        필터 초기화
      </button>
    </div>
  );
}
