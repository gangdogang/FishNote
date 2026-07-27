import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FishDetail, FishPriceSummary } from '../types/fish';
import FishIdentitySummary from './FishIdentitySummary';

const currentMonth = new Date().getMonth() + 1;

const fish: FishDetail = {
  id: 7,
  name: '방어',
  nameEn: 'Yellowtail',
  aliases: ['부시리와 구분'],
  verificationStatus: 'VERIFIED',
  media: null,
  galleryMedia: [],
  imageUrl: null,
  images: [],
  description: '겨울철 대표 횟감',
  tasteDesc: '기름지고 고소해요',
  priceLevel: 2,
  tasteTags: ['기름진', '고소한', '진한'],
  seasonMonths: [currentMonth],
  featured: true,
  avgRating: 4.8,
  reviewCount: 31,
  ratingDistribution: { '1': 0, '2': 1, '3': 2, '4': 8, '5': 20 },
  tips: [],
  similarFishes: [],
};

const priceSummary: FishPriceSummary = {
  fishId: fish.id,
  days: 30,
  observationCount: 1,
  latest: {
    observedAt: '2026-07-20T00:00:00Z',
    priceMinKrw: 12_000,
    priceMaxKrw: 18_000,
    unit: 'kg',
    origin: '국내산',
    sizeGrade: null,
    sourceLabel: '테스트 시세',
    shopName: null,
  },
  recent: [],
  dailyAverage: [],
  byShop: [],
  byVariant: [],
};

function quickFact(container: HTMLElement, label: string) {
  const term = within(container).getByText(label, { selector: 'dt' });
  const value = term.parentElement?.querySelector('dd');
  if (!value) throw new Error(`${label} quick fact value is missing`);
  return value;
}

function isBefore(first: Node, second: Node) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('FishIdentitySummary', () => {
  it('이름, quick facts, 저장·공유 순서를 유지하고 각 사용자 동작을 위임한다', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onToggleBookmark = vi.fn();
    const onShare = vi.fn();
    const { container } = render(
      <FishIdentitySummary
        fish={fish}
        priceSummary={priceSummary}
        bookmarked={false}
        canGoBack
        onBack={onBack}
        onToggleBookmark={onToggleBookmark}
        onShare={onShare}
      />,
    );

    const back = screen.getByRole('button', { name: '이전으로' });
    const heading = screen.getByRole('heading', { level: 1, name: '방어' });
    const facts = container.querySelector('dl');
    const save = screen.getByRole('button', { name: '횟감 저장' });
    const share = screen.getByRole('button', { name: '방어 공유하기' });
    expect(facts).not.toBeNull();
    expect(isBefore(back, heading)).toBe(true);
    expect(isBefore(heading, facts!)).toBe(true);
    expect(isBefore(facts!, save)).toBe(true);
    expect(isBefore(save, share)).toBe(true);

    expect(quickFact(container, '제철')).toHaveTextContent('지금 제철');
    expect(quickFact(container, '대표 맛')).toHaveTextContent('기름진 · 고소한');
    expect(quickFact(container, '최근 가격')).toHaveTextContent('1.2만원–1.8만원/kg');
    expect(save).toHaveAttribute('aria-pressed', 'false');

    await user.click(back);
    await user.click(save);
    await user.click(share);

    expect(onBack).toHaveBeenCalledOnce();
    expect(onToggleBookmark).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('시세·제철 정보가 없으면 가격 단계와 준비 중 fallback을 사용한다', () => {
    const fallbackFish = {
      ...fish,
      seasonMonths: [],
      tasteTags: [],
      priceLevel: 2,
      reviewCount: 0,
    };
    const callbacks = {
      onBack: vi.fn(),
      onToggleBookmark: vi.fn(),
      onShare: vi.fn(),
    };
    const { container, rerender } = render(
      <FishIdentitySummary
        fish={fallbackFish}
        bookmarked
        canGoBack={false}
        {...callbacks}
      />,
    );

    expect(screen.getByRole('button', { name: '도감으로' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '횟감 저장 해제' })).toHaveAttribute('aria-pressed', 'true');
    expect(quickFact(container, '제철')).toHaveTextContent('정보 준비 중');
    expect(quickFact(container, '대표 맛')).toHaveTextContent('정보 준비 중');
    expect(quickFact(container, '최근 가격')).toHaveTextContent('₩₩ 보통');

    rerender(
      <FishIdentitySummary
        fish={{ ...fallbackFish, priceLevel: null }}
        bookmarked
        canGoBack={false}
        {...callbacks}
      />,
    );

    expect(quickFact(container, '최근 가격')).toHaveTextContent('정보 준비 중');
  });

  it('비어류 횟감의 분류와 학명을 노출한다', () => {
    render(
      <FishIdentitySummary
        fish={{ ...fish, name: '전복', category: 'SHELLFISH', scientificName: 'Haliotis discus hannai' }}
        bookmarked={false}
        canGoBack={false}
        onBack={vi.fn()}
        onToggleBookmark={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    expect(screen.getByText('패류')).toBeInTheDocument();
    expect(screen.getByText('Haliotis discus hannai')).toBeInTheDocument();
  });
});
