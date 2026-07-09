import { Heart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FishCard from '../components/FishCard';
import FishPlaceholder from '../components/FishPlaceholder';
import ReviewForm from '../components/ReviewForm';
import ReviewList from '../components/ReviewList';
import SeasonBar from '../components/SeasonBar';
import { SeasonBadgeNow } from '../components/SeasonBadge';
import { DetailSkeleton } from '../components/Skeletons';
import { formatMonths, formatPriceLabel, formatPriceLevel, isInSeasonNow } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { useFishDetail } from '../hooks/useFish';
import { useBookmarks } from '../hooks/useBookmarks';
import { useCreateReview, useDeleteReview, useMarkReviewHelpful, useReviews } from '../hooks/useReviews';
import type { RatingDistribution } from '../types/fish';
import type { ReviewRequest, ReviewSort } from '../types/review';

export default function FishDetailPage() {
  const params = useParams();
  const fishId = Number(params.id);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviewFormResetKey, setReviewFormResetKey] = useState(0);
  const [formError, setFormError] = useState<string | undefined>();
  const [reviewActionError, setReviewActionError] = useState<string | undefined>();
  const [reviewSort, setReviewSort] = useState<ReviewSort>('latest');
  const reviewFormRef = useRef<HTMLFormElement>(null);
  const { data: fish, isLoading, isError } = useFishDetail(fishId);
  const { data: reviewList } = useReviews(fishId, reviewSort);
  const createMutation = useCreateReview(fishId);
  const deleteMutation = useDeleteReview(fishId);
  const helpfulMutation = useMarkReviewHelpful(fishId);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [fishId]);

  const galleryImages = useMemo(() => {
    const images = fish?.images?.filter(Boolean) ?? [];
    if (images.length > 0) return images;
    return fish?.imageUrl ? [fish.imageUrl] : [];
  }, [fish]);

  function handleCreate(request: ReviewRequest) {
    setFormError(undefined);
    createMutation.mutate(request, {
      onSuccess: () => setReviewFormResetKey((key) => key + 1),
      onError: (error) => setFormError(getErrorMessage(error)),
    });
  }

  function openReviewForm() {
    setFormError(undefined);
    window.requestAnimationFrame(() => {
      reviewFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      reviewFormRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[name="nickname"], textarea')?.focus({ preventScroll: true });
    });
  }

  async function handleDeleteReview(reviewId: number, password?: string) {
    setReviewActionError(undefined);
    try {
      await deleteMutation.mutateAsync({ reviewId, password });
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      setReviewActionError(message.includes('비밀번호') ? '비밀번호가 맞지 않아요' : message);
      return false;
    }
  }

  async function handleHelpfulReview(reviewId: number) {
    setReviewActionError(undefined);
    try {
      const response = await helpfulMutation.mutateAsync(reviewId);
      return response.helpfulCount;
    } catch (error) {
      setReviewActionError(getErrorMessage(error));
      return null;
    }
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError || !fish) {
    return <StateText text="이 생선을 아직 도감에서 찾을 수 없어요" />;
  }

  const selectedImage = galleryImages[selectedImageIndex] ?? galleryImages[0] ?? null;
  const avgRating = reviewList?.avgRating ?? fish.avgRating;
  const reviewCount = reviewList?.totalCount ?? fish.reviewCount;
  const ratingDistribution = reviewList?.ratingDistribution ?? fish.ratingDistribution;
  const tips = fish.tips ?? [];
  const description = fish.description;
  const tasteDescription = fish.tasteDesc ?? fish.description;
  const bookmarked = isBookmarked(fish.id);
  const inSeasonNow = isInSeasonNow(fish.seasonMonths);

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-20 pt-7 sm:px-7">
      <section className="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-chipbg">
            {selectedImage ? (
              <img src={selectedImage} alt={`${fish.name} 회 사진`} className="h-full w-full object-cover" />
            ) : (
              <FishPlaceholder className="h-[105px] w-[168px] stroke-ink-mute/30" />
            )}
          </div>
          {galleryImages.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {galleryImages.slice(0, 4).map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={[
                    'aspect-[4/3] min-w-0 overflow-hidden rounded-[9px] bg-chipbg outline-offset-1 transition',
                    selectedImageIndex === index ? 'outline outline-2 outline-sea' : 'outline outline-1 outline-transparent hover:outline-line',
                  ].join(' ')}
                  aria-label={`${fish.name} 이미지 ${index + 1}`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <Link to="/" className="mb-3 inline-flex text-[13px] font-medium text-ink-mute transition hover:text-sea">
            ← 도감으로
          </Link>

          <div className="mb-2 min-h-[26px]">{inSeasonNow ? <SeasonBadgeNow /> : null}</div>

          <div className="mb-2.5">
            <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-normal text-ink">{fish.name}</h1>
            {fish.nameEn ? <p className="m-0 mt-0.5 text-sm leading-snug text-ink-mute">{fish.nameEn}</p> : null}
          </div>

          {description ? <p className="m-0 mb-3 text-[15px] leading-[1.7] text-ink">{description}</p> : null}

          {reviewCount > 0 ? (
            <div className="mb-4 flex items-center gap-1 text-sm font-bold tabular-nums text-ink">
              <span className="text-star">★</span>
              <span>{avgRating.toFixed(1)}</span>
              <span className="font-medium text-ink-mute">·</span>
              <button
                type="button"
                onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="bg-transparent font-medium text-ink-mute transition hover:text-sea"
              >
                후기 {reviewCount}개
              </button>
            </div>
          ) : (
            <p className="mb-4 mt-0 text-sm text-ink-mute">아직 후기가 없어요</p>
          )}

          <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-card border border-line bg-white">
            <SpecCell label="제철" value={formatMonths(fish.seasonMonths)} />
            <SpecCell label="맛" value={fish.tasteTags.length > 0 ? fish.tasteTags.join(' · ') : '정보 준비 중'} />
            <SpecCell label="가격대" value={formatPriceLevel(fish.priceLevel)} subValue={formatPriceLabel(fish.priceLevel)} strongClassName="text-ink" />
          </div>

          <div className="mb-5">
            <SeasonBar months={fish.seasonMonths} />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => toggleBookmark(fish.id)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-sea bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea"
              aria-label={bookmarked ? '생선 저장 해제' : '생선 저장'}
              aria-pressed={bookmarked}
            >
              <Heart className={bookmarked ? 'h-4 w-4 fill-white text-white' : 'h-4 w-4 fill-none text-white'} aria-hidden />
              {bookmarked ? '저장됨' : '저장하기'}
            </button>
            <button
              type="button"
              onClick={openReviewForm}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition hover:border-sea hover:text-sea"
            >
              후기 쓰기
            </button>
          </div>
        </div>
      </section>

      <section className="mt-11">
        <h2 className="m-0 mb-3.5 text-[19px] font-extrabold tracking-normal text-ink">어떤 맛인가요?</h2>
        {tasteDescription ? (
          <p className="m-0 max-w-[640px] text-[15px] leading-[1.8] text-ink">{tasteDescription}</p>
        ) : (
          <p className="m-0 text-sm text-ink-mute">맛 설명을 준비 중이에요</p>
        )}
      </section>

      <section className="mt-9">
        <h2 className="m-0 mb-3.5 text-[19px] font-extrabold tracking-normal text-ink">이렇게 즐겨요</h2>
        {tips.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {tips.map((tip, index) => (
              <li key={`${tip}-${index}`} className="flex items-start gap-2.5 rounded-[12px] border border-line bg-white px-4 py-3 text-sm leading-[1.7] text-ink">
                <span className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full bg-chipbg text-[11px] font-bold text-ink-mute">
                  {index + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-ink-mute">준비된 팁이 아직 없어요</p>
        )}
      </section>

      {fish.similarFishes.length > 0 ? (
        <section className="mt-9">
          <h2 className="m-0 mb-3.5 text-[19px] font-extrabold tracking-normal text-ink">비슷한 생선</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fish.similarFishes.map((similar) => (
              <FishCard key={similar.id} fish={similar} />
            ))}
          </div>
        </section>
      ) : null}

      <section id="reviews" className="mt-14 border-t border-line pt-[34px]">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="m-0 text-[19px] font-extrabold tracking-normal text-ink">후기</h2>
          <span className="text-[13px] tabular-nums text-ink-mute">{reviewCount}개</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-card border border-line bg-white p-[18px]">
            <div className="text-[34px] font-extrabold leading-[1.1] tabular-nums text-ink">
              {avgRating.toFixed(1)} <span className="text-[15px] font-semibold text-ink-mute">/ 5</span>
            </div>
            <RatingStars rating={Math.round(avgRating)} className="mb-1 mt-0.5 block text-[15px] tracking-[1px]" />
            <div className="mb-3.5 text-[13px] text-ink-mute">후기 {reviewCount}개</div>
            <RatingDistributionBars distribution={ratingDistribution} />
            <button
              type="button"
              onClick={openReviewForm}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border-0 bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea"
            >
              후기 쓰기
            </button>
          </aside>

          <div className="min-w-0">
            <ReviewSortChips value={reviewSort} onChange={setReviewSort} />

            {reviewActionError ? <p className="m-0 mb-3 rounded-[10px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{reviewActionError}</p> : null}

            <ReviewList
              reviews={reviewList?.reviews ?? []}
              onDelete={handleDeleteReview}
              onHelpful={handleHelpfulReview}
              workingReviewId={
                helpfulMutation.isPending
                  ? helpfulMutation.variables
                  : deleteMutation.isPending
                    ? deleteMutation.variables?.reviewId
                    : undefined
              }
            />

            <ReviewForm
              formRef={reviewFormRef}
              resetKey={reviewFormResetKey}
              submitting={createMutation.isPending}
              error={formError}
              onSubmit={handleCreate}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function SpecCell({
  label,
  value,
  subValue,
  strongClassName = '',
}: {
  label: string;
  value: string;
  subValue?: string;
  strongClassName?: string;
}) {
  return (
    <div className="border-r border-line px-3.5 py-3 last:border-r-0 sm:px-4">
      <div className="mb-[5px] text-xs font-semibold text-ink-mute">{label}</div>
      <div className={['break-keep text-sm font-bold leading-snug', strongClassName].join(' ')}>
        {value}
        {subValue ? <span className="ml-1 font-medium text-ink-mute">{subValue}</span> : null}
      </div>
    </div>
  );
}

function ReviewSortChips({ value, onChange }: { value: ReviewSort; onChange: (value: ReviewSort) => void }) {
  return (
    <div className="mb-3 flex gap-2" aria-label="후기 정렬">
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
    'inline-flex min-h-8 items-center rounded-full px-[13px] py-[5px] text-[13px] font-semibold transition',
    active ? 'bg-sea text-white' : 'bg-chipbg text-ink hover:text-sea',
  ].join(' ');
}

function RatingDistributionBars({ distribution }: { distribution: RatingDistribution }) {
  const rows = [5, 4, 3, 2, 1] as const;
  const total = rows.reduce((sum, star) => sum + (distribution[String(star) as keyof RatingDistribution] ?? 0), 0);

  return (
    <div className="grid gap-[5px]">
      {rows.map((star) => {
        const count = distribution[String(star) as keyof RatingDistribution] ?? 0;
        const width = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="grid grid-cols-[26px_minmax(0,1fr)_20px] items-center gap-2 text-xs tabular-nums text-ink-mute">
            <span>{star}점</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-chipbg">
              <div className="h-full rounded-full bg-sea" style={{ width: `${width}%` }} />
            </div>
            <span className="text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function StateText({ text }: { text: string }) {
  return <main className="mx-auto max-w-[980px] px-4 py-12 text-center text-ink-mute sm:px-6">{text}</main>;
}

function RatingStars({ rating, className = '' }: { rating: number; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span className={className} aria-label={`${full}점`}>
      <span className="text-star">{'★'.repeat(full)}</span>
      <span className="text-line">{'★'.repeat(5 - full)}</span>
    </span>
  );
}
