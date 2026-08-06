import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, BookOpenCheck, CalendarDays, Heart, Moon, Sparkles, Sun } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useBookmarks } from '../hooks/useBookmarks';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { firstGrapheme } from '../lib/grapheme';
import { fishDetailPath } from '../lib/fishRoutes';
import BookmarkMergeDialog from './BookmarkMergeDialog';
import FishNoteMark from './FishNoteMark';
import RouteAnnouncer from './RouteAnnouncer';
import RouteFocusManager from './RouteFocusManager';
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
  const [homeHeroVisibility, setHomeHeroVisibility] = useState<'unknown' | 'visible' | 'hidden'>('unknown');
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = location;
  const normalizedPathname = normalizePathname(pathname);
  const catalogActive = normalizedPathname === '/' || /^\/fish\/[^/]+$/.test(normalizedPathname);
  const calendarActive = normalizedPathname === '/calendar';
  const savedActive = normalizedPathname === '/saved';
  const recommendationActive = normalizedPathname === '/recommend';
  const compareActive = normalizedPathname === '/compare';
  const showHeaderSearch = normalizedPathname !== '/' || homeHeroVisibility === 'hidden';
  const searchParams = new URLSearchParams(location.search);
  const navClassName = (active: boolean) =>
    [
      'relative flex-none px-0 py-2 text-body-sm font-semibold transition-colors duration-200',
      'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:rounded-full after:bg-accent after:transition-transform after:duration-200',
      active
        ? 'text-accent after:scale-x-100'
        : 'text-ink-mute after:scale-x-0 hover:text-accent hover:after:scale-x-50',
    ].join(' ');

  function handleHeaderSearch(value: string) {
    const params = new URLSearchParams();
    if (value) params.set('search', value);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  useEffect(() => {
    // Closing transient navigation UI on a route commit is intentional synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    if (normalizedPathname !== '/') {
      // Route-local observer state must not leak into non-home routes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHomeHeroVisibility('unknown');
      return;
    }

    // Reset before attaching the observer so stale hidden state does not flash the search.
    setHomeHeroVisibility('unknown');
    let observer: IntersectionObserver | undefined;
    const frame = window.requestAnimationFrame(() => {
      const hero = document.getElementById('home-hero');
      if (!hero || typeof IntersectionObserver === 'undefined') {
        setHomeHeroVisibility('visible');
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => setHomeHeroVisibility(entry?.isIntersecting ? 'visible' : 'hidden'),
        { rootMargin: '-65px 0px 0px', threshold: 0 },
      );
      observer.observe(hero);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [normalizedPathname]);

  useEffect(() => {
    if (!profileOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!profileRef.current?.contains(target)) setProfileOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
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
    <div className="flex min-h-dvh flex-col bg-mist pb-[calc(68px+var(--safe-area-bottom))] font-sans text-ink antialiased md:pb-0">
      <RouteFocusManager />
      <RouteAnnouncer />
      <a
        href="#main-content"
        tabIndex={0}
        className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-btn bg-primary px-4 py-2 text-body-sm font-bold text-on-primary shadow-[0_8px_24px_rgba(26,43,51,0.18)] transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
      >
        본문 바로가기
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-4 py-2.5 sm:px-7 md:flex md:min-h-[65px] md:items-center md:gap-7 md:py-3">
          <div className="flex min-h-11 w-full items-center gap-4">
            <Link to="/" className="group/brand flex min-h-11 flex-none items-center gap-2 p-0 text-ink transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2" aria-label="FishNote 홈">
              <FishNoteMark className="h-7 w-7 flex-none text-accent transition-transform duration-300 group-hover/brand:rotate-[-3deg] group-hover/brand:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
              <span className="text-lead font-extrabold leading-none tracking-[-0.025em] text-ink transition-colors group-hover/brand:text-accent">FishNote</span>
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center gap-4 lg:gap-5 md:flex">
              <Link
                to="/"
                aria-current={catalogActive ? 'page' : undefined}
                className={navClassName(catalogActive)}
              >
                도감
              </Link>
              <Link
                to="/recommend"
                aria-current={recommendationActive ? 'page' : undefined}
                className={navClassName(recommendationActive)}
              >
                오늘 추천
              </Link>
              <Link
                to="/compare"
                aria-current={compareActive ? 'page' : undefined}
                className={navClassName(compareActive)}
              >
                비교
              </Link>
              <Link
                to="/calendar"
                aria-current={calendarActive ? 'page' : undefined}
                className={navClassName(calendarActive)}
              >
                제철 캘린더
              </Link>
              <Link
                to="/saved"
                aria-current={savedActive ? 'page' : undefined}
                className={`${navClassName(savedActive)} inline-flex items-center gap-1.5`}
              >
                저장한 도감
                <BookmarkCount count={bookmarkCount} active={savedActive} />
              </Link>
            </nav>

            <div className="ml-auto flex flex-none items-center">
              <ThemeToggle />
              {!accessToken || (!isAuthenticated && !isAuthLoading) ? (
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-body-sm font-semibold text-ink-mute transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  로그인
                </Link>
              ) : null}

              {accessToken && isAuthLoading ? <div className="h-7 w-7 rounded-full bg-accent-soft" aria-hidden /> : null}

              {isAuthenticated && user ? (
                <div ref={profileRef} className="relative">
                  <button
                    ref={profileButtonRef}
                    type="button"
                    aria-controls="account-navigation"
                    aria-expanded={profileOpen}
                    aria-label={`${user.nickname} 계정 메뉴`}
                    onClick={() => setProfileOpen((open) => !open)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-accent-soft p-0 text-body-sm font-extrabold leading-none text-accent transition hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {firstGrapheme(user.nickname)}
                  </button>

                  {profileOpen ? (
                    <nav
                      id="account-navigation"
                      aria-label="계정"
                      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[204px] rounded-card border border-line bg-surface py-2 shadow-[0_12px_30px_rgba(26,43,51,0.14)]"
                    >
                      <div className="px-3.5 pb-2 pt-1">
                        <p className="m-0 truncate text-sm font-bold leading-snug text-ink">{user.nickname}</p>
                        <p className="m-0 mt-0.5 truncate text-xs leading-snug text-ink-mute">{user.email ?? '카카오 계정'}</p>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <Link
                        to="/saved"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3.5 py-2 text-body-sm font-semibold text-ink transition hover:bg-mist hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        저장한 도감
                      </Link>
                      <Link
                        to="/tastings"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3.5 py-2 text-body-sm font-semibold text-ink transition hover:bg-mist hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        먹어본 기록
                      </Link>
                      <Link
                        to="/account"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3.5 py-2 text-body-sm font-semibold text-ink transition hover:bg-mist hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        계정 관리
                      </Link>
                      {user.role === 'ADMIN' ? (
                        <Link
                          to="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3.5 py-2 text-body-sm font-semibold text-accent transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                        >
                          관리자
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full border-0 bg-transparent px-3.5 py-2 text-left text-body-sm font-semibold text-ink transition hover:bg-mist hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        로그아웃
                      </button>
                    </nav>
                  ) : null}
                </div>
              ) : null}
            </div>

            {showHeaderSearch ? (
              <div className="hidden w-[220px] flex-none md:block">
                <SearchBar
                  key={`desktop-${location.search}`}
                  initialValue={searchParams.get('search') ?? ''}
                  placeholder="횟감 이름 검색"
                  onSubmit={handleHeaderSearch}
                  onSuggestionSelect={(fish) => navigate(fishDetailPath(fish))}
                  variant="compact"
                  analyticsSurface="header"
                />
              </div>
            ) : null}
          </div>

          {showHeaderSearch ? (
            <div
              className={[
                'w-full md:hidden',
                normalizedPathname === '/'
                  ? 'absolute inset-x-0 top-full border-b border-line bg-surface px-4 pb-2.5 pt-2 sm:px-7'
                  : 'mt-2',
              ].join(' ')}
            >
              <SearchBar
                key={`mobile-${location.search}`}
                initialValue={searchParams.get('search') ?? ''}
                placeholder="횟감 이름 검색"
                onSubmit={handleHeaderSearch}
                onSuggestionSelect={(fish) => navigate(fishDetailPath(fish))}
                variant="compact"
                analyticsSurface="header"
              />
            </div>
          ) : null}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <MobileNavigation pathname={normalizedPathname} bookmarkCount={bookmarkCount} />
      <BookmarkMergeDialog />
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
      className="mr-1 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent text-ink-mute transition hover:bg-mist hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}

function BookmarkCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-caption font-bold leading-none text-on-primary'
          : 'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-chipbg px-1 text-caption font-bold leading-none text-ink-mute'
      }
      aria-label={`저장 ${count}개`}
    >
      {count}
    </span>
  );
}

function MobileNavigation({ pathname, bookmarkCount }: { pathname: string; bookmarkCount: number }) {
  const items = [
    { to: '/', label: '도감', icon: BookOpen, active: pathname === '/' || /^\/fish\/[^/]+$/.test(pathname) },
    { to: '/recommend', label: '추천', icon: Sparkles, active: pathname === '/recommend' },
    { to: '/calendar', label: '제철', icon: CalendarDays, active: pathname === '/calendar' },
    { to: '/tastings', label: '기록', icon: BookOpenCheck, active: pathname === '/tastings' },
    { to: '/saved', label: '저장', icon: Heart, active: pathname === '/saved' },
  ];

  return (
    <nav aria-label="모바일 주요 메뉴" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-3 pb-[max(6px,var(--safe-area-bottom))] pt-1.5 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, active }) => (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-btn text-caption font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              active ? 'text-accent' : 'text-ink-mute hover:bg-mist hover:text-accent',
            ].join(' ')}
          >
            <Icon className={active ? 'h-5 w-5 fill-accent/10' : 'h-5 w-5'} aria-hidden />
            <span>{label}</span>
            {to === '/saved' && bookmarkCount > 0 ? (
              <span className="absolute left-1/2 top-1 ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-caption font-bold leading-none text-on-primary" aria-label={`저장 ${bookmarkCount}개`}>
                {bookmarkCount}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-3 px-4 py-7 text-caption text-ink-mute sm:px-7 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="m-0 flex items-center gap-1.5 font-bold text-ink">
            <FishNoteMark className="h-5 w-5 text-accent" />
            FishNote
          </p>
          <p className="m-0 mt-1">제철과 맛 정보는 지역·유통 환경에 따라 달라질 수 있어요.</p>
        </div>
        <nav aria-label="서비스 정보" className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/sources" className="py-2 font-semibold transition hover:text-accent">정보 출처</Link>
          <Link to="/privacy" className="py-2 font-semibold transition hover:text-accent">개인정보처리방침</Link>
          <Link to="/terms" className="py-2 font-semibold transition hover:text-accent">이용약관</Link>
        </nav>
      </div>
    </footer>
  );
}
