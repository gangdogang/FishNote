import { Link, useNavigate } from 'react-router';
import { useMemo, useState, type ReactNode } from 'react';
import CardCarousel, { CardCarouselItem } from '../components/CardCarousel';
import FilterChips from '../components/FilterChips';
import FishCard from '../components/FishCard';
import HomeQuickNav from '../components/HomeQuickNav';
import SearchBar from '../components/SearchBar';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import SortSegment from '../components/SortSegment';
import { useHomeData } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';
import { fishDetailPath } from '../lib/fishRoutes';
import type { FishSort, FishSummary, Season } from '../types/fish';

const popularTags = ['광어', '방어', '연어', '참돔'];
const EMPTY_FISH: FishSummary[] = [];
const SEASON_MONTHS: Record<Season, number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
  winter: [12, 1, 2],
};

export default function HomePage() {
  const navigate = useNavigate();
  const currentMonth = new Date().getMonth() + 1;
  const [season, setSeason] = useState<Season | undefined>();
  const [taste, setTaste] = useState<string | undefined>();
  const [sort, setSort] = useState<FishSort>('popular');
  const {
    data: homeData,
    isLoading,
    isError,
    refetch,
  } = useHomeData(currentMonth, 'popular');
  const catalog = homeData?.catalog ?? EMPTY_FISH;
  const monthFishes = homeData?.seasonal ?? EMPTY_FISH;
  const featuredFishes = homeData?.featured ?? EMPTY_FISH;
  const fishes = useMemo(
    () => filterAndSortCatalog(catalog, season, taste, sort),
    [catalog, season, taste, sort],
  );
  const structuredData = useMemo(() => {
    if (catalog.length === 0) return undefined;

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'FishNote 공개 회 도감',
      numberOfItems: catalog.length,
      itemListElement: catalog.map((fish, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: fish.name,
        url: new URL(fishDetailPath(fish), window.location.origin).toString(),
      })),
    };
  }, [catalog]);
  usePageMeta(undefined, undefined, null, { canonicalPath: '/', structuredData });
  const isMonthLoading = isLoading;
  const isMonthError = isError;
  const isFeaturedLoading = isLoading;
  const isFeaturedError = isError;
  const refetchMonth = refetch;
  const refetchFeatured = refetch;

  function goSearch(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (season) params.set('season', season);
    if (taste) params.set('taste', taste);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSeason(undefined);
    setTaste(undefined);
  }

  return (
    <div className="bg-mist pb-20">
      <HomeQuickNav />

      <section id="home-hero" className="home-hero-stage mx-auto max-w-content px-4 pt-5 sm:px-7">
        <div className="home-hero-shell group relative isolate overflow-hidden rounded-[24px] bg-hero-surface">
          <img
            src="/hero/sea.jpg"
            srcSet="/hero/sea-960.jpg 960w, /hero/sea.jpg 1800w"
            sizes="(max-width: 980px) 100vw, 980px"
            width={1800}
            height={1200}
            alt=""
            aria-hidden
            decoding="async"
            className="home-hero-image absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.13),transparent_30%),linear-gradient(110deg,rgba(5,28,38,0.91)_0%,rgba(5,28,38,0.68)_48%,rgba(5,28,38,0.22)_78%,rgba(5,28,38,0.5)_100%)]"
            aria-hidden
          />
          <div className="home-hero-frame relative flex min-h-[410px] items-end px-4 py-4 sm:min-h-[460px] sm:px-8 sm:py-8">
            <div className="home-hero-panel w-full max-w-[650px] rounded-[20px] border border-white/15 bg-[#082934] px-5 py-6 text-left shadow-[0_18px_50px_rgba(2,13,18,0.24),inset_0_1px_rgba(255,255,255,0.08)] sm:px-7 sm:py-8">
              <p className="mb-2 text-caption font-bold tracking-[0.12em] text-white/70">오늘의 회 도감</p>
              <h1 className="home-hero-title mb-2 max-w-[560px] text-balance text-[2rem] font-extrabold leading-[1.16] tracking-[-0.035em] text-on-hero sm:text-[2.5rem]">
                아는 만큼 맛있어지는 회
              </h1>
              <p className="home-hero-copy mb-5.5 max-w-[520px] text-pretty text-body-sm text-white/[0.82] sm:text-[15px]">
                이름·제철·맛·가격대까지, 고르기 전에 필요한 정보를 빠르게 확인해요
              </p>
              <SearchBar
                placeholder="횟감 이름이나 별칭을 입력해 보세요"
                onSubmit={goSearch}
                onSuggestionSelect={(fish) => navigate(fishDetailPath(fish))}
                variant="default"
                className="mx-0 max-w-full border-white/25 shadow-[0_12px_30px_rgba(2,13,18,0.18)]"
                analyticsSurface="hero"
              />
              <div className="home-quick-tags mt-3.5 flex flex-wrap items-center justify-start gap-2 text-body-sm text-on-hero">
                <span className="home-quick-label w-full flex-none text-white/70 sm:mr-1 sm:w-auto">바로 찾아보기</span>
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => goSearch(tag)}
                    className="inline-flex min-h-11 flex-none items-center rounded-full border border-white/[0.18] bg-white/10 px-3 py-2 text-body-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-hero-surface active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-hero focus-visible:ring-offset-2 focus-visible:ring-offset-hero-surface motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="section-seasonal" className="mx-auto max-w-content scroll-mt-[var(--app-scroll-offset)] px-4 pt-8 sm:px-7">
        <SectionHeader title={`${currentMonth}월, 지금이 제철이에요`}>
          <Link to="/calendar" className="text-body-sm font-semibold text-accent transition hover:text-accent-hover">
            제철 캘린더 →
          </Link>
        </SectionHeader>

        {isMonthLoading ? <SkeletonCards count={4} layout="carousel" /> : null}
        {isMonthError ? <ErrorState onRetry={() => refetchMonth()} /> : null}
        {!isMonthLoading && !isMonthError && monthFishes.length === 0 ? (
          <ErrorState message="이달 제철 횟감이 아직 없어요" />
        ) : null}
        {!isMonthLoading && !isMonthError && monthFishes.length > 0 ? (
          <CardCarousel ariaLabel="이달의 제철 횟감">
            {monthFishes.map((fish, index) => (
              <CardCarouselItem key={fish.id}>
                <FishCard fish={fish} imageSizes="230px" analyticsSection="home_seasonal" analyticsPosition={index + 1} sort="popular" />
              </CardCarouselItem>
            ))}
          </CardCarousel>
        ) : null}
      </section>

      <section id="section-featured" className="mx-auto max-w-content scroll-mt-[var(--app-scroll-offset)] px-4 pt-9 sm:px-7">
        <SectionHeader title="처음 먹기 좋은 회" />

        {isFeaturedLoading ? <SkeletonCards count={2} layout="carousel" variant="wide" /> : null}
        {isFeaturedError ? <ErrorState onRetry={() => refetchFeatured()} /> : null}
        {!isFeaturedLoading && !isFeaturedError && featuredFishes.length === 0 ? (
          <ErrorState message="추천 횟감이 아직 없어요" />
        ) : null}
        {!isFeaturedLoading && !isFeaturedError && featuredFishes.length > 0 ? (
          <CardCarousel ariaLabel="처음 먹기 좋은 횟감">
            {featuredFishes.map((fish, index) => (
              <CardCarouselItem key={fish.id} variant="wide">
                <FishCard fish={fish} variant="wide" analyticsSection="home_beginner_friendly" analyticsPosition={index + 1} sort="popular" />
              </CardCarouselItem>
            ))}
          </CardCarousel>
        ) : null}
      </section>

      <section id="section-all" className="mx-auto max-w-content scroll-mt-[var(--app-scroll-offset)] px-4 pt-10 sm:px-7">
        <SectionHeader title="전체 도감" count={isLoading || isError ? undefined : `${fishes.length}종`} />

        <div className="mb-4.5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <FilterChips
            season={season}
            taste={taste}
            onSeasonChange={setSeason}
            onTasteChange={setTaste}
            onReset={resetFilters}
            className="min-w-0"
          />
          <SortSegment value={sort} onChange={setSort} />
        </div>

        {isLoading ? <SkeletonCards count={8} /> : null}
        {isError ? <ErrorState onRetry={() => refetch()} /> : null}
        {!isLoading && !isError && fishes.length === 0 ? <EmptyFilterState onReset={resetFilters} /> : null}
        {!isLoading && !isError && fishes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {fishes.map((fish, index) => (
              <FishCard key={fish.id} fish={fish} analyticsSection="home_catalog" analyticsPosition={index + 1} sort={sort} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function filterAndSortCatalog(
  catalog: FishSummary[],
  season: Season | undefined,
  taste: string | undefined,
  sort: FishSort,
) {
  const seasonMonths = season ? SEASON_MONTHS[season] : null;
  return catalog
    .filter((fish) => !seasonMonths || fish.seasonMonths.some((month) => seasonMonths.includes(month)))
    .filter((fish) => !taste || fish.tasteTags.some((tag) => tag.includes(taste)))
    .slice()
    .sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name, 'ko');
      return right.reviewCount - left.reviewCount
        || right.avgRating - left.avgRating
        || left.name.localeCompare(right.name, 'ko');
    });
}

function SectionHeader({ title, count, children }: { title: string; count?: string; children?: ReactNode }) {
  return (
    <div className="mb-[14px] flex items-baseline gap-3">
      <h2 className="m-0 text-lead font-extrabold text-ink">{title}</h2>
      {count ? <span className="text-body-sm tabular-nums text-ink-mute">{count}</span> : null}
      {children ? <div className="ml-auto flex-none">{children}</div> : null}
    </div>
  );
}

function EmptyFilterState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-5 py-12 text-center">
      <h3 className="mb-1 text-lead font-bold text-ink">이 조건에 맞는 횟감이 아직 없어요</h3>
      <p className="mb-4 text-body-sm text-ink-mute">필터를 하나 줄여보시면 어떨까요?</p>
      <button type="button" onClick={onReset} className="text-body-sm font-bold text-accent transition hover:text-accent-hover">
        필터 초기화
      </button>
    </div>
  );
}
