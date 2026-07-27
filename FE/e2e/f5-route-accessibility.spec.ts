import { expect, test } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const DESKTOP_VIEWPORT = { width: 1024, height: 768 } as const;

test.beforeEach(async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-07-15T03:00:00.000Z'));
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
});

test('the page exposes one focusable main landmark and a keyboard skip link', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();

  const mainLandmarks = page.locator('main');
  const mainContent = page.locator('main#main-content');
  const skipLink = page.getByRole('link', { name: '본문 바로가기' });

  await expect(mainLandmarks).toHaveCount(1);
  await expect(mainContent).toHaveCount(1);
  await expect(mainContent).toHaveAttribute('tabindex', '-1');
  await expect(skipLink).not.toBeInViewport();

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(mainContent).toBeFocused();
});

test('PUSH resets scroll and focuses the announced page, while POP restores scroll without forcing main focus', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const homeScrollY = await page.evaluate(() => window.scrollY);

  const mobileNavigation = page.getByRole('navigation', { name: '모바일 주요 메뉴' });
  await mobileNavigation.getByRole('link', { name: '제철', exact: true }).click();

  const mainContent = page.locator('main#main-content');
  const routeStatus = page
    .locator('[role="status"][aria-live="polite"]')
    .filter({ hasText: '제철 캘린더 | FishNote' });
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole('heading', { level: 1, name: '제철 캘린더' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(mainContent).toBeFocused();
  await expect(page).toHaveTitle('제철 캘린더 | FishNote');
  await expect(routeStatus).toHaveText('제철 캘린더 | FishNote');

  const themeToggle = page.getByRole('button', { name: /모드로 전환/ });
  await themeToggle.focus();
  await expect(themeToggle).toBeFocused();

  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(homeScrollY);
  await expect(themeToggle).toBeFocused();
  await expect(mainContent).not.toBeFocused();
});

test('a PUSH query change on the same search pathname preserves scroll and focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '검색' })).toBeVisible();

  const nameSort = page.getByRole('group', { name: '정렬' }).getByRole('button', {
    name: '이름순',
    exact: true,
  });
  await nameSort.focus();
  await page.evaluate(() => window.scrollTo(0, 120));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const searchScrollY = await page.evaluate(() => window.scrollY);

  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/search\?sort=name$/);
  await expect(nameSort).toHaveAttribute('aria-pressed', 'true');
  await expect(nameSort).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(searchScrollY);
});

test('desktop and mobile navigation expose exactly one current page', async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto('/calendar', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '제철 캘린더' })).toBeVisible();

  const desktopNavigation = page.locator('header nav');
  await expect(desktopNavigation).toBeVisible();
  await expect(desktopNavigation.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(
    desktopNavigation.getByRole('link', { name: '제철 캘린더', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(desktopNavigation.getByRole('link', { name: '도감', exact: true })).not.toHaveAttribute(
    'aria-current',
  );

  await page.setViewportSize(MOBILE_VIEWPORT);

  const mobileNavigation = page.getByRole('navigation', { name: '모바일 주요 메뉴' });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(mobileNavigation.getByRole('link', { name: '제철', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(mobileNavigation.getByRole('link', { name: '도감', exact: true })).not.toHaveAttribute(
    'aria-current',
  );
  await expect(mobileNavigation.getByRole('link', { name: '저장', exact: true })).not.toHaveAttribute(
    'aria-current',
  );
});
