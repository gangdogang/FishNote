import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockPublicApi } from './support/mockApi';
import { applyProjectTheme } from './support/theme';

const COMPACT_VIEWPORT = { width: 320, height: 568 } as const;

async function preparePublicPage(page: Page, testInfo: TestInfo) {
  await applyProjectTheme(page, testInfo);
  await mockPublicApi(page);
}

test('reduced-motion preference disables the detail gallery transition without hiding controls', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparePublicPage(page, testInfo);
  await page.goto('/fish/1', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1, name: '광어' })).toBeVisible();
  const gallery = page.getByRole('group', { name: '광어 사진 갤러리' });
  const gallerySurface = gallery.locator(':scope > div').first();
  const secondImageButton = gallery.getByRole('button', { name: '광어 이미지 2' });
  await expect(secondImageButton).toBeVisible();

  const motionState = await gallerySurface.evaluate((element) => ({
    preferenceMatches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    transitionProperty: getComputedStyle(element).transitionProperty,
  }));
  expect(motionState.preferenceMatches).toBe(true);
  expect(motionState.transitionProperty).toBe('none');

  await secondImageButton.click();
  await expect(secondImageButton).toHaveAttribute('aria-pressed', 'true');
});

test('an offline lazy-route navigation keeps the shell usable and presents a recovery action', async ({
  context,
  page,
}, testInfo) => {
  await page.setViewportSize(COMPACT_VIEWPORT);
  await preparePublicPage(page, testInfo);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 3, name: '광어' }).first()).toBeVisible();

  const detailLink = page
    .getByRole('heading', { level: 3, name: '광어' })
    .first()
    .locator('xpath=ancestor::a[1]');
  await page.unroute('**/api/v1/fish**');
  await context.setOffline(true);
  try {
    await detailLink.click();

    await expect(page).toHaveURL(/\/fish\/gwangeo$/);
    await expect(page.getByRole('heading', { level: 1, name: '문제가 발생했어요' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새로고침' })).toBeEnabled();
    await expect(page.getByRole('navigation', { name: '모바일 주요 메뉴' })).toBeVisible();

    const widths = await page.evaluate(() => ({
      content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
  } finally {
    await context.setOffline(false);
  }
});

test('long Korean, English, and emoji nicknames stay reachable in the compact account menu', async ({
  page,
}, testInfo) => {
  const nicknames = [
    { value: '바다를정말좋아하는아주긴한글닉네임사용자최대길이경계테스트용', initial: '바' },
    { value: 'VeryLongEnglishNicknameForFish', initial: 'V' },
    { value: '🐟‍🌊 회와바다를좋아하는사용자✨', initial: '🐟‍🌊' },
  ] as const;
  let currentNickname: string = nicknames[0].value;

  await page.setViewportSize(COMPACT_VIEWPORT);
  await page.addInitScript(() => {
    window.localStorage.setItem('fishnote:accessToken', 'e2e-access-token');
  });
  await preparePublicPage(page, testInfo);
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 42,
        email: 'reader@example.test',
        nickname: currentNickname,
        hasPassword: false,
      }),
    });
  });

  for (const nickname of nicknames) {
    currentNickname = nickname.value;
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: '아는 만큼 맛있어지는 회' })).toBeVisible();

    const accountButton = page.getByRole('button', { name: `${nickname.value} 계정 메뉴` });
    await expect(accountButton).toBeVisible();
    await expect(accountButton).toHaveText(nickname.initial);
    await accountButton.click();
    await expect(page.getByText(nickname.value, { exact: true })).toBeVisible();

    const widths = await page.evaluate(() => ({
      content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.content, `nickname overflow: ${nickname.value}`).toBeLessThanOrEqual(widths.viewport + 1);
  }
});
