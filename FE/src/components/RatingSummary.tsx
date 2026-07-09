interface RatingSummaryProps {
  avgRating: number;
  reviewCount: number;
}

export default function RatingSummary({ avgRating, reviewCount }: RatingSummaryProps) {
  return (
    <span className="flex flex-none items-center gap-1 whitespace-nowrap text-[13px] font-bold tabular-nums text-ink">
      <span className="text-star">★</span>
      {avgRating.toFixed(1)}
      <span className="font-medium text-ink-mute">({reviewCount})</span>
    </span>
  );
}
