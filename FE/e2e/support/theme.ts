import type { Page, TestInfo } from '@playwright/test';

export type ProjectTheme = 'light' | 'dark';

export async function applyProjectTheme(page: Page, testInfo: TestInfo): Promise<ProjectTheme> {
  const theme: ProjectTheme = testInfo.project.name.endsWith('-dark') ? 'dark' : 'light';

  await page.addInitScript((projectTheme) => {
    try {
      window.localStorage.setItem('fishnote-theme', projectTheme);
    } catch {
      // Initial opaque documents do not expose localStorage. The script runs
      // again after navigation, where the application origin is available.
    }
  }, theme);

  return theme;
}
