import CardCarousel, { CardCarouselItem, type CardCarouselItemVariant } from './CardCarousel';

const pulse = 'animate-pulse bg-chipbg motion-reduce:animate-none';
const defaultGridClassName = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';

interface SkeletonCardProps {
  variant?: CardCarouselItemVariant;
}

export function SkeletonCard({ variant = 'default' }: SkeletonCardProps = {}) {
  const isWide = variant === 'wide';

  return (
    <div
      className="overflow-hidden rounded-card border border-line bg-surface"
      data-skeleton-card-variant={variant}
      aria-hidden
    >
      <div
        className={[isWide ? 'aspect-[5/2]' : 'aspect-[4/3]', pulse].join(' ')}
        data-skeleton-media
      />
      <div className="p-3.5" data-skeleton-body>
        <div className="flex h-5 min-w-0 items-center justify-between gap-2">
          <div className={['h-4 w-2/5 rounded', pulse].join(' ')} />
          <div className={['h-3.5 w-14 rounded', pulse].join(' ')} />
        </div>

        <div className={['mb-2.5 mt-[3px] grid content-center gap-1', isWide ? 'h-10' : 'h-5'].join(' ')}>
          <div className={['h-3 w-4/5 rounded', pulse].join(' ')} />
          {isWide ? <div className={['h-3 w-3/5 rounded', pulse].join(' ')} /> : null}
        </div>

        <div className="flex h-6 items-center justify-between gap-2">
          <div className={['h-5 w-20 rounded-full', pulse].join(' ')} />
          <div className={['h-4 w-10 rounded', pulse].join(' ')} />
        </div>
      </div>
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  className?: string;
  variant?: CardCarouselItemVariant;
  layout?: 'grid' | 'carousel';
  ariaLabel?: string;
}

export function SkeletonCards({
  count = 4,
  className,
  variant = 'default',
  layout = 'grid',
  ariaLabel = '불러오는 중',
}: SkeletonCardsProps) {
  if (layout === 'carousel') {
    return (
      <div className={className} role="status" aria-label={ariaLabel} aria-busy="true">
        <CardCarousel ariaLabel={`${ariaLabel} 카드 목록`}>
          {Array.from({ length: count }, (_, index) => (
            <CardCarouselItem
              data-skeleton-carousel-item={variant}
              key={index}
              variant={variant}
            >
              <SkeletonCard variant={variant} />
            </CardCarouselItem>
          ))}
        </CardCarousel>
      </div>
    );
  }

  return (
    <div className={className ?? defaultGridClassName} role="status" aria-label={ariaLabel} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} variant={variant} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-7 sm:px-7" role="status" aria-label="불러오는 중">
      <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
        <div className="grid min-w-0 content-start gap-3 lg:order-2">
          <div className={['h-4 w-24 rounded', pulse].join(' ')} />
          <div className={['h-8 w-40 rounded', pulse].join(' ')} />
          <div className={['h-11 w-32 rounded-btn', pulse].join(' ')} />
          <div className={['h-24 rounded-card', pulse].join(' ')} />
          <div className={['h-11 rounded-btn', pulse].join(' ')} />
        </div>
        <div className={['aspect-[4/3] max-h-[420px] min-w-0 w-full rounded-2xl lg:order-1', pulse].join(' ')} />
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '잠시 연결이 원활하지 않아요', onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-card border border-line bg-surface px-5 py-10 text-center">
      <p className={['m-0 text-sm text-ink-mute', onRetry ? 'mb-4' : ''].join(' ')}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-semibold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
