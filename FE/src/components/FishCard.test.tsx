import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishSummary } from '../types/fish';
import FishCard from './FishCard';

const bookmarkMocks = vi.hoisted(() => ({
  isBookmarked: vi.fn(() => false),
  toggleBookmark: vi.fn(),
  isBookmarkMutationPending: false,
}));

vi.mock('../hooks/useBookmarks', () => ({
  useBookmarks: () => bookmarkMocks,
}));

const fish: FishSummary = {
  id: 42,
  slug: 'gwang-eo',
  name: '광어',
  imageUrl: null,
  description: '담백하고 쫄깃한 흰살생선',
  priceLevel: 2,
  tasteTags: ['담백'],
  seasonMonths: [11, 12, 1, 2],
  featured: true,
  avgRating: 4.7,
  reviewCount: 18,
  ratingCount: 18,
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderCard() {
  return render(
    <MemoryRouter
      initialEntries={['/catalog']}
    >
      <FishCard fish={fish} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('FishCard', () => {
  beforeEach(() => {
    bookmarkMocks.isBookmarked.mockReturnValue(false);
    bookmarkMocks.isBookmarkMutationPending = false;
  });

  it('상세 링크와 저장 버튼을 형제로 렌더링하고 링크부터 탭 이동한다', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    const detailLink = screen.getByRole('link');
    const saveButton = screen.getByRole('button', { name: '광어 저장' });

    expect(container.querySelector('a button')).not.toBeInTheDocument();
    expect(detailLink.parentElement).toBe(saveButton.parentElement);

    await user.tab();
    expect(detailLink).toHaveFocus();

    await user.tab();
    expect(saveButton).toHaveFocus();
  });

  it('저장은 링크 이벤트나 상세 이동 없이 북마크만 변경한다', async () => {
    const user = userEvent.setup();
    renderCard();
    const detailLink = screen.getByRole('link');
    const saveButton = screen.getByRole('button', { name: '광어 저장' });
    const detailLinkClick = vi.fn();
    detailLink.addEventListener('click', detailLinkClick);

    await user.click(saveButton);

    expect(bookmarkMocks.toggleBookmark).toHaveBeenCalledOnce();
    expect(bookmarkMocks.toggleBookmark).toHaveBeenCalledWith(fish.id);
    expect(detailLinkClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/catalog');

    await user.click(detailLink);

    expect(detailLinkClick).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent(`/fish/${fish.slug}`);
  });

  it('slug가 없으면 기존 숫자 ID 상세 링크를 유지한다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={['/catalog']}
      >
        <FishCard fish={{ ...fish, slug: null }} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link'));
    expect(screen.getByTestId('location')).toHaveTextContent(`/fish/${fish.id}`);
  });

  it('서버 저장 mutation 중에는 저장 버튼을 잠그고 중복 입력을 막는다', async () => {
    const user = userEvent.setup();
    bookmarkMocks.isBookmarkMutationPending = true;
    renderCard();

    const saveButton = screen.getByRole('button', { name: '광어 저장 처리 중' });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute('aria-busy', 'true');

    await user.click(saveButton);
    expect(bookmarkMocks.toggleBookmark).not.toHaveBeenCalled();
  });

  it('별점 없는 후기만 있으면 0점 별점을 노출하지 않는다', () => {
    render(
      <MemoryRouter>
        <FishCard fish={{ ...fish, avgRating: 0, reviewCount: 3, ratingCount: 0 }} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('★')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});
