import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomeQuickNav from './HomeQuickNav';

describe('HomeQuickNav', () => {
  it('44px controls와 reduced-motion 즉시 이동을 사용한다', () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList));
    const seasonal = document.createElement('section');
    seasonal.id = 'section-seasonal';
    const scrollIntoView = vi.fn();
    Object.defineProperty(seasonal, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    document.body.append(seasonal);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(<HomeQuickNav />);

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveClass('h-11', 'w-11');
    });
    fireEvent.click(screen.getByRole('button', { name: '이달의 제철' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

    fireEvent.click(screen.getByRole('button', { name: '맨 위로' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    seasonal.remove();
  });
});
