interface FishServingTipsSectionProps {
  tips?: string[];
}

export default function FishServingTipsSection({ tips = [] }: FishServingTipsSectionProps) {
  return (
    <section className="mt-9" aria-labelledby="fish-tips-heading">
      <h2 id="fish-tips-heading" className="m-0 mb-3.5 text-19 font-extrabold tracking-normal text-ink">
        이렇게 즐겨요
      </h2>
      {tips.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {tips.map((tip, index) => (
            <li
              key={`${tip}-${index}`}
              className="flex items-start gap-2.5 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm leading-[1.7] text-ink"
            >
              <span className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full bg-chipbg text-caption font-bold text-ink-mute">
                {index + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ink-mute">준비된 팁이 아직 없어요</p>
      )}
    </section>
  );
}
