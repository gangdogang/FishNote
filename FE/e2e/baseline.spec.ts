import { expect, test } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const baselineViewports = [
  { name: 'phone-compact', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const viewport of baselineViewports) {
  test(`home viewport baseline: ${viewport.name}`, async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-07-15T03:00:00.000Z'));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const projectTheme = await applyProjectTheme(page, testInfo);
    await mockPublicApi(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();

    await expect(page.locator('html')).toHaveClass(projectTheme === 'dark' ? /dark/ : /^(?!.*dark)/);

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      images.forEach((image) => {
        image.loading = 'eager';
      });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });

    const horizontalMetrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(Math.max(horizontalMetrics.bodyWidth, horizontalMetrics.documentWidth))
      .toBeLessThanOrEqual(horizontalMetrics.viewportWidth + 1);

    if (viewport.width < 1280) {
      const searchInput = page.getByPlaceholder('횟감 이름이나 별칭을 입력해 보세요');
      const inputFontSize = await searchInput.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(inputFontSize).toBeGreaterThanOrEqual(16);
    }

    if (viewport.width < 768) {
      const layoutBottomPadding = await page.locator('#root > div').first().evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingBottom),
      );
      expect(layoutBottomPadding).toBeGreaterThanOrEqual(68);
    }

    if (viewport.name === 'phone-compact') {
      const graphemesPerLine = await page
        .getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })
        .evaluate((heading) => {
          const textNode = Array.from(heading.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
          if (!textNode?.textContent) return [];

          const lineCounts = new Map<number, number>();
          for (let index = 0; index < textNode.textContent.length; index += 1) {
            if (/\s/.test(textNode.textContent[index])) continue;
            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            const top = Math.round(range.getBoundingClientRect().top);
            lineCounts.set(top, (lineCounts.get(top) ?? 0) + 1);
          }
          return Array.from(lineCounts.values());
        });
      expect(graphemesPerLine.at(-1)).toBeGreaterThan(1);
    }

    const screenshotName = `${testInfo.project.name}-${viewport.name}.png`;
    const screenshotPath = testInfo.outputPath(screenshotName);
    await page.screenshot({ fullPage: false, path: screenshotPath });
    await testInfo.attach(screenshotName, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });
}
