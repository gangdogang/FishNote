import { describe, expect, it } from 'vitest';
import { fishDetailPath, isValidFishIdentifier } from './fishRoutes';

describe('fish routes', () => {
  it('생성 링크는 유효한 slug를 우선하고 없거나 잘못되면 숫자 ID를 사용한다', () => {
    expect(fishDetailPath({ id: 4, slug: 'chamdom' })).toBe('/fish/chamdom');
    expect(fishDetailPath({ id: 4, slug: null })).toBe('/fish/4');
    expect(fishDetailPath({ id: 4, slug: '잘못된 slug' })).toBe('/fish/4');
  });

  it('기존 양의 숫자 ID와 canonical slug만 상세 식별자로 허용한다', () => {
    expect(isValidFishIdentifier('4')).toBe(true);
    expect(isValidFishIdentifier('chamdom')).toBe(true);
    expect(isValidFishIdentifier('jeon-bok')).toBe(true);
    expect(isValidFishIdentifier('0')).toBe(false);
    expect(isValidFishIdentifier('-1')).toBe(false);
    expect(isValidFishIdentifier('참돔')).toBe(false);
    expect(isValidFishIdentifier('A'.repeat(121))).toBe(false);
  });
});
