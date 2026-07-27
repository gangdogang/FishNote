import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishPriceTrendPoint } from '../types/fish';
import ResponsivePriceChart from './ResponsivePriceChart';

const defaultResizeObserver = globalThis.ResizeObserver;
let resizeCallback: ResizeObserverCallback | undefined;
let observedElement: Element | undefined;

const resizeObserverArgument: ResizeObserver = {
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
};

class ControlledResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  disconnect = vi.fn();
  unobserve = vi.fn();
  observe = vi.fn((target: Element) => {
    observedElement = target;
  });
}

const samplePoints: FishPriceTrendPoint[] = Array.from({ length: 7 }, (_, index) => ({
  observedDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
  priceMinKrw: 20_000 + index * 1_000,
  priceMaxKrw: 30_000 + index * 1_000,
  avgPriceKrw: 25_000 + index * 1_000,
  observationCount: 2,
}));

function resizeChart(width: number) {
  const callback = resizeCallback;
  const target = observedElement;
  if (!callback || !target) {
    throw new Error('ResizeObserver was not connected');
  }
  const contentRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 240,
    width,
    height: 240,
    toJSON: () => ({}),
  } as DOMRectReadOnly;
  const entry = {
    target,
    contentRect,
    contentBoxSize: [{ inlineSize: width, blockSize: 240 }],
    borderBoxSize: [{ inlineSize: width, blockSize: 240 }],
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 240 }],
  } as unknown as ResizeObserverEntry;

  act(() => callback([entry], resizeObserverArgument));
}

function expectFiniteMarkup(container: HTMLElement) {
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
}

describe('ResponsivePriceChart', () => {
  beforeEach(() => {
    resizeCallback = undefined;
    observedElement = undefined;
    vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
  });

  afterEach(() => {
    vi.stubGlobal('ResizeObserver', defaultResizeObserver);
  });

  it('uses the observed width, labelled SVG, 12px axes, and at most four mobile ticks', () => {
    const { container } = render(
      <ResponsivePriceChart
        points={samplePoints}
        label="광어 가격 추이"
        currency="KRW"
        unit="kg"
        height={220}
      />,
    );

    resizeChart(480);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute('width', '100%');
    expect(chart).toHaveAttribute('height', '220');
    expect(chart).toHaveAttribute('viewBox', '0 0 480 220');
    const labelledBy = chart.getAttribute('aria-labelledby')?.split(' ') ?? [];
    expect(labelledBy).toHaveLength(2);
    expect(document.getElementById(labelledBy[0])).toHaveTextContent('광어 가격 추이');
    expect(document.getElementById(labelledBy[1])).toHaveTextContent('기간 2026-07-01부터 2026-07-07까지');
    expect(document.getElementById(labelledBy[1])).toHaveTextContent('유효한 관측 7개');

    const xTicks = container.querySelectorAll('[data-axis="x"]');
    expect(xTicks.length).toBeLessThanOrEqual(4);
    const axisLabels = container.querySelectorAll('[data-axis-label]');
    expect(axisLabels.length).toBeGreaterThan(0);
    axisLabels.forEach((axisLabel) => {
      expect(Number(axisLabel.getAttribute('font-size'))).toBeGreaterThanOrEqual(12);
    });

    resizeChart(720);
    expect(chart).toHaveAttribute('viewBox', '0 0 720 220');
    expect(container.querySelectorAll('[data-axis="x"]').length).toBeLessThanOrEqual(6);
  });

  it('keeps empty, one-point, identical, and invalid values finite', () => {
    const { container, rerender } = render(
      <ResponsivePriceChart points={[]} label="빈 차트" currency="KRW" />,
    );
    resizeChart(320);
    expect(container.querySelector('[data-empty-state]')).toHaveTextContent('표시할 가격 데이터가 없어요');
    expectFiniteMarkup(container);

    rerender(
      <ResponsivePriceChart
        points={[samplePoints[0]]}
        label="한 점 차트"
        currency="KRW"
      />,
    );
    expect(container.querySelectorAll('[data-point-shape="circle"]')).toHaveLength(1);
    expect(container.querySelector('[data-empty-state]')).not.toBeInTheDocument();
    expectFiniteMarkup(container);

    const identical = samplePoints.slice(0, 3).map((point) => ({
      ...point,
      priceMinKrw: 20_000,
      priceMaxKrw: 20_000,
      avgPriceKrw: 20_000,
    }));
    rerender(
      <ResponsivePriceChart points={identical} label="동일 가격" currency="KRW" showRange />,
    );
    expectFiniteMarkup(container);

    const invalid: FishPriceTrendPoint[] = [
      {
        ...samplePoints[0],
        priceMinKrw: Number.NaN,
        priceMaxKrw: Number.POSITIVE_INFINITY,
        avgPriceKrw: Number.NEGATIVE_INFINITY,
      },
      {
        ...samplePoints[1],
        observedDate: 'not-a-date',
        priceMinKrw: Number.NaN,
        priceMaxKrw: Number.POSITIVE_INFINITY,
        avgPriceKrw: 22_000,
      },
    ];
    rerender(
      <ResponsivePriceChart points={invalid} label="비정상 값" currency="KRW" showRange />,
    );
    expect(container.querySelectorAll('[data-point-shape="circle"]')).toHaveLength(0);
    expect(container.querySelector('[data-empty-state]')).toBeInTheDocument();
    expectFiniteMarkup(container);
  });

  it('distinguishes average, minimum, and maximum with color, dash, and point shape without animation', () => {
    const { container } = render(
      <ResponsivePriceChart
        points={samplePoints.slice(0, 3)}
        label="광어 범위"
        currency="KRW"
        showRange
      />,
    );
    resizeChart(400);

    const average = container.querySelector('[data-series="average"]');
    const minimum = container.querySelector('[data-series="minimum"]');
    const maximum = container.querySelector('[data-series="maximum"]');
    expect(average).toBeInTheDocument();
    expect(minimum).toBeInTheDocument();
    expect(maximum).toBeInTheDocument();

    const averageLine = average?.querySelector('[data-series-line]');
    const minimumLine = minimum?.querySelector('[data-series-line]');
    const maximumLine = maximum?.querySelector('[data-series-line]');
    expect(averageLine?.getAttribute('stroke')).not.toBe(minimumLine?.getAttribute('stroke'));
    expect(minimumLine?.getAttribute('stroke')).not.toBe(maximumLine?.getAttribute('stroke'));
    expect(averageLine).not.toHaveAttribute('stroke-dasharray');
    expect(minimumLine).toHaveAttribute('stroke-dasharray', '6 4');
    expect(maximumLine).toHaveAttribute('stroke-dasharray', '2 4');
    expect(average?.querySelector('[data-point-shape="circle"]')).toBeInTheDocument();
    expect(minimum?.querySelector('[data-point-shape="square"]')).toBeInTheDocument();
    expect(maximum?.querySelector('[data-point-shape="triangle"]')).toBeInTheDocument();

    expect(screen.getByRole('list', { name: '광어 범위 범례' })).toHaveTextContent('평균최저최고');
    expect(container.querySelector('animate, animateMotion, animateTransform')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('animate-');

    const clip = container.querySelector('[data-chart-plot-clip]');
    const firstMarker = average?.querySelector('[data-point-shape="circle"]');
    const averageMarkers = average?.querySelectorAll('[data-point-shape="circle"]') ?? [];
    const lastMarker = averageMarkers[averageMarkers.length - 1];
    const clipLeft = Number(clip?.getAttribute('x'));
    const clipRight = clipLeft + Number(clip?.getAttribute('width'));
    expect(Number(firstMarker?.getAttribute('cx')) - 4).toBeGreaterThanOrEqual(clipLeft);
    expect(Number(lastMarker?.getAttribute('cx')) + 4).toBeLessThanOrEqual(clipRight);
  });

  it('keeps compact KRW labels and mobile ticks inside a 320px chart for very large values', () => {
    const hugePoints = samplePoints.slice(0, 5).map((point, index) => ({
      ...point,
      priceMinKrw: Number.MAX_SAFE_INTEGER - 20_000 + index,
      priceMaxKrw: Number.MAX_SAFE_INTEGER - 10_000 + index,
      avgPriceKrw: Number.MAX_SAFE_INTEGER - 15_000 + index,
    }));
    const { container } = render(
      <ResponsivePriceChart points={hugePoints} label="큰 가격" currency="KRW" showRange />,
    );
    resizeChart(320);

    expect(container.querySelector('svg[role="img"]')).toHaveClass('overflow-hidden');
    expect(container.querySelectorAll('[data-axis="x"]').length).toBeLessThanOrEqual(4);
    container.querySelectorAll('[data-axis="y"]').forEach((label) => {
      expect(label.textContent?.length ?? 0).toBeLessThanOrEqual(8);
    });
    expectFiniteMarkup(container);
  });
});
