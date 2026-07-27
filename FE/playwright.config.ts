import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    [isCI ? 'line' : 'list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results/playwright',
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-light',
      use: { browserName: 'chromium', colorScheme: 'light', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'chromium-dark',
      use: { browserName: 'chromium', colorScheme: 'dark', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'webkit-light',
      use: { browserName: 'webkit', colorScheme: 'light', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'webkit-dark',
      use: { browserName: 'webkit', colorScheme: 'dark', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
