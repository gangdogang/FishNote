import { CircleHelp, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatSourceDate, verificationStatusLabel } from '../lib/sourcePresentation';
import type { FishSourceSummary, VerificationStatus } from '../types/source';

interface VerificationSummaryProps {
  summary?: FishSourceSummary;
  loading: boolean;
  fetching?: boolean;
  error: boolean;
  onRetry: () => void;
}

export default function VerificationSummary({
  summary,
  loading,
  fetching = false,
  error,
  onRetry,
}: VerificationSummaryProps) {
  if (loading && !summary) {
    return (
      <div
        role="status"
        aria-label="검증 정보를 불러오는 중"
        aria-busy="true"
        className="mt-3 flex min-h-12 animate-pulse items-center rounded-btn bg-accent-soft/45 px-3.5 motion-reduce:animate-none"
      >
        <span className="h-4 w-56 rounded bg-chipbg" aria-hidden />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-btn bg-accent-soft/40 px-3.5 py-2.5">
        <ShieldAlert className="h-5 w-5 flex-none text-ink-mute" aria-hidden />
        <p className="m-0 min-w-0 flex-1 text-body-sm text-ink-mute">
          검증 요약은 불러오지 못했지만 상세 정보는 계속 볼 수 있어요.
        </p>
        <RetryButton fetching={fetching} onRetry={onRetry} />
      </div>
    );
  }

  if (!summary) return null;

  const verifiedDate = formatSourceDate(summary.lastVerifiedAt);
  const claimProgress =
    typeof summary.verifiedClaimCount === 'number' && typeof summary.claimCount === 'number'
      ? `검증 항목 ${summary.verifiedClaimCount}/${summary.claimCount}`
      : null;

  return (
    <aside
      aria-label="정보 검증 요약"
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-btn bg-accent-soft/45 px-3.5 py-2.5"
    >
      <StatusIcon status={summary.verificationStatus} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-body-sm font-bold text-ink">
          {verificationStatusLabel(summary.verificationStatus)}
        </p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-ink-mute">
          {verifiedDate ? `최근 검수 ${verifiedDate}` : '아직 검수일이 기록되지 않았어요'}
          {claimProgress ? ` · ${claimProgress}` : ''}
          {' · '}출처 {summary.sourceCount}개
        </p>
      </div>
      <a
        href="#fish-source-section"
        className="inline-flex min-h-11 items-center text-xs font-bold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        근거 보기
      </a>
      {error ? (
        <p role="alert" className="m-0 basis-full text-xs text-ink-mute">
          최신 검증 정보를 갱신하지 못해 이전 내용을 보여드려요.
        </p>
      ) : null}
    </aside>
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

function StatusIcon({ status }: { status: VerificationStatus }) {
  if (status === 'VERIFIED') {
    return <ShieldCheck className="h-5 w-5 flex-none text-accent" aria-hidden />;
  }
  if (status === 'PARTIALLY_VERIFIED') {
    return <ShieldAlert className="h-5 w-5 flex-none text-accent" aria-hidden />;
  }
  return <CircleHelp className="h-5 w-5 flex-none text-accent" aria-hidden />;
}
