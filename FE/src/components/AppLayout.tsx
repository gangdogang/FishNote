import type { ReactNode } from 'react';
import { Fish } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBookmarks } from '../hooks/useBookmarks';
import SearchBar from './SearchBar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { bookmarkCount } = useBookmarks();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const searchParams = new URLSearchParams(location.search);
  const navClassName = (active: boolean) =>
    active
      ? 'flex-none px-0 py-2 text-sm font-semibold text-sea transition'
      : 'flex-none px-0 py-2 text-sm font-semibold text-ink-mute transition hover:text-sea';

  function handleHeaderSearch(value: string) {
    const params = new URLSearchParams();
    if (value) params.set('search', value);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <div className="min-h-screen bg-mist font-sans text-ink antialiased">
      <header className="sticky top-0 z-50 border-b border-line bg-white">
        <div className="mx-auto flex min-h-[57px] max-w-[980px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-7 md:flex-nowrap">
          <Link to="/" className="flex flex-none items-center gap-2 p-0 text-ink transition hover:text-sea" aria-label="FishNote 홈">
            <Fish className="h-4 w-[26px] flex-none text-sea" aria-hidden />
            <span className="text-[17px] font-extrabold leading-none text-ink">FishNote</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-[22px] overflow-x-auto">
            <Link
              to="/"
              className={navClassName(pathname === '/' || pathname.startsWith('/fish'))}
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
              to="/saved"
              className={`${navClassName(pathname === '/saved')} inline-flex items-center gap-1.5`}
            >
              저장한 도감
              <span
                className={
                  pathname === '/saved'
                    ? 'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-sea px-1 text-[11px] font-bold leading-none text-white'
                    : 'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-chipbg px-1 text-[11px] font-bold leading-none text-ink-mute'
                }
                aria-label={`저장 ${bookmarkCount}개`}
              >
                {bookmarkCount}
              </span>
            </Link>
          </nav>

          <div className="w-full flex-none md:ml-auto md:w-[220px]">
            <SearchBar
              key={location.search}
              initialValue={searchParams.get('search') ?? ''}
              placeholder="생선 이름 검색"
              onSubmit={handleHeaderSearch}
              variant="compact"
            />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
