import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FilterPanel from './FilterPanel';

describe('FilterPanel', () => {
  it('모든 controlled 필터를 44px 이상의 토글 버튼으로 렌더링한다', () => {
    const { container } = render(
      <FilterPanel
        value={{ season: 'winter', taste: '고소', priceLevel: 2 }}
        onChange={vi.fn()}
        onReset={vi.fn()}
        idPrefix="desktop-filter"
      />,
    );

    expect(screen.getByRole('group', { name: '필터' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '제철' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '제철 달' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '맛' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '가격대' })).toBeInTheDocument();

    const filterButtons = Array.from(container.querySelectorAll('button[aria-pressed]'));
    expect(filterButtons).toHaveLength(23);
    filterButtons.forEach((button) => expect(button).toHaveClass('min-h-11'));

    expect(screen.getByRole('button', { name: '겨울' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '고소' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '₩₩ 보통' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '봄' })).toHaveAttribute('id', 'desktop-filter-season-spring');
    expect(screen.getByRole('button', { name: '12월' })).toHaveAttribute('id', 'desktop-filter-month-12');
  });

  it('제철 계절과 달을 상호 배타적으로 변경하고 다른 필터는 보존한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterPanel
        value={{ month: 7, taste: '담백', priceLevel: 1 }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '봄' }));
    expect(onChange).toHaveBeenLastCalledWith({
      month: undefined,
      season: 'spring',
      taste: '담백',
      priceLevel: 1,
    });

    rerender(
      <FilterPanel
        value={{ season: 'summer', taste: '담백', priceLevel: 1 }}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '3월' }));
    expect(onChange).toHaveBeenLastCalledWith({
      season: undefined,
      month: 3,
      taste: '담백',
      priceLevel: 1,
    });
  });

  it('활성 맛과 가격을 다시 누르면 해제하고 초기화를 위임한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onReset = vi.fn();
    const { rerender } = render(
      <FilterPanel value={{ taste: '쫄깃' }} onChange={onChange} onReset={onReset} />,
    );

    await user.click(screen.getByRole('button', { name: '쫄깃' }));
    expect(onChange).toHaveBeenLastCalledWith({ taste: undefined });

    rerender(<FilterPanel value={{ priceLevel: 3 }} onChange={onChange} onReset={onReset} />);
    await user.click(screen.getByRole('button', { name: '₩₩₩ 특별한 날' }));
    expect(onChange).toHaveBeenLastCalledWith({ priceLevel: undefined });

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('카탈로그 facet 수를 접근성 이름을 바꾸지 않고 필터에 표시한다', () => {
    render(
      <FilterPanel
        value={{}}
        onChange={vi.fn()}
        onReset={vi.fn()}
        facets={{
          taste: { '담백': 12 },
          season: { '3': 7 },
          priceLevel: { '2': 5 },
          category: {},
        }}
      />,
    );

    expect(screen.getByRole('button', { name: '담백' })).toHaveTextContent('담백12');
    expect(screen.getByRole('button', { name: '3월' })).toHaveTextContent('3월7');
    expect(screen.getByRole('button', { name: '₩₩ 보통' })).toHaveTextContent('₩₩ 보통5');
  });
});
