import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Fish } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBookmarks } from '../hooks/useBookmarks';
import { useAuth } from '../hooks/useAuth';
import BookmarkMergeDialog from './BookmarkMergeDialog';
import SearchBar from './SearchBar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { bookmarkCount } = useBookmarks();
  const { accessToken, user, isAuthLoading, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!profileRef.current?.contains(target)) setProfileOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  function handleLogout() {
    logout();
    setProfileOpen(false);
    navigate('/');
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

          <div className="flex flex-none items-center">
            {!accessToken || (!isAuthenticated && !isAuthLoading) ? (
              <Link
                to="/login"
                state={{ from: location }}
                className="whitespace-nowrap px-0 py-2 text-sm font-semibold text-ink-mute transition hover:text-sea"
              >
                로그인
              </Link>
            ) : null}

            {accessToken && isAuthLoading ? <div className="h-7 w-7 rounded-full bg-sea-soft" aria-hidden /> : null}

            {isAuthenticated && user ? (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label={`${user.nickname} 계정 메뉴`}
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-sea-soft p-0 text-[13px] font-extrabold leading-none text-sea transition hover:bg-sea-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2"
                >
                  {getInitial(user.nickname)}
                </button>

                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+10px)] z-50 w-[204px] rounded-card border border-line bg-white py-2 shadow-[0_12px_30px_rgba(26,43,51,0.14)]"
                  >
                    <div className="px-3.5 pb-2 pt-1">
                      <p className="m-0 truncate text-sm font-bold leading-snug text-ink">{user.nickname}</p>
                      <p className="m-0 mt-0.5 truncate text-xs leading-snug text-ink-mute">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link
                      role="menuitem"
                      to="/saved"
                      onClick={() => setProfileOpen(false)}
                      className="block px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:bg-mist hover:text-sea"
                    >
                      저장한 도감
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full border-0 bg-transparent px-3.5 py-2 text-left text-[13px] font-semibold text-ink transition hover:bg-mist hover:text-sea"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="w-full flex-none md:w-[220px]">
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
      <BookmarkMergeDialog />
    </div>
  );
}

function getInitial(nickname: string) {
  return Array.from(nickname.trim())[0] ?? '?';
}
