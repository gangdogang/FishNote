export function SeasonBadgeNow({ className = '' }: { className?: string }) {
  return (
    <span className={['inline-flex items-center gap-[5px] rounded-full bg-sea px-2.5 py-[3px] text-xs font-bold text-white', className].join(' ')}>
      <span className="h-[5px] w-[5px] rounded-full bg-white" aria-hidden />
      지금 제철
    </span>
  );
}

export function SeasonBadgeOutline({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center rounded-full border border-line bg-white px-2.5 py-[3px] text-xs font-semibold text-ink-mute">
      <span className="truncate">{label}</span>
    </span>
  );
}
