#!/usr/bin/env node
// docs/15 M3: 매니페스트의 원본 대표 이미지를 내려받아 웹 크기로 최적화해
// FE/public/fish/<slug>.jpg로 자체 호스팅하고, manifest에 hosted 필드를 기록한 뒤
// 운영 DB URL을 교체하는 V22 마이그레이션을 렌더한다.
//
// 사용법:
//   node scripts/import_fish_images.mjs             # 다운로드 + manifest + V22 렌더
//   node scripts/import_fish_images.mjs --sql-only  # 다운로드 없이 manifest 기준으로 V22만 재렌더
//   node scripts/import_fish_images.mjs --force     # 이미 hosted인 항목도 다시 다운로드
//
// 원칙: manifest의 url·sourceUrl·credit·license 등 원본 필드는 절대 바꾸지 않는다
// (V13 재현성 테스트가 이 필드들로 byte-match 한다). hosted는 추가 필드다.
// 이미지 최적화는 macOS 내장 sips를 사용한다.

import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(ROOT, 'config/fish_image_manifest.json');
const PUBLIC_FISH_DIR = resolve(ROOT, 'FE/public/fish');
const MIGRATION_PATH = resolve(ROOT, 'BE/src/main/resources/db/migration/V22__self_host_fish_images.sql');
const HOSTED_ORIGIN = 'https://www.fishnote.kr';
const MAX_WIDTH = 1280;
const JPEG_QUALITY = '82';
const USER_AGENT = 'FishNoteImageImport/1.0 (+https://www.fishnote.kr; one-time asset migration)';

const sqlOnly = process.argv.includes('--sql-only');
const force = process.argv.includes('--force');

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function sipsPixelSize(path) {
  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]);
  const width = Number(stdout.match(/pixelWidth: (\d+)/)?.[1]);
  const height = Number(stdout.match(/pixelHeight: (\d+)/)?.[1]);
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`sips could not read pixel size for ${path}`);
  }
  return { width, height };
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'image/*' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`download failed ${response.status} for ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function optimizeToJpeg(sourcePath, destinationPath) {
  const { width } = await sipsPixelSize(sourcePath);
  const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', JPEG_QUALITY];
  if (width > MAX_WIDTH) args.push('--resampleWidth', String(MAX_WIDTH));
  await run('sips', [...args, sourcePath, '--out', destinationPath]);
  return sipsPixelSize(destinationPath);
}

function renderMigration(items) {
  const ready = items.filter((item) => item.status === 'READY');
  const missing = ready.filter((item) => !item.hosted);
  if (missing.length > 0) {
    throw new Error(`hosted media missing for: ${missing.map((item) => item.slug).join(', ')}`);
  }
  const allIds = ready.map((item) => item.fishId).join(', ');
  const identityRows = ready
    .map((item) => `            (${item.fishId}, ${sqlText(item.name)}, ${sqlText(item.slug)})`)
    .join(',\n');
  const mappingRows = ready
    .map((item) => `    (${item.fishId}, ${sqlText(item.hosted.url)}, ${item.hosted.width}, ${item.hosted.height})`)
    .join(',\n');

  return `-- Generated from config/fish_image_manifest.json by scripts/import_fish_images.mjs.
-- Do not hand-edit media rows. Update the reviewed manifest and regenerate this migration.
-- docs/15 M3: 대표 이미지 핫링크(nifs·wikimedia)를 자체 호스팅 URL로 교체한다.
-- alt·credit·source_url·license·focal point와 fish_source PHOTO 근거는 원본 출처 그대로 유지한다.

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (VALUES
${identityRows}
        ) AS expected(id, name, slug)
        JOIN fish ON fish.id = expected.id
            AND fish.name = expected.name
            AND fish.slug = expected.slug
    ) <> ${ready.length} THEN
        RAISE EXCEPTION 'V22 self-host preflight failed: catalog identity drift';
    END IF;
    IF (
        SELECT count(*)
        FROM fish_image
        WHERE fish_id IN (${allIds})
          AND role = 'PRIMARY'
          AND image_order = 0
    ) <> ${ready.length} THEN
        RAISE EXCEPTION 'V22 self-host preflight failed: missing primary media rows';
    END IF;
END
$$;

UPDATE fish_image
SET url = mapping.url,
    width = mapping.width,
    height = mapping.height
FROM (VALUES
${mappingRows}
) AS mapping(fish_id, url, width, height)
WHERE fish_image.fish_id = mapping.fish_id
  AND fish_image.role = 'PRIMARY'
  AND fish_image.image_order = 0;

UPDATE fish
SET image_url = image.url
FROM fish_image image
WHERE image.fish_id = fish.id
  AND image.role = 'PRIMARY'
  AND fish.id IN (${allIds});
`;
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
await mkdir(PUBLIC_FISH_DIR, { recursive: true });

if (!sqlOnly) {
  for (const item of manifest.items) {
    if (item.status !== 'READY') continue;
    if (item.hosted && !force) {
      console.log(`skip ${item.slug} (already hosted)`);
      continue;
    }
    const destination = resolve(PUBLIC_FISH_DIR, `${item.slug}.jpg`);
    const original = resolve(PUBLIC_FISH_DIR, `.tmp-${item.slug}`);
    console.log(`fetch ${item.slug} ← ${item.url}`);
    await download(item.url, original);
    try {
      const { width, height } = await optimizeToJpeg(original, destination);
      item.hosted = { url: `${HOSTED_ORIGIN}/fish/${item.slug}.jpg`, width, height };
      console.log(`  → ${item.slug}.jpg ${width}x${height}`);
    } finally {
      await rm(original, { force: true });
    }
  }
  await rename(MANIFEST_PATH, `${MANIFEST_PATH}.bak`);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rm(`${MANIFEST_PATH}.bak`, { force: true });
}

await writeFile(MIGRATION_PATH, renderMigration(manifest.items), 'utf8');
console.log(`rendered ${MIGRATION_PATH}`);
