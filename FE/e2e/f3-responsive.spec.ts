import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const DESKTOP_VIEWPORT = { width: 1024, height: 900 } as const;

async function preparePage(
  page: Page,
  testInfo: TestInfo,
  viewport: { width: number; height: number } = MOBILE_VIEWPORT,
) {
  await page.setViewportSize(viewport);
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'element should have a measurable layout box').not.toBeNull();
  if (!box) throw new Error('Element did not produce a layout box');
  return box;
}

test('390x844 search shows its heading, result controls, and part of the first card', async ({ page }, testInfo) => {
  await preparePage(page, testInfo);
  await page.goto('/search', { waitUntil: 'domcontentloaded' });

  const main = page.locator('main');
  const heading = main.getByRole('heading', { level: 1, name: '검색' });
  const resultCount = main.locator('[aria-live="polite"]').filter({ hasText: '검색 결과' }).first();
  const filterButton = main.getByRole('button', { name: '필터', exact: true });
  const firstCard = main.locator('article').first();

  await expect(heading).toBeVisible();
  await expect(resultCount).toContainText('검색 결과 1건');
  await expect(filterButton).toBeVisible();
  await expect(firstCard).toBeVisible();

  const [headingBox, resultBox, filterBox, cardBox] = await Promise.all([
    requiredBox(heading),
    requiredBox(resultCount),
    requiredBox(filterButton),
    requiredBox(firstCard),
  ]);
  expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(resultBox.y + 1);
  expect(cardBox.y).toBeGreaterThanOrEqual(Math.max(
    resultBox.y + resultBox.height,
    filterBox.y + filterBox.height,
  ));

  const visibleCardHeight = Math.min(cardBox.y + cardBox.height, MOBILE_VIEWPORT.height)
    - Math.max(cardBox.y, 0);
  expect(visibleCardHeight).toBeGreaterThan(24);
});

test('mobile filter sheet keeps drafts out of the URL and restores committed history', async ({ page }, testInfo) => {
  await preparePage(page, testInfo);
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '검색' })).toBeVisible();

  const initialUrl = page.url();
  const opener = page.getByRole('button', { name: '필터', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '검색 필터' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.keyboard.press('Enter');
  const spring = dialog.getByRole('button', { name: '봄', exact: true });
  await spring.click();
  await expect(spring).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).toBe(initialUrl);

  const applyButton = dialog.getByRole('button', { name: '결과 1개 보기' });
  await expect(applyButton).toBeVisible();
  await applyButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/search\?season=spring$/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const restoredOpener = page.getByRole('button', { name: '필터 1개', exact: true });
  await expect(restoredOpener).toBeVisible();
  await restoredOpener.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button', { name: '봄', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(restoredOpener).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('button', { name: '필터', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '필터 1개', exact: true })).toHaveCount(0);
});

test('search canonicalizes invalid shared params and announces API errors without a false count', async ({ page }, testInfo) => {
  await preparePage(page, testInfo);
  await page.goto('/search?season=summer&month=7&priceLevel=9&taste=%EC%97%86%EB%8A%94%EB%A7%9B&sort=bogus&search=%20%EA%B4%91%EC%96%B4%20&unknown=1', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/\/search\?search=%EA%B4%91%EC%96%B4&month=7$/);
  const canonicalFilterOpener = page.getByRole('button', { name: '필터 1개', exact: true });
  await canonicalFilterOpener.click();
  const canonicalDialog = page.getByRole('dialog', { name: '검색 필터' });
  await expect(canonicalDialog.getByRole('button', { name: '7월', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  await page.route('**/api/v1/fish**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === '/api/v1/fish') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"failure"}' });
      return;
    }
    await route.fallback();
  });
  await page.goto('/search?search=%EA%B4%91%EC%96%B4&sort=name', { waitUntil: 'domcontentloaded' });

  const resultStatus = page.locator('[aria-live="polite"]').filter({ hasText: '검색 결과를 불러오지 못했어요' }).first();
  await expect(resultStatus).toBeVisible();
  await expect(resultStatus).not.toContainText('0건');
  await expect(page.getByText('잠시 연결이 원활하지 않아요')).toBeVisible();
});

test('calendar centers the current and edge months in the mobile rail', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T03:00:00.000Z'));
  await preparePage(page, testInfo);
  await page.goto('/calendar', { waitUntil: 'domcontentloaded' });

  const monthGroup = page.getByRole('group', { name: '월 선택' });
  await expect(monthGroup).toBeVisible();
  const currentMonth = monthGroup.getByRole('button', { name: /^1월/ });
  await expect(monthGroup.locator('button[aria-current="date"]')).toHaveCount(1);
  await expect(currentMonth).toHaveAttribute('aria-pressed', 'true');
  await expect(currentMonth).toContainText('1월');
  expectRailVisibility(await railMetrics(currentMonth), true);

  const monthTwelve = monthGroup.getByRole('button', { name: /^12월/ });
  await monthTwelve.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(monthTwelve).toHaveAttribute('aria-current', 'date');
  await expect(monthTwelve).toHaveAttribute('aria-pressed', 'true');
  await expect(currentMonth).not.toHaveAttribute('aria-current');
  expectRailVisibility(await railMetrics(monthTwelve), true);
});

test('home swaps the hero search for the header search only after the hero leaves view', async ({ page }, testInfo) => {
  await preparePage(page, testInfo);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const hero = page.locator('#home-hero');
  const heroSearch = hero.getByPlaceholder('횟감 이름이나 별칭을 입력해 보세요');
  const headerSearch = page.locator('header').getByPlaceholder('횟감 이름 검색').last();
  await expect(heroSearch).toBeVisible();
  await expect(headerSearch).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => hero.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(65);
  await expect(headerSearch).toBeVisible();
});

test('390x844 fish detail puts its identity and quick actions before a continuing gallery', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-04-15T03:00:00.000Z'));
  await preparePage(page, testInfo);
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  const main = page.locator('main');
  const topSection = main.locator('section').first();
  const identity = topSection.locator(':scope > div').nth(0);
  const gallery = topSection.locator(':scope > div').nth(1);
  const backButton = identity.getByRole('button', { name: '도감으로' });
  const heading = identity.getByRole('heading', { level: 1, name: '광어' });
  const aliases = identity.getByText('다른 이름 넙치 · 광어회용 양식 넙치');
  const verification = identity.getByText('일부 검증');
  const quickFacts = identity.locator('dl');
  const saveButton = identity.getByRole('button', { name: '횟감 저장' });
  const shareButton = identity.getByRole('button', { name: '광어 공유하기' });

  await expect(heading).toBeVisible();
  await expect(aliases).toBeVisible();
  await expect(verification).toBeVisible();
  await expect(gallery).toHaveAttribute('role', 'group');
  await expect(gallery).toHaveAttribute('aria-label', '광어 사진 갤러리');
  await expect(quickFacts.locator('dt')).toHaveText(['제철', '대표 맛', '최근 가격']);
  await expect(quickFacts.locator('dd')).toHaveText(['지금 제철', '담백한 · 쫄깃한', '12.3만원–45.6만원/kg']);
  await expect(saveButton).toBeVisible();
  await expect(shareButton).toBeVisible();

  for (const identityDetail of [heading, aliases, verification]) {
    await expectDomOrder(backButton, identityDetail);
    await expectDomOrder(identityDetail, quickFacts);
  }
  await expectDomOrder(quickFacts, saveButton);
  await expectDomOrder(saveButton, shareButton);
  await expectDomOrder(shareButton, gallery);

  const galleryFollowsIdentity = await identity.evaluate((element) =>
    element.nextElementSibling?.getAttribute('aria-label') === '광어 사진 갤러리',
  );
  expect(galleryFollowsIdentity).toBe(true);

  const galleryBox = await requiredBox(gallery);
  for (const coreElement of [heading, aliases, verification, quickFacts, saveButton, shareButton]) {
    const box = await requiredBox(coreElement);
    expect(box.y + box.height).toBeLessThanOrEqual(galleryBox.y + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(MOBILE_VIEWPORT.height);
  }

  const primaryMediaBox = await requiredBox(gallery.locator('[data-image-state]').first());
  const visibleGalleryHeight = Math.min(
    primaryMediaBox.y + primaryMediaBox.height,
    MOBILE_VIEWPORT.height,
  ) - Math.max(primaryMediaBox.y, 0);
  expect(galleryBox.y).toBeLessThan(MOBILE_VIEWPORT.height);
  expect(visibleGalleryHeight).toBeGreaterThan(100);
});

test('1024px fish detail keeps the gallery left and identity summary right in two columns', async ({ page }, testInfo) => {
  await preparePage(page, testInfo, DESKTOP_VIEWPORT);
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  const topSection = page.locator('main section').first();
  const identity = topSection.locator(':scope > div').nth(0);
  const gallery = topSection.locator(':scope > div').nth(1);
  await expect(identity.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  await expect(gallery).toHaveAttribute('aria-label', '광어 사진 갤러리');

  const [identityBox, galleryBox] = await Promise.all([
    requiredBox(identity),
    requiredBox(gallery),
  ]);
  expect(galleryBox.x + galleryBox.width).toBeLessThanOrEqual(identityBox.x);
  expect(Math.abs(galleryBox.y - identityBox.y)).toBeLessThanOrEqual(1);
  expect(galleryBox.width).toBeGreaterThan(300);
  expect(identityBox.width).toBeGreaterThan(300);
});

async function railMetrics(button: Locator) {
  return button.evaluate((element) => {
    const group = element.parentElement;
    const rail = group?.parentElement;
    if (!(rail instanceof HTMLElement)) throw new Error('Month rail is missing');
    const buttonRect = element.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    return {
      buttonLeft: buttonRect.left,
      buttonRight: buttonRect.right,
      buttonCenter: buttonRect.left + buttonRect.width / 2,
      railLeft: railRect.left,
      railRight: railRect.right,
      railCenter: railRect.left + railRect.width / 2,
      scrollLeft: rail.scrollLeft,
    };
  });
}

async function expectDomOrder(first: Locator, second: Locator) {
  const secondHandle = await second.elementHandle();
  expect(secondHandle, 'second DOM node should exist').not.toBeNull();
  if (!secondHandle) return;
  const follows = await first.evaluate(
    (firstNode, secondNode) => Boolean(
      secondNode && (firstNode.compareDocumentPosition(secondNode) & Node.DOCUMENT_POSITION_FOLLOWING),
    ),
    secondHandle,
  );
  await secondHandle.dispose();
  expect(follows).toBe(true);
}

function expectRailVisibility(
  metrics: Awaited<ReturnType<typeof railMetrics>>,
  expectCentered: boolean,
) {
  expect(metrics.buttonLeft).toBeGreaterThanOrEqual(metrics.railLeft - 1);
  expect(metrics.buttonRight).toBeLessThanOrEqual(metrics.railRight + 1);
  expect(metrics.scrollLeft).toBeGreaterThan(0);
  if (expectCentered) {
    expect(Math.abs(metrics.buttonCenter - metrics.railCenter)).toBeLessThanOrEqual(2);
  }
}
