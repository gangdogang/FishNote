import { expect, test } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page);
});

test('주장별 원문과 검수 메타데이터를 공개한다', async ({ page }) => {
  await page.goto('/fish/gwangeo');

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  await expect(page.getByText('일부 검증', { exact: true }).first()).toBeVisible();

  const evidence = page.getByText('제철 근거 · 검증 완료').first();
  await evidence.click();
  const sourceLink = page.getByRole('link', { name: /2026년 4월.*가자미/ }).first();
  await expect(sourceLink).toHaveAttribute('target', '_blank');
  await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByText('인천광역시 수산자원연구소').first()).toBeVisible();
  await expect(page.getByText(/공공누리 제1유형/).first()).toBeVisible();
});

test('출처 API 실패는 상세 본문을 막지 않고 독립적으로 재시도할 수 있다', async ({ page }) => {
  let sourceRequests = 0;
  await page.route('**/api/v1/fish/gwangeo/sources', async (route) => {
    sourceRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'temporary source failure' }),
    });
  });

  await page.goto('/fish/gwangeo');

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  await expect(page.getByText(/출처만 불러오지 못했어요/)).toBeVisible();
  expect(sourceRequests).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: '다시 시도' }).last()).toBeEnabled();
});

test('익명 오류 제보는 URL을 검증하고 202 접수 뒤 완료 안내를 보여준다', async ({ page }) => {
  await page.goto('/fish/gwangeo');
  await page.getByRole('button', { name: '정보 오류 제보' }).click();

  const dialog = page.getByRole('dialog', { name: '광어 정보 오류 제보' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('제보할 정보')).toBeFocused();
  await dialog.getByLabel('확인이 필요한 내용').fill('제철 월을 다시 확인해 주세요.');
  await dialog.getByLabel('근거 원문 URL (선택)').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: '제보 접수' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/http 또는 https 공개 링크/);

  await dialog.getByLabel('근거 원문 URL (선택)').fill('https://example.org/source');
  await dialog.getByRole('button', { name: '제보 접수' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('정보 제보가 접수됐어요')).toBeVisible();
});
