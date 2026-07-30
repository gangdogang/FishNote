import { useMemo, useState } from 'react';
import { normalizePriceTrendPoints } from '../lib/priceTrend';
import type {
  FishPriceObservation,
  FishPriceSummary,
  FishPriceTrendPoint,
} from '../types/fish';
import PriceDataTable from './PriceDataTable';
import ResponsivePriceChart from './ResponsivePriceChart';
import ClaimSourceList from './ClaimSourceList';
import type { FishClaimSources } from '../types/source';
import { trackAnalyticsEvent } from '../lib/analytics';

export interface PriceSectionProps {
  fishId?: number;
  fishName: string;
  summary?: FishPriceSummary;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  onRetry: () => void;
  sourceClaim?: FishClaimSources;
}

interface PriceView {
  key: string;
  label: string;
  unit: string | null;
  points: FishPriceTrendPoint[];
  latest: FishPriceObservation | null;
}

export default function PriceSection({
  fishId,
  fishName,
  summary,
  isLoading,
  isFetching = false,
  isError,
  onRetry,
  sourceClaim,
}: PriceSectionProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const views = useMemo(() => createPriceViews(summary), [summary]);
  const selected = views.find((view) => view.key === selectedKey) ?? views[0];
  const hasSummary = summary !== undefined;
  const hasCollectedPrices = Boolean(
    summary
      && (
        summary.observationCount > 0
        || summary.latest
        || summary.recent.length > 0
        || summary.byShop.length > 0
        || views.some((view) => view.points.length > 0)
      ),
  );
  const showInitialLoading = isLoading && !hasSummary;
  const showInitialError = isError && !hasSummary;
  const showUnavailable = !hasSummary && !isLoading && !isError;

  function selectView(key: string) {
    if (key === selected?.key) return;
    setSelectedKey(key);
    if (typeof fishId === 'number' && Number.isFinite(fishId)) {
      trackAnalyticsEvent('price_variant_selected', {
        fishId,
        variantKey: key.startsWith('variant:') ? key.slice('variant:'.length) : key,
      });
    }
  }

  return (
    <section
      id="price-section"
      className="mt-11 scroll-mt-[var(--detail-scroll-offset)]"
      aria-labelledby="price-section-heading"
    >
      <div className="mb-3.5 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <h2 id="price-section-heading" className="m-0 text-19 font-extrabold tracking-normal text-ink">
          가격 현황
        </h2>
        {summary ? (
          <span className="rounded-full bg-chipbg px-3 py-1.5 text-caption font-semibold tabular-nums text-ink-mute">
            최근 {summary.days}일 · {normalizeCount(summary.observationCount)}건
          </span>
        ) : null}
      </div>

      {summary ? <PriceFreshness summary={summary} /> : null}

      {showInitialLoading ? <PriceLoadingState /> : null}
      {showInitialError ? (
        <PriceErrorState isFetching={isFetching} onRetry={onRetry} />
      ) : null}
      {showUnavailable ? (
        <PriceErrorState isFetching={isFetching} onRetry={onRetry} />
      ) : null}

      {hasSummary && isError ? (
        <RefreshNotice
          message="최신 가격을 불러오지 못해 이전 내용을 보여드려요."
          isFetching={isFetching}
          onRetry={onRetry}
        />
      ) : null}
      {hasSummary && !isError && isFetching ? (
        <p role="status" aria-live="polite" className="m-0 mb-3 text-body-sm text-ink-mute">
          가격 정보를 갱신하는 중...
        </p>
      ) : null}

      {summary && !hasCollectedPrices ? (
        <PriceEmptyState summary={summary} />
      ) : null}

      {hasSummary && hasCollectedPrices && summary && selected ? (
        <>
          <article className="rounded-card border border-line bg-surface px-4 py-4 sm:px-5">
            {views.length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="가격 규격 선택">
                {views.map((view) => (
                  <VariantButton
                    key={view.key}
                    label={view.label}
                    active={view.key === selected.key}
                    onClick={() => selectView(view.key)}
                  />
                ))}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-end">
              <PriceHeadline fishName={fishName} view={selected} />
              <ResponsivePriceChart
                points={selected.points}
                label={`${fishName} ${selected.label} 가격 추이`}
                currency={summary.currency ?? 'KRW'}
                unit={selected.unit}
                showRange
              />
            </div>

            <div className="mt-4">
              <PriceDataTable
                points={selected.points}
                label={`${fishName} ${selected.label}`}
                currency={summary.currency ?? 'KRW'}
                unit={selected.unit}
              />
            </div>
          </article>

          <ObservationCards summary={summary} />

          <p className="m-0 mt-3 text-xs leading-[1.7] text-ink-mute">
            상회에서 관측한 참고 가격이에요. 실제 판매가는 중량·손질·포장 방식에 따라 달라질 수 있어요.
          </p>
        </>
      ) : null}

      <ClaimSourceList claim={sourceClaim} compact fishId={fishId} />
    </section>
  );
}

function createPriceViews(summary?: FishPriceSummary): PriceView[] {
  if (!summary) return [];
  const variants = (summary.byVariant ?? []).flatMap((variant) => {
    const points = normalizePriceTrendPoints(variant.graph ?? []);
    if (points.length === 0) return [];
    return [{
      key: `variant:${variant.variantKey}`,
      label: variant.unit ? `${variant.variantLabel} · ${variant.unit}` : variant.variantLabel,
      unit: variant.unit?.trim() || null,
      points,
      latest: variant.latest ?? null,
    }];
  });
  if (variants.length > 0) return variants;

  return [{
    key: 'daily',
    label: '일별 평균',
    unit: summary.normalizedUnit?.trim() || summary.latest?.unit?.trim() || null,
    points: normalizePriceTrendPoints(summary.dailyAverage ?? []),
    latest: summary.latest,
  }];
}

function PriceFreshness({ summary }: { summary: FishPriceSummary }) {
  const asOf = validObservedAt(summary.asOf) ?? validObservedAt(summary.latest?.observedAt);
  const resolution = resolutionLabel(summary.resolution ?? 'DAY');
  const maxPoints = normalizeCount(summary.maxPoints ?? 30);
  const sourceCount = summary.sourceCount === undefined
    ? inferredSourceCount(summary)
    : normalizeCount(summary.sourceCount);
  const currency = summary.currency ?? 'KRW';
  const normalizedUnit = summary.normalizedUnit?.trim() || summary.latest?.unit?.trim() || null;
  const variant = formatVariantKey(summary.variantKey);

  return (
    <aside
      aria-label="가격 데이터 기준"
      className="mb-3 rounded-btn border border-line bg-surface px-3.5 py-3 text-xs leading-relaxed text-ink-mute"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-bold text-ink">
          {asOf ? <time dateTime={asOf}>{formatObservedAt(asOf)} 기준</time> : '관측 기준 시각 없음'}
        </span>
        <span aria-hidden>·</span>
        <span>{resolution} 최대 {maxPoints}개 지점</span>
        <span aria-hidden>·</span>
        <span>출처 {sourceCount}곳</span>
        <span aria-hidden>·</span>
        <span>{currency}{normalizedUnit ? ` / ${normalizedUnit}` : ''}</span>
      </div>
      {variant ? (
        <p className="m-0 mt-1 break-words [overflow-wrap:anywhere]">선택 규격 {variant}</p>
      ) : null}
    </aside>
  );
}

function PriceEmptyState({ summary }: { summary: FishPriceSummary }) {
  const variant = formatVariantKey(summary.variantKey);
  const message = summary.noDataReason === 'VARIANT_NOT_FOUND'
    ? `선택한 규격${variant ? `(${variant})` : ''}과 일치하는 시세가 없습니다`
    : summary.noDataReason === 'NO_OBSERVATIONS_IN_RANGE'
      ? `최근 ${normalizeCount(summary.days)}일 범위에는 수집된 시세가 없습니다`
      : '아직 수집된 시세가 없습니다';

  return (
    <div
      aria-live="polite"
      className="rounded-card border border-dashed border-line bg-surface px-5 py-10 text-center"
    >
      <p className="m-0 text-body-sm text-ink-mute">{message}</p>
    </div>
  );
}

function VariantButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-1 text-caption font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        active ? 'bg-primary text-on-primary' : 'bg-chipbg text-ink hover:text-accent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function PriceHeadline({ fishName, view }: { fishName: string; view: PriceView }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-13 font-semibold text-ink-mute">{fishName} 최신 관측가 · {view.label}</p>
      {view.latest ? (
        <>
          <p className="m-0 mt-1 break-words text-28 font-extrabold leading-tight tabular-nums text-ink [overflow-wrap:anywhere]">
            {formatObservedPrice(view.latest)}
            {view.unit ? <span className="ml-1 text-15 font-semibold text-ink-mute">/ {view.unit}</span> : null}
          </p>
          <p className="m-0 mt-2 text-13 leading-[1.6] text-ink-mute">
            {view.latest.shopName ?? view.latest.sourceLabel} · {formatObservedAt(view.latest.observedAt)}
          </p>
        </>
      ) : (
        <p className="m-0 mt-2 text-body-sm text-ink-mute">이 규격의 최근 관측가를 준비 중이에요.</p>
      )}
    </div>
  );
}

function ObservationCards({ summary }: { summary: FishPriceSummary }) {
  const shops = summary.byShop ?? [];
  const observations = shops.length > 0
    ? shops.map((shop) => ({ observation: shop.latest, label: shop.shopName, meta: `${shop.observationCount}건 관측` }))
    : summary.recent.slice(0, 3).map((observation, index) => ({
        observation,
        label: index === 0 ? '가장 최근' : (observation.shopName ?? observation.sourceLabel),
        meta: undefined,
      }));
  if (observations.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
      {observations.map(({ observation, label, meta }, index) => (
        <PriceObservationCard
          key={`${label}-${observation.observedAt}-${index}`}
          observation={observation}
          label={label}
          meta={meta}
        />
      ))}
    </div>
  );
}

function PriceObservationCard({ observation, label, meta }: {
  observation: FishPriceObservation;
  label: string;
  meta?: string;
}) {
  const details = [observation.origin, observation.sizeGrade, observation.unit ? `${observation.unit} 기준` : null]
    .filter(Boolean);
  return (
    <article className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-ink-mute">{label}</span>
        <time dateTime={observation.observedAt} className="text-caption tabular-nums text-ink-mute">
          {formatObservedAt(observation.observedAt)}
        </time>
      </div>
      <p className="m-0 break-words text-lg font-extrabold tabular-nums tracking-tight text-ink [overflow-wrap:anywhere]">
        {formatObservedPrice(observation)}
      </p>
      <p className="m-0 mt-1 min-h-5 text-xs leading-5 text-ink-mute">
        {details.length > 0 ? details.join(' · ') : '세부 규격 정보 없음'}
      </p>
      {meta ? <p className="m-0 mt-2 text-caption font-semibold text-ink-mute">{meta}</p> : null}
    </article>
  );
}

function PriceLoadingState() {
  return (
    <div role="status" aria-label="가격 정보를 불러오는 중" aria-busy="true" className="rounded-card border border-line bg-surface p-4">
      <div className="h-5 w-40 animate-pulse rounded bg-chipbg motion-reduce:animate-none" />
      <div className="mt-4 h-60 animate-pulse rounded-[10px] bg-chipbg motion-reduce:animate-none" />
    </div>
  );
}

function PriceErrorState({ isFetching, onRetry }: { isFetching: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-line bg-surface px-5 py-10 text-center">
      <p className="m-0 text-body-sm text-ink-mute">가격 정보를 불러오지 못했어요.</p>
      <RetryButton isFetching={isFetching} onRetry={onRetry} label="가격 다시 시도" />
    </div>
  );
}

function RefreshNotice({ message, isFetching, onRetry }: {
  message: string;
  isFetching: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-surface px-3 py-2.5">
      <p className="m-0 text-body-sm text-ink-mute">{message}</p>
      <RetryButton isFetching={isFetching} onRetry={onRetry} label="다시 시도" compact />
    </div>
  );
}

function RetryButton({ isFetching, onRetry, label, compact = false }: {
  isFetching: boolean;
  onRetry: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={isFetching}
      aria-busy={isFetching}
      className={[
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn text-body-sm font-bold text-accent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-60',
        compact ? 'px-2 hover:text-accent-hover' : 'mt-4 border border-accent bg-surface px-5 py-2.5 hover:bg-accent-soft focus-visible:ring-offset-2',
      ].join(' ')}
    >
      {isFetching ? '다시 불러오는 중...' : label}
    </button>
  );
}

function formatObservedPrice(observation: FishPriceObservation) {
  const format = (value: number) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  return observation.priceMinKrw === observation.priceMaxKrw
    ? format(observation.priceMinKrw)
    : `${format(observation.priceMinKrw)}–${format(observation.priceMaxKrw)}`;
}

function formatObservedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '관측 시각 미상';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function validObservedAt(value: string | null | undefined) {
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function resolutionLabel(resolution: NonNullable<FishPriceSummary['resolution']>) {
  return ({ DAY: '일별', WEEK: '주별', MONTH: '월별' } as const)[resolution];
}

function formatVariantKey(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return value.split('|').map((part) => part.trim()).filter(Boolean).join(' · ') || value.trim();
}

function inferredSourceCount(summary: FishPriceSummary) {
  const labels = [
    ...summary.byShop.map((shop) => shop.shopName),
    ...summary.recent.map((observation) => observation.shopName ?? observation.sourceLabel),
    summary.latest?.shopName ?? summary.latest?.sourceLabel,
  ].filter((label): label is string => Boolean(label?.trim()));
  return new Set(labels).size;
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
