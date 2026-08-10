import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { FishPriceSummary, FishPriceTrendPoint } from '../src/types/fish';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const manyPricePoints: FishPriceTrendPoint[] = Array.from({ length: 12 }, (_, index) => ({
  observedDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
  priceMinKrw: 30_000 + index * 1_000,
  avgPriceKrw: 32_000 + index * 1_000,
  priceMaxKrw: 34_000 + index * 1_000,
  observationCount: index + 1,
}));

test.describe('F4 responsive price chart', () => {
  test('320px chart uses its measured width, keeps labels visible, and exposes the same data as a keyboard-opened table', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openDetailWithPrices(page, testInfo, createPriceSummary(manyPricePoints));

    const chart = page.getByRole('img', { name: /광어 일별 평균 가격 추이/ });
    await expect(chart).toBeVisible();
    await expect.poll(async () => {
      const metrics = await chart.evaluate((element) => {
        const svg = element as SVGSVGElement;
        return Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width);
      });
      return metrics;
    }).toBeLessThanOrEqual(1);

    const chartMetrics = await chart.evaluate((element) => {
      const svg = element as SVGSVGElement;
      return {
        cssWidth: svg.getBoundingClientRect().width,
        viewBoxWidth: svg.viewBox.baseVal.width,
        declaredWidth: Number(svg.dataset.chartWidth),
      };
    });
    expect(chartMetrics.cssWidth).toBeLessThanOrEqual(320);
    expect(Math.abs(chartMetrics.viewBoxWidth - chartMetrics.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(chartMetrics.declaredWidth - chartMetrics.cssWidth)).toBeLessThanOrEqual(1);

    const axisLabels = chart.locator('[data-axis-label]');
    await expect(axisLabels).not.toHaveCount(0);
    const axisFontSizes = await axisLabels.evaluateAll((elements) =>
      elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    );
    for (const fontSize of axisFontSizes) {
      expect(fontSize).toBeGreaterThanOrEqual(12);
    }
    await expect(chart.locator('[data-axis="x"]')).toHaveCount(4);

    const labelBounds = await chart.locator('[data-axis-label]').evaluateAll((elements) => {
      const svg = elements[0]?.ownerSVGElement;
      if (!svg) throw new Error('Price chart SVG is missing');
      const viewBox = svg.viewBox.baseVal;
      return elements.map((element) => {
        const bounds = (element as SVGGraphicsElement).getBBox();
        return {
          text: element.textContent ?? '',
          left: bounds.x,
          right: bounds.x + bounds.width,
          top: bounds.y,
          bottom: bounds.y + bounds.height,
          viewBoxWidth: viewBox.width,
          viewBoxHeight: viewBox.height,
        };
      });
    });
    for (const bounds of labelBounds) {
      expect(bounds.left, `${bounds.text} should not be clipped on the left`).toBeGreaterThanOrEqual(-1);
      expect(bounds.right, `${bounds.text} should not be clipped on the right`).toBeLessThanOrEqual(bounds.viewBoxWidth + 1);
      expect(bounds.top, `${bounds.text} should not be clipped at the top`).toBeGreaterThanOrEqual(-1);
      expect(bounds.bottom, `${bounds.text} should not be clipped at the bottom`).toBeLessThanOrEqual(bounds.viewBoxHeight + 1);
    }
    await expectNoInvalidSvgValues(chart);

    const description = await chart.locator('desc').textContent();
    expect(description).toContain('기간 2026-07-01부터 2026-07-12까지');
    expect(description).toContain('유효한 관측 12개');
    expect(description).toContain('₩30,000에서 ₩45,000');

    const tableDisclosure = page.locator('#price-section details');
    const tableSummary = tableDisclosure.locator('summary');
    await expect(tableSummary).toHaveAttribute('aria-expanded', 'false');
    await tableSummary.focus();
    await expect(tableSummary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tableDisclosure).toHaveAttribute('open', '');
    await expect(tableSummary).toHaveAttribute('aria-expanded', 'true');

    const tableRegion = page.getByRole('region', { name: '광어 일별 평균 가격 표' });
    await expect(tableRegion).toBeVisible();
    const rows = tableRegion.locator('tbody tr');
    await expect(rows).toHaveCount(manyPricePoints.length);

    const renderedRows = await rows.evaluateAll((elements) =>
      elements.map((row) => ({
        dateTime: row.querySelector('time')?.getAttribute('datetime') ?? '',
        cells: Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() ?? ''),
      })),
    );
    expect(renderedRows).toEqual(manyPricePoints.map((point) => ({
      dateTime: point.observedDate,
      cells: [
        formatTableDate(point.observedDate),
        `${formatKrw(point.priceMinKrw)}원/kg`,
        `${formatKrw(point.avgPriceKrw)}원/kg`,
        `${formatKrw(point.priceMaxKrw)}원/kg`,
        `${formatKrw(point.observationCount)}건`,
      ],
    })));
  });

  const boundaryScenarios: Array<{
    name: string;
    points: FishPriceTrendPoint[];
    empty?: boolean;
  }> = [
    { name: 'empty data', points: [], empty: true },
    {
      name: 'one point',
      points: [{
        observedDate: '2026-07-15',
        priceMinKrw: 38_000,
        avgPriceKrw: 40_000,
        priceMaxKrw: 42_000,
        observationCount: 1,
      }],
    },
    {
      name: 'identical values',
      points: ['2026-07-13', '2026-07-14', '2026-07-15'].map((observedDate) => ({
        observedDate,
        priceMinKrw: 40_000,
        avgPriceKrw: 40_000,
        priceMaxKrw: 40_000,
        observationCount: 1,
      })),
    },
  ];

  for (const scenario of boundaryScenarios) {
    test(`${scenario.name} never renders NaN or Infinity`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openDetailWithPrices(page, testInfo, createPriceSummary(scenario.points), {
        expectPriceSection: !scenario.empty,
      });

      const priceSection = page.locator('#price-section');

      if (scenario.empty) {
        // 성공 응답인데 관측 0건이면 차트를 그리지 않고 섹션·탭을 통째로 숨긴다 (docs/15 M1)
        await expect(priceSection).toHaveCount(0);
        const sectionNav = page.getByRole('navigation', { name: '횟감 상세 바로가기' });
        await expect(sectionNav.getByRole('link', { name: '맛·제철' })).toBeVisible();
        await expect(sectionNav.getByRole('link', { name: '가격' })).toHaveCount(0);
        return;
      }

      await expect(priceSection).toBeVisible();
      await expectNoInvalidSvgValues(priceSection);

      const chart = priceSection.locator('svg[role="img"]');
      await expect(chart).toBeVisible();
      await expect(chart.locator('[data-series-line]')).toHaveCount(3);
      const paths = await chart.locator('[data-series-line]').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('d') ?? ''),
      );
      for (const path of paths) {
        expect(path).toMatch(/^M\s+[\d.]+\s+[\d.]+(?:\s+L\s+[\d.]+\s+[\d.]+)*$/);
      }
    });
  }
});

async function openDetailWithPrices(
  page: Page,
  testInfo: TestInfo,
  summary: FishPriceSummary,
  { expectPriceSection = true } = {},
) {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
  await page.route('**/api/v1/fish/1/prices**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary),
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  if (expectPriceSection) {
    await expect(page.getByRole('heading', { level: 2, name: '가격 현황' })).toBeVisible();
  }
}

function createPriceSummary(points: FishPriceTrendPoint[]): FishPriceSummary {
  const latestPoint = points.at(-1);
  const latest = latestPoint
    ? {
        observedAt: `${latestPoint.observedDate}T03:00:00Z`,
        priceMinKrw: latestPoint.priceMinKrw,
        priceMaxKrw: latestPoint.priceMaxKrw,
        unit: 'kg',
        origin: '국내산',
        sizeGrade: null,
        sourceLabel: '테스트 시세',
        shopName: '테스트 상회',
      }
    : null;

  return {
    fishId: 1,
    days: 14,
    observationCount: points.reduce((sum, point) => sum + point.observationCount, 0),
    latest,
    recent: latest ? [latest] : [],
    dailyAverage: points,
    byShop: [],
    byVariant: [],
  };
}

async function expectNoInvalidSvgValues(root: Locator) {
  const invalidMarkup = await root.locator('svg path, svg text').evaluateAll((elements) =>
    elements
      .map((element) => element.outerHTML)
      .filter((markup) => /(?:NaN|-?Infinity)/.test(markup)),
  );
  expect(invalidMarkup).toEqual([]);
}

function formatTableDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

function formatKrw(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
}
