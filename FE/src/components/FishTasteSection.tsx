import SeasonBar from './SeasonBar';
import ClaimSourceList from './ClaimSourceList';
import type { FishClaimSources } from '../types/source';

interface FishTasteSectionProps {
  fishId?: number;
  description?: string | null;
  seasonMonths: number[];
  tasteClaim?: FishClaimSources;
  seasonClaim?: FishClaimSources;
}

export default function FishTasteSection({
  fishId,
  description,
  seasonMonths,
  tasteClaim,
  seasonClaim,
}: FishTasteSectionProps) {
  return (
    <>
      <section className="mt-11" aria-labelledby="fish-taste-heading">
        <h2 id="fish-taste-heading" className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">
          어떤 맛인가요?
        </h2>
        {description ? (
          <p className="m-0 max-w-[640px] text-15 leading-[1.8] text-ink">{description}</p>
        ) : (
          <p className="m-0 text-sm text-ink-mute">맛 설명을 준비 중이에요</p>
        )}
        <div className="max-w-[640px]">
          <ClaimSourceList claim={tasteClaim} compact fishId={fishId} />
        </div>
      </section>

      <section className="mt-9" aria-labelledby="fish-season-heading">
        <h2 id="fish-season-heading" className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">
          언제가 제철인가요?
        </h2>
        <div className="max-w-[640px] rounded-card border border-line bg-surface p-4">
          <SeasonBar months={seasonMonths} />
        </div>
        <div className="max-w-[640px]">
          <ClaimSourceList claim={seasonClaim} compact fishId={fishId} />
        </div>
      </section>

    </>
  );
}
