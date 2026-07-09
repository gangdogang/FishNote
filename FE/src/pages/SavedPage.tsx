import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import FishCard from '../components/FishCard';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useBookmarks } from '../hooks/useBookmarks';
import { useFishList } from '../hooks/useFish';

export default function SavedPage() {
  const {
    bookmarkedIdSet,
    bookmarkedFishes,
    bookmarkCount,
    isServerMode,
    isLoading: isBookmarksLoading,
    isError: isBookmarksError,
  } = useBookmarks();
  const {
    data: fishes = [],
    isLoading: isFishListLoading,
    isError: isFishListError,
  } = useFishList({ sort: 'popular' }, { enabled: !isServerMode });
  const savedFishes = isServerMode ? bookmarkedFishes : fishes.filter((fish) => bookmarkedIdSet.has(fish.id));
  const isLoading = isServerMode ? isBookmarksLoading : isFishListLoading;
  const isError = isServerMode ? isBookmarksError : isFishListError;

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-20 pt-8 sm:px-7">
      <div className="mb-[22px] flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="m-0 text-[30px] font-bold tracking-[-0.03em] text-ink">
            저장한 도감 <span className="text-[20px] font-medium text-ink-mute/70">· {bookmarkCount}종</span>
          </h1>
        </div>
        <Link to="/" className="text-sm font-semibold text-sea transition hover:text-sea">
          전체 도감 둘러보기
        </Link>
      </div>

      {isLoading ? (
        <SkeletonCards count={4} className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]" />
      ) : null}
      {isError ? <ErrorState /> : null}
      {!isLoading && !isError && bookmarkCount === 0 ? <EmptyState /> : null}
      {!isLoading && !isError && bookmarkCount > 0 && savedFishes.length === 0 ? (
        <ErrorState message="저장한 생선을 지금 도감에서 찾을 수 없어요" />
      ) : null}
      {!isLoading && !isError && savedFishes.length > 0 ? (
        <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]">
          {savedFishes.map((fish) => (
            <FishCard key={fish.id} fish={fish} />
          ))}
        </div>
      ) : null}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[72px] text-center">
      <div className="mx-auto mb-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-chipbg">
        <Heart className="h-[38px] w-[38px] text-ink-mute/40" aria-hidden />
      </div>
      <h2 className="mb-2 text-lg font-bold text-ink">아직 저장한 생선이 없어요</h2>
      <p className="mb-5 text-[14.5px] leading-[1.5] text-ink-mute">마음에 드는 카드의 하트를 눌러 모아보세요</p>
      <Link
        to="/"
        className="inline-flex rounded-[10px] border border-sea bg-white px-[22px] py-[11px] text-sm font-semibold text-sea transition hover:bg-sea-soft"
      >
        도감 둘러보기
      </Link>
    </div>
  );
}
