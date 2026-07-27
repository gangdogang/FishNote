import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import App from '../App';
import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../hooks/useAuth';
import { BookmarkProvider } from '../hooks/useBookmarks';
import { fishFixture } from './fixtures';
import { server } from './server';

function renderApp(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BookmarkProvider>
            <MemoryRouter
              initialEntries={[initialEntry]}
            >
              <App />
            </MemoryRouter>
          </BookmarkProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('App smoke', () => {
  it('MSW 응답으로 홈을 렌더링하고 주요 조작을 제공한다', async () => {
    let homeRequestCount = 0;
    let legacyFishRequestCount = 0;
    server.use(
      http.get('*/home', () => {
        homeRequestCount += 1;
        return HttpResponse.json({
          month: 7,
          generatedAt: '2026-07-23T00:00:00Z',
          seasonal: [fishFixture],
          featured: [fishFixture],
          catalog: [fishFixture],
          facets: { taste: {}, season: {}, priceLevel: {}, category: {} },
        });
      }),
      http.get('*/fish', () => {
        legacyFishRequestCount += 1;
        return HttpResponse.json([fishFixture]);
      }),
    );
    const user = userEvent.setup();
    const { container } = renderApp();

    expect(screen.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FishNote 홈' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(document.querySelectorAll('#main-content')).toHaveLength(1);
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('link', { name: '본문 바로가기' })).toHaveAttribute('href', '#main-content');

    const currentAtlasLinks = screen.getAllByRole('link', { name: '도감' });
    expect(currentAtlasLinks).toHaveLength(2);
    currentAtlasLinks.forEach((link) => expect(link).toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('link', { name: '제철 캘린더' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '제철' })).not.toHaveAttribute('aria-current');

    const routeStatus = container.querySelector('[role="status"].sr-only[aria-live="polite"]');
    expect(routeStatus).toBeInTheDocument();
    expect(routeStatus).toHaveClass('sr-only');
    expect(routeStatus).toHaveAttribute('aria-live', 'polite');
    expect(routeStatus).toHaveAttribute('aria-atomic', 'true');
    expect(container.firstElementChild).toHaveClass(
      'min-h-dvh',
      'pb-[calc(68px+var(--safe-area-bottom))]',
    );
    expect(screen.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' }))
      .toHaveClass('text-balance', 'text-title');

    screen.getAllByRole('combobox').forEach((input) => {
      expect(input).toHaveClass('text-base', 'xl:text-body-sm');
    });
    screen.getAllByRole('button', { name: '검색' }).forEach((button) => {
      expect(button).toHaveClass('bg-primary', 'text-on-primary');
    });

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 3, name: '광어' })).toHaveLength(3);
    });
    expect(homeRequestCount).toBe(1);
    expect(legacyFishRequestCount).toBe(0);

    const searchInput = screen.getByPlaceholderText('횟감 이름이나 별칭을 입력해 보세요');
    await user.type(searchInput, '광어');
    expect(searchInput).toHaveValue('광어');

    await user.click(screen.getByRole('button', { name: '다크 모드로 전환' }));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('경로 segment와 trailing slash를 정규화해 현재 메뉴만 표시한다', () => {
    const calendarView = renderApp('/calendar/');
    expect(screen.getByRole('link', { name: '제철 캘린더' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '제철' })).toHaveAttribute('aria-current', 'page');
    calendarView.unmount();

    const savedView = renderApp('/saved/');
    expect(screen.getByRole('link', { name: /저장한 도감/ })).toHaveAttribute('aria-current', 'page');
    expect(
      within(screen.getByRole('navigation', { name: '모바일 주요 메뉴' }))
        .getByRole('link', { name: '저장' }),
    ).toHaveAttribute('aria-current', 'page');
    savedView.unmount();

    renderApp('/fishery');
    screen.getAllByRole('link', { name: '도감' }).forEach((link) => {
      expect(link).not.toHaveAttribute('aria-current');
    });
  });
});
