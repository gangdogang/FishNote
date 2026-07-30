import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import type { SearchFilterValues } from '../types/search';
import type { FishFacets } from '../types/fish';
import FilterPanel from './FilterPanel';
import ModalDialog from './ModalDialog';

interface FilterSheetProps {
  open: boolean;
  value: SearchFilterValues;
  resultCount?: number;
  isResultLoading?: boolean;
  isResultError?: boolean;
  facets?: FishFacets;
  onChange: (nextValue: SearchFilterValues) => void;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
}

export default function FilterSheet({
  open,
  value,
  resultCount,
  isResultLoading = false,
  isResultError = false,
  facets,
  onChange,
  onApply,
  onClose,
  onReset,
}: FilterSheetProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      titleId={titleId}
      initialFocusRef={closeButtonRef}
      panelClassName="max-h-[88dvh] w-full self-end rounded-t-2xl border-x border-t border-line px-4 pb-[calc(16px+var(--safe-area-bottom))] pt-4 shadow-[0_-16px_40px_rgba(26,43,51,0.18)] sm:mx-auto sm:max-w-[560px]"
    >
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <h2 id={titleId} className="m-0 text-lead font-extrabold text-ink">
          검색 필터
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="검색 필터 닫기"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-mute transition hover:bg-mist hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <FilterPanel
        idPrefix="mobile-search-filter"
        value={value}
        onChange={onChange}
        onReset={onReset}
        facets={facets}
      />

      <div className="sticky bottom-0 -mx-4 mt-5 border-t border-line bg-surface px-4 pt-3">
        {isResultError ? (
          <p role="alert" className="m-0 mb-2 text-center text-body-sm font-medium text-red-700 dark:text-red-400">
            결과 수를 불러오지 못했어요. 필터는 적용할 수 있어요.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onApply}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-btn bg-primary px-5 py-3 text-body font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <span aria-live="polite" aria-atomic="true">
            {isResultLoading
              ? '결과를 세는 중...'
              : isResultError
                ? '필터 적용하기'
                : `결과 ${resultCount ?? 0}개 보기`}
          </span>
        </button>
      </div>
    </ModalDialog>
  );
}
