import { X } from 'lucide-react';

export interface AppliedFilterPill {
  key: string;
  label: string;
}

interface AppliedFilterBarProps {
  pills: readonly AppliedFilterPill[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

export default function AppliedFilterBar({ pills, onRemove, onClear }: AppliedFilterBarProps) {
  if (pills.length === 0) return null;

  return (
    <div role="group" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="적용된 필터">
      <ul className="m-0 flex min-w-0 list-none flex-wrap gap-2 p-0">
        {pills.map((pill) => (
          <li key={pill.key} className="min-w-0 max-w-full">
            <button
              type="button"
              onClick={() => onRemove(pill.key)}
              aria-label={`${pill.label} 필터 제거`}
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-3 text-body-sm font-semibold text-accent transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <span className="truncate">{pill.label}</span>
              <X className="h-4 w-4 flex-none" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClear}
        aria-label="적용된 필터 모두 지우기"
        className="min-h-11 rounded-btn px-2 text-body-sm font-semibold text-accent transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        모두 지우기
      </button>
    </div>
  );
}
