import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksMeQueryKey, mergeMyBookmarks } from '../api/bookmarks';
import { ACCESS_TOKEN_CHANGE_EVENT, getStoredAccessToken } from '../api/client';
import { AUTH_SUCCESS_EVENT } from '../hooks/useAuth';
import {
  clearLocalBookmarks,
  dismissBookmarkMerge,
  isBookmarkMergeDismissed,
  readLocalBookmarks,
} from '../lib/bookmarkStorage';

export default function BookmarkMergeDialog() {
  const [fishIds, setFishIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const titleId = useId();
  const descriptionId = useId();
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const isOpen = fishIds.length > 0;

  const mergeMutation = useMutation({
    mutationFn: mergeMyBookmarks,
    onSuccess: async () => {
      clearLocalBookmarks();
      setFishIds([]);
      setErrorMessage('');
      await queryClient.invalidateQueries({ queryKey: bookmarksMeQueryKey });
    },
    onError: () => {
      setErrorMessage('북마크를 옮기지 못했습니다. 다시 시도해 주세요.');
    },
  });

  const handleLater = useCallback(() => {
    dismissBookmarkMerge();
    setFishIds([]);
    setErrorMessage('');
  }, []);

  useEffect(() => {
    function maybeOpenMergeDialog() {
      if (!getStoredAccessToken() || isBookmarkMergeDismissed()) return;

      const localBookmarkIds = readLocalBookmarks();
      if (localBookmarkIds.length > 0) {
        setFishIds(localBookmarkIds);
        setErrorMessage('');
      }
    }

    function handleAccessTokenChange() {
      if (!getStoredAccessToken()) {
        setFishIds([]);
        setErrorMessage('');
      }
    }

    window.addEventListener(AUTH_SUCCESS_EVENT, maybeOpenMergeDialog);
    window.addEventListener(ACCESS_TOKEN_CHANGE_EVENT, handleAccessTokenChange);

    return () => {
      window.removeEventListener(AUTH_SUCCESS_EVENT, maybeOpenMergeDialog);
      window.removeEventListener(ACCESS_TOKEN_CHANGE_EVENT, handleAccessTokenChange);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    mergeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') handleLater();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLater, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-[360px] rounded-card border border-line bg-surface px-5 py-5 shadow-[0_20px_50px_rgba(26,43,51,0.22)]"
      >
        <h2 id={titleId} className="m-0 text-20 font-extrabold leading-snug text-ink">
          이 기기에 저장한 생선 {fishIds.length}종이 있어요
        </h2>
        <p id={descriptionId} className="mb-0 mt-2 text-14 leading-[1.6] text-ink-mute">
          내 도감으로 옮길까요?
        </p>

        {errorMessage ? (
          <p role="alert" className="mb-0 mt-3 rounded-btn bg-red-50 dark:bg-red-950/40 px-3 py-2 text-13 font-medium text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            ref={mergeButtonRef}
            type="button"
            disabled={mergeMutation.isPending}
            onClick={() => mergeMutation.mutate(fishIds)}
            className="inline-flex min-h-11 items-center justify-center rounded-btn border-0 bg-sea px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sea-deep disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
          >
            {mergeMutation.isPending ? '옮기는 중...' : '옮기기'}
          </button>
          <button
            type="button"
            disabled={mergeMutation.isPending}
            onClick={handleLater}
            className="inline-flex min-h-11 items-center justify-center rounded-btn border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink transition hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:text-ink-mute"
          >
            나중에
          </button>
        </div>
      </section>
    </div>
  );
}
