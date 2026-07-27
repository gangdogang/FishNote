import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../hooks/useAuth';
import { BookmarkProvider } from '../hooks/useBookmarks';
import CalendarPage from './CalendarPage';

const scrollIntoView = vi.fn();

function renderCalendar() {
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
            <MemoryRouter>
              <CalendarPage />
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
});
