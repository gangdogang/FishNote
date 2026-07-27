import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import FishIdentitySummary from '../components/FishIdentitySummary';
import FishMediaGallery from '../components/FishMediaGallery';
import FishServingTipsSection from '../components/FishServingTipsSection';
import FishTasteSection from '../components/FishTasteSection';
import PriceSection from '../components/PriceSection';
import ReviewSection from '../components/ReviewSection';
import SimilarFishSection from '../components/SimilarFishSection';
import CorrectionDialog from '../components/CorrectionDialog';
import { DetailSkeleton } from '../components/Skeletons';
import SourceSection from '../components/SourceSection';
import VerificationSummary from '../components/VerificationSummary';
import { useToast } from '../hooks/useToast';
import { getErrorMessage, getHttpStatus } from '../lib/errors';
import { isValidFishIdentifier } from '../lib/fishRoutes';
import { useFishDetail, useFishPrices } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';
import { useBookmarks } from '../hooks/useBookmarks';
import { useFishSources, useSubmitFishCorrection } from '../hooks/useFishSources';
import { useCreateReview, useDeleteReview, useMarkReviewHelpful, useReviews } from '../hooks/useReviews';
import type { ReviewRequest, ReviewSort } from '../types/review';
import type { FishClaimType, FishCorrectionRequest } from '../types/source';
import { trackAnalyticsEvent } from '../lib/analytics';
import { isInSeasonNow } from '../lib/format';
import type { FishDetail } from '../types/fish';

export default function FishDetailPage() {
  const params = useParams();
  const identifier = params.identifier ?? '';
  return <FishDetailPageContent key={identifier || 'invalid'} identifier={identifier} />;
}

function FishDetailPageContent({ identifier }: { identifier: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  // 앱 안에서 이동해 온 경우에만 브라우저 히스토리로 복귀 (검색 결과·필터 유지)
  const canGoBack = location.key !== 'default';
  const [reviewFormResetKey, setReviewFormResetKey] = useState(0);
  const [formError, setFormError] = useState<string | undefined>();
  const [reviewActionError, setReviewActionError] = useState<string | undefined>();
  const [reviewSort, setReviewSort] = useState<ReviewSort>('latest');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionClaimType, setCorrectionClaimType] = useState<FishClaimType>('SEASON');
  const reviewFormRef = useRef<HTMLFormElement>(null);
  const {
    data: fish,
    error: fishError,
    isLoading,
    isFetching: isFishFetching,
    isError,
    refetch: refetchFish,
  } = useFishDetail(identifier);
  const {
    data: sourceData,
    isLoading: isSourcesLoading,
    isFetching: isSourcesFetching,
    isError: isSourcesError,
    refetch: refetchSources,
  } = useFishSources(identifier);
  const fishId = fish?.id ?? Number.NaN;
  const {
    data: priceSummary,
    isLoading: isPriceLoading,
    isFetching: isPriceFetching,
    isError: isPriceError,
    refetch: refetchPrices,
  } = useFishPrices(fishId);
  const {
    data: reviewList,
    fetchNextPage: fetchNextReviews,
    hasNextPage: hasNextReviews,
    isFetchingNextPage: isFetchingNextReviews,
    isFetchNextPageError,
    isLoading: isReviewsLoading,
    isFetching: isReviewsFetching,
    isError: isReviewsError,
    refetch: refetchReviews,
  } = useReviews(fishId, reviewSort);
  const createMutation = useCreateReview(fishId);
  const deleteMutation = useDeleteReview(fishId);
  const helpfulMutation = useMarkReviewHelpful(fishId);
  const correctionMutation = useSubmitFishCorrection(fishId);
  const { isBookmarked, toggleBookmark, isServerMode } = useBookmarks();
  const detailTrackedFishId = useRef<number | null>(null);
  const sourceSection = readSourceSection(location.state);
  const isNotFound = !isValidFishIdentifier(identifier) || (isError && isNotFoundError(fishError));
  const resolvedFish = isNotFound ? undefined : fish;
  const canonicalPath = resolvedFish?.slug ? `/fish/${resolvedFish.slug}` : `/fish/${identifier}`;
  const detailDescription = resolvedFish
    ? `${resolvedFish.name} 회의 제철·맛·가격과 실제 후기를 확인해보세요.`
    : isNotFound
      ? '요청한 횟감을 FishNote 도감에서 찾을 수 없습니다.'
      : undefined;
  usePageMeta(
    isNotFound ? '횟감을 찾을 수 없어요' : resolvedFish ? `${resolvedFish.name} 회 도감` : undefined,
    detailDescription,
    resolvedFish?.media?.url ?? resolvedFish?.imageUrl,
    {
      canonicalPath,
      noindex: isNotFound,
      type: resolvedFish ? 'article' : 'website',
      structuredData: resolvedFish
        ? createFishStructuredData(resolvedFish, canonicalPath, detailDescription ?? '')
        : undefined,
    },
  );

  useEffect(() => {
    if (!fish || isPriceLoading || isSourcesLoading || detailTrackedFishId.current === fish.id) return;
    detailTrackedFishId.current = fish.id;
    trackAnalyticsEvent('fish_detail_viewed', {
      fishId: fish.id,
      sourceSection,
      inSeason: isInSeasonNow(fish.seasonMonths),
      hasPrice: Boolean(priceSummary && priceSummary.observationCount > 0),
      verificationStatus: sourceData?.summary.verificationStatus,
    });
  }, [fish, isPriceLoading, isSourcesLoading, priceSummary, sourceData, sourceSection]);

  function handleCreate(request: ReviewRequest) {
    setFormError(undefined);
    createMutation.mutate(request, {
      onSuccess: () => {
        trackAnalyticsEvent('review_submitted', {
          fishId,
          authenticated: Boolean(isServerMode),
          hasImage: Boolean(request.imageAssetId || request.imageUrl),
        });
        setReviewFormResetKey((key) => key + 1);
        // 최신순으로 바꿔 방금 쓴 후기가 목록 맨 위에 보이게 한 뒤 그 위치로 이동
        setReviewSort('latest');
        showToast('후기가 등록됐어요');
        window.requestAnimationFrame(() => {
          document.getElementById('reviews')?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
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
        trackAnalyticsEvent('share_completed', { fishId: fish.id, method: 'native' });
        return;
      }
      await navigator.clipboard.writeText(url);
      trackAnalyticsEvent('share_completed', { fishId: fish.id, method: 'clipboard' });
      showToast('링크를 복사했어요');
    } catch {
      // 사용자가 공유 시트를 닫은 경우 등은 조용히 무시
    }
  }

  function openReviewForm() {
    setFormError(undefined);
    if (Number.isFinite(fishId)) {
      trackAnalyticsEvent('review_started', { fishId, authenticated: Boolean(isServerMode) });
    }
    window.requestAnimationFrame(() => {
      reviewFormRef.current?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' });
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

  function openCorrection(claimType: FishClaimType) {
    correctionMutation.reset();
    setCorrectionClaimType(claimType);
    setCorrectionOpen(true);
  }

  function closeCorrection() {
    if (correctionMutation.isPending) return;
    correctionMutation.reset();
    setCorrectionOpen(false);
  }

  async function handleCorrection(request: FishCorrectionRequest) {
    try {
      await correctionMutation.mutateAsync(request);
      trackAnalyticsEvent('correction_submitted', { fishId, claimType: request.claimType });
      setCorrectionOpen(false);
      showToast('정보 제보가 접수됐어요');
    } catch {
      // Mutation state is rendered in the dialog without closing the user's draft.
    }
  }

  if (!isValidFishIdentifier(identifier)) {
    return <FishNotFoundState />;
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError) {
    if (isNotFoundError(fishError)) return <FishNotFoundState />;
    return (
      <FishDetailErrorState
        isFetching={isFishFetching}
        onRetry={() => void refetchFish()}
      />
    );
  }

  if (!fish) {
    return (
      <FishDetailErrorState
        isFetching={isFishFetching}
        onRetry={() => void refetchFish()}
      />
    );
  }

  const tasteDescription = fish.tasteDesc ?? fish.description;
  const bookmarked = isBookmarked(fish.id);
  const claim = (claimType: FishClaimType) => sourceData?.claims.find((item) => item.claimType === claimType);

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-7 sm:px-7">
      <section className="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
        <FishIdentitySummary
          fish={fish}
          priceSummary={priceSummary}
          bookmarked={bookmarked}
          canGoBack={canGoBack}
          onBack={() => (canGoBack ? navigate(-1) : navigate('/'))}
          onToggleBookmark={() => toggleBookmark(fish.id)}
          onShare={() => void handleShare()}
          verification={(
            <VerificationSummary
              summary={sourceData?.summary}
              loading={isSourcesLoading}
              fetching={isSourcesFetching}
              error={isSourcesError}
              onRetry={() => void refetchSources()}
            />
          )}
          className="lg:order-2"
        />
        <FishMediaGallery fish={fish} className="lg:order-1" />
      </section>

      <FishTasteSection
        fishId={fish.id}
        description={tasteDescription}
        seasonMonths={fish.seasonMonths}
        tasteClaim={claim('TASTE')}
        seasonClaim={claim('SEASON')}
      />

      <PriceSection
        key={`price-${fish.id}`}
        fishId={fish.id}
        fishName={fish.name}
        summary={priceSummary}
        isLoading={isPriceLoading}
        isFetching={isPriceFetching}
        isError={isPriceError}
        onRetry={() => void refetchPrices()}
        sourceClaim={claim('PRICE')}
      />

      <FishServingTipsSection tips={fish.tips} />

      <SourceSection
        data={sourceData}
        loading={isSourcesLoading}
        fetching={isSourcesFetching}
        error={isSourcesError}
        onRetry={() => void refetchSources()}
        onReport={openCorrection}
      />

      <SimilarFishSection fishes={fish.similarFishes} />

      <ReviewSection
        key={`reviews-${fish.id}`}
        reviewList={reviewList}
        fallbackAvgRating={fish.avgRating}
        fallbackReviewCount={fish.reviewCount}
        fallbackRatingCount={fish.ratingCount}
        fallbackRatingDistribution={fish.ratingDistribution}
        isLoading={isReviewsLoading}
        isFetching={isReviewsFetching}
        isError={isReviewsError}
        onRetry={() => void refetchReviews()}
        sort={reviewSort}
        onSortChange={setReviewSort}
        hasNextPage={hasNextReviews}
        isFetchingNextPage={isFetchingNextReviews}
        isFetchNextPageError={isFetchNextPageError}
        onLoadMore={() => fetchNextReviews()}
        reviewFormProps={{
          formRef: reviewFormRef,
          resetKey: reviewFormResetKey,
          submitting: createMutation.isPending,
          error: formError,
          onSubmit: handleCreate,
        }}
        onDelete={handleDeleteReview}
        onHelpful={handleHelpfulReview}
        reviewActionError={reviewActionError}
        onOpenForm={openReviewForm}
      />

      <CorrectionDialog
        open={correctionOpen}
        fishName={fish.name}
        initialClaimType={correctionClaimType}
        submitting={correctionMutation.isPending}
        serverError={correctionMutation.isError ? getErrorMessage(correctionMutation.error) : undefined}
        onClearError={correctionMutation.reset}
        onSubmit={handleCorrection}
        onClose={closeCorrection}
      />
    </div>
  );
}

function readSourceSection(state: unknown) {
  if (!state || typeof state !== 'object') return 'direct';
  const value = (state as { sourceSection?: unknown }).sourceSection;
  return typeof value === 'string' && value.length <= 80 ? value : 'direct';
}

function FishNotFoundState() {
  return (
    <div className="mx-auto max-w-content px-4 py-12 text-center sm:px-6">
      <h1
        className="m-0 text-xl font-extrabold text-ink"
        data-route-announcement="횟감을 찾을 수 없어요 | FishNote"
      >
        횟감을 찾을 수 없어요
      </h1>
      <p className="m-0 mt-2 text-body-sm text-ink-mute">이 횟감을 아직 도감에서 찾을 수 없어요</p>
      <Link
        to="/"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        도감으로 돌아가기
      </Link>
    </div>
  );
}

function FishDetailErrorState({ isFetching, onRetry }: { isFetching: boolean; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-content px-4 py-12 text-center sm:px-6">
      <h1 className="m-0 text-xl font-extrabold text-ink">횟감 정보를 불러오지 못했어요.</h1>
      <p className="m-0 mt-2 text-body-sm text-ink-mute">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        aria-busy={isFetching}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-ink-mute"
      >
        {isFetching ? '상세를 다시 불러오는 중...' : '상세 다시 시도'}
      </button>
    </div>
  );
}

function isNotFoundError(error: unknown) {
  return getHttpStatus(error) === 404;
}

function preferredScrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}

function createFishStructuredData(fish: FishDetail, canonicalPath: string, description: string) {
  const canonical = new URL(canonicalPath, window.location.origin).toString();
  const home = new URL('/', window.location.origin).toString();
  const image = fish.media?.url ?? fish.imageUrl;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'FishNote', item: home },
        { '@type': 'ListItem', position: 2, name: fish.name, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${fish.name} 회 도감`,
      description,
      url: canonical,
      ...(image ? { primaryImageOfPage: new URL(image, window.location.origin).toString() } : {}),
      isPartOf: { '@type': 'WebSite', name: 'FishNote', url: home },
    },
  ];
}
