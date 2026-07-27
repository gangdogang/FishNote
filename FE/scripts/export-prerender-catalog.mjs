#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const manifestPath = resolve(repositoryRoot, 'config/fish_image_manifest.json');
const seedPaths = [
  resolve(repositoryRoot, 'BE/src/main/resources/db/migration/V2__seed_fish_catalog.sql'),
  resolve(repositoryRoot, 'BE/src/main/resources/db/migration/V6__add_price_fish_species.sql'),
];
const outputPath = resolve(scriptDirectory, '../prerender/catalog.json');

function decodeSqlText(value) {
  return value.replaceAll("''", "'");
}

function parseFishRows(sql, catalog) {
  const rowPattern = /^\s*\((\d+),\s*'((?:''|[^'])*)',\s*(?:NULL|'(?:''|[^'])*'),\s*(?:NULL|'(?:''|[^'])*'),\s*(?:NULL|'(?:''|[^'])*'),\s*\d+,\s*(?:true|false),\s*'((?:''|[^'])*)',\s*now\(\)\)/gm;
  for (const match of sql.matchAll(rowPattern)) {
    catalog.set(Number(match[1]), {
      id: Number(match[1]),
      name: decodeSqlText(match[2]),
      description: decodeSqlText(match[3]),
      seasonMonths: [],
    });
  }
}

function parseSeasonRows(sql, catalog) {
  const blockPattern = /INSERT INTO fish_season_month\s*\([^)]*\)\s*VALUES([\s\S]*?)(?:ON CONFLICT[^;]*;|;)/g;
  for (const block of sql.matchAll(blockPattern)) {
    for (const row of block[1].matchAll(/\((\d+),\s*(\d+)\)/g)) {
      const item = catalog.get(Number(row[1]));
      if (!item) continue;
      const month = Number(row[2]);
      if (!item.seasonMonths.includes(month)) item.seasonMonths.push(month);
    }
  }
}

function stableCatalogJson(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

async function buildCatalog() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const catalog = new Map();

  for (const seedPath of seedPaths) {
    const sql = await readFile(seedPath, 'utf8');
    parseFishRows(sql, catalog);
    parseSeasonRows(sql, catalog);
  }

  // V7 replaces the generic flatfish season and extends black seabream by October.
  catalog.get(20).seasonMonths = [3, 4, 5, 6];
  if (!catalog.get(11).seasonMonths.includes(10)) catalog.get(11).seasonMonths.push(10);

  const items = manifest.items
    .map((media) => {
      const item = catalog.get(media.fishId);
      if (!item || item.name !== media.name) {
        throw new Error(`catalog identity mismatch for fish ${media.fishId}`);
      }
      return {
        ...item,
        slug: media.slug,
        imageUrl: media.status === 'READY' ? media.url : null,
        seasonMonths: [...item.seasonMonths].sort((left, right) => left - right),
      };
    })
    .sort((left, right) => left.id - right.id);

  if (items.length !== 26 || new Set(items.map((item) => item.slug)).size !== items.length) {
    throw new Error('prerender catalog must contain exactly 26 unique public slugs');
  }
  return items;
}

const catalog = await buildCatalog();
const rendered = stableCatalogJson(catalog);
if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8');
  if (existing !== rendered) {
    console.error(`prerender catalog is stale: ${outputPath}`);
    process.exitCode = 1;
  } else {
    console.log(`prerender catalog matches database seeds: ${catalog.length} fish`);
  }
} else if (process.argv.includes('--write')) {
  await writeFile(outputPath, rendered, 'utf8');
  console.log(`wrote ${catalog.length} fish to ${outputPath}`);
} else {
  process.stdout.write(rendered);
}
