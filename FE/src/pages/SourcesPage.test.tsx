import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SourcesPage from './SourcesPage';

describe('SourcesPage', () => {
  it('검수 원칙과 PII를 받지 않는 제보 경로를 설명한다', () => {
    render(<SourcesPage />);

    expect(screen.getByRole('heading', { level: 1, name: '정보 출처' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '검수 상태를 읽는 법' }).parentElement)
      .toHaveTextContent('검증 완료');
    expect(screen.getByRole('heading', { name: '검수 상태를 읽는 법' }).parentElement)
      .toHaveTextContent('일부 검증');
    expect(screen.getByRole('heading', { name: '검수 상태를 읽는 법' }).parentElement)
      .toHaveTextContent('검증 전');

    const reportSection = screen.getByRole('heading', { name: '정보 제보' }).parentElement;
    expect(reportSection).toHaveTextContent('각 횟감 상세 화면의 ‘정보 오류 제보’');
    expect(reportSection).toHaveTextContent('이메일이나 이름은 받지 않으며');
    expect(reportSection).toHaveTextContent('선택적인 공개 원문 URL만 접수');
  });

  it('공개 원문 9건에 기관·자료명·게시일과 안전한 새 창 링크를 제공한다', () => {
    render(<SourcesPage />);

    const section = screen.getByRole('heading', { name: '공개한 원문' }).parentElement;
    if (!section) throw new Error('공개 원문 section이 없습니다.');
    const links = within(section).getAllByRole('link');
    expect(links).toHaveLength(9);

    for (const link of links) {
      expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\/www\.incheon\.go\.kr\/fish\//));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.closest('li')).toHaveTextContent('인천광역시 수산자원연구소');
      expect(link.closest('li')?.textContent).toMatch(/20\d{2}년 \d{1,2}월 \d{1,2}일/);
    }

    expect(links.map((link) => link.textContent)).toEqual([
      '2024년 9월, 어식백세 수산물 “대하, 전어”',
      '2024년 8월, 어식백세 수산물 “장어류, 문어”',
      '2020년 6월 어식백세 수산물 “광어, 농어”',
      '2026년 5월, 어식백세 수산물 “다시마, 조피볼락”',
      '2026년 4월, 어식백세 수산물 “가자미, 홍어”',
      '2026년 3월, 어식백세 수산물 “도다리, 멍게”',
      '2024년 10월, 어식백세 수산물 “삼치, 감성돔”',
      '2023년 8월, 어식백세 수산물 “민어, 한치”',
      '2023년 6월, 어식백세 수산물 “재첩, 병어”',
    ]);
    expect(section).toHaveTextContent('공공누리 제1유형(출처표시)');
  });
});
