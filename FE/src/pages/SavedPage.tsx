import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import FishCard from '../components/FishCard';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useBookmarks } from '../hooks/useBookmarks';
import { useFishList } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SavedPage() {
  usePageMeta('내 도감', undefined, null, { noindex: true });
  const {
    bookmarkedIdSet,
    bookmarkedFishes,
    bookmarkCount,
    isServerMode,
    isLoading: isBookmarksLoading,
    isError: isBookmarksError,
    refetchBookmarks,
  } = useBookmarks();
  const {
    data: fishes = [],
    isLoading: isFishListLoading,
    isError: isFishListError,
    refetch: refetchFishList,
  } = useFishList({ sort: 'popular' }, { enabled: !isServerMode });
  const savedFishes = isServerMode ? bookmarkedFishes : fishes.filter((fish) => bookmarkedIdSet.has(fish.id));
  const isLoading = isServerMode ? isBookmarksLoading : isFishListLoading;
  const isError = isServerMode ? isBookmarksError : isFishListError;
  const retrySavedFishes = () => {
    if (isServerMode) {
      void refetchBookmarks();
      return;
    }

    void refetchFishList();
  };

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-8 sm:px-7">
      <div className="mb-5.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="m-0 text-30 font-bold tracking-[-0.03em] text-ink">
            저장한 도감 <span className="text-20 font-medium text-ink-mute">· {bookmarkCount}종</span>
          </h1>
        </div>
        <Link to="/" className="text-sm font-semibold text-accent transition hover:text-accent-hover">
          전체 도감 둘러보기
        </Link>
      </div>

      {isLoading ? (
        <SkeletonCards count={4} className="grid gap-5.5 [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]" />
      ) : null}
      {isError ? <ErrorState onRetry={retrySavedFishes} /> : null}
      {!isLoading && !isError && bookmarkCount === 0 ? <EmptyState /> : null}
      {!isLoading && !isError && bookmarkCount > 0 && savedFishes.length === 0 ? (
        <ErrorState message="저장한 횟감을 지금 도감에서 찾을 수 없어요" onRetry={retrySavedFishes} />
      ) : null}
      {!isLoading && !isError && savedFishes.length > 0 ? (
        <div className="grid gap-5.5 [grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]">
          {savedFishes.map((fish, index) => (
            <FishCard key={fish.id} fish={fish} analyticsSection="saved" analyticsPosition={index + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-[72px] text-center">
      <div className="mx-auto mb-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-chipbg">
        <Heart className="h-[38px] w-[38px] text-ink-mute/40" aria-hidden />
      </div>
      <h2 className="mb-2 text-lg font-bold text-ink">아직 저장한 횟감이 없어요</h2>
      <p className="mb-5 text-14.5 leading-[1.5] text-ink-mute">마음에 드는 카드의 하트를 눌러 모아보세요</p>
      <Link
        to="/"
        className="inline-flex rounded-btn border border-accent bg-surface px-5.5 py-[11px] text-sm font-semibold text-accent transition hover:bg-accent-soft"
      >
        도감 둘러보기
      </Link>
    </div>
  );
}
