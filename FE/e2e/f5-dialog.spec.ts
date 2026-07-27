import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
// Browser zoom halves the CSS viewport at 200%. Use the 390x844 device's
// effective CSS viewport so this exercises horizontal reflow, not only height.
const ZOOM_EQUIVALENT_VIEWPORT = { width: 195, height: 422 } as const;

async function preparePage(page: Page, testInfo: TestInfo) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '검색' })).toBeVisible();
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'element should have a measurable layout box').not.toBeNull();
  if (!box) throw new Error('Element did not produce a layout box');
  return box;
}

test('mobile filter dialog contains keyboard focus and restores its opener', async ({ page }, testInfo) => {
  await preparePage(page, testInfo);

  const opener = page.getByRole('button', { name: '필터', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: '검색 필터' });
  const closeButton = dialog.getByRole('button', { name: '검색 필터 닫기' });
  const applyButton = dialog.getByRole('button', { name: '결과 1개 보기' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => (element as HTMLDialogElement).open)).toBe(true);
  await expect(closeButton).toBeFocused();
  await expect(dialog.evaluate((element) => element.contains(document.activeElement))).resolves.toBe(true);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Shift+Tab');
  await expect(applyButton).toBeFocused();
  await expect(dialog.evaluate((element) => element.contains(document.activeElement))).resolves.toBe(true);

  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await expect(dialog.evaluate((element) => element.contains(document.activeElement))).resolves.toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  const dialogBox = await requiredBox(dialog);
  await page.mouse.click(dialogBox.x + dialogBox.width / 2, dialogBox.y + 4);
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('mobile filter dialog keeps all content reachable at a 200%-zoom-equivalent width', async ({
  page,
}, testInfo) => {
  await preparePage(page, testInfo);
  await page.setViewportSize(ZOOM_EQUIVALENT_VIEWPORT);

  const opener = page.getByRole('button', { name: '필터', exact: true });
  await opener.click();

  const dialog = page.getByRole('dialog', { name: '검색 필터' });
  const panel = dialog.locator(':scope > div');
  const closeButton = dialog.getByRole('button', { name: '검색 필터 닫기' });
  const lastFilterButton = dialog.getByRole('button', { name: '₩₩₩ 특별한 날', exact: true });
  const applyButton = dialog.getByRole('button', { name: '결과 1개 보기' });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();

  const closeBox = await requiredBox(closeButton);
  expect(closeBox.x).toBeGreaterThanOrEqual(0);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(ZOOM_EQUIVALENT_VIEWPORT.width + 1);
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(ZOOM_EQUIVALENT_VIEWPORT.height + 1);

  const scrollMetrics = await panel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.clientWidth + 1);

  await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(lastFilterButton).toBeVisible();
  await expect(applyButton).toBeVisible();
  const lastFilterBox = await requiredBox(lastFilterButton);
  const applyBox = await requiredBox(applyButton);
  expect(lastFilterBox.x).toBeGreaterThanOrEqual(0);
  expect(lastFilterBox.x + lastFilterBox.width).toBeLessThanOrEqual(ZOOM_EQUIVALENT_VIEWPORT.width + 1);
  expect(lastFilterBox.y).toBeGreaterThanOrEqual(0);
  expect(lastFilterBox.y + lastFilterBox.height).toBeLessThanOrEqual(applyBox.y + 1);
  expect(applyBox.x).toBeGreaterThanOrEqual(0);
  expect(applyBox.x + applyBox.width).toBeLessThanOrEqual(ZOOM_EQUIVALENT_VIEWPORT.width + 1);
  expect(applyBox.y).toBeGreaterThanOrEqual(0);
  expect(applyBox.y + applyBox.height).toBeLessThanOrEqual(ZOOM_EQUIVALENT_VIEWPORT.height + 1);

  const dialogMetrics = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(dialogMetrics.scrollWidth).toBeLessThanOrEqual(dialogMetrics.clientWidth + 1);
  expect(dialogMetrics.scrollLeft).toBe(0);
});
