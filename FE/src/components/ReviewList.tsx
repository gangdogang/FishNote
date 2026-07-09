import { useState } from 'react';
import type { Review } from '../types/review';

interface ReviewListProps {
  reviews: Review[];
  onDelete: (reviewId: number, password: string) => Promise<boolean>;
  onHelpful: (reviewId: number) => Promise<number | null>;
  workingReviewId?: number;
}

export default function ReviewList({ reviews, onDelete, onHelpful, workingReviewId }: ReviewListProps) {
  const [helpfulReviewIds, setHelpfulReviewIds] = useState<Set<number>>(() => new Set());
  const [helpfulCounts, setHelpfulCounts] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [deletingReviewId, setDeletingReviewId] = useState<number | undefined>();
  const [deletePassword, setDeletePassword] = useState('');

  if (reviews.length === 0) {
    return <div className="rounded-card border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-ink-mute">첫 후기를 남겨보세요</div>;
  }

  function isHelpful(reviewId: number) {
    return helpfulReviewIds.has(reviewId) || readHelpfulReviewId(reviewId);
  }

  async function handleHelpful(reviewId: number) {
    if (isHelpful(reviewId)) {
      setMessage('이미 도움돼요를 누른 후기입니다.');
      return;
    }

    setMessage(undefined);
    const nextCount = await onHelpful(reviewId);
    if (nextCount === null) return;

    setHelpfulReviewIds((prev) => new Set(prev).add(reviewId));
    setHelpfulCounts((prev) => ({ ...prev, [reviewId]: nextCount }));
    writeHelpfulReviewId(reviewId);
  }

  function openDeleteForm(reviewId: number) {
    setMessage(undefined);
    setDeletingReviewId(reviewId);
    setDeletePassword('');
  }

  async function handleDelete(reviewId: number) {
    if (deletePassword.trim().length < 4) {
      setMessage('비밀번호는 4자 이상 입력해 주세요.');
      return;
    }

    setMessage(undefined);
    const ok = await onDelete(reviewId, deletePassword);
    if (!ok) return;

    setDeletingReviewId(undefined);
    setDeletePassword('');
  }

  return (
    <div className="grid gap-3">
      {message ? <p className="m-0 rounded-[10px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{message}</p> : null}

      {reviews.map((review) => {
        const helpful = isHelpful(review.id);
        const helpfulCount = helpfulCounts[review.id] ?? review.helpfulCount ?? 0;

        return (
          <article key={review.id} className="rounded-card border border-line bg-white px-[18px] py-4">
            <div className="mb-2 flex items-start gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-sea-soft text-sm font-extrabold text-sea">
                {getInitial(review.nickname)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <b className="truncate text-sm font-bold text-ink">{review.nickname}</b>
                  {review.rating !== null ? <RatingValue rating={review.rating} /> : null}
                </div>
                <time className="block text-xs leading-snug text-ink-mute">{formatDate(review.createdAt)}</time>
              </div>

              <button
                type="button"
                disabled={workingReviewId === review.id}
                onClick={() => openDeleteForm(review.id)}
                className="ml-auto flex-none border-0 bg-transparent p-0 text-xs font-medium text-ink-mute transition hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
              >
                삭제
              </button>
            </div>

            <p className="m-0 mb-3 whitespace-pre-line break-words text-sm leading-[1.7] text-ink">{review.content}</p>

            {review.imageUrl ? (
              <a href={review.imageUrl} target="_blank" rel="noreferrer" className="mb-3 block max-w-[420px]">
                <img src={review.imageUrl} alt="후기 사진" className="max-h-40 w-full rounded-[10px] border border-line object-cover" />
              </a>
            ) : null}

            <button
              type="button"
              disabled={helpful || workingReviewId === review.id}
              onClick={() => void handleHelpful(review.id)}
              className={[
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-[13px] py-[5px] text-[13px] font-semibold transition',
                helpful ? 'border-sea bg-sea-soft text-sea' : 'border-line bg-white text-ink-mute hover:border-sea hover:text-sea',
                workingReviewId === review.id ? 'cursor-wait opacity-60' : '',
              ].join(' ')}
            >
              👍 도움돼요 {helpfulCount}
              {helpful ? ' · 눌렀어요' : ''}
            </button>

            {deletingReviewId === review.id ? (
              <div className="mt-3 rounded-[10px] bg-mist p-3">
                <p className="m-0 mb-2 text-[13px] font-medium leading-[1.5] text-ink">
                  이 후기를 지울까요? 작성할 때 쓴 비밀번호를 입력해 주세요
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="password"
                    value={deletePassword}
                    autoFocus
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder="비밀번호"
                    className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-sea"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingReviewId(undefined);
                        setDeletePassword('');
                        setMessage(undefined);
                      }}
                      className="min-h-9 flex-1 rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink-mute sm:flex-none"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={workingReviewId === review.id}
                      onClick={() => void handleDelete(review.id)}
                      className="min-h-9 flex-1 rounded-[10px] border-0 bg-red-600 px-3 py-2 text-[13px] font-semibold text-white disabled:cursor-wait disabled:bg-slate-300 sm:flex-none"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function RatingValue({ rating }: { rating: number }) {
  return (
    <span className="whitespace-nowrap text-xs font-bold tabular-nums text-ink" aria-label={`${rating}점`}>
      <span className="text-star">★</span> {rating.toFixed(1)}
    </span>
  );
}

function getInitial(nickname: string) {
  return nickname.trim().charAt(0) || '익';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

function helpfulStorageKey(reviewId: number) {
  return `helpful:${reviewId}`;
}

function readHelpfulReviewId(reviewId: number) {
  try {
    return window.localStorage.getItem(helpfulStorageKey(reviewId)) === 'true';
  } catch {
    return false;
  }
}

function writeHelpfulReviewId(reviewId: number) {
  try {
    window.localStorage.setItem(helpfulStorageKey(reviewId), 'true');
  } catch {
    // Ignore storage failures; the API mutation already completed.
  }
}
