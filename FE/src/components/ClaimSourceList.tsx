import { CircleHelp, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  claimTypeLabel,
  confidenceLabel,
  formatSourceDate,
  verificationStatusLabel,
} from '../lib/sourcePresentation';
import type { FishClaimSources, VerificationStatus } from '../types/source';
import { trackAnalyticsEvent } from '../lib/analytics';

interface ClaimSourceListProps {
  claim?: FishClaimSources;
  compact?: boolean;
  showEmpty?: boolean;
  fishId?: number;
}

export default function ClaimSourceList({
  claim,
  compact = false,
  showEmpty = true,
  fishId,
}: ClaimSourceListProps) {
  if (!claim || (!showEmpty && claim.sources.length === 0)) return null;

  if (claim.sources.length === 0) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-btn bg-mist px-3 py-2.5 text-xs leading-relaxed text-ink-mute">
        <CircleHelp className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
        <span>
          {claimTypeLabel(claim.claimType)} 근거는 아직 검수 중이에요. 확인된 원문이 추가되면 여기에 공개합니다.
        </span>
      </div>
    );
  }

  return (
    <details className="group mt-3 rounded-btn border border-line bg-surface open:pb-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-btn px-3 py-2 text-xs text-ink-mute transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
        <StatusIcon status={claim.verificationStatus} />
        <span className="min-w-0 flex-1 font-semibold text-ink">
          {claimTypeLabel(claim.claimType)} 근거 · {verificationStatusLabel(claim.verificationStatus)}
        </span>
        <span className="flex-none tabular-nums">출처 {claim.sourceCount}개</span>
        <span className="flex-none transition group-open:rotate-180" aria-hidden>⌄</span>
      </summary>

      <ol className={compact ? 'm-0 grid list-none gap-2 px-2' : 'm-0 grid list-none gap-2 px-2 sm:grid-cols-2'}>
        {claim.sources.map((source) => (
          <li key={source.id} className="min-w-0 rounded-btn bg-mist px-3 py-3">
            <a
              href={source.url}
              onClick={() => {
                if (fishId !== undefined) {
                  trackAnalyticsEvent('source_link_clicked', { fishId, claimType: claim.claimType });
                }
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link inline-flex min-h-11 items-start gap-2 font-bold leading-snug text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="min-w-0">{source.title}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            </a>
            <p className="m-0 mt-1 text-xs leading-relaxed text-ink-mute">
              {source.publisher}
              {formatSourceDate(source.publishedAt) ? ` · ${formatSourceDate(source.publishedAt)}` : ''}
            </p>
            <p className="m-0 mt-1 text-caption leading-relaxed text-ink-mute">
              {confidenceLabel(source.confidence)} · {source.license ?? '이용 조건 확인 중'}
              {formatSourceDate(source.verifiedAt) ? ` · ${formatSourceDate(source.verifiedAt)} 검수` : ''}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  if (status === 'VERIFIED') {
    return <ShieldCheck className="h-4 w-4 flex-none text-accent" aria-hidden />;
  }
  if (status === 'PARTIALLY_VERIFIED') {
    return <ShieldAlert className="h-4 w-4 flex-none text-accent" aria-hidden />;
  }
  return <CircleHelp className="h-4 w-4 flex-none text-accent" aria-hidden />;
}
