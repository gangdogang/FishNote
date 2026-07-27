#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const manifestPath = resolve(process.argv[2] ?? 'config/fish_image_manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const targets = manifest.items.flatMap((item) => [
  { fishId: item.fishId, name: item.name, kind: 'image', url: item.url },
  { fishId: item.fishId, name: item.name, kind: 'source', url: item.sourceUrl },
]);

const failures = [];
const rateLimited = [];
let nextIndex = 0;
const workerCount = 1;

await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `FAIL fish=${failure.fishId}(${failure.name}) kind=${failure.kind} ${failure.reason} ${failure.url}`,
    );
  }
  console.error(`fish media URL check failed: ${failures.length}/${targets.length} targets`);
  process.exitCode = 1;
} else if (rateLimited.length > 0) {
  for (const target of rateLimited) {
    console.warn(
      `INCONCLUSIVE fish=${target.fishId}(${target.name}) kind=${target.kind} HTTP 429 ${target.url}`,
    );
  }
  console.warn(
    `fish media URL check inconclusive: ${rateLimited.length}/${targets.length} targets were rate-limited`,
  );
  process.exitCode = 2;
} else {
  console.log(
    `fish media URLs reachable: ${manifest.items.length} images and ${manifest.items.length} source pages`,
  );
}

async function runWorker() {
  while (nextIndex < targets.length) {
    const target = targets[nextIndex++];
    if (!target.url) {
      failures.push({ ...target, reason: 'missing URL' });
      continue;
    }
    await checkTarget(target);
    await delay(750);
  }
}

async function checkTarget(target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      let response = await fetch(target.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'FishNote-Media-Link-Checker/1.0 (+https://www.fishnote.kr)' },
      });

      // A small ranged GET covers hosts that do not implement HEAD correctly.
      if (response.status === 405 || response.status === 501) {
        response = await fetch(target.url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            Range: 'bytes=0-0',
            'User-Agent': 'FishNote-Media-Link-Checker/1.0 (+https://www.fishnote.kr)',
          },
        });
      }

      if (response.status === 429 || response.status === 503) {
        if (attempt === 3) {
          rateLimited.push(target);
          return;
        }
        await delay(retryDelay(response, attempt));
        continue;
      }

      if (!response.ok) {
        failures.push({ ...target, reason: `HTTP ${response.status}` });
        return;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (target.kind === 'image' && !contentType.startsWith('image/')) {
        failures.push({ ...target, reason: `unexpected content-type ${contentType || '(missing)'}` });
      }
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({ ...target, reason });
      return;
    } finally {
      clearTimeout(timer);
    }
  }
}

function retryDelay(response, attempt) {
  const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 20_000);
  }
  return 2_000 * 2 ** attempt;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
