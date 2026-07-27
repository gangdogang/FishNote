import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const operationalBaseUrl = process.env.OPERATIONAL_BASE_URL ?? 'http://127.0.0.1:9';

export default defineConfig({
  testDir: './e2e-operational',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    [isCI ? 'line' : 'list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-operational' }],
  ],
  outputDir: 'test-results/operational',
  use: {
    baseURL: operationalBaseUrl,
    browserName: 'chromium',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'operational-chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
