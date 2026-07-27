import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Result } from 'axe-core';
import { attachJson } from './support/artifacts';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

interface RouteA11yScenario {
  name: string;
  path: string;
  requireNoViolationsAtAnyImpact?: boolean;
  waitUntilReady: (page: Page) => Promise<void>;
}

const scenarios: RouteA11yScenario[] = [
  {
    name: 'home',
    path: '/',
    requireNoViolationsAtAnyImpact: true,
    waitUntilReady: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();
    },
  },
  {
    name: 'search',
    path: '/search?search=광어',
    waitUntilReady: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: '검색' })).toBeVisible();
      await expect(
        page.locator('span[aria-live="polite"]:visible').filter({ hasText: '검색 결과' }).first(),
      ).toContainText('1건');
      await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();
    },
  },
  {
    name: 'detail with review form',
    path: '/fish/1',
    waitUntilReady: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
      await expect(page.locator('#price-section')).toContainText('최근 14일 · 1건');
      await expect(page.locator('#reviews')).toContainText('첫 후기를 남겨보세요');
      await expect(
        page.locator('#review-form').getByRole('heading', { level: 3, name: '후기 남기기' }),
      ).toBeVisible();
    },
  },
  {
    name: 'calendar',
    path: '/calendar',
    waitUntilReady: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: '제철 캘린더' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2 })).toContainText('· 1종');
      await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();
    },
  },
];

for (const scenario of scenarios) {
  test(`${scenario.name} has no high-impact axe issues`, async ({ page }, testInfo) => {
    await applyProjectTheme(page, testInfo);
    await mockPublicApi(page);
    await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });
    await scenario.waitUntilReady(page);

    await expectRouteToPassAxe(page, testInfo, scenario.requireNoViolationsAtAnyImpact ?? false);
  });
}

async function expectRouteToPassAxe(
  page: Page,
  testInfo: TestInfo,
  requireNoViolationsAtAnyImpact: boolean,
) {
  const results = await new AxeBuilder({ page }).analyze();
  await attachJson(testInfo, 'axe-results.json', results);

  // Keep the original, stricter home contract while applying the F5 high-impact
  // gate to every route.
  if (requireNoViolationsAtAnyImpact) expect(results.violations).toEqual([]);

  expect(toHighImpactIssues(results.violations)).toEqual([]);
  expect(toUnresolvedHighImpactIncomplete(results.incomplete)).toEqual([]);
}

function toHighImpactIssues(rules: Result[]) {
  return rules.flatMap((rule) => {
    if (rule.impact !== 'serious' && rule.impact !== 'critical') return [];

    return rule.nodes.map((node) => ({
      id: rule.id,
      impact: rule.impact,
      target: node.target,
    }));
  });
}

function toUnresolvedHighImpactIncomplete(rules: Result[]) {
  return rules.flatMap((rule) => {
    if (rule.impact !== 'serious' && rule.impact !== 'critical') return [];

    return rule.nodes
      .filter((node) => {
        // axe cannot calculate contrast for non-BMP-only glyph controls such
        // as star ratings. All other high-impact incomplete nodes must fail.
        const onlyKnownColorEngineLimits = rule.id === 'color-contrast'
          && node.any.length > 0
          && node.any.every((check) => check.data?.messageKey === 'nonBmp');
        return !onlyKnownColorEngineLimits;
      })
      .map((node) => ({
        id: rule.id,
        impact: rule.impact,
        target: node.target,
      }));
  });
}
