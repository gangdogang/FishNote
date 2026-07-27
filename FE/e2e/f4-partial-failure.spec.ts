import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { fishDetailFixture, mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

type FailureMode = 'not-found' | 'server-error' | 'network-error';

interface ControlledFailure {
  recover: () => void;
  requestCount: () => number;
}

const emptyPriceSummary = {
  fishId: 1,
  days: 14,
  observationCount: 0,
  latest: null,
  recent: [],
  dailyAverage: [],
  byShop: [],
  byVariant: [],
};

const emptyRatingDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

const secondFishSummary = {
  id: 2,
  name: '우럭',
  nameEn: 'Korean rockfish',
  imageUrl: '/fish/chamdom.jpg',
};

const secondFishDetail = {
  ...fishDetailFixture,
  ...secondFishSummary,
  aliases: ['조피볼락'],
  description: '담백하고 탄탄한 식감의 횟감',
  tasteDesc: '씹을수록 은은한 단맛이 나요.',
  avgRating: 0,
  reviewCount: 0,
  ratingDistribution: emptyRatingDistribution,
  similarFishes: [],
};

async function prepareDetail(page: Page, testInfo: TestInfo) {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
}

async function controlEndpointFailure(
  page: Page,
  pathname: string,
  mode: FailureMode,
): Promise<ControlledFailure> {
  let shouldFail = true;
  let requests = 0;

  await page.route('**/api/v1/fish**', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (request.method() !== 'GET' || requestUrl.pathname !== pathname) {
      await route.fallback();
      return;
    }

    requests += 1;
    if (!shouldFail) {
      await route.fallback();
      return;
    }

    if (mode === 'network-error') {
      await route.abort('failed');
      return;
    }

    await fulfillJson(route, mode === 'not-found' ? 404 : 500, {
      message: mode === 'not-found' ? 'fish not found' : 'temporary server failure',
    });
  });

  return {
    recover: () => {
      shouldFail = false;
    },
    requestCount: () => requests,
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

test('detail 404 alone is presented as a missing fish', async ({ page }, testInfo) => {
  await prepareDetail(page, testInfo);
  const failure = await controlEndpointFailure(page, '/api/v1/fish/1', 'not-found');

  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('이 횟감을 아직 도감에서 찾을 수 없어요', { exact: true })).toBeVisible();
  await expect(page.getByText('횟감 정보를 불러오지 못했어요.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '상세 다시 시도' })).toHaveCount(0);
  expect(failure.requestCount(), '404 detail requests should not be retried').toBe(1);
});

for (const scenario of [
  { name: '500', mode: 'server-error' },
  { name: 'network failure', mode: 'network-error' },
] as const) {
  test(`detail ${scenario.name} is retryable and never mislabeled as 404`, async ({ page }, testInfo) => {
    await prepareDetail(page, testInfo);
    const failure = await controlEndpointFailure(page, '/api/v1/fish/1', scenario.mode);

    await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: '횟감 정보를 불러오지 못했어요.' })).toBeVisible();
    await expect(page.getByText('이 횟감을 아직 도감에서 찾을 수 없어요', { exact: true })).toHaveCount(0);

    const retryButton = page.getByRole('button', { name: '상세 다시 시도' });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    const failedRequestCount = failure.requestCount();
    failure.recover();
    await retryButton.click();

    await expect.poll(failure.requestCount).toBeGreaterThan(failedRequestCount);
    await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  });
}

test('price 500 keeps detail and review form usable, then retries only the price section', async ({ page }, testInfo) => {
  await prepareDetail(page, testInfo);
  const failure = await controlEndpointFailure(page, '/api/v1/fish/1/prices', 'server-error');

  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  const reviewForm = page.locator('#review-form');
  await expect(reviewForm.getByRole('heading', { level: 3, name: '후기 남기기' })).toBeVisible();

  const priceSection = page.locator('#price-section');
  await expect(priceSection.getByText('가격 정보를 불러오지 못했어요.', { exact: true })).toBeVisible();
  const retryButton = priceSection.getByRole('button', { name: '가격 다시 시도' });
  await expect(retryButton).toBeEnabled();

  const failedRequestCount = failure.requestCount();
  failure.recover();
  await retryButton.click();

  await expect.poll(failure.requestCount).toBeGreaterThan(failedRequestCount);
  await expect(priceSection.getByText('최근 14일 · 1건', { exact: true })).toBeVisible();
  await expect(priceSection.getByText('가격 정보를 불러오지 못했어요.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  await expect(reviewForm).toBeVisible();
});

test('review 500 keeps detail, price, and review form usable, then retries only reviews', async ({ page }, testInfo) => {
  await prepareDetail(page, testInfo);
  const failure = await controlEndpointFailure(page, '/api/v1/fish/1/reviews', 'server-error');

  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  const priceSection = page.locator('#price-section');
  await expect(priceSection.getByRole('heading', { level: 2, name: '가격 현황' })).toBeVisible();
  await expect(priceSection.getByText('최근 14일 · 1건', { exact: true })).toBeVisible();

  const reviewSection = page.locator('#reviews');
  const reviewForm = reviewSection.locator('#review-form');
  await expect(reviewForm.getByRole('heading', { level: 3, name: '후기 남기기' })).toBeVisible();
  await expect(reviewSection.getByText('후기를 불러오지 못했어요.', { exact: true })).toBeVisible();
  const retryButton = reviewSection.getByRole('button', { name: '후기 다시 시도' });
  await expect(retryButton).toBeEnabled();

  const failedRequestCount = failure.requestCount();
  failure.recover();
  await retryButton.click();

  await expect.poll(failure.requestCount).toBeGreaterThan(failedRequestCount);
  await expect(reviewSection.getByText('후기를 불러오지 못했어요.', { exact: true })).toHaveCount(0);
  await expect(reviewSection.getByText('첫 후기를 남겨보세요', { exact: true })).toBeVisible();
  await expect(reviewForm).toBeVisible();
  await expect(priceSection).toBeVisible();
});

test('a successful zero-observation price response keeps the section and exact empty copy', async ({ page }, testInfo) => {
  await prepareDetail(page, testInfo);
  await page.route('**/api/v1/fish**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (route.request().method() === 'GET' && requestUrl.pathname === '/api/v1/fish/1/prices') {
      await fulfillJson(route, 200, emptyPriceSummary);
      return;
    }
    await route.fallback();
  });

  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  const priceSection = page.locator('#price-section');
  await expect(priceSection.getByRole('heading', { level: 2, name: '가격 현황' })).toBeVisible();
  await expect(priceSection.getByText('최근 14일 · 0건', { exact: true })).toBeVisible();
  await expect(priceSection.getByText('아직 수집된 시세가 없습니다', { exact: true })).toBeVisible();
  await expect(priceSection.getByRole('button', { name: '가격 다시 시도' })).toHaveCount(0);
});

test('SPA navigation to another fish clears the previous review draft', async ({ page }, testInfo) => {
  await prepareDetail(page, testInfo);
  await page.route('**/api/v1/fish**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    if (requestUrl.pathname === '/api/v1/fish/1') {
      await fulfillJson(route, 200, {
        ...fishDetailFixture,
        similarFishes: [secondFishSummary],
      });
      return;
    }
    if (requestUrl.pathname === '/api/v1/fish/2') {
      await fulfillJson(route, 200, secondFishDetail);
      return;
    }
    if (requestUrl.pathname === '/api/v1/fish/2/prices') {
      await fulfillJson(route, 200, { ...emptyPriceSummary, fishId: 2 });
      return;
    }
    if (requestUrl.pathname === '/api/v1/fish/2/reviews') {
      await fulfillJson(route, 200, {
        fishId: 2,
        avgRating: 0,
        totalCount: 0,
        ratingDistribution: emptyRatingDistribution,
        reviews: [],
        page: 0,
        size: 20,
        hasNext: false,
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();

  const firstReviewForm = page.locator('#review-form');
  const nickname = firstReviewForm.locator('input[name="nickname"]');
  const content = firstReviewForm.getByPlaceholder('맛·식감·먹은 곳 분위기, 자유롭게 적어주세요');
  const password = firstReviewForm.locator('input[type="password"]');
  await nickname.fill('초안 작성자');
  await content.fill('이 내용은 다른 횟감으로 넘어가면 사라져야 해요.');
  await password.fill('draft-password');
  await firstReviewForm.getByRole('radio', { name: '4점' }).click();
  await expect(firstReviewForm.getByRole('radio', { name: '4점' })).toHaveAttribute('aria-checked', 'true');

  await page.evaluate(() => {
    document.documentElement.dataset.e2eDocumentMarker = 'same-document';
  });
  const secondFishLink = page
    .getByRole('heading', { level: 3, name: '우럭' })
    .locator('xpath=ancestor::a[1]');
  await expect(secondFishLink).toHaveAttribute('href', '/fish/2');
  await secondFishLink.click();

  await expect(page).toHaveURL(/\/fish\/2$/);
  await expect(page.getByRole('heading', { level: 1, name: '우럭' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.e2eDocumentMarker))
    .toBe('same-document');

  const secondReviewForm = page.locator('#review-form');
  await expect(secondReviewForm.locator('input[name="nickname"]')).toHaveValue('');
  await expect(secondReviewForm.getByPlaceholder('맛·식감·먹은 곳 분위기, 자유롭게 적어주세요')).toHaveValue('');
  await expect(secondReviewForm.locator('input[type="password"]')).toHaveValue('');
  await expect(secondReviewForm.getByRole('radio', { name: '4점' })).toHaveAttribute('aria-checked', 'false');
});
