import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDirectory, '..');
const distRoot = resolve(frontendRoot, 'dist');
const catalog = JSON.parse(await readFile(resolve(frontendRoot, 'prerender/catalog.json'), 'utf8'));
const fixedPublicPages = [
  ['/calendar', '제철 캘린더'],
  ['/sources', '정보 출처'],
  ['/privacy', '개인정보처리방침'],
  ['/terms', '이용약관'],
];

test('every public fish has crawlable prerendered HTML', async () => {
  for (const fish of catalog) {
    const html = await readFile(resolve(distRoot, 'fish', fish.slug, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`<title>${fish.name}[^<]*FishNote</title>`));
    assert.match(html, new RegExp(`<h1>${fish.name}</h1>`));
    assert.match(html, /<meta name="description" content="[^"]+" \/>/);
    assert.match(html, new RegExp(`rel="canonical" href="https://fishnote\\.kr/fish/${fish.slug}"`));
    assert.match(html, /property="og:image" content="https:\/\//);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /"@type":"WebPage"/);
    assert.match(html, /type="application\/ld\+json" data-fishnote-json-ld="prerender"/);
    assert.doesNotMatch(html, /"@type":"(?:Product|Offer)"/);
  }
});

test('every fixed public sitemap route has its own crawlable HTML', async () => {
  for (const [path, heading] of fixedPublicPages) {
    const html = await readFile(resolve(distRoot, path.slice(1), 'index.html'), 'utf8');
    assert.match(html, new RegExp(`<title>${heading} \\| FishNote</title>`));
    assert.match(html, new RegExp(`<h1>${heading}</h1>`));
    assert.match(html, /<meta name="description" content="[^\"]+" \/>/);
    assert.match(html, new RegExp(`rel="canonical" href="https://fishnote\\.kr${path}"`));
    assert.match(html, /"@type":"WebPage"/);
    assert.match(html, /type="application\/ld\+json" data-fishnote-json-ld="prerender"/);
    assert.doesNotMatch(html, /<h1>아는 만큼 맛있어지는 회<\/h1>/);
  }
});

test('sitemap public fish URL count matches the catalog exactly', async () => {
  const sitemap = await readFile(resolve(distRoot, 'sitemap.xml'), 'utf8');
  const fishUrls = [...sitemap.matchAll(/<loc>https:\/\/fishnote\.kr\/fish\/([^<]+)<\/loc>/g)];
  assert.equal(fishUrls.length, catalog.length);
  assert.deepEqual(new Set(fishUrls.map((match) => match[1])), new Set(catalog.map((fish) => fish.slug)));

  for (const [path] of fixedPublicPages) {
    assert.match(sitemap, new RegExp(`<loc>https://fishnote\\.kr${path}</loc>`));
  }
});

test('private SPA shell is noindex and reserved analytics path bypasses fallback', async () => {
  const shell = await readFile(resolve(distRoot, 'spa-noindex.html'), 'utf8');
  const vercel = JSON.parse(await readFile(resolve(frontendRoot, 'vercel.json'), 'utf8'));
  assert.match(shell, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source.includes('(?!_vercel/)')));
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === '/search' && rewrite.destination === '/spa-noindex.html'));
});
