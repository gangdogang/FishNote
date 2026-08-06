import { BookOpenCheck, Camera, MapPin, Star, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { Field } from '../components/FormField';
import { ErrorState } from '../components/Skeletons';
import { uploadImage } from '../api/image';
import { useAuth } from '../hooks/useAuth';
import { useFishList } from '../hooks/useFish';
import { useCreateTastingEntry, useDeleteTastingEntry, useTastingEntries } from '../hooks/useTastings';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../hooks/useToast';
import { getErrorMessage } from '../lib/errors';
import { fishDetailPath } from '../lib/fishRoutes';
import { inputClass } from '../lib/uiClasses';
import type { TastingPreparation } from '../types/tasting';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const preparationOptions: Array<{ value: TastingPreparation; label: string }> = [
  { value: 'RAW', label: '생회' },
  { value: 'AGED', label: '숙성회' },
  { value: 'SEKKOSI', label: '세꼬시' },
  { value: 'OTHER', label: '기타' },
];

interface FormState {
  fishId: string;
  tastedOn: string;
  rating: number | null;
  preparation: TastingPreparation;
  placeName: string;
  note: string;
}

export default function TastingJournalPage() {
  usePageMeta('먹어본 기록', '내가 먹어본 회를 날짜와 취향으로 차곡차곡 기록해보세요.', null, { noindex: true });
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { accessToken, user, isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const initialFishId = readInitialFishId(searchParams);
  const [form, setForm] = useState<FormState>(() => emptyForm(initialFishId));
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: fishes = [], isLoading: isFishLoading, isError: isFishError, refetch: refetchFish } = useFishList({}, { enabled: Boolean(accessToken) });
  const entriesQuery = useTastingEntries(Boolean(accessToken));
  const createMutation = useCreateTastingEntry();
  const deleteMutation = useDeleteTastingEntry();
  const entries = useMemo(() => entriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [entriesQuery.data]);
  const stats = entriesQuery.data?.pages[0]?.stats;
  const isBusy = uploading || createMutation.isPending;

  if (!accessToken) return <Navigate to="/login" replace state={{ from: location }} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    const fishId = Number(form.fishId);
    if (!Number.isSafeInteger(fishId) || fishId <= 0) {
      setFieldError('기록할 횟감을 선택해 주세요.');
      return;
    }
    if (!form.tastedOn || form.tastedOn > todayValue()) {
      setFieldError('오늘 또는 이전 날짜를 선택해 주세요.');
      return;
    }

    setFieldError('');
    setFormError('');
    let imageUrl: string | null = null;
    let imageAssetId: string | null = null;
    if (selectedImage) {
      setUploading(true);
      try {
        const uploaded = await uploadImage(selectedImage);
        imageUrl = uploaded.url;
        imageAssetId = uploaded.assetId;
      } catch (error) {
        setUploading(false);
        setFormError(getErrorMessage(error));
        return;
      }
      setUploading(false);
    }

    try {
      await createMutation.mutateAsync({
        fishId,
        tastedOn: form.tastedOn,
        rating: form.rating,
        preparation: form.preparation,
        placeName: form.placeName.trim() || null,
        note: form.note.trim() || null,
        imageUrl,
        imageAssetId,
      });
      setForm(emptyForm(''));
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('먹어본 기록을 저장했어요');
      window.requestAnimationFrame(() => document.getElementById('tasting-list')?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' }));
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  function handleImage(file: File | undefined) {
    setFormError('');
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setFormError('JPG, PNG, 정적 GIF, 정적 WebP 사진만 올릴 수 있어요.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFormError('5MB 이하 사진만 올릴 수 있어요.');
      return;
    }
    setSelectedImage(file);
  }

  async function handleDelete(entryId: number, fishName: string) {
    if (!window.confirm(`${fishName} 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.`)) return;
    try {
      await deleteMutation.mutateAsync(entryId);
      showToast('기록을 삭제했어요');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }

  if (isAuthLoading || !user) {
    return <div className="mx-auto max-w-content px-4 py-12 text-body-sm text-ink-mute sm:px-7">내 기록을 준비하고 있어요...</div>;
  }

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-8 sm:px-7">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-soft text-accent"><BookOpenCheck className="h-5 w-5" aria-hidden /></span>
          <h1 className="m-0 text-30 font-extrabold tracking-[-0.035em] text-ink">먹어본 기록</h1>
          <p className="mb-0 mt-2 text-14.5 leading-[1.6] text-ink-mute">{user.nickname}님의 취향을 공개 후기와 분리된 개인 기록으로 남겨보세요.</p>
        </div>
        {stats ? (
          <dl className="m-0 grid grid-cols-3 overflow-hidden rounded-card border border-line bg-surface">
            <Stat label="전체 기록" value={`${stats.totalEntries}개`} />
            <Stat label="먹어본 횟감" value={`${stats.distinctFishCount}종`} />
            <Stat label="이번 달" value={`${stats.currentMonthEntries}개`} />
          </dl>
        ) : null}
      </header>

      <section className="rounded-card border border-line bg-surface p-4 sm:p-6" aria-labelledby="tasting-form-title">
        <div className="mb-5">
          <p className="m-0 text-caption font-black tracking-[0.12em] text-accent">NEW NOTE</p>
          <h2 id="tasting-form-title" className="m-0 mt-1 text-20 font-extrabold text-ink">오늘의 한 접시 기록하기</h2>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate aria-busy={isBusy}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="횟감" htmlFor="tasting-fish" error={fieldError && !form.fishId ? fieldError : undefined}>
              <select
                id="tasting-fish"
                value={form.fishId}
                disabled={isFishLoading || isFishError}
                onChange={(event) => { setForm((previous) => ({ ...previous, fishId: event.target.value })); setFieldError(''); }}
                className={inputClass(Boolean(fieldError && !form.fishId))}
              >
                <option value="">횟감을 선택해 주세요</option>
                {fishes.map((fish) => <option key={fish.id} value={fish.id}>{fish.name}</option>)}
              </select>
            </Field>
            <Field label="먹은 날짜" htmlFor="tasting-date" error={fieldError && Boolean(form.fishId) ? fieldError : undefined}>
              <input id="tasting-date" type="date" max={todayValue()} value={form.tastedOn} onChange={(event) => { setForm((previous) => ({ ...previous, tastedOn: event.target.value })); setFieldError(''); }} className={inputClass(Boolean(fieldError && form.fishId))} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-[5px] text-xs font-bold text-ink-mute">먹은 방식</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {preparationOptions.map((option) => (
                  <label key={option.value} className={[
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-btn border px-2 text-13 font-bold transition focus-within:ring-2 focus-within:ring-focus',
                    form.preparation === option.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-mute hover:border-accent/40',
                  ].join(' ')}>
                    <input type="radio" name="preparation" value={option.value} checked={form.preparation === option.value} onChange={() => setForm((previous) => ({ ...previous, preparation: option.value }))} className="sr-only" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-[5px] text-xs font-bold text-ink-mute">내 별점 (선택)</legend>
              <div className="flex min-h-11 items-center gap-1" role="radiogroup" aria-label="내 별점">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button key={score} type="button" role="radio" aria-checked={form.rating === score} onClick={() => setForm((previous) => ({ ...previous, rating: previous.rating === score ? null : score }))} className="flex min-h-11 min-w-11 items-center justify-center rounded-btn text-24 leading-none text-control-border transition hover:text-star focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <Star className={score <= (form.rating ?? 0) ? 'h-6 w-6 fill-star text-star' : 'h-6 w-6'} aria-hidden />
                    <span className="sr-only">{score}점</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div>
            <label htmlFor="tasting-place" className="mb-[5px] block text-xs font-bold text-ink-mute">먹은 곳 (선택)</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
              <input id="tasting-place" aria-describedby="tasting-place-helper" maxLength={100} value={form.placeName} onChange={(event) => setForm((previous) => ({ ...previous, placeName: event.target.value }))} placeholder="예: 노량진 ○○수산" className={`${inputClass(false)} pl-9`} />
            </div>
            <p id="tasting-place-helper" className="m-0 mt-1 text-xs leading-snug text-ink-mute">상호나 동네처럼 나중에 알아볼 수 있게 적어보세요.</p>
          </div>

          <Field label="한줄 메모 (선택)" htmlFor="tasting-note" helper={`${form.note.length}/500자`}>
            <textarea id="tasting-note" rows={3} maxLength={500} value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="식감, 곁들임, 다시 먹고 싶은 포인트를 남겨보세요." className={`${inputClass(false)} min-h-[96px] resize-y`} />
          </Field>

          <div>
            <span className="mb-[5px] block text-xs font-bold text-ink-mute">사진 (선택)</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-btn border border-line bg-surface px-4 py-2.5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-within:ring-2 focus-within:ring-focus">
                <Camera className="h-4 w-4" aria-hidden />
                사진 고르기
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => handleImage(event.target.files?.[0])} className="sr-only" />
              </label>
              {selectedImage ? (
                <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full bg-chipbg py-1 pl-3 pr-1.5 text-caption font-bold text-ink">
                  <span className="max-w-[220px] truncate">{selectedImage.name}</span>
                  <button type="button" onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute hover:bg-surface hover:text-accent" aria-label="선택한 사진 빼기"><X className="h-4 w-4" aria-hidden /></button>
                </span>
              ) : null}
            </div>
            <p className="mb-0 mt-1.5 text-caption text-ink-mute">JPG·PNG·정적 GIF·정적 WebP, 최대 5MB</p>
          </div>

          {isFishError ? <ErrorState message="횟감 목록을 불러오지 못했어요" onRetry={() => void refetchFish()} /> : null}
          {formError ? <p role="alert" className="m-0 text-13 font-semibold text-red-700 dark:text-red-400">{formError}</p> : null}
          <button type="submit" disabled={isBusy || isFishLoading || isFishError} className="inline-flex min-h-12 w-full items-center justify-center rounded-btn bg-primary px-6 py-3 text-[15px] font-extrabold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 sm:w-fit">
            {uploading ? '사진 올리는 중...' : createMutation.isPending ? '기록 저장 중...' : '먹어본 기록 저장하기'}
          </button>
        </form>
      </section>

      <section id="tasting-list" className="mt-10 scroll-mt-24" aria-labelledby="tasting-list-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="m-0 text-caption font-black tracking-[0.12em] text-accent">MY TASTING LOG</p>
            <h2 id="tasting-list-title" className="m-0 mt-1 text-22 font-extrabold text-ink">차곡차곡 쌓인 기록</h2>
          </div>
          {stats ? <span className="text-body-sm font-bold text-ink-mute">총 {stats.totalEntries}개</span> : null}
        </div>

        {entriesQuery.isLoading ? <p className="rounded-card border border-line bg-surface px-5 py-12 text-center text-body-sm text-ink-mute">기록을 불러오고 있어요...</p> : null}
        {entriesQuery.isError ? <ErrorState onRetry={() => void entriesQuery.refetch()} /> : null}
        {!entriesQuery.isLoading && !entriesQuery.isError && entries.length === 0 ? (
          <div className="rounded-card border border-dashed border-line px-5 py-16 text-center">
            <BookOpenCheck className="mx-auto h-9 w-9 text-ink-mute/40" aria-hidden />
            <h3 className="mb-0 mt-4 text-18 font-extrabold text-ink">아직 먹어본 기록이 없어요</h3>
            <p className="mb-0 mt-2 text-body-sm text-ink-mute">첫 한 접시를 기록하면 나만의 취향 도감이 시작됩니다.</p>
          </div>
        ) : null}
        {entries.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <article key={entry.id} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="aspect-[16/9] overflow-hidden bg-chipbg">
                  {entry.imageUrl || entry.fishImageUrl ? <img src={entry.imageUrl ?? entry.fishImageUrl ?? undefined} alt={entry.imageUrl ? `${entry.fishName} 먹어본 기록 사진` : ''} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-body-sm font-bold text-ink-mute">{entry.fishName}</div>}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={entry.fishSlug ? `/fish/${entry.fishSlug}` : fishDetailPath({ id: entry.fishId })} className="text-[17px] font-extrabold text-ink transition hover:text-accent">{entry.fishName}</Link>
                      <p className="m-0 mt-1 text-caption font-semibold text-ink-mute">{formatKoreanDate(entry.tastedOn)} · {preparationLabel(entry.preparation)}</p>
                    </div>
                    <button type="button" disabled={deleteMutation.isPending} onClick={() => void handleDelete(entry.id, entry.fishName)} className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-ink-mute transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 dark:hover:bg-red-950/40" aria-label={`${entry.fishName} 기록 삭제`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                  {entry.rating ? <p className="m-0 mt-3 text-14 font-bold text-star" aria-label={`${entry.rating}점`}>{'★'.repeat(entry.rating)}<span className="text-control-border">{'★'.repeat(5 - entry.rating)}</span></p> : null}
                  {entry.placeName ? <p className="m-0 mt-2 flex items-center gap-1.5 text-13 font-semibold text-ink-mute"><MapPin className="h-3.5 w-3.5" aria-hidden />{entry.placeName}</p> : null}
                  {entry.note ? <p className="mb-0 mt-3 whitespace-pre-wrap text-body-sm leading-[1.6] text-ink">{entry.note}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {entriesQuery.hasNextPage ? <button type="button" onClick={() => void entriesQuery.fetchNextPage()} disabled={entriesQuery.isFetchingNextPage} className="mx-auto mt-6 flex min-h-11 items-center justify-center rounded-btn border border-line bg-surface px-5 py-2.5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent disabled:opacity-50">{entriesQuery.isFetchingNextPage ? '더 불러오는 중...' : '기록 더 보기'}</button> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[92px] border-r border-line px-3 py-3 text-center last:border-r-0"><dt className="text-caption font-semibold text-ink-mute">{label}</dt><dd className="m-0 mt-1 text-16 font-extrabold text-ink">{value}</dd></div>;
}

function emptyForm(fishId: string): FormState {
  return { fishId, tastedOn: todayValue(), rating: null, preparation: 'RAW', placeName: '', note: '' };
}

function todayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readInitialFishId(params: URLSearchParams) {
  const fishId = Number(params.get('fish'));
  return Number.isSafeInteger(fishId) && fishId > 0 ? String(fishId) : '';
}

function preparationLabel(value: TastingPreparation) {
  return preparationOptions.find((option) => option.value === value)?.label ?? '기타';
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
}

function preferredScrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
