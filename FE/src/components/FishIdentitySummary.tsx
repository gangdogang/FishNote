import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMonths, formatPriceLevel, isInSeasonNow } from '../lib/format';
import type { FishDetail, FishPriceObservation, FishPriceSummary } from '../types/fish';

interface FishIdentitySummaryProps {
  fish: FishDetail;
  priceSummary?: FishPriceSummary;
  bookmarked: boolean;
  pending?: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
  onShare: () => void;
  verification?: ReactNode;
  className?: string;
}

export default function FishIdentitySummary({
  fish,
  priceSummary,
  bookmarked,
  pending = false,
  canGoBack,
  onBack,
  onToggleBookmark,
  onShare,
  verification,
  className = '',
}: FishIdentitySummaryProps) {
  const inSeasonNow = isInSeasonNow(fish.seasonMonths);
  const aliases = fish.aliases?.filter(Boolean) ?? [];
  const tasteSummary = fish.tasteTags.slice(0, 2).join(' · ') || '정보 준비 중';
  const priceSummaryLabel = priceSummary?.latest
    ? formatQuickPrice(priceSummary.latest)
    : formatPriceLevel(fish.priceLevel, { withLabel: true }) || '정보 준비 중';

  return (
    <div className={['min-w-0', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-btn bg-transparent pr-2 text-body-sm font-medium text-ink-mute transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {canGoBack ? '이전으로' : '도감으로'}
      </button>

      <div className="mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-normal text-ink">{fish.name}</h1>
          {fish.category ? (
            <span className="rounded-full bg-chipbg px-2 py-1 text-caption font-semibold text-ink-mute">
              {categoryLabel(fish.category)}
            </span>
          ) : null}
        </div>
        {fish.nameEn ? <p className="m-0 mt-0.5 text-body-sm leading-snug text-ink-mute">{fish.nameEn}</p> : null}
        {fish.scientificName ? <p className="m-0 mt-0.5 text-caption italic leading-snug text-ink-mute">{fish.scientificName}</p> : null}
        {aliases.length > 0 ? (
          <p className="m-0 mt-1 text-caption leading-5 text-ink-mute">다른 이름 {aliases.join(' · ')}</p>
        ) : null}
      </div>

      {verification}

      <dl className="mb-4 grid grid-cols-3 overflow-hidden rounded-card border border-line bg-surface">
        <QuickFact label="제철" value={inSeasonNow ? '지금 제철' : formatMonths(fish.seasonMonths)} />
        <QuickFact label="대표 맛" value={tasteSummary} />
        <QuickFact label="최근 가격" value={priceSummaryLabel} />
      </dl>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-primary bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          aria-label={pending ? '횟감 저장 처리 중' : bookmarked ? '횟감 저장 해제' : '횟감 저장'}
          aria-pressed={bookmarked}
        >
          <Heart className={bookmarked ? 'h-4 w-4 fill-on-primary text-on-primary' : 'h-4 w-4'} aria-hidden />
          {pending ? (bookmarked ? '해제 중...' : '저장 중...') : bookmarked ? '저장됨' : '저장하기'}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-btn border border-line bg-surface px-4 py-2.5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          aria-label={`${fish.name} 공유하기`}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          공유
        </button>
      </div>
    </div>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-line px-2.5 py-3 last:border-r-0 sm:px-4">
      <dt className="mb-1 text-caption font-semibold text-ink-mute">{label}</dt>
      <dd className="m-0 break-words text-[13px] font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-body-sm">{value}</dd>
    </div>
  );
}

function formatQuickPrice(observation: FishPriceObservation) {
  const compact = (value: number) => {
    if (value < 10_000) return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
    const amount = value / 10_000;
    return `${amount.toFixed(Number.isInteger(amount) ? 0 : 1)}만원`;
  };
  const range = observation.priceMinKrw === observation.priceMaxKrw
    ? compact(observation.priceMinKrw)
    : `${compact(observation.priceMinKrw)}–${compact(observation.priceMaxKrw)}`;
  return observation.unit ? `${range}/${observation.unit}` : range;
}

function categoryLabel(category: FishDetail['category']) {
  if (category === 'SHELLFISH') return '패류';
  if (category === 'CEPHALOPOD') return '두족류';
  return '어류';
}
