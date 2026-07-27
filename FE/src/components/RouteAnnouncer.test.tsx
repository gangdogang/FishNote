import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RouteAnnouncer from './RouteAnnouncer';

function Page({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return <h1>{title}</h1>;
}

function AsyncDetailPage() {
  useEffect(() => {
    document.title = 'FishNote — 회 도감 | 제철·맛·가격으로 보는 횟감';
    const timer = window.setTimeout(() => {
      document.title = '광어 | FishNote';
    }, 20);

    return () => window.clearTimeout(timer);
  }, []);

  return <h1>광어 상세</h1>;
}

function Navigation() {
  const navigate = useNavigate();

  return (
    <nav>
      <button type="button" onClick={() => navigate('/calendar')}>
        캘린더로
      </button>
      <button type="button" onClick={() => navigate('/fish/1')}>
        상세로
      </button>
      <button type="button" onClick={() => navigate('/search?search=광어')}>
        검색어만 변경
      </button>
      <button type="button" onClick={() => navigate('/fish/INVALID')}>
        없는 상세로
      </button>
    </nav>
  );
}

function renderHarness(initialEntry = '/') {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
    >
      <RouteAnnouncer />
      <Navigation />
      <Routes>
        <Route path="/" element={<Page title="홈 | FishNote" />} />
        <Route path="/calendar" element={<Page title="제철 캘린더 | FishNote" />} />
        <Route path="/fish/:id" element={<AsyncDetailPage />} />
        <Route
          path="/fish/INVALID"
          element={(
            <h1 data-route-announcement="횟감을 찾을 수 없어요 | FishNote">
              횟감을 찾을 수 없어요
            </h1>
          )}
        />
        <Route path="/search" element={<Page title="검색 | FishNote" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useRealTimers();
  document.title = 'FishNote — 회 도감';
});

describe('RouteAnnouncer', () => {
  it('초기 document title을 보이지 않는 polite live region에 알린다', async () => {
    renderHarness();

    const status = screen.getByRole('status');
    expect(status).toHaveClass('sr-only');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    await waitFor(() => expect(status).toHaveTextContent('홈 | FishNote'));
  });

  it('pathname이 바뀌면 새 페이지 effect가 설정한 title을 알린다', async () => {
    renderHarness();
    const status = screen.getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('홈 | FishNote'));

    fireEvent.click(screen.getByRole('button', { name: '캘린더로' }));

    await waitFor(() => expect(status).toHaveTextContent('제철 캘린더 | FishNote'));
  });

  it('상세 데이터 도착 후 비동기로 바뀐 title도 관찰해 알린다', async () => {
    renderHarness();
    const status = screen.getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('홈 | FishNote'));

    const announcedTexts: string[] = [];
    const observer = new MutationObserver(() => announcedTexts.push(status.textContent ?? ''));
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    fireEvent.click(screen.getByRole('button', { name: '상세로' }));

    await waitFor(() => expect(status).toHaveTextContent('광어 | FishNote'));
    expect(announcedTexts).not.toContain('FishNote — 회 도감 | 제철·맛·가격으로 보는 횟감');
    observer.disconnect();
  });

  it('같은 pathname의 검색 query와 같은 title은 live region을 다시 갱신하지 않는다', async () => {
    renderHarness('/search');
    const status = screen.getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('검색 | FishNote'));

    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    fireEvent.click(screen.getByRole('button', { name: '검색어만 변경' }));
    document.title = '검색 | FishNote';
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });

    expect(status).toHaveTextContent('검색 | FishNote');
    expect(mutations).toHaveLength(0);
    observer.disconnect();
  });

  it('기본 title이 남은 실패 경로는 명시된 h1 안내를 대신 알린다', async () => {
    renderHarness();
    const status = screen.getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('홈 | FishNote'));

    fireEvent.click(screen.getByRole('button', { name: '없는 상세로' }));

    await waitFor(() => expect(status).toHaveTextContent('횟감을 찾을 수 없어요 | FishNote'));
  });
});
