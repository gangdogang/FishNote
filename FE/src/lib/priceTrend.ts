import type { FishPriceTrendPoint } from '../types/fish';

interface NormalizedEntry {
  point: FishPriceTrendPoint;
  sortValue: number;
  originalIndex: number;
}

export function normalizePriceTrendPoints(points: readonly FishPriceTrendPoint[]) {
  if (!Array.isArray(points)) return [];

  return points
    .map(normalizeEntry)
    .filter((entry): entry is NormalizedEntry => entry !== null)
    .sort((left, right) => left.sortValue - right.sortValue || left.originalIndex - right.originalIndex)
    .map(({ point }) => point);
}

function normalizeEntry(point: FishPriceTrendPoint, originalIndex: number): NormalizedEntry | null {
  if (!point || typeof point !== 'object') return null;
  const date = normalizeCalendarDate(point.observedDate);
  if (!date) return null;

  const rawMinimum = normalizePrice(point.priceMinKrw);
  const rawMaximum = normalizePrice(point.priceMaxKrw);
  const rawAverage = normalizePrice(point.avgPriceKrw);
  const derivedAverage = rawAverage ?? safeAverage(rawMinimum, rawMaximum);
  if (derivedAverage === null) return null;

  const minimum = Math.min(rawMinimum ?? derivedAverage, rawMaximum ?? derivedAverage);
  const maximum = Math.max(rawMinimum ?? derivedAverage, rawMaximum ?? derivedAverage);
  const average = Math.min(maximum, Math.max(minimum, derivedAverage));
  const observationCount = Number.isFinite(point.observationCount)
    ? Math.max(0, Math.trunc(point.observationCount))
    : 0;

  return {
    point: {
      ...point,
      observedDate: date.value,
      priceMinKrw: minimum,
      priceMaxKrw: maximum,
      avgPriceKrw: average,
      observationCount,
    },
    sortValue: date.timestamp,
    originalIndex,
  };
}

function normalizePrice(value: unknown) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= Number.MAX_SAFE_INTEGER
    ? value
    : null;
}

function safeAverage(minimum: number | null, maximum: number | null) {
  if (minimum !== null && maximum !== null) return minimum / 2 + maximum / 2;
  return minimum ?? maximum;
}

function normalizeCalendarDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    year < 1000
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { value: normalized, timestamp };
}
