import { Link, useNavigate } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import CardCarousel from '../components/CardCarousel';
import FilterChips from '../components/FilterChips';
import FishCard from '../components/FishCard';
import HomeQuickNav from '../components/HomeQuickNav';
import SearchBar from '../components/SearchBar';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import SortSegment from '../components/SortSegment';
import { useFishList } from '../hooks/useFish';
import type { FishSort, Season } from '../types/fish';

const popularTags = ['광어', '방어', '연어', '참돔'];

export default function HomePage() {
  const navigate = useNavigate();
  const currentMonth = new Date().getMonth() + 1;
  const [season, setSeason] = useState<Season | undefined>();
  const [taste, setTaste] = useState<string | undefined>();
  const [sort, setSort] = useState<FishSort>('popular');
  const { data: fishes = [], isLoading, isError, refetch } = useFishList({ season, taste, sort });
  const {
    data: monthFishes = [],
    isLoading: isMonthLoading,
    isError: isMonthError,
    refetch: refetchMonth,
  } = useFishList({ month: currentMonth, sort: 'popular' });
  const {
    data: featuredFishes = [],
    isLoading: isFeaturedLoading,
    isError: isFeaturedError,
    refetch: refetchFeatured,
  } = useFishList({ featured: true, sort: 'popular' });

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
    <main className="bg-mist pb-20">
      <HomeQuickNav />

      <section className="mx-auto max-w-content px-4 pt-5 sm:px-7">
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src="/hero/sea.jpg"
            srcSet="/hero/sea-960.jpg 960w, /hero/sea.jpg 1800w"
            sizes="(max-width: 980px) 100vw, 980px"
            width={1800}
            height={1200}
            alt=""
            aria-hidden
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A2836]/60 via-[#0A2836]/45 to-[#0A2836]/75" aria-hidden />
          <div className="relative px-5 py-12 text-center sm:px-8 sm:py-16">
            <h1 className="mb-2 text-28 font-extrabold leading-tight text-white [text-shadow:0_1px_8px_rgba(10,40,54,0.4)]">
              아는 만큼 맛있어지는 회
            </h1>
            <p className="mb-5.5 text-15 text-white/85">이름·제철·맛·가격대까지, 3초면 확인해요</p>
            <SearchBar placeholder="생선 이름을 입력해 보세요" onSubmit={goSearch} variant="default" />
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-13 text-white/75">
              <span>많이 찾는 생선</span>
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => goSearch(tag)}
                  className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-3 py-2 text-13 font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="section-seasonal" className="mx-auto max-w-content scroll-mt-24 px-4 pt-8 sm:px-7">
        <SectionHeader title={`${currentMonth}월, 지금이 제철이에요`}>
          <Link to="/calendar" className="text-13 font-semibold text-sea transition hover:text-sea-deep">
            제철 캘린더 →
          </Link>
        </SectionHeader>

        {isMonthLoading ? <SkeletonCards count={4} /> : null}
        {isMonthError ? <ErrorState onRetry={() => refetchMonth()} /> : null}
        {!isMonthLoading && !isMonthError && monthFishes.length === 0 ? (
          <ErrorState message="이달 제철 생선이 아직 없어요" />
        ) : null}
        {!isMonthLoading && !isMonthError && monthFishes.length > 0 ? (
          <CardCarousel ariaLabel="이달의 제철 생선">
            {monthFishes.map((fish) => (
              <div key={fish.id} className="w-[230px] flex-none snap-start">
                <FishCard fish={fish} />
              </div>
            ))}
          </CardCarousel>
        ) : null}
      </section>

      <section id="section-featured" className="mx-auto max-w-content scroll-mt-24 px-4 pt-9 sm:px-7">
        <SectionHeader title="에디터 추천" />

        {isFeaturedLoading ? <SkeletonCards count={2} className="grid gap-3.5 md:grid-cols-2" /> : null}
        {isFeaturedError ? <ErrorState onRetry={() => refetchFeatured()} /> : null}
        {!isFeaturedLoading && !isFeaturedError && featuredFishes.length === 0 ? (
          <ErrorState message="추천 생선이 아직 없어요" />
        ) : null}
        {!isFeaturedLoading && !isFeaturedError && featuredFishes.length > 0 ? (
          <CardCarousel ariaLabel="에디터 추천 생선">
            {featuredFishes.map((fish) => (
              <div key={fish.id} className="w-[85%] max-w-[430px] flex-none snap-start sm:w-[430px]">
                <FishCard fish={fish} variant="wide" />
              </div>
            ))}
          </CardCarousel>
        ) : null}
      </section>

      <section id="section-all" className="mx-auto max-w-content scroll-mt-24 px-4 pt-10 sm:px-7">
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
            {fishes.map((fish) => (
              <FishCard key={fish.id} fish={fish} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SectionHeader({ title, count, children }: { title: string; count?: string; children?: ReactNode }) {
  return (
    <div className="mb-[14px] flex items-baseline gap-3">
      <h2 className="m-0 text-19 font-extrabold leading-tight text-ink">{title}</h2>
      {count ? <span className="text-13 tabular-nums text-ink-mute">{count}</span> : null}
      {children ? <div className="ml-auto flex-none">{children}</div> : null}
    </div>
  );
}

function EmptyFilterState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-5 py-12 text-center">
      <h3 className="mb-1 text-17 font-bold text-ink">이 조건에 맞는 생선이 아직 없어요</h3>
      <p className="mb-4 text-14 text-ink-mute">필터를 하나 줄여보시면 어떨까요?</p>
      <button type="button" onClick={onReset} className="text-13 font-bold text-sea transition hover:text-sea-deep">
        필터 초기화
      </button>
    </div>
  );
}
