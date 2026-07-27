import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CardCarousel from './CardCarousel';
import { SkeletonCard, SkeletonCards } from './Skeletons';

const carouselItemClassNames = {
  default: 'w-[230px] flex-none snap-start',
  wide: 'w-[85%] max-w-[430px] flex-none snap-start sm:w-[430px]',
} as const;

describe('SkeletonCard', () => {
  it.each([
    ['default', 'aspect-[4/3]'],
    ['wide', 'aspect-[5/2]'],
  ] as const)('reserves the %s FishCard media and body geometry', (variant, aspectClassName) => {
    const { container } = render(<SkeletonCard variant={variant} />);

    expect(container.querySelector('[data-skeleton-media]')).toHaveClass(aspectClassName);
    expect(container.querySelector('[data-skeleton-body]')).toHaveClass('p-3.5');
  });
});

describe('SkeletonCards', () => {
  it('keeps the existing grid API as the default', () => {
    const { container } = render(<SkeletonCards count={2} />);

    expect(screen.getByRole('status', { name: '불러오는 중' })).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-4',
    );
    expect(container.querySelectorAll('[data-skeleton-card-variant="default"]')).toHaveLength(2);
  });

  it.each([
    ['default', 'aspect-[4/3]'],
    ['wide', 'aspect-[5/2]'],
  ] as const)('uses the shared carousel width and aspect for %s placeholders', (variant, aspectClassName) => {
    const { container } = render(
      <SkeletonCards count={2} layout="carousel" variant={variant} ariaLabel="추천 불러오는 중" />,
    );

    expect(screen.getByRole('region', { name: '추천 불러오는 중 카드 목록' })).toHaveClass(
      '-mx-4',
      'flex',
      'snap-x',
      'gap-3.5',
      'overflow-x-auto',
    );

    const items = Array.from(
      container.querySelectorAll<HTMLElement>(`[data-skeleton-carousel-item="${variant}"]`),
    );
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.className === carouselItemClassNames[variant])).toBe(true);
    expect(items[0]?.querySelector('[data-skeleton-media]')).toHaveClass(aspectClassName);
  });
});

describe('CardCarousel controls', () => {
  it('gives visible arrow controls a 44px target and keyboard focus ring', () => {
    render(
      <CardCarousel ariaLabel="테스트 캐러셀">
        <div>카드</div>
      </CardCarousel>,
    );

    const track = screen.getByRole('region', { name: '테스트 캐러셀' });
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 100 },
      scrollLeft: { configurable: true, value: 0, writable: true },
      scrollWidth: { configurable: true, value: 300 },
    });
    fireEvent.scroll(track);

    expect(screen.getByRole('button', { name: '테스트 캐러셀 다음' })).toHaveClass(
      'h-11',
      'w-11',
      'focus-visible:ring-2',
      'focus-visible:ring-focus',
    );
  });

  it('reduced-motion 사용자는 화살표 이동을 즉시 처리한다', () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList));
    render(
      <CardCarousel ariaLabel="테스트 캐러셀">
        <div>카드</div>
      </CardCarousel>,
    );

    const track = screen.getByRole('region', { name: '테스트 캐러셀' });
    const scrollBy = vi.fn();
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 100 },
      scrollLeft: { configurable: true, value: 0, writable: true },
      scrollWidth: { configurable: true, value: 300 },
      scrollBy: { configurable: true, value: scrollBy },
    });
    fireEvent.scroll(track);
    fireEvent.click(screen.getByRole('button', { name: '테스트 캐러셀 다음' }));

    expect(scrollBy).toHaveBeenCalledWith({ left: 90, behavior: 'auto' });
  });
});
