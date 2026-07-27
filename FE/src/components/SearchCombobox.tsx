import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Fish, LoaderCircle, RotateCcw } from 'lucide-react';
import { getFishSuggestions } from '../api/fish';
import type { FishSuggestion } from '../types/fish';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const DEFAULT_LIMIT = 8;

type RequestState = 'idle' | 'loading' | 'success' | 'error';

interface SearchComboboxProps {
  id: string;
  name: string;
  value: string;
  label: string;
  placeholder: string;
  describedBy?: string;
  invalid?: boolean;
  inputClassName?: string;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: FishSuggestion) => void;
}

export default function SearchCombobox({
  id,
  name,
  value,
  label,
  placeholder,
  describedBy,
  invalid,
  inputClassName,
  onValueChange,
  onSelect,
}: SearchComboboxProps) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replace(/:/g, '')}-suggestions`;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const requestSequenceRef = useRef(0);
  const [focused, setFocused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [composing, setComposing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [items, setItems] = useState<FishSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);
  const query = value.trim();
  const eligible = codePointLength(query) >= MIN_QUERY_LENGTH;

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = undefined;
    const requestSequence = ++requestSequenceRef.current;
    // Query changes invalidate the keyboard selection before the next async result arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1);

    if (!focused || !interacted || composing || dismissed || !eligible) {
      if (!eligible) {
        setItems([]);
        setRequestState('idle');
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setRequestState('loading');

      void getFishSuggestions(query, DEFAULT_LIMIT, abortController.signal)
        .then((response) => {
          if (abortController.signal.aborted || requestSequence !== requestSequenceRef.current) return;
          setItems(response.items);
          setRequestState('success');
        })
        .catch(() => {
          if (abortController.signal.aborted || requestSequence !== requestSequenceRef.current) return;
          setItems([]);
          setRequestState('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [composing, dismissed, eligible, focused, interacted, query, retryKey]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const popupVisible = focused && !composing && !dismissed && eligible && requestState !== 'idle';
  const listboxVisible = popupVisible && requestState === 'success' && items.length > 0;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setInteracted(true);
    setDismissed(false);
    setItems([]);
    setRequestState('idle');
    setActiveIndex(-1);
    onValueChange(event.target.value);
  }

  function handleCompositionStart() {
    setComposing(true);
    setInteracted(true);
    setDismissed(false);
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    setComposing(false);
    onValueChange(event.currentTarget.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || composing) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      setDismissed(false);
      setActiveIndex((current) => (current + 1) % items.length);
      return;
    }

    if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      setDismissed(false);
      setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      selectItem(activeItem);
      return;
    }

    if (event.key === 'Enter' && requestState === 'error') {
      event.preventDefault();
      retry();
      return;
    }

    if (event.key === 'Escape' && popupVisible) {
      event.preventDefault();
      abortControllerRef.current?.abort();
      setDismissed(true);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'Tab') {
      setFocused(false);
      setActiveIndex(-1);
    }
  }

  function selectItem(item: FishSuggestion) {
    abortControllerRef.current?.abort();
    setItems([]);
    setRequestState('idle');
    setDismissed(true);
    setActiveIndex(-1);
    onValueChange(item.name);
    onSelect(item);
    inputRef.current?.focus();
  }

  function retry() {
    setDismissed(false);
    setRequestState('idle');
    setRetryKey((key) => key + 1);
    inputRef.current?.focus();
  }

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        role="combobox"
        name={name}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          setFocused(true);
          setInteracted(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setActiveIndex(-1);
        }}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={listboxVisible}
        aria-controls={listboxVisible ? listboxId : undefined}
        aria-activedescendant={activeItem ? `${listboxId}-option-${activeItem.id}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={inputClassName}
      />

      {popupVisible ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[min(360px,55vh)] overflow-y-auto rounded-card border border-line bg-surface p-1.5 text-left shadow-[0_16px_40px_rgba(26,43,51,0.16)]"
        >
          {requestState === 'loading' ? (
            <SuggestionStatus>
              <LoaderCircle className="h-4 w-4 animate-spin text-accent" aria-hidden />
              추천 횟감을 찾고 있어요
            </SuggestionStatus>
          ) : null}

          {requestState === 'error' ? (
            <SuggestionStatus>
              <span className="min-w-0 flex-1">추천을 불러오지 못했어요</span>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={retry}
                className="inline-flex min-h-11 min-w-11 flex-none items-center gap-1 rounded-btn px-2.5 text-xs font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                다시 시도
              </button>
            </SuggestionStatus>
          ) : null}

          {requestState === 'success' && items.length === 0 ? (
            <SuggestionStatus>
              일치하는 추천이 없어요. Enter를 누르면 전체 검색으로 이동해요.
            </SuggestionStatus>
          ) : null}

          {listboxVisible ? (
            <div id={listboxId} role="listbox" aria-label="횟감 검색 추천">
              {items.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <div
                    key={item.id}
                    id={`${listboxId}-option-${item.id}`}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-btn px-3 py-2.5 transition',
                      active ? 'bg-accent-soft' : 'hover:bg-mist',
                    ].join(' ')}
                  >
                    <SuggestionThumbnail suggestion={item} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-body-sm font-bold text-ink">{item.name}</p>
                      <p className="m-0 mt-0.5 truncate text-xs text-ink-mute">
                        {item.matchedAlias
                          ? `${item.matchedAlias}로 검색됨 · 표준명 ${item.name}`
                          : `표준명 ${item.name}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveStatus(requestState, items.length, popupVisible)}
      </span>
    </>
  );
}

function SuggestionStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-2 px-3 py-2 text-body-sm text-ink-mute">
      {children}
    </div>
  );
}

function SuggestionThumbnail({ suggestion }: { suggestion: FishSuggestion }) {
  if (suggestion.thumbnail) {
    return (
      <img
        src={suggestion.thumbnail}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 flex-none rounded-btn bg-chipbg object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-btn bg-chipbg text-accent" aria-hidden>
      <Fish className="h-4 w-6" />
    </span>
  );
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function liveStatus(requestState: RequestState, count: number, popupVisible: boolean) {
  if (!popupVisible) return '';
  if (requestState === 'loading') return '추천 횟감을 찾는 중입니다.';
  if (requestState === 'error') return '추천을 불러오지 못했습니다. Enter를 누르면 다시 시도합니다.';
  if (requestState === 'success') return count > 0 ? `추천 ${count}개가 있습니다.` : '일치하는 추천이 없습니다.';
  return '';
}
