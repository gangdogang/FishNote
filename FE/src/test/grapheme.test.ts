import { describe, expect, it } from 'vitest';
import { firstGrapheme } from '../lib/grapheme';

describe('firstGrapheme', () => {
  it('surrogate pair로 된 이모지를 하나의 grapheme으로 반환한다', () => {
    expect(firstGrapheme('🐟회러버')).toBe('🐟');
  });

  it('결합 문자를 하나의 grapheme으로 반환한다', () => {
    expect(firstGrapheme('e\u0301clair')).toBe('e\u0301');
  });

  it('빈 문자열에는 기본 fallback을 반환한다', () => {
    expect(firstGrapheme('')).toBe('?');
  });

  it('공백뿐인 문자열에는 지정한 fallback을 반환한다', () => {
    expect(firstGrapheme('   ', '익')).toBe('익');
  });
});
