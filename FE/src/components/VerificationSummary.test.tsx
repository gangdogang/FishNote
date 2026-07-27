import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VerificationStatus } from '../types/source';
import VerificationSummary from './VerificationSummary';

describe('VerificationSummary', () => {
  it.each([
    ['VERIFIED', '검증 완료'],
    ['PARTIALLY_VERIFIED', '일부 검증'],
    ['UNVERIFIED', '검증 전'],
  ] as const)('%s 상태를 텍스트·아이콘과 검수일·출처 수로 요약한다', (status, label) => {
    render(
      <VerificationSummary
        summary={{
          verificationStatus: status as VerificationStatus,
          lastVerifiedAt: '2026-07-15T00:00:00Z',
          sourceCount: 3,
          verifiedClaimCount: status === 'VERIFIED' ? 5 : status === 'PARTIALLY_VERIFIED' ? 2 : 0,
          claimCount: 5,
        }}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    );

    const summary = screen.getByRole('complementary', { name: '정보 검증 요약' });
    expect(within(summary).getByText(label)).toBeInTheDocument();
    expect(summary.querySelector('svg')).not.toBeNull();
    expect(summary).toHaveTextContent('최근 검수 2026년 7월 15일');
    expect(summary).toHaveTextContent(
      status === 'VERIFIED' ? '검증 항목 5/5' : status === 'PARTIALLY_VERIFIED' ? '검증 항목 2/5' : '검증 항목 0/5',
    );
    expect(summary).toHaveTextContent('출처 3개');
    expect(within(summary).getByRole('link', { name: '근거 보기' }))
      .toHaveAttribute('href', '#fish-source-section');
  });

  it('요약 API 실패를 부분 오류로 알리고 상세 본문을 유지한 채 재시도한다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <main>
        <h1>도다리</h1>
        <p>담백하고 쫄깃한 횟감 상세 설명</p>
        <VerificationSummary loading={false} error onRetry={onRetry} />
      </main>,
    );

    expect(screen.getByRole('heading', { name: '도다리' })).toBeInTheDocument();
    expect(screen.getByText('담백하고 쫄깃한 횟감 상세 설명')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '검증 요약은 불러오지 못했지만 상세 정보는 계속 볼 수 있어요.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('이전 요약을 유지한 갱신 실패도 텍스트 alert로 구분한다', () => {
    render(
      <VerificationSummary
        summary={{
          verificationStatus: 'PARTIALLY_VERIFIED',
          lastVerifiedAt: null,
          sourceCount: 1,
        }}
        loading={false}
        error
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('일부 검증')).toBeInTheDocument();
    expect(screen.getByText('아직 검수일이 기록되지 않았어요 · 출처 1개')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '최신 검증 정보를 갱신하지 못해 이전 내용을 보여드려요.',
    );
  });
});
