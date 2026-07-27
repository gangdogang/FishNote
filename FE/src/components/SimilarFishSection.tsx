import type { SimilarFish } from '../types/fish';
import FishCard from './FishCard';

interface SimilarFishSectionProps {
  fishes: SimilarFish[];
}

export default function SimilarFishSection({ fishes }: SimilarFishSectionProps) {
  if (fishes.length === 0) return null;

  return (
    <section className="mt-9" aria-labelledby="similar-fish-heading">
      <h2 id="similar-fish-heading" className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">
        비슷한 횟감
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fishes.map((fish, index) => (
          <FishCard key={fish.id} fish={fish} analyticsSection="similar_fish" analyticsPosition={index + 1} />
        ))}
      </div>
    </section>
  );
}
