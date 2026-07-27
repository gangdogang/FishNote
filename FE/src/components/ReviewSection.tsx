import type { ComponentProps } from 'react';
import type { RatingDistribution } from '../types/fish';
import type { ReviewList as ReviewListData, ReviewSort } from '../types/review';
import ReviewForm from './ReviewForm';
import ReviewList from './ReviewList';

export type ReviewSectionFormProps = ComponentProps<typeof ReviewForm>;

export interface ReviewSectionProps {
  reviewList?: ReviewListData;
  fallbackAvgRating: number;
  fallbackReviewCount: number;
  fallbackRatingCount?: number;
  fallbackRatingDistribution: RatingDistribution;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  onRetry: () => void;
  sort: ReviewSort;
  onSortChange: (sort: ReviewSort) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  onLoadMore: () => void | Promise<unknown>;
  reviewFormProps: ReviewSectionFormProps;
  onDelete: (reviewId: number, password?: string) => Promise<boolean>;
  onHelpful: (reviewId: number) => Promise<number | null>;
  reviewActionError?: string;
  onOpenForm: () => void;
}

export default function ReviewSection({
  reviewList,
  fallbackAvgRating,
  fallbackReviewCount,
  fallbackRatingCount,
  fallbackRatingDistribution,
  isLoading,
  isFetching = false,
  isError,
  onRetry,
  sort,
  onSortChange,
  hasNextPage = false,
  isFetchingNextPage = false,
  isFetchNextPageError = false,
  onLoadMore,
  reviewFormProps,
  onDelete,
  onHelpful,
  reviewActionError,
  onOpenForm,
}: ReviewSectionProps) {
  const avgRating = normalizeAverageRating(reviewList?.avgRating ?? fallbackAvgRating);
  const reviewCount = normalizeCount(reviewList?.totalCount ?? fallbackReviewCount);
  const distribution = reviewList?.ratingDistribution ?? fallbackRatingDistribution;
  const distributionRatingCount = Object.values(distribution)
    .reduce((sum, count) => sum + normalizeCount(count), 0);
  const ratingCount = normalizeCount(
    reviewList?.ratingCount
      ?? fallbackRatingCount
      ?? distributionRatingCount,
  );
  const hasRatings = ratingCount > 0;
  const loadedReviewCount = reviewList?.reviews.length ?? 0;
  const hasCachedReviewList = reviewList !== undefined;
  const isBaseQueryError = isError && !isFetchNextPageError;
  const showInitialError = isBaseQueryError && !hasCachedReviewList;
  const showInitialLoading = isLoading && !hasCachedReviewList;
  const showReviewList = !showInitialError && !showInitialLoading;

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-14 scroll-mt-24 border-t border-line pt-[34px]"
    >
      <div className="mb-4 flex items-baseline gap-2">
        <h2 id="reviews-heading" className="m-0 text-19 font-extrabold tracking-normal text-ink">
          후기
        </h2>
        <span className="text-13 tabular-nums text-ink-mute">{reviewCount}개</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-card border border-line bg-surface p-[18px]" aria-label="후기 평점 요약">
          {hasRatings ? (
            <>
              <div className="text-[34px] font-extrabold leading-[1.1] tabular-nums text-ink">
                {avgRating.toFixed(1)} <span className="text-15 font-semibold text-ink-mute">/ 5</span>
              </div>
              <RatingStars rating={Math.round(avgRating)} className="mb-1 mt-0.5 block text-15 tracking-[1px]" />
              <div className="mb-3.5 text-13 text-ink-mute">
                별점 {ratingCount}개 · 후기 {reviewCount}개
              </div>
            </>
          ) : (
            <div className="mb-3.5 text-body-sm font-semibold text-ink-mute">아직 별점이 없어요</div>
          )}
          <RatingDistributionBars distribution={distribution} />
          <button
            type="button"
            onClick={onOpenForm}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-btn border-0 bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            후기 쓰기
          </button>
        </aside>

        <div className="min-w-0">
          <ReviewSortChips value={sort} onChange={onSortChange} />

          {reviewActionError ? (
            <p
              role="alert"
              className="m-0 mb-3 rounded-btn bg-red-50 px-3 py-2 text-13 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400"
            >
              {reviewActionError}
            </p>
          ) : null}

          {isBaseQueryError && hasCachedReviewList ? (
            <div
              role="alert"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-surface px-3 py-2.5"
            >
              <p className="m-0 text-body-sm text-ink-mute">최신 후기를 불러오지 못해 이전 내용을 보여드려요.</p>
              <button
                type="button"
                onClick={onRetry}
                disabled={isFetching}
                aria-busy={isFetching}
                className="inline-flex min-h-11 items-center rounded-btn px-2 text-body-sm font-bold text-accent transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:text-ink-mute"
              >
                {isFetching ? '다시 불러오는 중...' : '다시 시도'}
              </button>
            </div>
          ) : null}

          {!isBaseQueryError && !isFetchingNextPage && (isLoading || isFetching) && hasCachedReviewList ? (
            <p
              role="status"
              aria-live="polite"
              className="m-0 mb-3 text-body-sm text-ink-mute"
            >
              최신 후기를 불러오는 중...
            </p>
          ) : null}

          {showInitialError ? (
            <div
              role="alert"
              className="rounded-card border border-line bg-surface px-5 py-8 text-center"
            >
              <p className="m-0 text-body-sm text-ink-mute">후기를 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={onRetry}
                disabled={isFetching}
                aria-busy={isFetching}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-ink-mute"
              >
                {isFetching ? '후기를 다시 불러오는 중...' : '후기 다시 시도'}
              </button>
            </div>
          ) : showInitialLoading ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="rounded-card border border-line bg-surface px-5 py-8 text-center text-body-sm text-ink-mute"
            >
              후기를 불러오는 중...
            </div>
          ) : showReviewList ? (
            <ReviewList
              reviews={reviewList?.reviews ?? []}
              onDelete={onDelete}
              onHelpful={onHelpful}
            />
          ) : null}

          {showReviewList && (hasNextPage || isFetchNextPageError) ? (
            <div className="mt-3">
              {isFetchNextPageError ? (
                <p role="alert" className="m-0 mb-2 text-center text-body-sm text-red-700 dark:text-red-400">
                  후기를 더 불러오지 못했어요.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void onLoadMore()}
                disabled={isFetchingNextPage}
                aria-busy={isFetchingNextPage}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-btn border border-line bg-surface px-5 py-2.5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-ink-mute"
              >
                {isFetchingNextPage
                  ? '후기를 불러오는 중...'
                  : isFetchNextPageError
                    ? '더 보기 다시 시도'
                    : `후기 더 보기 (${loadedReviewCount}/${reviewCount})`}
              </button>
            </div>
          ) : null}

          <ReviewForm {...reviewFormProps} />
        </div>
      </div>
    </section>
  );
}

function ReviewSortChips({ value, onChange }: { value: ReviewSort; onChange: (value: ReviewSort) => void }) {
  return (
    <div className="mb-3 flex gap-2" role="group" aria-label="후기 정렬">
      <button
        type="button"
        onClick={() => onChange('latest')}
        aria-pressed={value === 'latest'}
        className={reviewSortChipClass(value === 'latest')}
      >
        최신순
      </button>
      <button
        type="button"
        onClick={() => onChange('helpful')}
        aria-pressed={value === 'helpful'}
        className={reviewSortChipClass(value === 'helpful')}
      >
        도움순
      </button>
    </div>
  );
}

function reviewSortChipClass(active: boolean) {
  return [
    'inline-flex min-h-11 items-center rounded-full px-3.25 py-1.75 text-13 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
    active ? 'bg-primary text-on-primary' : 'bg-chipbg text-ink hover:text-accent',
  ].join(' ');
}

function RatingDistributionBars({ distribution }: { distribution: RatingDistribution }) {
  const rows = [5, 4, 3, 2, 1] as const;
  const counts = rows.map((star) => normalizeCount(distribution[String(star) as keyof RatingDistribution] ?? 0));
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="grid gap-[5px]" role="group" aria-label="별점 분포">
      {rows.map((star, index) => {
        const count = counts[index];
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div
            key={star}
            className="grid grid-cols-[26px_minmax(0,1fr)_24px] items-center gap-2 text-xs tabular-nums text-ink-mute"
          >
            <span>{star}점</span>
            <div
              role="progressbar"
              aria-label={`${star}점 후기 비율`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
              className="h-1.5 overflow-hidden rounded-full bg-chipbg"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
            </div>
            <span className="text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function RatingStars({ rating, className = '' }: { rating: number; className?: string }) {
  const full = normalizeRating(rating);

  return (
    <span className={className} role="img" aria-label={`${full}점`}>
      <span className="text-star">{'★'.repeat(full)}</span>
      <span className="text-control-border">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

function normalizeRating(value: number) {
  return Math.round(normalizeAverageRating(value));
}

function normalizeAverageRating(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}
