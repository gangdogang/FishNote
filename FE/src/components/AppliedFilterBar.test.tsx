import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppliedFilterBar from './AppliedFilterBar';

describe('AppliedFilterBar', () => {
  it('적용된 필터가 없으면 빈 bar를 만들지 않는다', () => {
    const { container } = render(<AppliedFilterBar pills={[]} onRemove={vi.fn()} onClear={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('접근 가능한 Lucide 제거 버튼으로 개별 제거와 전체 지우기를 위임한다', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <AppliedFilterBar
        pills={[
          { key: 'season', label: '겨울' },
          { key: 'priceLevel', label: '₩₩ 보통' },
        ]}
        onRemove={onRemove}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole('group', { name: '적용된 필터' })).toBeInTheDocument();
    const removeSeason = screen.getByRole('button', { name: '겨울 필터 제거' });
    const removePrice = screen.getByRole('button', { name: '₩₩ 보통 필터 제거' });
    expect(removeSeason).toHaveClass('min-h-11');
    expect(removePrice).toHaveClass('min-h-11');
    expect(removeSeason.querySelector('svg')).toHaveClass('lucide-x');

    await user.click(removePrice);
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith('priceLevel');

    await user.click(screen.getByRole('button', { name: '적용된 필터 모두 지우기' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
