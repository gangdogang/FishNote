const pulse = 'animate-pulse bg-chipbg motion-reduce:animate-none';

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white" aria-hidden>
      <div className={['aspect-[4/3]', pulse].join(' ')} />
      <div className="grid gap-2 p-3.5">
        <div className={['h-4 w-2/5 rounded', pulse].join(' ')} />
        <div className={['h-3 w-4/5 rounded', pulse].join(' ')} />
        <div className={['h-3 w-3/5 rounded', pulse].join(' ')} />
      </div>
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  className?: string;
}

export function SkeletonCards({
  count = 4,
  className = 'grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-4',
}: SkeletonCardsProps) {
  return (
    <div className={className} role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-[980px] px-4 pb-20 pt-7 sm:px-7" role="status" aria-label="불러오는 중">
      <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
        <div className={['aspect-[4/3] rounded-2xl', pulse].join(' ')} />
        <div className="grid content-start gap-3">
          <div className={['h-4 w-24 rounded', pulse].join(' ')} />
          <div className={['h-8 w-40 rounded', pulse].join(' ')} />
          <div className={['h-4 w-3/4 rounded', pulse].join(' ')} />
          <div className={['h-24 rounded-card', pulse].join(' ')} />
          <div className={['h-11 rounded-[10px]', pulse].join(' ')} />
        </div>
      </div>
    </main>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '잠시 연결이 원활하지 않아요', onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-card border border-line bg-white px-5 py-10 text-center">
      <p className={['m-0 text-sm text-ink-mute', onRetry ? 'mb-4' : ''].join(' ')}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[10px] border border-sea bg-white px-5 py-2.5 text-sm font-semibold text-sea transition hover:bg-sea-soft"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
