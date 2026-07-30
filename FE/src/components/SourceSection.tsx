import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import ClaimSourceList from './ClaimSourceList';
import { CLAIM_ORDER } from '../lib/sourcePresentation';
import type { FishClaimType, FishSourcesResponse } from '../types/source';

interface SourceSectionProps {
  data?: FishSourcesResponse;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  onRetry: () => void;
  onReport: (claimType: FishClaimType) => void;
}

export default function SourceSection({
  data,
  loading,
  fetching,
  error,
  onRetry,
  onReport,
}: SourceSectionProps) {
  return (
    <section
      id="fish-source-section"
      aria-labelledby="fish-source-heading"
      className="mt-11 scroll-mt-[var(--detail-scroll-offset)]"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <h2 id="fish-source-heading" className="m-0 text-19 font-extrabold tracking-normal text-ink">
          정보 근거
        </h2>
        <button
          type="button"
          onClick={() => onReport('SEASON')}
          className="inline-flex min-h-11 items-center rounded-btn px-2 text-body-sm font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          정보 오류 제보
        </button>
      </div>

      <p className="m-0 mt-1 max-w-[720px] text-13 leading-[1.7] text-ink-mute">
        제철과 맛 정보는 산지·수온·유통 방식에 따라 달라질 수 있어요. 원문과 검수 상태를 함께 공개합니다.
      </p>

      {loading && !data ? (
        <div
          role="status"
          aria-label="정보 근거를 불러오는 중"
          aria-busy="true"
          className="mt-3 h-20 animate-pulse rounded-card border border-line bg-surface motion-reduce:animate-none"
        />
      ) : null}

      {error && !data ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
          <p className="m-0 min-w-0 flex-1 text-body-sm text-ink-mute">
            출처만 불러오지 못했어요. 횟감 상세 정보는 계속 볼 수 있습니다.
          </p>
          <RetryButton fetching={fetching} onRetry={onRetry} />
        </div>
      ) : null}

      {data ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CLAIM_ORDER.map((claimType) => (
            <ClaimSourceList
              key={claimType}
              claim={data.claims.find((claim) => claim.claimType === claimType)}
              compact
              fishId={data.fishId}
            />
          ))}
        </div>
      ) : null}

      {data && error ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-btn bg-mist px-3 py-2">
          <p className="m-0 min-w-0 flex-1 text-xs text-ink-mute">
            최신 근거를 갱신하지 못해 이전 내용을 보여드려요.
          </p>
          <RetryButton fetching={fetching} onRetry={onRetry} />
        </div>
      ) : null}

      <Link
        to="/sources"
        className="mt-3 inline-flex min-h-11 items-center text-body-sm font-bold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        검수 기준과 전체 출처 보기
      </Link>
    </section>
  );
}

function RetryButton({ fetching, onRetry }: { fetching: boolean; onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={fetching}
      aria-busy={fetching}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-2.5 text-xs font-bold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw className={fetching ? 'h-3.5 w-3.5 animate-spin motion-reduce:animate-none' : 'h-3.5 w-3.5'} aria-hidden />
      다시 시도
    </button>
  );
}
