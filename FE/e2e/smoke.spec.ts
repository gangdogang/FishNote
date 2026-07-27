import { expect, test } from '@playwright/test';
import { attachJson } from './support/artifacts';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

test('public home smoke', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: Array<{ method: string; url: string; errorText: string | null }> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    requestFailures.push({
      method: request.method(),
      url: request.url(),
      errorText: request.failure()?.errorText ?? null,
    });
  });

  try {
    await applyProjectTheme(page, testInfo);
    await mockPublicApi(page, { catalogV2: true });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();

    const searchInput = page.getByPlaceholder('횟감 이름이나 별칭을 입력해 보세요');
    await searchInput.fill('광어');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/search\?search=/);
  } finally {
    await attachJson(testInfo, 'console-errors.json', consoleErrors);
    await attachJson(testInfo, 'page-errors.json', pageErrors);
    await attachJson(testInfo, 'request-failures.json', requestFailures);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(requestFailures.filter((failure) => !isExpectedSuggestionCancellation(failure))).toEqual([]);
});

function isExpectedSuggestionCancellation(failure: {
  method: string;
  url: string;
  errorText: string | null;
}) {
  if (failure.method !== 'GET') return false;

  const pathname = new URL(failure.url).pathname;
  const cancellation = failure.errorText?.toLowerCase() ?? '';
  return pathname === '/api/v1/fish/suggestions'
    && (cancellation.includes('aborted') || cancellation.includes('cancelled'));
}
