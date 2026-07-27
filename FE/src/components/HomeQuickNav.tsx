import { ArrowUp, BookOpen, Fish, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'section-seasonal', label: '이달의 제철', icon: Fish },
  { id: 'section-featured', label: '처음 먹기 좋은 회', icon: Sparkles },
  { id: 'section-all', label: '전체 도감', icon: BookOpen },
];

// 홈 전용 바로가기 레일 — 넓은 화면(xl↑)에서 좌측에 떠서 스크롤을 따라온다.
export default function HomeQuickNav() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
  }

  return (
    <nav aria-label="홈 바로가기" className="fixed left-[calc(50%-566px)] top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <div className="flex flex-col items-center gap-1.5 rounded-full border border-line bg-surface/90 p-2 shadow-[0_10px_30px_rgba(26,43,51,0.10)] backdrop-blur">
        {SECTIONS.map((section) => {
          const active = activeId === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollTo(section.id)}
              aria-label={section.label}
              aria-current={active ? 'true' : undefined}
              className={[
                'group relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none',
                active ? 'scale-110 bg-accent-soft text-accent ring-2 ring-accent' : 'bg-chipbg text-ink-mute hover:scale-105 hover:bg-accent-soft hover:text-accent',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span
                className={[
                  'pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap',
                  'rounded-full bg-ink px-2.5 py-1 text-caption font-semibold text-surface transition-opacity duration-150',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}
              >
                {section.label}
              </span>
            </button>
          );
        })}

        <div className="my-0.5 h-px w-6 bg-line" aria-hidden />

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })}
          aria-label="맨 위로"
          className="group relative flex h-11 w-11 items-center justify-center rounded-full bg-chipbg text-ink-mute transition-all duration-200 hover:scale-105 hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
          <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-caption font-semibold text-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            맨 위로
          </span>
        </button>
      </div>
    </nav>
  );
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
