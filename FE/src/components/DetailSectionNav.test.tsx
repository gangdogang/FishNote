import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetailSectionNav from './DetailSectionNav';

describe('DetailSectionNav', () => {
  it('기본으로 다섯 섹션 탭을 모두 렌더한다', () => {
    render(<DetailSectionNav />);

    const nav = screen.getByRole('navigation', { name: '횟감 상세 바로가기' });
    expect(nav).toBeInTheDocument();
    ['맛·제철', '가격', '즐기는 법', '근거', '후기'].forEach((label) => {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '맛·제철' })).toHaveAttribute('aria-current', 'location');
  });

  it('hiddenIds에 포함된 섹션 탭은 렌더하지 않는다 (시세 0건 → 가격 탭 숨김)', () => {
    render(<DetailSectionNav hiddenIds={['price-section']} />);

    expect(screen.queryByRole('link', { name: '가격' })).not.toBeInTheDocument();
    ['맛·제철', '즐기는 법', '근거', '후기'].forEach((label) => {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});
