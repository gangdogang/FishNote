import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputPath = process.argv[2];
const surface = process.argv[3] ?? 'unknown';

if (!outputPath) {
  console.error('usage: node write-baseline-manifest.mjs <output-path> [surface]');
  process.exit(2);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');

function commandVersion(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error || result.status !== 0) {
    return 'unavailable';
  }

  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() || 'unavailable';
}

function packageVersion(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), 'utf8')).version;
  } catch {
    return 'unavailable';
  }
}

function sitemapFishCount() {
  try {
    const sitemap = readFileSync(resolve(repositoryRoot, 'FE', 'dist', 'sitemap.xml'), 'utf8');
    return [...sitemap.matchAll(/<loc>[^<]*\/fish\/[^<]+<\/loc>/g)].length;
  } catch {
    try {
      const catalog = JSON.parse(
        readFileSync(resolve(repositoryRoot, 'FE', 'prerender', 'catalog.json'), 'utf8'),
      );
      return Array.isArray(catalog) ? catalog.length : null;
    } catch {
      return null;
    }
  }
}

const commit = process.env.GITHUB_SHA
  ?? commandVersion('git', ['rev-parse', 'HEAD']);
const javaVersion = commandVersion('java', ['-version']).split('\n')[0];

const manifest = {
  schemaVersion: 1,
  surface,
  generatedAt: new Date().toISOString(),
  commit,
  ci: {
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    runnerOs: process.env.RUNNER_OS ?? process.platform,
  },
  runtime: {
    node: process.version,
    java: javaVersion,
    playwright: packageVersion('FE/node_modules/@playwright/test/package.json'),
    postgresqlImage: 'postgres:16.4-alpine',
  },
  dataBaseline: {
    sitemapFishUrlCount: sitemapFishCount(),
    sourceVerificationStatus: 'NOT_AVAILABLE',
  },
};

const absoluteOutputPath = resolve(repositoryRoot, outputPath);
mkdirSync(dirname(absoluteOutputPath), { recursive: true });
writeFileSync(absoluteOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
