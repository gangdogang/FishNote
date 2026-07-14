import { Heart, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import FishCard from '../components/FishCard';
import FishPlaceholder from '../components/FishPlaceholder';
import ReviewForm from '../components/ReviewForm';
import ReviewList from '../components/ReviewList';
import SeasonBar from '../components/SeasonBar';
import { SeasonBadgeNow } from '../components/SeasonBadge';
import { DetailSkeleton } from '../components/Skeletons';
import { useToast } from '../components/Toast';
import { formatMonths, formatPriceLabel, formatPriceLevel, isInSeasonNow } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { useFishDetail, useFishPrices } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';
import { useBookmarks } from '../hooks/useBookmarks';
import { useCreateReview, useDeleteReview, useMarkReviewHelpful, useReviews } from '../hooks/useReviews';
import type { FishPriceObservation, FishPriceSummary, FishPriceTrendPoint, FishVariantPriceSeries, RatingDistribution } from '../types/fish';
import type { ReviewRequest, ReviewSort } from '../types/review';

export default function FishDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const fishId = Number(params.id);
  // 앱 안에서 이동해 온 경우에만 브라우저 히스토리로 복귀 (검색 결과·필터 유지)
  const canGoBack = location.key !== 'default';
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviewFormResetKey, setReviewFormResetKey] = useState(0);
  const [formError, setFormError] = useState<string | undefined>();
  const [reviewActionError, setReviewActionError] = useState<string | undefined>();
  const [reviewSort, setReviewSort] = useState<ReviewSort>('latest');
  const reviewFormRef = useRef<HTMLFormElement>(null);
  const { data: fish, isLoading, isError } = useFishDetail(fishId);
  const { data: priceSummary } = useFishPrices(fishId);
  const {
    data: reviewList,
    fetchNextPage: fetchNextReviews,
    hasNextPage: hasNextReviews,
    isFetchingNextPage: isFetchingNextReviews,
  } = useReviews(fishId, reviewSort);
  const createMutation = useCreateReview(fishId);
  const deleteMutation = useDeleteReview(fishId);
  const helpfulMutation = useMarkReviewHelpful(fishId);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  usePageMeta(
    fish?.name,
    fish ? `${fish.name} 회의 제철·맛·가격과 실제 후기를 확인해보세요.` : undefined,
    fish?.imageUrl,
  );

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
      onSuccess: () => {
        setReviewFormResetKey((key) => key + 1);
        // 최신순으로 바꿔 방금 쓴 후기가 목록 맨 위에 보이게 한 뒤 그 위치로 이동
        setReviewSort('latest');
        showToast('후기가 등록됐어요');
        window.requestAnimationFrame(() => {
          document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      },
      onError: (error) => setFormError(getErrorMessage(error)),
    });
  }

  async function handleShare() {
    if (!fish) return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `${fish.name} | FishNote`,
          text: `${fish.name} 회의 제철·맛·가격, FishNote에서 확인해보세요.`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('링크를 복사했어요');
    } catch {
      // 사용자가 공유 시트를 닫은 경우 등은 조용히 무시
    }
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
    <main className="mx-auto max-w-content px-4 pb-20 pt-7 sm:px-7">
      <section className="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="flex aspect-[4/3] max-h-[420px] w-full items-center justify-center overflow-hidden rounded-2xl bg-chipbg">
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
                  <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <button
            type="button"
            onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
            className="mb-3 inline-flex bg-transparent p-0 text-13 font-medium text-ink-mute transition hover:text-sea"
          >
            ← {canGoBack ? '이전으로' : '도감으로'}
          </button>

          <div className="mb-2 min-h-[26px]">{inSeasonNow ? <SeasonBadgeNow /> : null}</div>

          <div className="mb-2.5">
            <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-normal text-ink">{fish.name}</h1>
            {fish.nameEn ? <p className="m-0 mt-0.5 text-sm leading-snug text-ink-mute">{fish.nameEn}</p> : null}
          </div>

          {description ? <p className="m-0 mb-3 text-15 leading-[1.7] text-ink">{description}</p> : null}

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

          <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-card border border-line bg-surface">
            <SpecCell label="제철" value={formatMonths(fish.seasonMonths)} />
            <SpecCell label="맛" value={fish.tasteTags.length > 0 ? fish.tasteTags.join(' · ') : '정보 준비 중'} />
            <SpecCell
              label="가격대"
              value={fish.priceLevel ? formatPriceLevel(fish.priceLevel) : '정보 준비 중'}
              subValue={formatPriceLabel(fish.priceLevel)}
              strongClassName="text-ink"
            />
          </div>

          {priceSummary?.latest ? (
            <button
              type="button"
              onClick={() => document.getElementById('price-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="-mt-2.5 mb-5 inline-flex min-h-11 items-center gap-1 bg-transparent p-0 text-13 font-semibold text-sea transition hover:text-sea-deep"
            >
              최근 시장가 {formatObservedPrice(priceSummary.latest)}
              {priceSummary.latest.unit ? ` / ${priceSummary.latest.unit}` : ''} · 가격 현황 보기 ↓
            </button>
          ) : null}

          <div className="mb-5">
            <SeasonBar months={fish.seasonMonths} />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => toggleBookmark(fish.id)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-sea bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea-deep"
              aria-label={bookmarked ? '생선 저장 해제' : '생선 저장'}
              aria-pressed={bookmarked}
            >
              <Heart className={bookmarked ? 'h-4 w-4 fill-white text-white' : 'h-4 w-4 fill-none text-white'} aria-hidden />
              {bookmarked ? '저장됨' : '저장하기'}
            </button>
            <button
              type="button"
              onClick={openReviewForm}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-btn border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink transition hover:border-sea hover:text-sea"
            >
              후기 쓰기
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink transition hover:border-sea hover:text-sea"
              aria-label={`${fish.name} 공유하기`}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              공유
            </button>
          </div>
        </div>
      </section>

      {priceSummary?.latest ? <RecentPriceSection key={fish.id} fishName={fish.name} summary={priceSummary} /> : null}

      <section className="mt-11">
        <h2 className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">어떤 맛인가요?</h2>
        {tasteDescription ? (
          <p className="m-0 max-w-[640px] text-15 leading-[1.8] text-ink">{tasteDescription}</p>
        ) : (
          <p className="m-0 text-sm text-ink-mute">맛 설명을 준비 중이에요</p>
        )}
      </section>

      <section className="mt-9">
        <h2 className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">이렇게 즐겨요</h2>
        {tips.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {tips.map((tip, index) => (
              <li key={`${tip}-${index}`} className="flex items-start gap-2.5 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm leading-[1.7] text-ink">
                <span className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full bg-chipbg text-11 font-bold text-ink-mute">
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

      <aside className="mt-9 rounded-card border border-line bg-sea-soft/60 px-4 py-4 text-13 leading-[1.7] text-ink-mute sm:px-5">
        <p className="m-0">
          제철과 맛 정보는 산지·수온·유통 방식에 따라 달라질 수 있어요.{' '}
          <Link to="/sources" className="inline-flex min-h-11 items-center font-bold text-sea underline-offset-2 hover:underline">
            검수 기준과 출처 보기
          </Link>
        </p>
      </aside>

      {fish.similarFishes.length > 0 ? (
        <section className="mt-9">
          <h2 className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">비슷한 생선</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fish.similarFishes.map((similar) => (
              <FishCard key={similar.id} fish={similar} />
            ))}
          </div>
        </section>
      ) : null}

      <section id="reviews" className="mt-14 border-t border-line pt-[34px]">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="m-0 text-19 font-extrabold tracking-normal text-ink">후기</h2>
          <span className="text-13 tabular-nums text-ink-mute">{reviewCount}개</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-card border border-line bg-surface p-[18px]">
            <div className="text-[34px] font-extrabold leading-[1.1] tabular-nums text-ink">
              {avgRating.toFixed(1)} <span className="text-15 font-semibold text-ink-mute">/ 5</span>
            </div>
            <RatingStars rating={Math.round(avgRating)} className="mb-1 mt-0.5 block text-15 tracking-[1px]" />
            <div className="mb-3.5 text-13 text-ink-mute">후기 {reviewCount}개</div>
            <RatingDistributionBars distribution={ratingDistribution} />
            <button
              type="button"
              onClick={openReviewForm}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-btn border-0 bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea-deep"
            >
              후기 쓰기
            </button>
          </aside>

          <div className="min-w-0">
            <ReviewSortChips value={reviewSort} onChange={setReviewSort} />

            {reviewActionError ? <p className="m-0 mb-3 rounded-btn bg-red-50 dark:bg-red-950/40 px-3 py-2 text-13 font-medium text-red-700 dark:text-red-400">{reviewActionError}</p> : null}

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

            {hasNextReviews ? (
              <button
                type="button"
                onClick={() => fetchNextReviews()}
                disabled={isFetchingNextReviews}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-btn border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink transition hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:text-ink-mute"
              >
                {isFetchingNextReviews ? '후기를 불러오는 중...' : `후기 더 보기 (${reviewList?.reviews.length ?? 0}/${reviewCount})`}
              </button>
            ) : null}

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

function RecentPriceSection({ fishName, summary }: { fishName: string; summary: FishPriceSummary }) {
  const shopSeries = summary.byShop ?? [];
  const recentFallback = summary.recent.slice(0, 3);

  return (
    <section id="price-section" className="mt-11 scroll-mt-24" aria-labelledby="recent-price-heading">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-price-heading" className="m-0 text-19 font-extrabold tracking-normal text-ink">
          가격 현황
        </h2>
        <span className="rounded-full bg-chipbg px-3 py-1.5 text-xs font-semibold tabular-nums text-ink-mute">
          최근 {summary.days}일 · {summary.observationCount}건
        </span>
      </div>

      <PriceTrendPanel fishName={fishName} summary={summary} />

      {shopSeries.length > 0 ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {shopSeries.map((shop) => (
            <PriceObservationCard
              key={shop.shopName}
              observation={shop.latest}
              label={shop.shopName}
              meta={`${shop.observationCount}건 관측`}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {recentFallback.map((observation, index) => (
            <PriceObservationCard
              key={`${observation.observedAt}-${observation.priceMinKrw}-${index}`}
              observation={observation}
              label={index === 0 ? '가장 최근' : (observation.shopName ?? observation.sourceLabel)}
            />
          ))}
        </div>
      )}

      <p className="m-0 mt-3 text-xs leading-[1.7] text-ink-mute">
        상회에서 관측한 참고 가격이에요. 실제 판매가는 중량·손질·포장 방식에 따라 달라질 수 있어요.
      </p>
    </section>
  );
}

const VARIANT_ALL = '__all__';

const SERIES_COLORS = [
  'rgb(var(--c-sea))',
  '#E0A030',
  '#C25B4E',
  '#7B68AE',
  '#4E9A6C',
  '#B0578D',
  '#5C7CC4',
  '#8A8F53',
];

function seriesColor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

function variantChipLabel(variant: FishVariantPriceSeries) {
  return variant.unit ? `${variant.variantLabel} · ${variant.unit}` : variant.variantLabel;
}

function unitSuffix(unit: string | null) {
  return unit ? ` / ${unit}` : '';
}

interface ChartSeries {
  key: string;
  label: string;
  color: string;
  points: FishPriceTrendPoint[];
}

function PriceTrendPanel({ fishName, summary }: { fishName: string; summary: FishPriceSummary }) {
  const [selectedKey, setSelectedKey] = useState(VARIANT_ALL);
  const variants = (summary.byVariant ?? []).filter((variant) => variant.graph.length > 0);
  const showChips = variants.length > 1;
  const selected = showChips ? variants.find((variant) => variant.variantKey === selectedKey) : variants[0];

  const series: ChartSeries[] =
    showChips && !selected
      ? variants.map((variant, index) => ({
          key: variant.variantKey,
          label: variantChipLabel(variant),
          color: seriesColor(index),
          points: variant.graph,
        }))
      : selected
        ? [
            {
              key: selected.variantKey,
              label: variantChipLabel(selected),
              color: seriesColor(Math.max(0, variants.indexOf(selected))),
              points: selected.graph,
            },
          ]
        : [{ key: 'daily', label: '일별 평균', color: seriesColor(0), points: summary.dailyAverage ?? [] }];

  const headline = selected?.latest ?? summary.latest;
  const headlineUnit = selected ? selected.unit : (summary.latest?.unit ?? null);
  const chartTitle = selected ? `${selected.variantLabel} · 일별 평균 단가` : '일별 평균 단가';

  return (
    <article className="rounded-card border border-line bg-surface px-4 py-4 sm:px-5">
      {showChips ? (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="원산지·양식 구분 선택">
          <VariantChip
            label="전체"
            active={!selected}
            onClick={() => setSelectedKey(VARIANT_ALL)}
          />
          {variants.map((variant) => (
            <VariantChip
              key={variant.variantKey}
              label={variantChipLabel(variant)}
              active={selected?.variantKey === variant.variantKey}
              onClick={() => setSelectedKey(variant.variantKey)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="m-0 text-13 font-semibold text-ink-mute">
            {fishName} 최신 관측가{selected ? ` · ${selected.variantLabel}` : ''}
          </p>
          {headline ? (
            <>
              <p className="m-0 mt-1 text-28 font-extrabold leading-tight tabular-nums text-ink">
                {formatObservedPrice(headline)}
                {headlineUnit ? <span className="ml-1 text-15 font-semibold text-ink-mute">{unitSuffix(headlineUnit).trim()}</span> : null}
              </p>
              <p className="m-0 mt-2 text-13 leading-[1.6] text-ink-mute">
                {headline.shopName ?? headline.sourceLabel} · {formatObservedAt(headline.observedAt)}
              </p>
            </>
          ) : (
            <p className="m-0 mt-2 text-sm text-ink-mute">아직 관측된 시세가 없어요</p>
          )}
        </div>

        <PriceChart title={chartTitle} series={series} />
      </div>
    </article>
  );
}

function VariantChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2',
        active ? 'bg-sea text-white' : 'bg-chipbg text-ink hover:text-sea',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function PriceChart({ title, series }: { title: string; series: ChartSeries[] }) {
  const drawable = series.filter((entry) => entry.points.length > 0);

  if (drawable.length === 0) {
    return <div className="flex h-44 items-center justify-center rounded-[10px] bg-chipbg text-sm text-ink-mute">그래프를 만들 시세가 아직 없어요</div>;
  }

  const width = 640;
  const height = 200;
  const padLeft = 48;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 30;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const axisY = height - padBottom;

  const dates = Array.from(new Set(drawable.flatMap((entry) => entry.points.map((point) => point.observedDate)))).sort();
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const values = drawable.flatMap((entry) => entry.points.map((point) => point.avgPriceKrw));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);

  const xFor = (date: string) => {
    const index = dateIndex.get(date) ?? 0;
    return dates.length === 1 ? padLeft + plotWidth / 2 : padLeft + (index / (dates.length - 1)) * plotWidth;
  };
  const yFor = (value: number) => padTop + (1 - (value - minValue) / range) * plotHeight;

  const maxTicks = 6;
  const step = Math.max(1, Math.ceil(dates.length / maxTicks));
  const tickIndexes = new Set<number>();
  for (let index = 0; index < dates.length; index += step) tickIndexes.add(index);
  tickIndexes.add(dates.length - 1);
  if (dates.length > 2) {
    const beforeLast = [...tickIndexes].filter((index) => index !== dates.length - 1).pop();
    if (beforeLast !== undefined && dates.length - 1 - beforeLast < Math.max(1, Math.round(step / 2))) {
      tickIndexes.delete(beforeLast);
    }
  }

  const showDots = drawable.length === 1 || dates.length <= 16;
  const minLabelY = Math.min(axisY - 6, yFor(minValue) + 4);
  const maxLabelY = Math.max(padTop + 4, yFor(maxValue) + 4);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-13 font-semibold text-ink-mute">{title}</span>
        <span className="text-11 tabular-nums text-ink-mute">
          {formatObservedDate(dates[0])} - {formatObservedDate(dates[dates.length - 1])}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="최근 시세 일별 평균 그래프" className="h-48 w-full overflow-visible rounded-[10px] bg-chipbg">
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={axisY} stroke="rgb(var(--c-line))" strokeWidth="1" />
        <line x1={padLeft} y1={axisY} x2={width - padRight} y2={axisY} stroke="rgb(var(--c-line))" strokeWidth="1" />
        <text x={padLeft - 7} y={maxLabelY} textAnchor="end" fill="rgb(var(--c-ink-mute))" fontSize="11">
          {formatCompactPrice(maxValue)}
        </text>
        {maxValue !== minValue ? (
          <text x={padLeft - 7} y={minLabelY} textAnchor="end" fill="rgb(var(--c-ink-mute))" fontSize="11">
            {formatCompactPrice(minValue)}
          </text>
        ) : null}
        {[...tickIndexes].sort((a, b) => a - b).map((index) => {
          const date = dates[index];
          const x = xFor(date);
          const anchor = index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle';
          return (
            <text key={date} x={x} y={height - 9} textAnchor={anchor} fill="rgb(var(--c-ink-mute))" fontSize="11">
              {formatObservedDate(date)}
            </text>
          );
        })}
        {drawable.map((entry) => {
          const sorted = [...entry.points].sort((a, b) => a.observedDate.localeCompare(b.observedDate));
          const path = sorted
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.observedDate).toFixed(1)} ${yFor(point.avgPriceKrw).toFixed(1)}`)
            .join(' ');
          return (
            <g key={entry.key}>
              {sorted.length > 1 ? (
                <path d={path} fill="none" stroke={entry.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              {showDots
                ? sorted.map((point) => (
                    <circle
                      key={point.observedDate}
                      cx={xFor(point.observedDate)}
                      cy={yFor(point.avgPriceKrw)}
                      r={drawable.length > 1 ? 3.5 : 4.5}
                      fill="rgb(var(--c-surface))"
                      stroke={entry.color}
                      strokeWidth="2.5"
                    />
                  ))
                : null}
            </g>
          );
        })}
      </svg>
      {drawable.length > 1 ? (
        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0" aria-label="그래프 범례">
          {drawable.map((entry) => (
            <li key={entry.key} className="flex items-center gap-1.5 text-xs font-medium text-ink-mute">
              <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PriceObservationCard({
  observation,
  label,
  meta,
}: {
  observation: FishPriceObservation;
  label: string;
  meta?: string;
}) {
  const details = [observation.origin, observation.sizeGrade, observation.unit ? `${observation.unit} 기준` : null].filter(Boolean);

  return (
    <article className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-ink-mute">{label}</span>
        <time dateTime={observation.observedAt} className="text-11 tabular-nums text-ink-mute">
          {formatObservedAt(observation.observedAt)}
        </time>
      </div>
      <p className="m-0 text-lg font-extrabold tabular-nums tracking-tight text-ink">{formatObservedPrice(observation)}</p>
      <p className="m-0 mt-1 min-h-5 text-xs leading-5 text-ink-mute">{details.length > 0 ? details.join(' · ') : '세부 규격 정보 없음'}</p>
      {meta ? <p className="m-0 mt-2 text-11 font-semibold text-ink-mute">{meta}</p> : null}
    </article>
  );
}

function formatObservedPrice(observation: FishPriceObservation) {
  const format = (value: number) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  return observation.priceMinKrw === observation.priceMaxKrw
    ? format(observation.priceMinKrw)
    : `${format(observation.priceMinKrw)}–${format(observation.priceMaxKrw)}`;
}

function formatObservedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '관측 시각 미상';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatObservedDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date);
}

function formatCompactPrice(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}만`;
  return new Intl.NumberFormat('ko-KR').format(value);
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
    'inline-flex min-h-11 items-center rounded-full px-3.25 py-1.75 text-13 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2',
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
  return <main className="mx-auto max-w-content px-4 py-12 text-center text-ink-mute sm:px-6">{text}</main>;
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
