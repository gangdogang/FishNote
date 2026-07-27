import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteFocusManager from './RouteFocusManager';

interface MutableScrollPosition {
  x: number;
  y: number;
}

function NavigationHarness() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <RouteFocusManager />
      <nav>
        <button type="button" onClick={() => navigate('/second')}>두 번째 경로</button>
        <button type="button" onClick={() => navigate('/replacement', { replace: true })}>
          경로 교체
        </button>
        <button type="button" onClick={() => navigate('/search?q=two')}>검색 조건 변경</button>
        <button type="button" onClick={() => navigate(-1)}>뒤로</button>
        <button type="button" onClick={() => navigate(1)}>앞으로</button>
      </nav>
      <main id="main-content" tabIndex={-1}>
        {location.pathname}
        {location.search}
      </main>
    </>
  );
}

describe('RouteFocusManager', () => {
  const originalScrollRestorationDescriptor = Object.getOwnPropertyDescriptor(
    window.history,
    'scrollRestoration',
  );
  let scrollPosition: MutableScrollPosition;
  let queuedFrames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    scrollPosition = { x: 0, y: 0 };
    queuedFrames = new Map();
    nextFrameId = 1;

    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      get: () => scrollPosition.x,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollPosition.y,
    });
    Object.defineProperty(window.history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    });

    vi.spyOn(window, 'scrollTo').mockImplementation((x, y) => {
      scrollPosition = { x, y: y ?? 0 };
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      queuedFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      queuedFrames.delete(frameId);
    });
  });

  afterEach(() => {
    if (originalScrollRestorationDescriptor) {
      Object.defineProperty(
        window.history,
        'scrollRestoration',
        originalScrollRestorationDescriptor,
      );
    } else {
      Reflect.deleteProperty(window.history, 'scrollRestoration');
    }
  });

  function renderManager(initialEntry = '/first') {
    return render(
      <MemoryRouter
        initialEntries={[initialEntry]}
      >
        <NavigationHarness />
      </MemoryRouter>,
    );
  }

  function setScrollPosition(x: number, y: number) {
    scrollPosition = { x, y };
  }

  function flushAnimationFrames() {
    act(() => {
      const frames = Array.from(queuedFrames.values());
      queuedFrames.clear();
      frames.forEach((callback) => callback(performance.now()));
    });
  }

  it('does not disturb the initial load and restores the browser scroll setting on cleanup', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const { unmount } = renderManager();

    expect(window.history.scrollRestoration).toBe('manual');
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(queuedFrames.size).toBe(0);

    unmount();

    expect(window.history.scrollRestoration).toBe('auto');
  });

  it.each([
    ['PUSH', '두 번째 경로', '/second'],
    ['REPLACE', '경로 교체', '/replacement'],
  ])('%s로 pathname이 바뀌면 맨 위로 이동한 뒤 본문에 포커스한다', (_type, buttonName, path) => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    renderManager();
    setScrollPosition(80, 640);

    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    expect(screen.getByText(path)).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();

    flushAnimationFrames();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(vi.mocked(window.scrollTo).mock.invocationCallOrder[0]).toBeLessThan(
      focusSpy.mock.invocationCallOrder[0],
    );
    expect(document.activeElement).toBe(document.getElementById('main-content'));
  });

  it('POP 이동에서는 location key별 위치를 복원하고 본문 포커스를 강제하지 않는다', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    renderManager();
    setScrollPosition(120, 360);

    fireEvent.click(screen.getByRole('button', { name: '두 번째 경로' }));
    flushAnimationFrames();
    setScrollPosition(44, 88);
    vi.mocked(window.scrollTo).mockClear();
    focusSpy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    flushAnimationFrames();

    expect(window.scrollTo).toHaveBeenLastCalledWith(120, 360);
    expect(focusSpy).not.toHaveBeenCalled();

    setScrollPosition(9, 10);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(screen.getByRole('button', { name: '앞으로' }));
    flushAnimationFrames();

    expect(window.scrollTo).toHaveBeenLastCalledWith(44, 88);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('같은 pathname의 PUSH 검색 조건 변경은 스크롤과 포커스를 초기화하지 않는다', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    renderManager('/search?q=one');
    setScrollPosition(25, 275);

    fireEvent.click(screen.getByRole('button', { name: '검색 조건 변경' }));

    expect(screen.getByText('/search?q=two')).toBeInTheDocument();
    expect(queuedFrames.size).toBe(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(scrollPosition).toEqual({ x: 25, y: 275 });
  });

  it('cleanup에서 대기 중인 animation frame을 취소한다', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const { unmount } = renderManager();

    fireEvent.click(screen.getByRole('button', { name: '두 번째 경로' }));
    expect(queuedFrames.size).toBe(1);

    unmount();
    flushAnimationFrames();

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
