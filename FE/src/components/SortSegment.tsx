import type { FishSort } from '../types/fish';

// 홈·검색 공용 정렬 세그먼트 (동일 기능은 동일한 컨트롤로)
export default function SortSegment({ value, onChange }: { value: FishSort; onChange: (value: FishSort) => void }) {
  return (
    <div className="inline-flex w-fit flex-none rounded-full border border-line bg-surface p-1" aria-label="정렬">
      <button
        type="button"
        onClick={() => onChange('popular')}
        aria-pressed={value === 'popular'}
        className={segmentClass(value === 'popular')}
      >
        인기순
      </button>
      <button
        type="button"
        onClick={() => onChange('name')}
        aria-pressed={value === 'name'}
        className={segmentClass(value === 'name')}
      >
        이름순
      </button>
    </div>
  );
}

function segmentClass(active: boolean) {
  return [
    'min-h-11 rounded-full px-3.5 text-13 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2',
    active ? 'bg-sea text-white' : 'text-ink-mute hover:text-sea',
  ].join(' ');
}
