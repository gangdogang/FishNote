import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../hooks/useAuth';
import { BookmarkProvider } from '../hooks/useBookmarks';
import CalendarPage from './CalendarPage';

const scrollIntoView = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-probe">{location.pathname}</output>;
}

function renderCalendar(initialPath = '/calendar') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BookmarkProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route path="/calendar/:month?" element={<CalendarPage />} />
              </Routes>
              <LocationProbe />
            </MemoryRouter>
          </BookmarkProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function monthButton(month: number) {
  return within(screen.getByRole('group', { name: '월 선택' }))
    .getByRole('button', { name: new RegExp(`^${month}월`) });
}

describe('CalendarPage month rail', () => {
  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it('첫 렌더에서 현재 월을 선택하고 rail 중앙으로 노출한다', () => {
    renderCalendar();

    const currentMonth = new Date().getMonth() + 1;
    const current = monthButton(currentMonth);
    expect(current).toHaveAttribute('aria-current', 'date');
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(scrollIntoView).toHaveBeenLastCalledWith({ inline: 'center', block: 'nearest' });
  });

  it('선택한 월로 상태와 중앙 정렬 대상을 함께 이동한다', async () => {
    const user = userEvent.setup();
    renderCalendar();
    const currentMonth = new Date().getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const previous = monthButton(currentMonth);
    const next = monthButton(nextMonth);

    await user.click(next);

    expect(next).toHaveAttribute('aria-current', 'date');
    expect(next).toHaveAttribute('aria-pressed', 'true');
    expect(previous).not.toHaveAttribute('aria-current');
    expect(previous).toHaveAttribute('aria-pressed', 'false');
    expect(scrollIntoView).toHaveBeenLastCalledWith({ inline: 'center', block: 'nearest' });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('12개 월 버튼에 44px 최소 영역·focus ring과 12px 의미 색상 종 수를 제공한다', () => {
    renderCalendar();
    const rail = screen.getByRole('group', { name: '월 선택' });
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(12);
    expect(rail.querySelectorAll('[data-month-rail-spacer]')).toHaveLength(2);

    for (const button of buttons) {
      expect(button).toHaveClass(
        'calendar-month-button',
        'h-[58px]',
        'min-h-11',
        'w-[74px]',
        'min-w-11',
        'focus-visible:ring-2',
        'focus-visible:ring-focus',
      );
      const count = button.querySelector('span:last-child');
      expect(count).toHaveClass('text-caption');
      expect(count).toHaveClass(
        button.getAttribute('aria-pressed') === 'true' ? 'text-on-primary' : 'text-ink-mute',
      );
    }
  });

  it('제철 표시 기준과 검수 방식으로 이동하는 링크를 제공한다', () => {
    renderCalendar();

    const note = screen.getByRole('complementary', { name: '제철 표시 기준' });
    expect(note).toHaveTextContent('자연산 중심의 대표 월');
    expect(note).toHaveTextContent('양식·수입종은 연중');
    expect(within(note).getByRole('link', { name: '근거와 검수 방식 보기 →' }))
      .toHaveAttribute('href', '/sources');
  });

});

describe('CalendarPage 월 딥링크 (docs/15 M2)', () => {
  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it('/calendar/11 직접 진입 시 11월을 선택하고 월별 제목을 설정한다', () => {
    renderCalendar('/calendar/11');

    expect(monthButton(11)).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('heading', { level: 2, name: /^11월 제철/ })).toBeInTheDocument();
    expect(document.title).toBe('11월 제철 회·횟감 | FishNote');
  });

  it('/calendar는 현재 월을 보여주고 기본 제목을 유지한다', () => {
    renderCalendar('/calendar');

    const currentMonth = new Date().getMonth() + 1;
    expect(monthButton(currentMonth)).toHaveAttribute('aria-current', 'date');
    expect(document.title).toBe('제철 캘린더 | FishNote');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(/^\/calendar$/);
  });

  it('월 버튼 클릭 시 URL을 /calendar/N으로 교체한다', async () => {
    const user = userEvent.setup();
    renderCalendar('/calendar');
    const currentMonth = new Date().getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    await user.click(monthButton(nextMonth));

    expect(screen.getByTestId('location-probe')).toHaveTextContent(`/calendar/${nextMonth}`);
    expect(monthButton(nextMonth)).toHaveAttribute('aria-current', 'date');
    expect(document.title).toBe(`${nextMonth}월 제철 회·횟감 | FishNote`);
  });

  it('범위 밖·비정규 월은 /calendar로 폴백한다', () => {
    const { unmount } = renderCalendar('/calendar/13');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(/^\/calendar$/);
    unmount();

    renderCalendar('/calendar/03');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(/^\/calendar$/);
    const currentMonth = new Date().getMonth() + 1;
    expect(monthButton(currentMonth)).toHaveAttribute('aria-current', 'date');
  });
});
