import { describe, expect, it } from 'vitest';
import { getAuthRedirectPath } from './authRedirect';

describe('auth redirect', () => {
  it('앱 내부 경로만 로그인 완료 뒤 복귀 대상으로 허용한다', () => {
    expect(getAuthRedirectPath({ from: '/fish/chamdom?tab=reviews#write' })).toBe(
      '/fish/chamdom?tab=reviews#write',
    );
    expect(getAuthRedirectPath({ from: { pathname: '/saved', search: '?sort=recent' } })).toBe(
      '/saved?sort=recent',
    );
  });

  it('외부·인증 순환·백슬래시 우회 경로를 홈으로 정규화한다', () => {
    expect(getAuthRedirectPath({ from: 'https://attacker.example' })).toBe('/');
    expect(getAuthRedirectPath({ from: '//attacker.example' })).toBe('/');
    expect(getAuthRedirectPath({ from: '/\\attacker.example' })).toBe('/');
    expect(getAuthRedirectPath({ from: '/login?from=/saved' })).toBe('/');
  });
});
