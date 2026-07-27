import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SearchFilterValues } from '../types/search';
import FilterSheet from './FilterSheet';

const noop = () => undefined;

function DraftHarness({ onChange, onReset }: { onChange: (value: SearchFilterValues) => void; onReset: () => void }) {
  const [draft, setDraft] = useState<SearchFilterValues>({ month: 7, taste: '담백' });

  return (
    <FilterSheet
      open
      value={draft}
      resultCount={8}
      onChange={(nextValue) => {
        setDraft(nextValue);
        onChange(nextValue);
      }}
      onReset={() => {
        setDraft({});
        onReset();
      }}
      onApply={noop}
      onClose={noop}
    />
  );
}

function FocusRestoreHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        검색 필터 열기
      </button>
      <FilterSheet
        open={open}
        value={{}}
        resultCount={0}
        onChange={noop}
        onApply={noop}
        onReset={noop}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

describe('FilterSheet', () => {
  it('controlled draft 변경과 초기화를 부모에 전달한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(<DraftHarness onChange={onChange} onReset={onReset} />);

    expect(screen.getByRole('button', { name: '7월' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '봄' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({ month: undefined, season: 'spring', taste: '담백' });
    expect(screen.getByRole('button', { name: '봄' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '7월' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '봄' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('loading·결과 수 문구를 알리고 적용과 닫기 이벤트를 분리한다', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <FilterSheet
        open
        value={{}}
        resultCount={13}
        isResultLoading
        onChange={noop}
        onApply={onApply}
        onClose={onClose}
        onReset={noop}
      />,
    );

    const loadingStatus = screen.getByText('결과를 세는 중...');
    expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('button', { name: '결과를 세는 중...' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <FilterSheet
        open
        value={{}}
        resultCount={13}
        onChange={noop}
        onApply={onApply}
        onClose={onClose}
        onReset={noop}
      />,
    );

    expect(screen.getByRole('button', { name: '결과 13개 보기' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색 필터 닫기' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape로 닫고 ModalDialog가 포커스를 opener에 복원한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FocusRestoreHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: '검색 필터 열기' });

    await user.click(opener);

    expect(screen.getByRole('dialog', { name: '검색 필터' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '검색 필터 닫기' })).toHaveFocus());

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '검색 필터' })).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
