import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'taste-section', label: '맛·제철' },
  { id: 'price-section', label: '가격' },
  { id: 'tips-section', label: '즐기는 법' },
  { id: 'fish-source-section', label: '근거' },
  { id: 'reviews', label: '후기' },
] as const;

type DetailSectionId = (typeof SECTIONS)[number]['id'];

export default function DetailSectionNav() {
  const [activeId, setActiveId] = useState<DetailSectionId>(SECTIONS[0].id);

  useEffect(() => {
    const elements = SECTIONS
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id as DetailSectionId);
      },
      { rootMargin: '-24% 0px -62% 0px', threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="횟감 상세 바로가기"
      className="sticky top-[var(--app-header-height)] z-30 -mx-4 mt-7 border-y border-line bg-mist/95 px-4 backdrop-blur sm:-mx-7 sm:px-7"
    >
      <div className="detail-section-nav-scroll flex gap-1 overflow-x-auto py-1">
        {SECTIONS.map(({ id, label }) => {
          const active = activeId === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active ? 'location' : undefined}
              className={[
                'relative inline-flex min-h-11 flex-none items-center px-3 text-body-sm font-bold transition',
                'focus-visible:rounded-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active ? 'text-accent' : 'text-ink-mute hover:text-ink',
              ].join(' ')}
            >
              {label}
              <span
                aria-hidden
                className={[
                  'absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
              />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
