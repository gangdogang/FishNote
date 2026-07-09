import { Link } from 'react-router-dom';
import FishPlaceholder from './FishPlaceholder';
import RatingSummary from './RatingSummary';
import SaveButton from './SaveButton';
import { SeasonBadgeNow, SeasonBadgeOutline } from './SeasonBadge';
import { formatPriceLevel, formatSeasonBadge, isInSeasonNow } from '../lib/format';
import type { FishSummary, SimilarFish } from '../types/fish';

interface FishCardProps {
  fish: FishSummary | SimilarFish;
  variant?: 'default' | 'wide';
}

export default function FishCard({ fish, variant = 'default' }: FishCardProps) {
  const summary = fish as FishSummary;
  const hasSummary = 'description' in summary;
  const nameEn = getOptionalString(fish, 'nameEn');
  const seasonMonths = 'seasonMonths' in summary ? summary.seasonMonths : [];
  const inSeasonNow = seasonMonths.length > 0 && isInSeasonNow(seasonMonths);
  const reviewCount = 'reviewCount' in summary ? summary.reviewCount : undefined;
  const shouldShowRating = 'avgRating' in summary && typeof reviewCount === 'number' && reviewCount > 0;
  const isWide = variant === 'wide';

  return (
    <Link
      to={`/fish/${fish.id}`}
      className="group block overflow-hidden rounded-card border border-line bg-white shadow-none transition duration-150 hover:shadow-[0_8px_24px_rgba(26,43,51,0.08)]"
    >
      <div className={['relative flex items-center justify-center bg-chipbg', isWide ? 'aspect-[5/2]' : 'aspect-[4/3]'].join(' ')}>
        {fish.imageUrl ? (
          <img src={fish.imageUrl} alt={`${fish.name} 회 사진`} className="h-full w-full object-cover" />
        ) : (
          <FishPlaceholder className={isWide ? 'h-[60px] w-[96px] stroke-ink-mute/30' : 'h-[51px] w-[82px] stroke-ink-mute/30'} />
        )}
        {inSeasonNow ? <SeasonBadgeNow className="absolute left-2.5 top-2.5" /> : null}
        <SaveButton fishId={fish.id} fishName={fish.name} />
      </div>

      <div className="p-3.5">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-bold leading-tight text-ink">{fish.name}</h3>
            {nameEn ? <span className="block truncate text-xs leading-snug text-ink-mute">{nameEn}</span> : null}
          </div>
          {shouldShowRating ? <RatingSummary avgRating={summary.avgRating} reviewCount={reviewCount} /> : null}
        </div>

        {hasSummary && summary.description ? (
          <p className={['mb-2.5 mt-[3px] text-[13px] leading-[1.5] text-ink-mute', isWide ? 'line-clamp-2' : 'truncate'].join(' ')}>
            {summary.description}
          </p>
        ) : null}

        {'priceLevel' in summary || seasonMonths.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            {seasonMonths.length > 0 ? <SeasonBadgeOutline label={formatSeasonBadge(seasonMonths)} /> : <span />}
            {'priceLevel' in summary ? (
              <span className="flex-none text-[13px] font-bold tabular-nums text-ink">{formatPriceLevel(summary.priceLevel)}</span>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function getOptionalString(value: object, key: string) {
  if (key in value) {
    const maybeString = (value as Record<string, unknown>)[key];
    return typeof maybeString === 'string' ? maybeString : undefined;
  }
  return undefined;
}
