import { useId, type ReactNode } from 'react';
import { SEASONS, TASTE_TAGS } from '../lib/filters';
import { formatPriceLevel } from '../lib/format';
import { chipClass } from '../lib/uiClasses';
import type { SearchFilterValues } from '../types/search';
import type { FishFacets, Season } from '../types/fish';

interface FilterPanelProps {
  value: SearchFilterValues;
  onChange: (nextValue: SearchFilterValues) => void;
  onReset: () => void;
  idPrefix?: string;
  facets?: FishFacets;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const PRICE_LEVELS = [1, 2, 3] as const;

export default function FilterPanel({ value, onChange, onReset, idPrefix, facets }: FilterPanelProps) {
  const generatedId = useId().replace(/:/g, '');
  const prefix = idPrefix?.trim() || `search-filter-${generatedId}`;

  function changeSeason(season: Season) {
    onChange({
      ...value,
      season: value.season === season ? undefined : season,
      month: undefined,
    });
  }

  function changeMonth(month: number) {
    onChange({
      ...value,
      season: undefined,
      month: value.month === month ? undefined : month,
    });
  }

  function changeTaste(taste: string) {
    onChange({
      ...value,
      taste: value.taste === taste ? undefined : taste,
    });
  }

  function changePriceLevel(priceLevel: number) {
    onChange({
      ...value,
      priceLevel: value.priceLevel === priceLevel ? undefined : priceLevel,
    });
  }

  return (
    <div role="group" aria-labelledby={`${prefix}-title`}>
      <div className="mb-4.5 flex min-h-11 items-center justify-between gap-3">
        <h2 id={`${prefix}-title`} className="text-body font-bold text-ink">
          필터
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 rounded-btn px-2 text-body-sm font-semibold text-accent transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          초기화
        </button>
      </div>

      <FilterGroup id={`${prefix}-season`} label="제철">
        {SEASONS.map((season) => (
          <FilterChip
            key={season.value}
            id={`${prefix}-season-${season.value}`}
            active={value.season === season.value}
            onClick={() => changeSeason(season.value)}
          >
            {season.label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup id={`${prefix}-month`} label="제철 달">
        {MONTHS.map((month) => (
          <FilterChip
            key={month}
            id={`${prefix}-month-${month}`}
            active={value.month === month}
            onClick={() => changeMonth(month)}
            count={facets?.season[String(month)]}
          >
            {month}월
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup id={`${prefix}-taste`} label="맛">
        {TASTE_TAGS.map((taste) => (
          <FilterChip
            key={taste}
            id={`${prefix}-taste-${taste}`}
            active={value.taste === taste}
            onClick={() => changeTaste(taste)}
            count={facets?.taste[taste]}
          >
            {taste}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup id={`${prefix}-price`} label="가격대" className="mb-0">
        {PRICE_LEVELS.map((priceLevel) => (
          <FilterChip
            key={priceLevel}
            id={`${prefix}-price-${priceLevel}`}
            active={value.priceLevel === priceLevel}
            onClick={() => changePriceLevel(priceLevel)}
            count={facets?.priceLevel[String(priceLevel)]}
          >
            {formatPriceLevel(priceLevel, { withLabel: true })}
          </FilterChip>
        ))}
      </FilterGroup>
    </div>
  );
}

interface FilterGroupProps {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}

function FilterGroup({ id, label, children, className = 'mb-5' }: FilterGroupProps) {
  return (
    <fieldset id={id} className={className}>
      <legend className="mb-2.5 text-body-sm font-semibold text-ink-mute">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

interface FilterChipProps {
  id: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}

function FilterChip({ id, active, onClick, children, count }: FilterChipProps) {
  return (
    <button id={id} type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {children}
      {typeof count === 'number' ? (
        <span aria-hidden className={active ? 'ml-1 opacity-80' : 'ml-1 text-ink-mute'}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
