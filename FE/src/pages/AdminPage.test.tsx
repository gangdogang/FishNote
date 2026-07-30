import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminCorrections,
  getAdminFishes,
  getAdminOverview,
  getAdminReviews,
} from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import AdminPage from './AdminPage';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../api/admin', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/admin')>();
  return {
    ...original,
    getAdminOverview: vi.fn(),
    getAdminFishes: vi.fn(),
    getAdminCorrections: vi.fn(),
    getAdminReviews: vi.fn(),
  };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedOverview = vi.mocked(getAdminOverview);
const mockedFishes = vi.mocked(getAdminFishes);
const mockedCorrections = vi.mocked(getAdminCorrections);
const mockedReviews = vi.mocked(getAdminReviews);

function renderAdmin(role: 'USER' | 'ADMIN') {
  mockedUseAuth.mockReturnValue({
    accessToken: 'access-token',
    user: {
      id: 1,
      email: 'operator@example.com',
      nickname: '운영자',
      hasPassword: true,
      role,
    },
    isAuthLoading: false,
  } as unknown as ReturnType<typeof useAuth>);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    mockedOverview.mockResolvedValue({
      fishCount: 26,
      reviewCount: 14,
      pendingCorrectionCount: 2,
      userCount: 8,
      recentActions: [],
    });
    mockedFishes.mockResolvedValue([]);
    mockedCorrections.mockResolvedValue([]);
    mockedReviews.mockResolvedValue([]);
  });

  it('일반 회원에게 관리 데이터를 요청하지 않고 권한 안내를 표시한다', () => {
    renderAdmin('USER');

    expect(screen.getByRole('heading', { name: '관리자 권한이 필요합니다' })).toBeInTheDocument();
    expect(mockedOverview).not.toHaveBeenCalled();
    expect(mockedFishes).not.toHaveBeenCalled();
  });

  it('관리자에게 운영 지표와 도감 등록 폼을 제공한다', async () => {
    const user = userEvent.setup();
    renderAdmin('ADMIN');

    expect(await screen.findByRole('heading', { name: 'FishNote 운영 관리' })).toBeInTheDocument();
    expect((await screen.findAllByText('26')).length).toBeGreaterThan(0);
    expect(screen.getByText('대기 중 제보')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /도감 관리/ }));
    expect(await screen.findByRole('heading', { name: '새 횟감 등록' })).toBeInTheDocument();
    expect(screen.getByLabelText(/이름/)).toBeInTheDocument();
    expect(screen.getByLabelText(/슬러그/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '횟감 등록' })).toBeInTheDocument();
  });
});
