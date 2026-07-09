import { Heart } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';

interface SaveButtonProps {
  fishId: number;
  fishName: string;
  className?: string;
}

export default function SaveButton({ fishId, fishName, className = 'absolute right-2 top-2' }: SaveButtonProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(fishId);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    toggleBookmark(fishId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        className,
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/90 text-ink-mute transition hover:text-sea',
      ].join(' ')}
      aria-label={bookmarked ? `${fishName} 저장 해제` : `${fishName} 저장`}
      aria-pressed={bookmarked}
    >
      <Heart className={bookmarked ? 'h-4 w-4 fill-sea text-sea' : 'h-4 w-4 fill-none text-ink-mute/70'} aria-hidden />
    </button>
  );
}
