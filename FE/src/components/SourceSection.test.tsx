import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FishSourcesResponse } from '../types/source';
import SourceSection from './SourceSection';

const sources: FishSourcesResponse = {
  fishId: 10,
  fishName: '도다리',
  summary: {
    verificationStatus: 'PARTIALLY_VERIFIED',
    lastVerifiedAt: '2026-07-15T00:00:00Z',
    sourceCount: 1,
  },
  claims: [
    {
      claimType: 'IDENTITY',
      verificationStatus: 'UNVERIFIED',
      lastVerifiedAt: null,
      sourceCount: 0,
      sources: [],
    },
    {
      claimType: 'SEASON',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-07-15T00:00:00Z',
      sourceCount: 1,
      sources: [
        {
          id: 101,
          claimType: 'SEASON',
          publisher: '인천광역시 수산자원연구소',
          title: '2026년 3월, 어식백세 수산물 “도다리, 멍게”',
          url: 'https://www.incheon.go.kr/fish/FI020401/3065118',
          publishedAt: '2026-03-07T00:00:00Z',
          verifiedAt: '2026-07-15T00:00:00Z',
          license: '공공누리 제1유형(출처표시)',
          confidence: 'HIGH',
        },
      ],
    },
    ...(['TASTE', 'PRICE', 'PHOTO'] as const).map((claimType) => ({
      claimType,
      verificationStatus: 'UNVERIFIED' as const,
      lastVerifiedAt: null,
      sourceCount: 0,
      sources: [],
    })),
  ],
};

function renderSection(props: Partial<React.ComponentProps<typeof SourceSection>> = {}) {
  const defaults: React.ComponentProps<typeof SourceSection> = {
    loading: false,
    fetching: false,
    error: false,
    onRetry: vi.fn(),
    onReport: vi.fn(),
  };

  const merged = { ...defaults, ...props };
  return {
    ...render(
      <MemoryRouter>
        <main>
          <h1>도다리</h1>
          <p>담백하고 쫄깃한 횟감 상세 설명</p>
          <SourceSection {...merged} />
        </main>
      </MemoryRouter>,
    ),
    props: merged,
  };
}

describe('SourceSection', () => {
  it('source API 실패를 섹션 안에 격리하고 상세 본문과 재시도 동작을 유지한다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderSection({ error: true, onRetry });

    expect(screen.getByRole('heading', { level: 1, name: '도다리' })).toBeInTheDocument();
    expect(screen.getByText('담백하고 쫄깃한 횟감 상세 설명')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '출처만 불러오지 못했어요. 횟감 상세 정보는 계속 볼 수 있습니다.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('주장별 근거와 빈 claim을 함께 표시하고 외부 원문 링크 안전 속성을 보존한다', () => {
    renderSection({ data: sources });

    expect(screen.getByText('제철 근거 · 검증 완료')).toBeInTheDocument();
    expect(screen.getByText(/이름·분류 근거는 아직 검수 중/)).toBeInTheDocument();
    expect(screen.getByText(/맛 근거는 아직 검수 중/)).toBeInTheDocument();
    expect(screen.getByText(/가격 근거는 아직 검수 중/)).toBeInTheDocument();
    expect(screen.getByText(/사진 근거는 아직 검수 중/)).toBeInTheDocument();

    const sourceLink = screen.getByRole('link', {
      name: '2026년 3월, 어식백세 수산물 “도다리, 멍게”',
    });
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: '검수 기준과 전체 출처 보기' }))
      .toHaveAttribute('href', '/sources');
  });

  it('stale 근거를 유지한 갱신 실패를 별도 alert로 알리고 제보 claim을 위임한다', async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    renderSection({ data: sources, error: true, onReport });

    expect(screen.getByText('제철 근거 · 검증 완료')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '최신 근거를 갱신하지 못해 이전 내용을 보여드려요.',
    );
    await user.click(screen.getByRole('button', { name: '정보 오류 제보' }));
    expect(onReport).toHaveBeenCalledWith('SEASON');
  });

  it('재시도 중에는 버튼을 disabled·busy로 표시한다', () => {
    renderSection({ error: true, fetching: true });
    const retry = screen.getByRole('button', { name: '다시 시도' });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute('aria-busy', 'true');
  });
});
