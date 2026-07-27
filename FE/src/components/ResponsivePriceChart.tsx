import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizePriceTrendPoints } from '../lib/priceTrend';
import type { FishPriceTrendPoint } from '../types/fish';

export interface ResponsivePriceChartProps {
  points: FishPriceTrendPoint[];
  label: string;
  currency: 'KRW';
  unit?: string | null;
  height?: number;
  showRange?: boolean;
}

interface NormalizedPoint {
  key: string;
  observedDate: string;
  dateLabel: string;
  average: number;
  minimum: number;
  maximum: number;
}

type SeriesKey = 'average' | 'minimum' | 'maximum';
type PointShape = 'circle' | 'square' | 'triangle';

interface ChartSeries {
  key: SeriesKey;
  label: string;
  color: string;
  dash?: string;
  shape: PointShape;
  values: number[];
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 240;
const MOBILE_MAX_WIDTH = 480;
const MOBILE_MAX_TICKS = 4;
const DESKTOP_MAX_TICKS = 6;
const MARKER_GUTTER = 8;

const SERIES_STYLE: Record<SeriesKey, Omit<ChartSeries, 'values'>> = {
  average: {
    key: 'average',
    label: '평균',
    color: 'rgb(var(--c-accent))',
    shape: 'circle',
  },
  minimum: {
    key: 'minimum',
    label: '최저',
    color: 'rgb(var(--c-ink-mute))',
    dash: '6 4',
    shape: 'square',
  },
  maximum: {
    key: 'maximum',
    label: '최고',
    color: 'rgb(var(--c-star))',
    dash: '2 4',
    shape: 'triangle',
  },
};

export default function ResponsivePriceChart({
  points,
  label,
  currency,
  unit,
  height = DEFAULT_HEIGHT,
  showRange = false,
}: ResponsivePriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measuredWidth = useMeasuredWidth(containerRef);
  const chartHeight = normalizeHeight(height);
  const accessibleLabel = label.trim() || '가격 추이';
  const generatedId = useId().replace(/:/g, '');
  const titleId = `${generatedId}-price-chart-title`;
  const descriptionId = `${generatedId}-price-chart-description`;
  const clipId = `${generatedId}-price-chart-clip`;
  const normalizedPoints = useMemo(() => normalizePoints(points), [points]);
  const series = useMemo(
    () => createSeries(normalizedPoints, showRange),
    [normalizedPoints, showRange],
  );
  const layout = createLayout(measuredWidth, chartHeight, series);
  const tickIndexes = selectTickIndexes(
    normalizedPoints.length,
    measuredWidth <= MOBILE_MAX_WIDTH ? MOBILE_MAX_TICKS : DESKTOP_MAX_TICKS,
  );
  const description = createDescription(
    accessibleLabel,
    normalizedPoints,
    currency,
    unit,
    showRange,
  );

  return (
    <div ref={containerRef} className="min-w-0 w-full" data-responsive-price-chart>
      {normalizedPoints.length === 0 ? (
        <div
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          className="flex w-full items-center justify-center rounded-[10px] bg-chipbg"
          style={{ height: chartHeight }}
          data-chart-width={measuredWidth}
        >
          <span id={titleId} className="sr-only">{accessibleLabel}</span>
          <span id={descriptionId} className="sr-only">{description}</span>
          <p className="m-0 text-caption text-ink-mute" data-empty-state>
            표시할 가격 데이터가 없어요
          </p>
        </div>
      ) : (
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${measuredWidth} ${chartHeight}`}
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          className="block w-full overflow-hidden rounded-[10px] bg-chipbg"
          data-chart-width={measuredWidth}
        >
        <title id={titleId}>{accessibleLabel}</title>
        <desc id={descriptionId}>{description}</desc>
        <defs>
          <clipPath id={clipId}>
            <rect
              x={layout.left - MARKER_GUTTER}
              y={layout.top - MARKER_GUTTER}
              width={layout.plotWidth + MARKER_GUTTER * 2}
              height={layout.plotHeight + MARKER_GUTTER * 2}
              data-chart-plot-clip
            />
          </clipPath>
        </defs>

        <line
          x1={layout.left}
          y1={layout.top}
          x2={layout.left}
          y2={layout.axisY}
          stroke="rgb(var(--c-line))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />
        <line
          x1={layout.left}
          y1={layout.axisY}
          x2={layout.rightEdge}
          y2={layout.axisY}
          stroke="rgb(var(--c-line))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />

        {normalizedPoints.length > 0 ? (
          <>
            {layout.yTicks.map((tick) => (
              <g key={tick.value} aria-hidden="true">
                <line
                  x1={layout.left}
                  y1={tick.y}
                  x2={layout.rightEdge}
                  y2={tick.y}
                  stroke="rgb(var(--c-line))"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={layout.left - 8}
                  y={tick.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="rgb(var(--c-ink-mute))"
                  fontSize="12"
                  data-axis="y"
                  data-axis-label
                >
                  {formatCompactCurrency(tick.value, currency)}
                </text>
              </g>
            ))}

            {tickIndexes.map((index) => {
              const point = normalizedPoints[index];
              const x = layout.xFor(index, normalizedPoints.length);
              const textAnchor = index === 0
                ? 'start'
                : index === normalizedPoints.length - 1
                  ? 'end'
                  : 'middle';
              return (
                <text
                  key={`${point.key}-tick`}
                  x={x}
                  y={chartHeight - 10}
                  textAnchor={textAnchor}
                  fill="rgb(var(--c-ink-mute))"
                  fontSize="12"
                  data-axis="x"
                  data-axis-label
                >
                  {point.dateLabel}
                </text>
              );
            })}

            <g clipPath={`url(#${clipId})`}>
              {series.map((entry) => {
                const path = buildSeriesPath(
                  entry.values,
                  layout,
                  normalizedPoints.length,
                );
                return (
                  <g key={entry.key} data-series={entry.key}>
                    <title>{entry.label}</title>
                    <path
                      d={path}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth="2.5"
                      strokeDasharray={entry.dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      data-series-line
                    />
                    {entry.values.map((value, index) => (
                      <SeriesMarker
                        key={`${entry.key}-${normalizedPoints[index].key}`}
                        x={layout.xFor(index, normalizedPoints.length)}
                        y={layout.yFor(value)}
                        color={entry.color}
                        shape={entry.shape}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          </>
        ) : null}
        </svg>
      )}

      {showRange && normalizedPoints.length > 0 ? (
        <ul
          className="m-0 mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-2 p-0"
          aria-label={`${accessibleLabel} 범례`}
        >
          {series.map((entry) => (
            <li key={entry.key} className="flex items-center gap-1.5 text-caption font-semibold text-ink-mute">
              <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true" className="flex-none overflow-visible">
                <line
                  x1="1"
                  y1="6"
                  x2="29"
                  y2="6"
                  stroke={entry.color}
                  strokeWidth="2"
                  strokeDasharray={entry.dash}
                />
                <LegendMarker color={entry.color} shape={entry.shape} />
              </svg>
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function useMeasuredWidth(containerRef: React.RefObject<HTMLDivElement>) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth(candidate: number) {
      if (!Number.isFinite(candidate) || candidate <= 0) return;
      const nextWidth = Math.max(1, Math.round(candidate));
      setWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
    }

    updateWidth(container.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => updateWidth(container.getBoundingClientRect().width);
      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === container) ?? entries[0];
      if (!entry) return;
      const contentBoxSize = entry.contentBoxSize as unknown as
        | ResizeObserverSize
        | readonly ResizeObserverSize[];
      const contentBox = Array.isArray(contentBoxSize) ? contentBoxSize[0] : contentBoxSize;
      updateWidth(contentBox?.inlineSize ?? entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return width;
}

function normalizeHeight(height: number) {
  if (!Number.isFinite(height) || height <= 0) return DEFAULT_HEIGHT;
  return Math.max(160, Math.round(height));
}

function normalizePoints(points: FishPriceTrendPoint[]) {
  return normalizePriceTrendPoints(points).map<NormalizedPoint>((point, index) => ({
    key: `${point.observedDate}-${index}`,
    observedDate: point.observedDate,
    dateLabel: formatDateLabel(point.observedDate, index),
    average: point.avgPriceKrw,
    minimum: point.priceMinKrw,
    maximum: point.priceMaxKrw,
  }));
}

function usablePrice(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function createSeries(points: NormalizedPoint[], showRange: boolean): ChartSeries[] {
  const average: ChartSeries = {
    ...SERIES_STYLE.average,
    values: points.map((point) => point.average),
  };
  if (!showRange) return [average];

  return [
    average,
    {
      ...SERIES_STYLE.minimum,
      values: points.map((point) => point.minimum),
    },
    {
      ...SERIES_STYLE.maximum,
      values: points.map((point) => point.maximum),
    },
  ];
}

function createLayout(width: number, height: number, series: ChartSeries[]) {
  const left = Math.min(52, width * 0.22);
  const right = Math.min(16, width * 0.07);
  const top = Math.min(20, height * 0.1);
  const bottom = Math.min(38, height * 0.2);
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const axisY = top + plotHeight;
  const values = series.flatMap((entry) => entry.values).filter(usablePrice);
  const rawMinimum = values.length > 0 ? Math.min(...values) : 0;
  const rawMaximum = values.length > 0 ? Math.max(...values) : 1;
  const span = rawMaximum - rawMinimum;
  const padding = span > 0 ? span * 0.08 : Math.max(1, rawMaximum * 0.05);
  const domainMinimum = Math.max(0, rawMinimum - padding);
  const domainMaximum = Math.max(domainMinimum + 1, rawMaximum + padding);
  const domainSpan = domainMaximum - domainMinimum;
  const yFor = (value: number) => top
    + (1 - (value - domainMinimum) / domainSpan) * plotHeight;
  const xFor = (index: number, pointCount: number) => pointCount <= 1
    ? left + plotWidth / 2
    : left + (index / (pointCount - 1)) * plotWidth;
  const yTickValues = Array.from(new Set(
    rawMinimum === rawMaximum
      ? [rawMinimum]
      : [rawMaximum, rawMinimum + span / 2, rawMinimum],
  ));

  return {
    left,
    top,
    plotWidth,
    plotHeight,
    axisY,
    rightEdge: left + plotWidth,
    xFor,
    yFor,
    yTicks: yTickValues.map((value) => ({ value, y: yFor(value) })),
  };
}

function selectTickIndexes(pointCount: number, maximumTicks: number) {
  if (pointCount <= 0) return [];
  if (pointCount <= maximumTicks) return Array.from({ length: pointCount }, (_, index) => index);
  return Array.from(
    new Set(
      Array.from({ length: maximumTicks }, (_, index) =>
        Math.round((index * (pointCount - 1)) / (maximumTicks - 1))),
    ),
  );
}

function buildSeriesPath(
  values: number[],
  layout: ReturnType<typeof createLayout>,
  pointCount: number,
) {
  return values
    .map((value, index) => {
      const x = layout.xFor(index, pointCount).toFixed(2);
      const y = layout.yFor(value).toFixed(2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function SeriesMarker({
  x,
  y,
  color,
  shape,
}: {
  x: number;
  y: number;
  color: string;
  shape: PointShape;
}) {
  const commonProps = {
    fill: 'rgb(var(--c-surface))',
    stroke: color,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  if (shape === 'square') {
    return (
      <rect
        x={x - 4}
        y={y - 4}
        width="8"
        height="8"
        {...commonProps}
        data-point-shape="square"
      />
    );
  }
  if (shape === 'triangle') {
    return (
      <path
        d={`M ${x.toFixed(2)} ${(y - 5).toFixed(2)} L ${(x + 5).toFixed(2)} ${(y + 4).toFixed(2)} L ${(x - 5).toFixed(2)} ${(y + 4).toFixed(2)} Z`}
        {...commonProps}
        strokeLinejoin="round"
        data-point-shape="triangle"
      />
    );
  }
  return <circle cx={x} cy={y} r="4" {...commonProps} data-point-shape="circle" />;
}

function LegendMarker({ color, shape }: { color: string; shape: PointShape }) {
  if (shape === 'square') {
    return <rect x="12" y="2" width="8" height="8" fill="rgb(var(--c-surface))" stroke={color} strokeWidth="2" data-legend-point-shape="square" />;
  }
  if (shape === 'triangle') {
    return <path d="M 16 1 L 21 10 L 11 10 Z" fill="rgb(var(--c-surface))" stroke={color} strokeWidth="2" strokeLinejoin="round" data-legend-point-shape="triangle" />;
  }
  return <circle cx="16" cy="6" r="4" fill="rgb(var(--c-surface))" stroke={color} strokeWidth="2" data-legend-point-shape="circle" />;
}

function formatDateLabel(value: string, index: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return `관측 ${index + 1}`;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
    return `관측 ${index + 1}`;
  }
  return `${month}/${day}`;
}

function formatCompactCurrency(value: number, currency: 'KRW') {
  return new Intl.NumberFormat('ko-KR', {
    notation: currency === 'KRW' ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number, currency: 'KRW') {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function createDescription(
  label: string,
  points: NormalizedPoint[],
  currency: 'KRW',
  unit: string | null | undefined,
  showRange: boolean,
) {
  if (points.length === 0) return `${label}. 표시할 유효한 가격 데이터가 없습니다.`;
  const values = points.flatMap((point) => showRange
    ? [point.minimum, point.average, point.maximum]
    : [point.average]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const unitDescription = unit ? `, 단위 ${unit}` : '';
  const periodDescription = points.length === 1
    ? ` 관측일 ${points[0].observedDate}.`
    : ` 기간 ${points[0].observedDate}부터 ${points[points.length - 1].observedDate}까지.`;
  const seriesDescription = showRange
    ? ' 평균은 실선과 원, 최저는 파선과 사각형, 최고는 점선과 삼각형으로 표시합니다.'
    : '';
  return `${label}.${periodDescription} 유효한 관측 ${points.length}개, ${formatCurrency(minimum, currency)}에서 ${formatCurrency(maximum, currency)}${unitDescription}.${seriesDescription}`;
}
