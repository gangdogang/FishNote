import { Heart } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';

interface SaveButtonProps {
  fishId: number;
  fishName: string;
  className?: string;
}

export default function SaveButton({ fishId, fishName, className = 'absolute right-2 top-2 z-10' }: SaveButtonProps) {
  const { isBookmarked, toggleBookmark, isBookmarkPending } = useBookmarks();
  const bookmarked = isBookmarked(fishId);
  const pending = isBookmarkPending(fishId);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    toggleBookmark(fishId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
      className={[
        className,
        'inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-surface/[0.92] text-ink-mute shadow-[0_6px_18px_rgba(10,40,54,0.14)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:text-accent active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none dark:border-line',
      ].join(' ')}
      aria-label={pending ? `${fishName} 저장 처리 중` : bookmarked ? `${fishName} 저장 해제` : `${fishName} 저장`}
      aria-pressed={bookmarked}
    >
      <Heart className={bookmarked ? 'h-4 w-4 fill-accent text-accent' : 'h-4 w-4 fill-none text-ink-mute'} aria-hidden />
    </button>
  );
}
