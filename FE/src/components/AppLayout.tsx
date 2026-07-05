import type { ReactNode } from 'react';
import { Bookmark } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useBookmarks } from '../hooks/useBookmarks';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { bookmarkCount } = useBookmarks();
  const { pathname } = useLocation();
  const navClassName = (active: boolean) =>
    active
      ? 'flex-none rounded-[10px] px-[14px] py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50'
      : 'flex-none rounded-[10px] px-[14px] py-2 text-sm font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-700';

  return (
    <div className="min-h-screen bg-white font-sans text-ink antialiased">
      <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-[10px] backdrop-saturate-[180%]">
        <div className="mx-auto flex h-[66px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-7">
          <Link to="/" className="flex flex-none items-center gap-[9px] p-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
              <svg viewBox="0 0 64 40" width="18" height="12" fill="#fff" aria-hidden>
                <path d="M2 20 C16 3, 42 3, 52 20 C42 37, 16 37, 2 20 Z" />
                <path d="M50 20 L63 9 L63 31 Z" />
                <circle cx="18" cy="17" r="2.4" fill="#0F9488" />
              </svg>
            </span>
            <span className="text-xl font-bold tracking-[-0.025em] text-ink">FishNote</span>
          </Link>

          <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
            <Link
              to="/"
              className={navClassName(pathname === '/')}
            >
              도감
            </Link>
            <Link
              to="/calendar"
              className={navClassName(pathname === '/calendar')}
            >
              제철 캘린더
            </Link>
            <Link
              to="/search?sort=popular"
              className={navClassName(pathname === '/search')}
            >
              후기
            </Link>
          </nav>

          <Link
            to="/saved"
            className="ml-auto inline-flex h-10 flex-none items-center gap-1.5 rounded-[10px] border border-line bg-white px-[14px] text-[13px] font-semibold text-ink transition hover:border-brand-500 hover:text-brand-700"
            aria-label="저장한 도감"
          >
            <Bookmark className="h-4 w-4 fill-none text-brand-700" aria-hidden />
            <span>{bookmarkCount}</span>
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
