import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TestInfo } from '@playwright/test';

export async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  const outputPath = testInfo.outputPath(name);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await testInfo.attach(name, {
    path: outputPath,
    contentType: 'application/json',
  });
}
