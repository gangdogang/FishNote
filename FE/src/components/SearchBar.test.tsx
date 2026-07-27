import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
  it('검색 입력에 고유한 label과 검색 키보드 계약을 연결한다', () => {
    render(
      <>
        <SearchBar onSubmit={vi.fn()} />
        <SearchBar onSubmit={vi.fn()} />
      </>,
    );

    const searchboxes = screen.getAllByRole('combobox', { name: '횟감 이름 검색' });

    expect(searchboxes).toHaveLength(2);
    expect(searchboxes[0]).toHaveAttribute('type', 'search');
    expect(searchboxes[0]).toHaveAttribute('name', 'search');
    expect(searchboxes[0]).toHaveAttribute('enterkeyhint', 'search');
    expect(searchboxes[0].id).toBeTruthy();
    expect(searchboxes[1].id).toBeTruthy();
    expect(searchboxes[0].id).not.toBe(searchboxes[1].id);
    expect(document.querySelector(`label[for="${searchboxes[0].id}"]`)).toHaveClass('sr-only');
    expect(searchboxes[0].closest('form')).toHaveClass('focus-within:ring-2', 'focus-within:ring-focus');
  });

  it('Enter 제출 시 기존처럼 앞뒤 공백을 제거해 onSubmit에 위임한다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SearchBar initialValue="  광어  " onSubmit={onSubmit} />);

    const searchbox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    await user.click(searchbox);
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('광어');
  });

  it('선택적 helper와 error를 입력 설명 및 오류 상태에 연결한다', () => {
    render(
      <SearchBar
        label="도감 검색"
        name="fish-query"
        helper="이름이나 별칭을 입력하세요"
        error="검색어를 확인해 주세요"
        onSubmit={vi.fn()}
      />,
    );

    const searchbox = screen.getByRole('combobox', { name: '도감 검색' });
    const helper = screen.getByText('이름이나 별칭을 입력하세요');
    const error = screen.getByRole('alert');
    const descriptionIds = searchbox.getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(searchbox).toHaveAttribute('name', 'fish-query');
    expect(searchbox).toHaveAttribute('aria-invalid', 'true');
    expect(descriptionIds).toEqual([helper.id, error.id]);
    expect(error).toHaveTextContent('검색어를 확인해 주세요');
  });
});
