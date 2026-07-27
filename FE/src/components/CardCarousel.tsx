import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

interface CardCarouselProps {
  ariaLabel: string;
  children: ReactNode;
}

export type CardCarouselItemVariant = 'default' | 'wide';

// 로딩/완료 상태가 같은 폭을 사용하도록 카드와 스켈레톤이 공유하는 프리셋.
const itemClassNames: Record<CardCarouselItemVariant, string> = {
  default: 'w-[230px] flex-none snap-start',
  wide: 'w-[85%] max-w-[430px] flex-none snap-start sm:w-[430px]',
};

const trackClassName =
  '-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

interface CardCarouselItemProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardCarouselItemVariant;
}

export function CardCarouselItem({ variant = 'default', className = '', ...props }: CardCarouselItemProps) {
  return <div {...props} className={[itemClassNames[variant], className].filter(Boolean).join(' ')} />;
}

// 가로 스크롤 슬라이더. 모바일은 손가락 스와이프, 데스크톱은 양옆 화살표.
// 자식 요소들이 각자 flex-none 폭을 갖고 있어야 한다.
export default function CardCarousel({ ariaLabel, children }: CardCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function updateArrows() {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 8);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 8);
  }

  useEffect(() => {
    updateArrows();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [children]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: preferredScrollBehavior() });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateArrows}
        role="region"
        aria-label={ariaLabel}
        className={trackClassName}
      >
        {children}
      </div>

      {canPrev ? (
        <button type="button" onClick={() => scrollByPage(-1)} aria-label={`${ariaLabel} 이전`} className={arrowClass('left')}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {canNext ? (
        <button type="button" onClick={() => scrollByPage(1)} aria-label={`${ariaLabel} 다음`} className={arrowClass('right')}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function arrowClass(side: 'left' | 'right') {
  return [
    'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full',
    'border border-line bg-surface text-ink shadow-[0_6px_18px_rgba(26,43,51,0.14)] transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:flex',
    side === 'left' ? '-left-4' : '-right-4',
  ].join(' ');
}
