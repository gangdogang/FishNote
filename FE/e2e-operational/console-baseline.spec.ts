import { test } from '@playwright/test';
import { attachJson } from '../e2e/support/artifacts';

type NavigationResult = {
  error: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
  ok: boolean;
  requestedUrl: string;
  settled: boolean;
};

type RequestFailure = {
  errorText: string | null;
  method: string;
  resourceType: string;
  url: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function artifactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

test('collect operational console baseline', async ({ page }, testInfo) => {
  const consoleErrors: Array<{ location: string | null; text: string }> = [];
  const pageErrors: string[] = [];
  const requestFailures: RequestFailure[] = [];
  const startedAt = new Date().toISOString();
  const configuredBaseUrl = process.env.OPERATIONAL_BASE_URL ?? null;
  const requestedUrl = configuredBaseUrl ?? 'http://127.0.0.1:9';
  const navigation: NavigationResult = {
    error: null,
    finalUrl: null,
    httpStatus: null,
    ok: false,
    requestedUrl: artifactUrl(requestedUrl),
    settled: false,
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const location = message.location().url;
    consoleErrors.push({
      location: location ? artifactUrl(location) : null,
      text: message.text(),
    });
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    requestFailures.push({
      errorText: request.failure()?.errorText ?? null,
      method: request.method(),
      resourceType: request.resourceType(),
      url: artifactUrl(request.url()),
    });
  });

  try {
    const response = await page.goto(requestedUrl, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    });

    navigation.finalUrl = artifactUrl(page.url());
    navigation.httpStatus = response?.status() ?? null;
    navigation.ok = response?.ok() ?? false;

    try {
      await page.waitForLoadState('networkidle', { timeout: 5_000 });
      navigation.settled = true;
    } catch {
      // Long-lived requests are expected on some production pages. The short
      // observation window below still captures console and runtime failures.
    }

    await page.waitForTimeout(3_000);
  } catch (error) {
    navigation.error = errorMessage(error).replaceAll(requestedUrl, artifactUrl(requestedUrl));
    navigation.finalUrl = page.url() === 'about:blank' ? null : artifactUrl(page.url());
  } finally {
    await attachJson(testInfo, 'operational-console-baseline.json', {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      startedAt,
      commit: process.env.GITHUB_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      targetConfigured: configuredBaseUrl !== null,
      browser: testInfo.project.name,
      navigation,
      consoleErrors,
      pageErrors,
      requestFailures,
      counts: {
        consoleErrors: consoleErrors.length,
        pageErrors: pageErrors.length,
        requestFailures: requestFailures.length,
      },
    });
  }
});
