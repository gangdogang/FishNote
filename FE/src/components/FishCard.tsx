import { Link } from 'react-router-dom';
import RatingSummary from './RatingSummary';
import SaveButton from './SaveButton';
import { SeasonBadgeNow, SeasonBadgeOutline } from './SeasonBadge';
import SmartImage from './SmartImage';
import { formatPriceLevel, formatSeasonBadge, isInSeasonNow } from '../lib/format';
import { fishDetailPath } from '../lib/fishRoutes';
import { trackAnalyticsEvent } from '../lib/analytics';
import type { FishSort, FishSummary, SimilarFish } from '../types/fish';

interface FishCardProps {
  fish: FishSummary | SimilarFish;
  variant?: 'default' | 'wide';
  imageSizes?: string;
  analyticsSection?: string;
  analyticsPosition?: number;
  sort?: FishSort;
}

export default function FishCard({
  fish,
  variant = 'default',
  imageSizes,
  analyticsSection = 'catalog',
  analyticsPosition = 1,
  sort,
}: FishCardProps) {
  const summary = fish as FishSummary;
  const hasSummary = 'description' in summary;
  const nameEn = getOptionalString(fish, 'nameEn');
  const seasonMonths = 'seasonMonths' in summary ? summary.seasonMonths : [];
  const inSeasonNow = seasonMonths.length > 0 && isInSeasonNow(seasonMonths);
  const reviewCount = 'reviewCount' in summary ? summary.reviewCount : undefined;
  const ratingCount = 'ratingCount' in summary && typeof summary.ratingCount === 'number'
    ? summary.ratingCount
    : reviewCount;
  const shouldShowRating = 'avgRating' in summary && typeof ratingCount === 'number' && ratingCount > 0;
  const isWide = variant === 'wide';

  return (
    <article className="relative overflow-hidden rounded-card border border-line bg-surface shadow-none transition duration-150 hover:shadow-[0_8px_24px_rgba(26,43,51,0.08)]">
      <Link
        to={fishDetailPath(fish)}
        state={{ sourceSection: analyticsSection }}
        onClick={() => trackAnalyticsEvent('fish_card_clicked', {
          fishId: fish.id,
          section: analyticsSection,
          position: analyticsPosition,
          sort,
        })}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        <div
          className={[
            'relative flex items-center justify-center bg-chipbg',
            isWide ? 'aspect-[5/2]' : 'aspect-[4/3]',
          ].join(' ')}
        >
          <SmartImage
            media={fish.media}
            legacyUrl={fish.imageUrl}
            fallbackName={fish.name}
            sizes={imageSizes ?? (
              isWide
                ? '(max-width: 639px) 85vw, 430px'
                : '(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 28px), 280px'
            )}
            className="h-full"
          />
          {inSeasonNow ? <SeasonBadgeNow className="absolute left-2.5 top-2.5" /> : null}
        </div>

        <div className="p-3.5" data-fish-card-body>
          <div className="flex min-h-5 min-w-0 items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-bold leading-tight text-ink">{fish.name}</h3>
              {nameEn ? <span className="block truncate text-xs leading-snug text-ink-mute">{nameEn}</span> : null}
            </div>
            {shouldShowRating ? <RatingSummary avgRating={summary.avgRating} reviewCount={ratingCount ?? 0} /> : null}
          </div>

          <p
            className={[
              'mb-2.5 mt-[3px] text-13 leading-[1.5] text-ink-mute',
              isWide ? 'min-h-10 line-clamp-2' : 'min-h-5 truncate',
            ].join(' ')}
            aria-hidden={!hasSummary || !summary.description ? true : undefined}
          >
            {hasSummary ? summary.description : null}
          </p>

          <div className="flex min-h-6 items-center justify-between gap-2">
            {seasonMonths.length > 0 ? <SeasonBadgeOutline label={formatSeasonBadge(seasonMonths)} /> : <span />}
            {'priceLevel' in summary ? (
              <span className="flex-none text-13 font-bold tabular-nums text-ink">
                {formatPriceLevel(summary.priceLevel)}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      </Link>
      <SaveButton fishId={fish.id} fishName={fish.name} />
    </article>
  );
}

function getOptionalString(value: object, key: string) {
  if (key in value) {
    const maybeString = (value as Record<string, unknown>)[key];
    return typeof maybeString === 'string' ? maybeString : undefined;
  }
  return undefined;
}
