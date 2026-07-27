import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Review } from '../types/review';
import ReviewList from './ReviewList';

const reviews: Review[] = [
  {
    id: 201,
    fishId: 7,
    nickname: '첫번째',
    rating: 5,
    content: '첫 번째 후기',
    imageUrl: null,
    helpfulCount: 0,
    createdAt: '2026-07-20T12:00:00Z',
    mine: false,
  },
  {
    id: 202,
    fishId: 7,
    nickname: '두번째',
    rating: 4,
    content: '두 번째 후기',
    imageUrl: null,
    helpfulCount: 0,
    createdAt: '2026-07-21T12:00:00Z',
    mine: false,
  },
];

function renderList(onDelete = vi.fn().mockResolvedValue(true)) {
  render(<ReviewList reviews={reviews} onDelete={onDelete} onHelpful={vi.fn().mockResolvedValue(1)} />);
  return { onDelete };
}

function reviewArticle(content: string) {
  return screen.getByText(content).closest('article') as HTMLElement;
}

describe('ReviewList 삭제 폼 접근성', () => {
  it('후기마다 고유한 입력 ID와 실제 label, helper 연결을 제공한다', async () => {
    const user = userEvent.setup();
    renderList();

    const firstArticle = reviewArticle('첫 번째 후기');
    await user.click(within(firstArticle).getByRole('button', { name: '삭제' }));

    const firstInput = within(firstArticle).getByLabelText('삭제 비밀번호');
    expect(firstInput).toHaveAttribute('id', 'review-201-delete-password');
    expect(firstInput).toHaveAttribute('aria-invalid', 'false');
    expect(firstInput).toHaveAccessibleDescription('작성할 때 사용한 비밀번호를 4자 이상 입력해 주세요.');

    await user.click(within(firstArticle).getByRole('button', { name: '취소' }));
    const secondArticle = reviewArticle('두 번째 후기');
    await user.click(within(secondArticle).getByRole('button', { name: '삭제' }));

    const secondInput = within(secondArticle).getByLabelText('삭제 비밀번호');
    expect(secondInput).toHaveAttribute('id', 'review-202-delete-password');
    expect(secondInput.id).not.toBe(firstInput.id);
  });

  it('검증 실패 시 입력을 오류와 연결하고 해당 입력에 focus한다', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    const article = reviewArticle('첫 번째 후기');
    await user.click(within(article).getByRole('button', { name: '삭제' }));

    const input = within(article).getByLabelText('삭제 비밀번호');
    await user.type(input, '123');
    const deleteButtons = within(article).getAllByRole('button', { name: '삭제' });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    const error = within(article).getByRole('alert');
    expect(error).toHaveTextContent('비밀번호는 4자 이상 입력해 주세요.');
    expect(error).toHaveAttribute('id', 'review-201-delete-password-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'review-201-delete-password-helper review-201-delete-password-error',
    );
    expect(input).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();

    await user.type(input, '4');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(within(article).queryByRole('alert')).not.toBeInTheDocument();

    await user.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(201, '1234'));
  });
});
