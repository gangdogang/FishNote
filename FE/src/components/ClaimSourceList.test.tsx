import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FishClaimSources } from '../types/source';
import ClaimSourceList from './ClaimSourceList';

const verifiedClaim: FishClaimSources = {
  claimType: 'SEASON',
  verificationStatus: 'VERIFIED',
  lastVerifiedAt: '2026-07-20T00:00:00Z',
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
};

describe('ClaimSourceList', () => {
  it('상태를 색상 외 텍스트·아이콘으로 표시하고 원문별 메타데이터와 안전한 외부 링크를 제공한다', () => {
    const { container } = render(<ClaimSourceList claim={verifiedClaim} />);
    const summary = screen.getByText('제철 근거 · 검증 완료').closest('summary');
    expect(summary).not.toBeNull();
    expect(summary).toHaveTextContent('검증 완료');
    expect(summary?.querySelector('svg')).not.toBeNull();

    const link = screen.getByRole('link', {
      name: '2026년 3월, 어식백세 수산물 “도다리, 멍게”',
    });
    expect(link).toHaveAttribute('href', verifiedClaim.sources[0].url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    const sourceItem = link.closest('li');
    expect(sourceItem).not.toBeNull();
    expect(within(sourceItem!).getByText(/인천광역시 수산자원연구소/)).toBeInTheDocument();
    expect(sourceItem).toHaveTextContent('2026년 3월 7일');
    expect(sourceItem).toHaveTextContent('신뢰도 높음');
    expect(sourceItem).toHaveTextContent('공공누리 제1유형(출처표시)');
    expect(sourceItem).toHaveTextContent('2026년 7월 15일 검수');
    expect(sourceItem).not.toHaveTextContent('2026년 7월 20일 검수');
    expect(container.querySelector('details')).toBeInTheDocument();
  });

  it('출처가 없는 claim을 빈 검수 상태로 설명하고 showEmpty=false면 생략한다', () => {
    const emptyClaim: FishClaimSources = {
      claimType: 'TASTE',
      verificationStatus: 'UNVERIFIED',
      lastVerifiedAt: null,
      sourceCount: 0,
      sources: [],
    };
    const { rerender } = render(<ClaimSourceList claim={emptyClaim} />);

    expect(screen.getByText(
      '맛 근거는 아직 검수 중이에요. 확인된 원문이 추가되면 여기에 공개합니다.',
    )).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(<ClaimSourceList claim={emptyClaim} showEmpty={false} />);
    expect(screen.queryByText(/맛 근거는 아직 검수 중/)).not.toBeInTheDocument();
  });
});
