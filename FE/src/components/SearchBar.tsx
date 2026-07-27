import { FormEvent, useId, useState } from 'react';
import { Search } from 'lucide-react';
import type { FishSuggestion } from '../types/fish';
import { trackAnalyticsEvent } from '../lib/analytics';
import SearchCombobox from './SearchCombobox';

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  label?: string;
  name?: string;
  helper?: string;
  error?: string;
  onSubmit: (value: string) => void;
  onSuggestionSelect?: (suggestion: FishSuggestion) => void;
  variant?: 'default' | 'compact';
  className?: string;
  analyticsSurface?: 'hero' | 'header' | 'search';
  analyticsFilterCount?: number;
}

export default function SearchBar({
  initialValue = '',
  placeholder = '횟감 검색 (예: 광어, 방어)',
  label = '횟감 이름 검색',
  name = 'search',
  helper,
  error,
  onSubmit,
  onSuggestionSelect,
  variant = 'default',
  className = '',
  analyticsSurface,
  analyticsFilterCount = 0,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const inputId = useId();
  const helperId = helper ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (analyticsSurface) {
      trackAnalyticsEvent('search_submitted', {
        surface: analyticsSurface,
        queryLength: Array.from(query).length,
        filterCount: analyticsFilterCount,
      });
    }
    onSubmit(query);
  }

  function handleSuggestionSelect(suggestion: FishSuggestion) {
    if (analyticsSurface) {
      trackAnalyticsEvent('search_submitted', {
        surface: analyticsSurface,
        queryLength: Array.from(suggestion.name).length,
        filterCount: analyticsFilterCount,
      });
    }
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
      return;
    }
    onSubmit(suggestion.name);
  }

  const isCompact = variant === 'compact';

  const searchForm = (
    <form
      onSubmit={handleSubmit}
      className={[
        isCompact
          ? 'relative flex min-h-11 w-full min-w-0 items-center gap-2 rounded-full border border-control-border bg-mist py-0 pl-3 pr-0.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-focus'
          : 'relative mx-auto flex min-h-[58px] w-full max-w-[520px] min-w-0 items-center gap-3 rounded-card border-[1.5px] border-control-border bg-surface py-0 pl-[18px] pr-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-focus',
        className,
      ].join(' ')}
    >
      <Search className={isCompact ? 'h-3.5 w-3.5 flex-none text-ink-mute' : 'h-[17px] w-[17px] flex-none text-ink-mute'} aria-hidden />
      <SearchCombobox
        id={inputId}
        name={name}
        value={value}
        onValueChange={setValue}
        onSelect={handleSuggestionSelect}
        label={label}
        placeholder={placeholder}
        invalid={Boolean(error)}
        describedBy={describedBy}
        inputClassName="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-mute xl:text-body-sm"
      />
      <button
        className={isCompact ? 'flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2' : 'inline-flex h-11 flex-none items-center justify-center rounded-btn bg-primary px-4.5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'}
        type="submit"
        aria-label="검색"
      >
        {isCompact ? <Search className="h-3.5 w-3.5" aria-hidden /> : '검색'}
      </button>
    </form>
  );

  if (!helper && !error) return searchForm;

  return (
    <div className="w-full">
      {searchForm}
      <div className={isCompact ? 'mt-1' : 'mx-auto mt-1 max-w-[520px]'}>
        {helper ? (
          <p id={helperId} className="m-0 text-xs leading-snug text-ink-mute">
            {helper}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="m-0 text-xs font-medium leading-snug text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
