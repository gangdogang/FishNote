import { expect, test } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const mobileRoutes = [
  { path: '/', heading: '아는 만큼 맛있어지는 회', readyHeading: { level: 3, name: '광어' } },
  { path: '/search?search=%EA%B4%91%EC%96%B4', heading: '검색', readyHeading: { level: 3, name: '광어' } },
  { path: '/fish/1', heading: '광어', readyHeading: { level: 2, name: '후기' } },
  { path: '/saved', heading: '저장한 도감', readyText: '아직 저장한 횟감이 없어요' },
  { path: '/calendar', heading: '제철 캘린더', readyHeading: { level: 3, name: '광어' } },
  { path: '/login', heading: '다시 오셨네요' },
  { path: '/signup', heading: '내 도감을 만들어보세요' },
  { path: '/sources', heading: '정보 출처' },
  { path: '/privacy', heading: '개인정보처리방침' },
  { path: '/terms', heading: '이용약관' },
  { path: '/missing-page', heading: '페이지를 찾을 수 없어요' },
] as const;

for (const route of mobileRoutes) {
  test(`320px layout stays within the safe content area: ${route.path}`, async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-07-15T03:00:00.000Z'));
    await page.setViewportSize({ width: 320, height: 568 });
    await applyProjectTheme(page, testInfo);
    await mockPublicApi(page);
    await page.goto(route.path);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-area-bottom', '34px');
    });

    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    if ('readyHeading' in route) {
      await expect(page.getByRole('heading', route.readyHeading).first()).toBeVisible();
    }
    if ('readyText' in route) {
      await expect(page.getByText(route.readyText, { exact: true })).toBeVisible();
    }

    const layoutBottomPadding = await page.locator('#root > div').first().evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingBottom),
    );
    expect(layoutBottomPadding).toBeGreaterThanOrEqual(102);

    const horizontalMetrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(Math.max(horizontalMetrics.bodyWidth, horizontalMetrics.documentWidth))
      .toBeLessThanOrEqual(horizontalMetrics.viewportWidth + 1);

    await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    const contentBoundary = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const navigation = document.querySelector('nav[aria-label="모바일 주요 메뉴"]');
      if (!(footer instanceof HTMLElement) || !(navigation instanceof HTMLElement)) {
        throw new Error('Footer or mobile navigation is missing');
      }

      return {
        footerBottom: footer.getBoundingClientRect().bottom,
        navigationTop: navigation.getBoundingClientRect().top,
      };
    });
    expect(contentBoundary.footerBottom).toBeLessThanOrEqual(contentBoundary.navigationTop + 1);
  });
}

test('Korean text remains intact when web fonts are unavailable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route(/\.(?:woff2?|ttf)(?:\?.*)?$/i, (route) => route.abort('failed'));
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();

  const fallbackResult = await page.evaluate(async () => {
    await document.fonts.ready;
    const probe = document.createElement('p');
    probe.id = 'font-fallback-probe';
    probe.textContent = '한글 ₩ 123 🐟회러버';
    probe.style.cssText = 'position:fixed;left:8px;top:8px;z-index:1000;margin:0;padding:8px;background:white;color:black;font-size:16px';
    document.body.append(probe);

    return {
      bodyText: document.body.textContent ?? '',
      fontFamily: getComputedStyle(probe).fontFamily,
      probeText: probe.textContent,
      systemFallbackCoversProbe: document.fonts.check('16px system-ui', probe.textContent),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(fallbackResult.probeText).toBe('한글 ₩ 123 🐟회러버');
  expect(fallbackResult.bodyText).not.toContain('�');
  expect(fallbackResult.systemFallbackCoversProbe).toBe(true);
  expect(fallbackResult.fontFamily).toContain('system-ui');
  expect(fallbackResult.fontFamily).toContain('Malgun Gothic');
  expect(fallbackResult.documentWidth).toBeLessThanOrEqual(fallbackResult.viewportWidth + 1);

  const screenshotName = `${testInfo.project.name}-font-fallback.png`;
  const screenshotPath = testInfo.outputPath(screenshotName);
  await page.locator('#font-fallback-probe').screenshot({ path: screenshotPath });
  await testInfo.attach(screenshotName, { path: screenshotPath, contentType: 'image/png' });
});
