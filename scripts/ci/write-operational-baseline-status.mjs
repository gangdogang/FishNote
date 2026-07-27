import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = process.argv[2];

if (!outputPath) {
  console.error('usage: node write-operational-baseline-status.mjs <output-path>');
  process.exit(2);
}

const targetConfigured = Boolean(process.env.OPERATIONAL_BASE_URL);
const collectorOutcome = process.env.OPERATIONAL_COLLECTOR_OUTCOME || 'skipped';
const status = targetConfigured ? collectorOutcome : 'skipped-no-base-url';
const absoluteOutputPath = resolve(outputPath);

mkdirSync(dirname(absoluteOutputPath), { recursive: true });
writeFileSync(absoluteOutputPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  targetConfigured,
  collectorOutcome,
  status,
}, null, 2)}\n`, 'utf8');
