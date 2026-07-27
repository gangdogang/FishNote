import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from './Toast';
import { useToast } from '../hooks/useToast';

function ToastTrigger() {
  const { showToast } = useToast();
  return <button type="button" onClick={() => showToast('저장했어요')}>토스트 표시</button>;
}

describe('ToastProvider', () => {
  it('모바일 탭바와 safe-area 위에 메시지를 표시한다', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveClass('bottom-[calc(5rem+var(--safe-area-bottom))]', 'md:bottom-6');

    await user.click(screen.getByRole('button', { name: '토스트 표시' }));
    expect(screen.getByRole('status')).toHaveTextContent('저장했어요');
  });
});
