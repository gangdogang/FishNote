import { SEASONS, TASTE_TAGS } from '../lib/filters';
import type { Season } from '../types/fish';

interface FilterChipsProps {
  season?: Season;
  taste?: string;
  onSeasonChange: (value?: Season) => void;
  onTasteChange: (value?: string) => void;
  onReset?: () => void;
  className?: string;
}

export default function FilterChips({ season, taste, onSeasonChange, onTasteChange, onReset, className = '' }: FilterChipsProps) {
  const hasActiveFilter = Boolean(season || taste);

  return (
    <div className={['flex flex-wrap items-center gap-2', className].join(' ')}>
      <div className="flex flex-wrap gap-2">
        {SEASONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onSeasonChange(season === item.value ? undefined : item.value)}
            className={chipClass(season === item.value)}
          >
            {item.label}
            {season === item.value ? <span aria-hidden>✕</span> : null}
          </button>
        ))}
      </div>
      <span className="mx-0.5 hidden h-8 w-px bg-line sm:block" aria-hidden />
      <div className="flex flex-wrap gap-2">
        {TASTE_TAGS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTasteChange(taste === item ? undefined : item)}
            className={chipClass(taste === item)}
          >
            {item}
            {taste === item ? <span aria-hidden>✕</span> : null}
          </button>
        ))}
      </div>
      {onReset && hasActiveFilter ? (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 text-[13px] font-semibold text-sea transition hover:text-sea"
        >
          필터 초기화
        </button>
      ) : null}
    </div>
  );
}

export function chipClass(active: boolean) {
  return [
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[13px] py-[5px] text-[13px] font-semibold transition duration-150',
    active
      ? 'bg-sea text-white'
      : 'bg-chipbg text-ink hover:text-sea',
  ].join(' ');
}
