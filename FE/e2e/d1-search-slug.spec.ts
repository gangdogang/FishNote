import { expect, test } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page);
});

test('별칭 자동완성은 slug 상세로 이동하고 하위 API는 canonical 숫자 ID를 사용한다', async ({ page }) => {
  const requestedPaths: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/fish')) requestedPaths.push(url.pathname);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const combobox = page.getByRole('combobox', { name: '횟감 이름 검색' });
  await combobox.fill('넙치');

  await expect(page.getByRole('option', { name: /광어/ })).toContainText('넙치로 검색됨 · 표준명 광어');
  await combobox.press('ArrowDown');
  await expect(combobox).toHaveAttribute('aria-activedescendant', /option-1$/);
  await combobox.press('Enter');

  await expect(page).toHaveURL(/\/fish\/gwangeo$/);
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  await expect.poll(() => requestedPaths).toContain('/api/v1/fish/gwangeo');
  await expect.poll(() => requestedPaths).toContain('/api/v1/fish/1/prices');
  await expect.poll(() => requestedPaths).toContain('/api/v1/fish/1/reviews');
});

test('기존 숫자 ID 상세 URL도 그대로 동작한다', async ({ page }) => {
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/fish\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
});
