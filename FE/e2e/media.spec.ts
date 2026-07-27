import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPublicApi, primaryFishMedia } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

async function openHome(page: Page, testInfo: Parameters<typeof applyProjectTheme>[1]) {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();
}

async function openFishDetail(page: Page, testInfo: Parameters<typeof applyProjectTheme>[1]) {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
}

async function expectMinimumHitArea(locator: Locator, size = 44) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'interactive control should have a measurable box').not.toBeNull();
  expect(box?.width).toBeGreaterThanOrEqual(size);
  expect(box?.height).toBeGreaterThanOrEqual(size);
}

test('FishCard keeps the detail link and save control as ordered siblings', async ({ page }, testInfo) => {
  await openHome(page, testInfo);

  const card = page
    .getByRole('heading', { level: 3, name: '광어' })
    .first()
    .locator('xpath=ancestor::article[1]');
  const detailLink = card.locator(':scope > a');
  const saveButton = card.locator(':scope > button');

  await expect(card.locator('a button')).toHaveCount(0);
  await expect(detailLink).toHaveCount(1);
  await expect(saveButton).toHaveCount(1);

  const sequentialFocusOrder = await card.evaluate((element) => {
    const link = element.querySelector(':scope > a');
    const button = element.querySelector(':scope > button');
    if (!(link instanceof HTMLAnchorElement) || !(button instanceof HTMLButtonElement)) return false;
    return link.tabIndex === 0
      && button.tabIndex === 0
      && Boolean(link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(sequentialFocusOrder).toBe(true);

  const initialUrl = page.url();
  await saveButton.click();
  await expect(page).toHaveURL(initialUrl);
  await expect(saveButton).toHaveAttribute('aria-pressed', 'true');
});

test('detail media reserves dimensions, prioritizes only the primary image, and exposes its source', async ({ page }, testInfo) => {
  await openFishDetail(page, testInfo);

  const gallery = page.locator('main section').first();
  const images = gallery.locator('[data-image-state] img');
  await expect(images).toHaveCount(3);
  await expect(gallery.locator('img[fetchpriority="high"]')).toHaveCount(1);
  await expect(gallery.locator('img[fetchpriority="high"]')).toHaveAttribute('loading', 'eager');
  await expect(gallery.locator('img[loading="lazy"]')).toHaveCount(2);

  const dimensions = await images.evaluateAll((elements) =>
    elements.map((element) => ({
      width: element.getAttribute('width'),
      height: element.getAttribute('height'),
      aspectRatio: element.parentElement?.style.aspectRatio ?? '',
    })),
  );
  expect(dimensions).toHaveLength(3);
  for (const dimension of dimensions) {
    expect(Number(dimension.width)).toBeGreaterThan(0);
    expect(Number(dimension.height)).toBeGreaterThan(0);
    expect(dimension.aspectRatio).toMatch(/^\d+\s*\/\s*\d+$/);
  }

  await expect(page.getByText(primaryFishMedia.credit, { exact: false })).toBeVisible();
  await expect(page.getByText(primaryFishMedia.license, { exact: false })).toBeVisible();
  const sourceLink = page.locator(`a[href="${primaryFishMedia.sourceUrl}"]`);
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute('target', '_blank');
  await expect(sourceLink).toHaveAttribute('rel', /noopener/);
  await expect(sourceLink).toHaveAttribute('rel', /noreferrer/);
});

test('a failed fish photo removes the broken img and leaves an accessible placeholder', async ({ page }, testInfo) => {
  await page.route('**/fish/gwangeo.jpg', (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }),
  );
  await openHome(page, testInfo);

  const card = page
    .getByRole('heading', { level: 3, name: '광어' })
    .first()
    .locator('xpath=ancestor::article[1]');
  const imageSurface = card.locator('[data-image-state]');

  await expect(imageSurface).toHaveAttribute('data-image-state', 'error');
  await expect(imageSurface.locator('img')).toHaveCount(0);
  await expect(card.getByRole('img', { name: '광어 이미지 준비 중' })).toBeVisible();
});

test('seasonal and featured carousel skeletons reserve the completed card geometry', async ({ page }, testInfo) => {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);

  let releaseFishLists: () => void = () => undefined;
  const fishListGate = new Promise<void>((resolve) => {
    releaseFishLists = resolve;
  });
  await page.route('**/api/v1/home**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== '/api/v1/home') {
      await route.fallback();
      return;
    }
    await fishListGate;
    await route.fallback();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const seasonalSkeleton = page.locator('#section-seasonal [data-skeleton-carousel-item="default"]').first();
  const featuredSkeleton = page.locator('#section-featured [data-skeleton-carousel-item="wide"]').first();
  await expect(seasonalSkeleton).toBeVisible();
  await expect(featuredSkeleton).toBeVisible();
  const before = {
    seasonal: await requiredBox(seasonalSkeleton),
    featured: await requiredBox(featuredSkeleton),
  };

  releaseFishLists();
  const seasonalCard = page.locator('#section-seasonal div[role="region"] > div > article').first();
  const featuredCard = page.locator('#section-featured div[role="region"] > div > article').first();
  await expect(seasonalCard).toBeVisible();
  await expect(featuredCard).toBeVisible();
  const after = {
    seasonal: await requiredBox(seasonalCard),
    featured: await requiredBox(featuredCard),
  };

  expectGeometryToMatch(before.seasonal, after.seasonal);
  expectGeometryToMatch(before.featured, after.featured);
});

test('rating, review-photo removal, and price variant controls provide 44px hit areas', async ({ page }, testInfo) => {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.route('**/api/v1/fish/1/prices**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(priceSummaryWithVariants),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();

  await expectMinimumHitArea(page.getByRole('radio', { name: '1점' }));

  await page.locator('#review-form input[type="file"]').setInputFiles({
    name: 'review.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3L8AAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expectMinimumHitArea(page.getByRole('button', { name: '사진 제거' }));

  const variantGroup = page.getByRole('group', { name: '가격 규격 선택' });
  await expect(variantGroup).toBeVisible();
  for (const control of await variantGroup.getByRole('button').all()) {
    await expectMinimumHitArea(control);
  }
});

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'card should have a measurable box').not.toBeNull();
  if (!box) throw new Error('Card did not produce a layout box');
  return box;
}

function expectGeometryToMatch(
  skeleton: { width: number; height: number },
  completed: { width: number; height: number },
) {
  expect(Math.abs(skeleton.width - completed.width)).toBeLessThanOrEqual(2);
  // Text line boxes can round to fractional CSS pixels differently across engines.
  expect(Math.abs(skeleton.height - completed.height)).toBeLessThanOrEqual(3);
}

const priceObservation = {
  observedAt: '2026-07-15T03:00:00Z',
  priceMinKrw: 30_000,
  priceMaxKrw: 34_000,
  unit: 'kg',
  origin: '제주',
  sizeGrade: null,
  sourceLabel: '가락시장',
  shopName: '테스트 상회',
};

const pricePoint = {
  observedDate: '2026-07-15',
  priceMinKrw: 30_000,
  priceMaxKrw: 34_000,
  avgPriceKrw: 32_000,
  observationCount: 2,
};

const priceSummaryWithVariants = {
  fishId: 1,
  days: 14,
  observationCount: 4,
  latest: priceObservation,
  recent: [priceObservation],
  dailyAverage: [pricePoint],
  byShop: [],
  byVariant: [
    {
      variantKey: 'farm-jeju',
      variantLabel: '제주 양식',
      farming: '양식',
      origin: '제주',
      unit: 'kg',
      observationCount: 2,
      latest: priceObservation,
      graph: [pricePoint],
    },
    {
      variantKey: 'wild-busan',
      variantLabel: '부산 자연산',
      farming: '자연산',
      origin: '부산',
      unit: 'kg',
      observationCount: 2,
      latest: { ...priceObservation, origin: '부산' },
      graph: [pricePoint],
    },
  ],
};
