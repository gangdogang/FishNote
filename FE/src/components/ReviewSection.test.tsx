import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../hooks/useAuth';
import type { ReviewList as ReviewListData } from '../types/review';
import ReviewSection, { type ReviewSectionProps } from './ReviewSection';

const fallbackDistribution = { '1': 1, '2': 1, '3': 2, '4': 2, '5': 1 };

const reviewList: ReviewListData = {
  fishId: 7,
  avgRating: 4.6,
  totalCount: 4,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 3 },
  reviews: [
    {
      id: 101,
      fishId: 7,
      nickname: '회러버',
      rating: 5,
      content: '기름지고 고소해서 맛있어요.',
      imageUrl: null,
      helpfulCount: 2,
      createdAt: '2026-07-20T12:00:00Z',
      mine: true,
    },
  ],
  page: 0,
  size: 1,
  hasNext: true,
};

function createProps(overrides: Partial<ReviewSectionProps> = {}): ReviewSectionProps {
  return {
    reviewList,
    fallbackAvgRating: 3.2,
    fallbackReviewCount: 7,
    fallbackRatingDistribution: fallbackDistribution,
    isLoading: false,
    isFetching: false,
    isError: false,
    onRetry: vi.fn(),
    sort: 'latest',
    onSortChange: vi.fn(),
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    onLoadMore: vi.fn(),
    reviewFormProps: {
      submitting: false,
      resetKey: 0,
      onSubmit: vi.fn(),
    },
    onDelete: vi.fn().mockResolvedValue(true),
    onHelpful: vi.fn().mockResolvedValue(3),
    onOpenForm: vi.fn(),
    ...overrides,
  };
}

function renderSection(props: ReviewSectionProps, sibling?: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {sibling}
        <ReviewSection {...props} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ReviewSection', () => {
  it('성공 데이터의 소수 평균·분포·목록을 표시하고 모든 목록 동작을 위임한다', async () => {
    const user = userEvent.setup();
    const props = createProps();
    renderSection(props);

    const ratingSummary = screen.getByLabelText('후기 평점 요약');
    expect(ratingSummary).toHaveTextContent('4.6 / 5');
    expect(screen.getByText('4개')).toBeInTheDocument();
    expect(within(ratingSummary).getByRole('img', { name: '5점' })).toBeInTheDocument();
    expect(within(ratingSummary).getByRole('progressbar', { name: '5점 후기 비율' }))
      .toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText('기름지고 고소해서 맛있어요.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '후기 남기기' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '도움순' }));
    expect(props.onSortChange).toHaveBeenCalledWith('helpful');

    await user.click(screen.getByRole('button', { name: '후기 쓰기' }));
    expect(props.onOpenForm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '후기 더 보기 (1/4)' }));
    expect(props.onLoadMore).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '도움돼요 2' }));
    await waitFor(() => expect(props.onHelpful).toHaveBeenCalledWith(101));

    await user.click(screen.getByRole('button', { name: '삭제' }));
    const deleteButtons = screen.getAllByRole('button', { name: '삭제' });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(101, undefined));
  });

  it('초기 loading에서는 fallback 요약과 작성 폼을 유지하고 목록만 상태로 대체한다', async () => {
    const user = userEvent.setup();
    const props = createProps({ reviewList: undefined, isLoading: true, hasNextPage: false });
    renderSection(props);

    expect(screen.getByLabelText('후기 평점 요약')).toHaveTextContent('3.2 / 5');
    expect(screen.getByText('7개')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('후기를 불러오는 중...');
    expect(screen.queryByText('첫 후기를 남겨보세요')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '후기 쓰기' }));
    expect(props.onOpenForm).toHaveBeenCalledOnce();
  });

  it('초기 error는 로컬 재시도를 제공하면서 가격 sibling과 ReviewForm을 계속 사용 가능하게 한다', async () => {
    const user = userEvent.setup();
    const props = createProps({ reviewList: undefined, isError: true, hasNextPage: false });
    const { rerender } = renderSection(props, <div>가격 정보는 계속 보여요</div>);

    expect(screen.getByText('가격 정보는 계속 보여요')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('후기를 불러오지 못했어요.');
    expect(screen.queryByText('기름지고 고소해서 맛있어요.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled();
    await user.type(screen.getByPlaceholderText('예: 회러버'), '테스터');
    expect(screen.getByPlaceholderText('예: 회러버')).toHaveValue('테스터');

    await user.click(screen.getByRole('button', { name: '후기 다시 시도' }));
    expect(props.onRetry).toHaveBeenCalledOnce();

    const fetchingProps = createProps({
      reviewList: undefined,
      isError: true,
      isFetching: true,
      hasNextPage: false,
      onRetry: props.onRetry,
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReviewSection {...fetchingProps} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: '후기를 다시 불러오는 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '후기를 다시 불러오는 중...' })).toHaveAttribute('aria-busy', 'true');
  });

  it('cached 목록은 refetch loading/error에도 유지하고 비차단 상태와 재시도를 표시한다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const props = createProps({ isError: true, onRetry });
    const { rerender } = renderSection(props);

    expect(screen.getByText('기름지고 고소해서 맛있어요.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('이전 내용을 보여드려요.');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
      <ReviewSection {...createProps({ isLoading: false, isFetching: true })} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('기름지고 고소해서 맛있어요.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('최신 후기를 불러오는 중...');
    expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled();
  });

  it('pagination 오류는 기존 목록을 유지하고 더 보기만 독립 재시도한다', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const props = createProps({ isError: true, isFetchNextPageError: true, onLoadMore });
    const { rerender } = renderSection(props);

    expect(screen.getByText('기름지고 고소해서 맛있어요.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('후기를 더 불러오지 못했어요.');
    await user.click(screen.getByRole('button', { name: '더 보기 다시 시도' }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <ReviewSection
            {...createProps({
              isFetchNextPageError: true,
              isError: true,
              isFetchingNextPage: true,
              onLoadMore,
            })}
          />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: '후기를 불러오는 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '후기를 불러오는 중...' })).toHaveAttribute('aria-busy', 'true');
  });

  it('action error와 ReviewForm 상태 props를 하위 컴포넌트에 전달한다', () => {
    const props = createProps({
      hasNextPage: false,
      reviewActionError: '후기 작업에 실패했어요.',
      reviewFormProps: {
        submitting: true,
        error: '후기를 등록하지 못했어요.',
        resetKey: 2,
        onSubmit: vi.fn(),
      },
    });
    renderSection(props);

    expect(screen.getByText('후기 작업에 실패했어요.')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('후기를 등록하지 못했어요.')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: '등록 중...' })).toBeDisabled();
  });

  it('여러 후기 작업이 겹쳐도 각 버튼을 완료 시점까지 독립적으로 잠근다', async () => {
    const user = userEvent.setup();
    const resolvers = new Map<number, (value: number | null) => void>();
    const onHelpful = vi.fn((reviewId: number) => new Promise<number | null>((resolve) => {
      resolvers.set(reviewId, resolve);
    }));
    const concurrentList: ReviewListData = {
      ...reviewList,
      totalCount: 2,
      hasNext: false,
      reviews: [
        { ...reviewList.reviews[0], id: 201, helpfulCount: 2 },
        { ...reviewList.reviews[0], id: 202, nickname: '두번째', helpfulCount: 4 },
      ],
    };
    renderSection(createProps({ reviewList: concurrentList, hasNextPage: false, onHelpful }));

    const first = screen.getByRole('button', { name: '도움돼요 2' });
    const second = screen.getByRole('button', { name: '도움돼요 4' });
    await user.click(first);
    await user.click(second);
    expect(first).toBeDisabled();
    expect(second).toBeDisabled();

    resolvers.get(201)?.(null);
    await waitFor(() => expect(first).toBeEnabled());
    expect(second).toBeDisabled();

    resolvers.get(202)?.(null);
    await waitFor(() => expect(second).toBeEnabled());
  });
});
