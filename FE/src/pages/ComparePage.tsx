import { Plus, Scale, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import SmartImage from '../components/SmartImage';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useFishList } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';
import { fishDetailPath } from '../lib/fishRoutes';
import { formatMonths, formatPriceLevel, isInSeasonNow } from '../lib/format';
import type { FishSummary } from '../types/fish';

const MAX_COMPARE = 3;

export default function ComparePage() {
  usePageMeta('횟감 비교', '제철·맛·가격을 기준으로 횟감을 한눈에 비교해보세요.', null, { noindex: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>(() => readFishIds(searchParams));
  const { data: fishes = [], isLoading, isError, refetch } = useFishList({ sort: 'name' });
  const selected = useMemo(
    () => selectedIds.map((id) => fishes.find((fish) => fish.id === id)).filter((fish): fish is FishSummary => Boolean(fish)),
    [fishes, selectedIds],
  );
  const available = fishes.filter((fish) => !selectedIds.includes(fish.id));

  function commit(nextIds: number[]) {
    setSelectedIds(nextIds);
    const params = new URLSearchParams();
    if (nextIds.length > 0) params.set('fish', nextIds.join(','));
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-8 sm:px-7">
      <header className="mb-7">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-soft text-accent"><Scale className="h-5 w-5" aria-hidden /></span>
        <h1 className="m-0 text-30 font-extrabold tracking-[-0.035em] text-ink">횟감 비교</h1>
        <p className="mb-0 mt-2 text-14.5 leading-[1.6] text-ink-mute">최대 3종의 제철·맛·가격과 평점을 같은 기준으로 살펴보세요.</p>
      </header>

      <section className="rounded-card border border-line bg-surface p-4 sm:p-5" aria-labelledby="compare-picker-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="compare-picker-title" className="m-0 text-17 font-extrabold text-ink">비교할 횟감</h2>
            <p className="m-0 mt-1 text-caption text-ink-mute">{selectedIds.length}/{MAX_COMPARE}종 선택</p>
          </div>
          <label className="block min-w-0 sm:w-[300px]">
            <span className="sr-only">비교할 횟감 추가</span>
            <span className="relative block">
              <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
              <select
                value=""
                disabled={isLoading || isError || selectedIds.length >= MAX_COMPARE || available.length === 0}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (Number.isSafeInteger(id) && id > 0) commit([...selectedIds, id]);
                }}
                className="min-h-11 w-full appearance-none rounded-btn border border-control-border bg-surface py-2.5 pl-9 pr-9 text-base font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-mist disabled:text-ink-mute xl:text-body-sm"
              >
                <option value="">{selectedIds.length >= MAX_COMPARE ? '최대 3종까지 비교할 수 있어요' : '횟감 추가하기'}</option>
                {available.map((fish) => <option key={fish.id} value={fish.id}>{fish.name}</option>)}
              </select>
            </span>
          </label>
        </div>
        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.map((fish) => (
              <span key={fish.id} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-chipbg py-1 pl-3 pr-1.5 text-body-sm font-bold text-ink">
                {fish.name}
                <button type="button" onClick={() => commit(selectedIds.filter((id) => id !== fish.id))} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute transition hover:bg-surface hover:text-accent" aria-label={`${fish.name} 비교에서 빼기`}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {isLoading ? <SkeletonCards count={3} className="mt-7 grid gap-5 sm:grid-cols-3" /> : null}
      {isError ? <div className="mt-7"><ErrorState onRetry={() => void refetch()} /></div> : null}
      {!isLoading && !isError && selected.length === 0 ? (
        <div className="mt-7 rounded-card border border-dashed border-line px-5 py-16 text-center">
          <Scale className="mx-auto h-9 w-9 text-ink-mute/40" aria-hidden />
          <h2 className="mb-0 mt-4 text-18 font-extrabold text-ink">먼저 횟감을 골라주세요</h2>
          <p className="mb-0 mt-2 text-body-sm text-ink-mute">위 선택 메뉴에서 궁금한 횟감을 2~3종 추가해 보세요.</p>
        </div>
      ) : null}
      {!isLoading && !isError && selected.length > 0 ? <ComparisonTable fishes={selected} /> : null}
    </div>
  );
}

function ComparisonTable({ fishes }: { fishes: FishSummary[] }) {
  return (
    <section className="mt-7" aria-labelledby="comparison-title">
      <h2 id="comparison-title" className="sr-only">선택한 횟감 비교 결과</h2>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-left">
          <caption className="sr-only">제철, 대표 맛, 가격대, 평점을 기준으로 선택한 횟감을 비교합니다.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[150px] border-b border-r border-line bg-mist px-4 py-4 text-body-sm font-extrabold text-ink">비교 기준</th>
              {fishes.map((fish) => (
                <th key={fish.id} scope="col" className="border-b border-r border-line p-3 align-top last:border-r-0">
                  <Link to={fishDetailPath(fish)} className="group block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <div className="aspect-[4/3] overflow-hidden rounded-[12px] bg-chipbg">
                      <SmartImage media={fish.media} legacyUrl={fish.imageUrl} fallbackName={fish.name} sizes="220px" className="h-full" />
                    </div>
                    <span className="mt-2.5 block text-[17px] font-extrabold text-ink transition group-hover:text-accent">{fish.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow label="지금 제철" fishes={fishes} render={(fish) => isInSeasonNow(fish.seasonMonths) ? '지금 제철이에요' : '제철을 기다려보세요'} />
            <ComparisonRow label="대표 제철" fishes={fishes} render={(fish) => formatMonths(fish.seasonMonths)} />
            <ComparisonRow label="대표 맛" fishes={fishes} render={(fish) => fish.tasteTags.length > 0 ? fish.tasteTags.join(' · ') : '정보 준비 중'} />
            <ComparisonRow label="가격대" fishes={fishes} render={(fish) => formatPriceLevel(fish.priceLevel, { withLabel: true })} />
            <ComparisonRow label="이용자 평점" fishes={fishes} render={(fish) => fish.reviewCount > 0 ? `★ ${fish.avgRating.toFixed(1)} · 후기 ${fish.reviewCount}개` : '아직 후기 없음'} />
            <ComparisonRow label="한줄 소개" fishes={fishes} render={(fish) => fish.description ?? '정보 준비 중'} />
          </tbody>
        </table>
      </div>
      <p className="mb-0 mt-3 text-caption leading-[1.6] text-ink-mute">가격대와 제철은 대표 정보이며 산지·크기·유통 환경에 따라 달라질 수 있어요.</p>
    </section>
  );
}

function ComparisonRow({ label, fishes, render }: { label: string; fishes: FishSummary[]; render: (fish: FishSummary) => string }) {
  return (
    <tr>
      <th scope="row" className="border-b border-r border-line bg-mist px-4 py-4 text-body-sm font-extrabold text-ink last:border-b-0">{label}</th>
      {fishes.map((fish) => <td key={fish.id} className="border-b border-r border-line px-4 py-4 text-body-sm font-semibold leading-[1.55] text-ink last:border-r-0">{render(fish)}</td>)}
    </tr>
  );
}

function readFishIds(params: URLSearchParams) {
  return [...new Set((params.get('fish') ?? '').split(',')
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0))]
    .slice(0, MAX_COMPARE);
}
