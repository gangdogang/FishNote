import { Heart } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';

interface SaveButtonProps {
  fishId: number;
  fishName: string;
  className?: string;
}

export default function SaveButton({ fishId, fishName, className = 'absolute right-2 top-2 z-10' }: SaveButtonProps) {
  const { isBookmarked, toggleBookmark, isBookmarkMutationPending } = useBookmarks();
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
      disabled={isBookmarkMutationPending}
      aria-busy={isBookmarkMutationPending}
      className={[
        className,
        'inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-mute shadow-sm transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
      ].join(' ')}
      aria-label={isBookmarkMutationPending ? `${fishName} 저장 처리 중` : bookmarked ? `${fishName} 저장 해제` : `${fishName} 저장`}
      aria-pressed={bookmarked}
    >
      <Heart className={bookmarked ? 'h-4 w-4 fill-accent text-accent' : 'h-4 w-4 fill-none text-ink-mute'} aria-hidden />
    </button>
  );
}
