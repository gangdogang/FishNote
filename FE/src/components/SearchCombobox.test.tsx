import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFishSuggestions } from '../api/fish';
import type { FishSuggestion, FishSuggestionsResponse } from '../types/fish';
import SearchBar from './SearchBar';

vi.mock('../api/fish', () => ({
  getFishSuggestions: vi.fn(),
}));

const mockedGetFishSuggestions = vi.mocked(getFishSuggestions);

const seabreamSuggestion: FishSuggestion = {
  id: 4,
  slug: 'chamdom',
  name: '참돔',
  matchedAlias: '도미',
  thumbnail: null,
};

const flounderSuggestion: FishSuggestion = {
  id: 1,
  slug: 'gwangeo',
  name: '광어',
  matchedAlias: '넙치',
  thumbnail: null,
};

describe('SearchCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetFishSuggestions.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('IME 조합 중과 1자 입력에는 요청하지 않고 조합 종료 200ms 뒤 요청한다', async () => {
    const onSubmit = vi.fn();
    mockedGetFishSuggestions.mockResolvedValue({ items: [] });
    render(<SearchBar onSubmit={onSubmit} />);

    const combobox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: '돔' } });
    await advanceTimers(500);

    expect(mockedGetFishSuggestions).not.toHaveBeenCalled();

    fireEvent.compositionStart(combobox);
    fireEvent.change(combobox, { target: { value: '도미' } });
    const keydownAccepted = fireEvent.keyDown(combobox, { key: 'Enter' });
    await advanceTimers(500);

    expect(keydownAccepted).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockedGetFishSuggestions).not.toHaveBeenCalled();

    fireEvent.compositionEnd(combobox, { data: '미' });
    await advanceTimers(199);
    expect(mockedGetFishSuggestions).not.toHaveBeenCalled();

    await advanceTimers(1);
    expect(mockedGetFishSuggestions).toHaveBeenCalledOnce();
    expect(mockedGetFishSuggestions).toHaveBeenCalledWith(
      '도미',
      8,
      expect.any(AbortSignal),
    );
  });

  it('새 검색어가 입력되면 이전 요청을 abort하고 늦게 도착한 응답을 노출하지 않는다', async () => {
    const firstRequest = deferred<FishSuggestionsResponse>();
    const secondRequest = deferred<FishSuggestionsResponse>();
    let firstSignal: AbortSignal | undefined;

    mockedGetFishSuggestions
      .mockImplementationOnce((_query, _limit, signal) => {
        firstSignal = signal;
        return firstRequest.promise;
      })
      .mockImplementationOnce(() => secondRequest.promise);

    render(<SearchBar onSubmit={vi.fn()} />);
    const combobox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: '도미' } });
    await advanceTimers(200);

    expect(mockedGetFishSuggestions).toHaveBeenCalledTimes(1);
    expect(firstSignal?.aborted).toBe(false);

    fireEvent.change(combobox, { target: { value: '넙치' } });
    expect(firstSignal?.aborted).toBe(true);
    await advanceTimers(200);
    expect(mockedGetFishSuggestions).toHaveBeenCalledTimes(2);

    await resolveDeferred(secondRequest, { items: [flounderSuggestion] });
    expect(screen.getByText('넙치로 검색됨 · 표준명 광어')).toBeInTheDocument();

    await resolveDeferred(firstRequest, { items: [seabreamSuggestion] });
    expect(screen.queryByText('도미로 검색됨 · 표준명 참돔')).not.toBeInTheDocument();
    expect(screen.getByText('넙치로 검색됨 · 표준명 광어')).toBeInTheDocument();
  });

  it('loading, empty, error 상태 popup을 option 없는 listbox로 노출하지 않는다', async () => {
    const loadingRequest = deferred<FishSuggestionsResponse>();
    mockedGetFishSuggestions
      .mockImplementationOnce(() => loadingRequest.promise)
      .mockRejectedValueOnce(new Error('network error'));

    render(<SearchBar onSubmit={vi.fn()} />);
    const combobox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: '도미' } });
    await advanceTimers(200);

    expect(screen.getByText('추천 횟감을 찾고 있어요')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).not.toHaveAttribute('aria-controls');

    await resolveDeferred(loadingRequest, { items: [] });
    expect(screen.getByText(/일치하는 추천이 없어요/)).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    fireEvent.change(combobox, { target: { value: '넙치' } });
    await advanceTimers(200);
    expect(screen.getByText('추천을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toHaveClass('min-h-11', 'min-w-11');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('listbox ARIA 상태와 방향키 순환, 별칭 문구, Enter 선택을 연결한다', async () => {
    const onSubmit = vi.fn();
    const onSuggestionSelect = vi.fn();
    mockedGetFishSuggestions.mockResolvedValue({
      items: [seabreamSuggestion, flounderSuggestion],
    });
    render(
      <SearchBar
        onSubmit={onSubmit}
        onSuggestionSelect={onSuggestionSelect}
      />,
    );

    const combobox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: '도미' } });
    await advanceTimers(200);

    const listbox = screen.getByRole('listbox', { name: '횟감 검색 추천' });
    const options = screen.getAllByRole('option');
    expect(combobox).toHaveAttribute('aria-autocomplete', 'list');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    expect(options).toHaveLength(2);
    expect(screen.getByText('도미로 검색됨 · 표준명 참돔')).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-activedescendant', options[1].id);

    fireEvent.keyDown(combobox, { key: 'ArrowUp' });
    expect(combobox).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onSuggestionSelect).toHaveBeenCalledOnce();
    expect(onSuggestionSelect).toHaveBeenCalledWith(seabreamSuggestion);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(combobox).toHaveValue('참돔');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Escape로 popup과 활성 option을 닫는다', async () => {
    mockedGetFishSuggestions.mockResolvedValue({ items: [seabreamSuggestion] });
    render(<SearchBar onSubmit={vi.fn()} />);

    const combobox = screen.getByRole('combobox', { name: '횟감 이름 검색' });
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: '도미' } });
    await advanceTimers(200);
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });

    expect(combobox).toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(combobox, { key: 'Escape' });

    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

async function advanceTimers(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function resolveDeferred<T>(
  request: ReturnType<typeof deferred<T>>,
  value: T,
) {
  await act(async () => {
    request.resolve(value);
    await request.promise;
  });
}
