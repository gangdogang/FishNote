import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import type { FishDetail } from '../types/fish';
import FishDetailPage from './FishDetailPage';

const hookMocks = vi.hoisted(() => ({
  useFishDetail: vi.fn(),
  useFishPrices: vi.fn(),
  useReviews: vi.fn(),
  useCreateReview: vi.fn(),
  useDeleteReview: vi.fn(),
  useMarkReviewHelpful: vi.fn(),
  useFishSources: vi.fn(),
  useSubmitFishCorrection: vi.fn(),
  isBookmarked: vi.fn(),
  toggleBookmark: vi.fn(),
  showToast: vi.fn(),
  usePageMeta: vi.fn(),
}));

vi.mock('../hooks/useFish', () => ({
  useFishDetail: hookMocks.useFishDetail,
  useFishPrices: hookMocks.useFishPrices,
}));

vi.mock('../hooks/useReviews', () => ({
  useReviews: hookMocks.useReviews,
  useCreateReview: hookMocks.useCreateReview,
  useDeleteReview: hookMocks.useDeleteReview,
  useMarkReviewHelpful: hookMocks.useMarkReviewHelpful,
}));

vi.mock('../hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: hookMocks.isBookmarked,
    toggleBookmark: hookMocks.toggleBookmark,
  }),
}));

vi.mock('../hooks/useFishSources', () => ({
  useFishSources: hookMocks.useFishSources,
  useSubmitFishCorrection: hookMocks.useSubmitFishCorrection,
}));

vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: hookMocks.usePageMeta }));
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: hookMocks.showToast }),
}));

// 이 테스트의 관심사는 라우트 식별자와 데이터 ID의 경계다. 하위 섹션은 별도
// 컴포넌트 테스트가 있으므로 렌더링 비용과 부수 효과를 제거한다.
vi.mock('../components/FishMediaGallery', () => ({ default: () => null }));
vi.mock('../components/FishTasteSection', () => ({ default: () => null }));
vi.mock('../components/PriceSection', () => ({ default: () => null }));
vi.mock('../components/FishServingTipsSection', () => ({ default: () => null }));
vi.mock('../components/SourceSection', () => ({ default: () => null }));
vi.mock('../components/SimilarFishSection', () => ({ default: () => null }));
vi.mock('../components/ReviewSection', () => ({
  default: ({
    onOpenForm,
    reviewFormProps,
  }: {
    onOpenForm: () => void;
    reviewFormProps: { formRef: RefObject<HTMLFormElement | null> };
  }) => (
    <section id="reviews">
      <form ref={reviewFormProps.formRef} aria-label="후기 작성 폼" />
      <button type="button" onClick={onOpenForm}>후기 작성 위치로 이동</button>
    </section>
  ),
}));

const fish: FishDetail = {
  id: 42,
  slug: 'gwang-eo',
  category: 'FISH',
  name: '광어',
  nameEn: 'Olive flounder',
  imageUrl: null,
  description: '담백하고 쫄깃한 흰살생선',
  images: [],
  tasteDesc: '담백한 맛',
  priceLevel: 2,
  tasteTags: ['담백'],
  seasonMonths: [11, 12, 1, 2],
  featured: true,
  avgRating: 4.7,
  reviewCount: 18,
  ratingDistribution: { '1': 0, '2': 0, '3': 1, '4': 4, '5': 13 },
  tips: [],
  similarFishes: [],
};

function queryResult(data: unknown) {
  return {
    data,
    error: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function renderRoute(identifier: string) {
  return render(
    <MemoryRouter
      initialEntries={[`/fish/${identifier}`]}
    >
      <Routes>
        <Route path="/fish/:identifier" element={<FishDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(hookMocks)) mock.mockReset();

  hookMocks.useFishDetail.mockReturnValue(queryResult(fish));
  hookMocks.useFishPrices.mockReturnValue(queryResult(undefined));
  hookMocks.useReviews.mockReturnValue({
    ...queryResult(undefined),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  });
  hookMocks.useCreateReview.mockReturnValue({ mutate: vi.fn(), isPending: false });
  hookMocks.useDeleteReview.mockReturnValue({ mutateAsync: vi.fn() });
  hookMocks.useMarkReviewHelpful.mockReturnValue({ mutateAsync: vi.fn() });
  hookMocks.useFishSources.mockReturnValue(queryResult(undefined));
  hookMocks.useSubmitFishCorrection.mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
  hookMocks.isBookmarked.mockReturnValue(false);
});

describe('FishDetailPage route/data identifier boundary', () => {
  it.each([
    ['slug 상세 경로', 'gwang-eo'],
    ['기존 숫자 ID 상세 경로', '42'],
  ])('%s는 조회 식별자만 경로에서 받고 하위 데이터는 canonical fish.id로 요청한다', async (_label, identifier) => {
    const user = userEvent.setup();
    renderRoute(identifier);

    expect(hookMocks.useFishDetail).toHaveBeenCalledWith(identifier);
    expect(hookMocks.useFishPrices).toHaveBeenCalledWith(fish.id);
    expect(hookMocks.useReviews).toHaveBeenCalledWith(fish.id, 'latest');
    expect(hookMocks.useCreateReview).toHaveBeenCalledWith(fish.id);
    expect(hookMocks.useDeleteReview).toHaveBeenCalledWith(fish.id);
    expect(hookMocks.useMarkReviewHelpful).toHaveBeenCalledWith(fish.id);
    expect(hookMocks.useFishSources).toHaveBeenCalledWith(identifier);
    expect(hookMocks.useSubmitFishCorrection).toHaveBeenCalledWith(fish.id);
    expect(hookMocks.isBookmarked).toHaveBeenCalledWith(fish.id);

    await user.click(screen.getByRole('button', { name: '횟감 저장' }));
    expect(hookMocks.toggleBookmark).toHaveBeenCalledWith(fish.id);
  });

  it('유효하지 않은 상세 경로는 h1을 노출하고 noindex 메타를 요청한다', () => {
    renderRoute('INVALID');

    expect(screen.getByRole('heading', { level: 1, name: '횟감을 찾을 수 없어요' })).toHaveAttribute(
      'data-route-announcement',
      '횟감을 찾을 수 없어요 | FishNote',
    );
    expect(screen.getByRole('link', { name: '도감으로 돌아가기' })).toHaveAttribute('href', '/');
    expect(hookMocks.usePageMeta).toHaveBeenCalledWith(
      '횟감을 찾을 수 없어요',
      '요청한 횟감을 FishNote 도감에서 찾을 수 없습니다.',
      undefined,
      expect.objectContaining({
        canonicalPath: '/fish/INVALID',
        noindex: true,
        structuredData: undefined,
        type: 'website',
      }),
    );
  });

  it('reduced-motion에서는 후기 작성 폼으로 애니메이션 없이 이동한다', async () => {
    const user = userEvent.setup();
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
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    renderRoute('gwang-eo');
    const reviewForm = screen.getByRole('form', { name: '후기 작성 폼' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(reviewForm, 'scrollIntoView', { configurable: true, value: scrollIntoView });

    await user.click(screen.getByRole('button', { name: '후기 작성 위치로 이동' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });
});
