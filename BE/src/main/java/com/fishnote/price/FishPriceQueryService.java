package com.fishnote.price;

import com.fishnote.common.NotFoundException;
import com.fishnote.fish.FishRepository;
import com.fishnote.price.dto.FishPriceGraphPointResponse;
import com.fishnote.price.dto.FishPriceObservationResponse;
import com.fishnote.price.dto.FishPriceSummaryResponse;
import com.fishnote.price.dto.FishShopPriceSeriesResponse;
import com.fishnote.price.dto.FishVariantPriceSeriesResponse;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class FishPriceQueryService {

    private static final int DEFAULT_DAYS = 14;
    private static final int MAX_DAYS = 30;
    private static final int DEFAULT_MAX_POINTS = 30;
    private static final int MAX_POINTS = 200;
    private static final int MAX_RECENT_OBSERVATIONS = 20;
    private static final String PUBLIC_SOURCE_LABEL = "상회 시세";
    private static final String CURRENCY = "KRW";

    private final ShopPriceObservationRepository observationRepository;
    private final FishRepository fishRepository;

    public FishPriceQueryService(
            ShopPriceObservationRepository observationRepository, FishRepository fishRepository) {
        this.observationRepository = observationRepository;
        this.fishRepository = fishRepository;
    }

    public FishPriceSummaryResponse getRecentPrices(Long fishId, Integer requestedDays) {
        return getRecentPrices(fishId, requestedDays, PriceResolution.DAY, null, null);
    }

    public FishPriceSummaryResponse getRecentPrices(
            Long fishId,
            Integer requestedDays,
            PriceResolution requestedResolution,
            Integer requestedMaxPoints,
            String requestedVariantKey) {
        if (!fishRepository.existsById(fishId)) {
            throw new NotFoundException("횟감을 찾을 수 없습니다.");
        }

        int days = clamp(requestedDays, DEFAULT_DAYS, 1, MAX_DAYS);
        int maxPoints = clamp(requestedMaxPoints, DEFAULT_MAX_POINTS, 1, MAX_POINTS);
        PriceResolution resolution = requestedResolution == null ? PriceResolution.DAY : requestedResolution;
        String variantFilter = blankToNull(requestedVariantKey);
        OffsetDateTime observedAfter = OffsetDateTime.now(ShopPriceParser.KST).minusDays(days);

        // One projection query supplies latest/recent/count/graphs and never selects raw_text.
        List<PriceRow> allRows = observationRepository.findPriceRows(fishId, observedAfter);
        List<PriceRow> selectedRows = variantFilter == null
                ? allRows
                : allRows.stream().filter(row -> variantKey(row).equals(variantFilter)).toList();

        PriceNoDataReason noDataReason = null;
        if (allRows.isEmpty()) {
            noDataReason = PriceNoDataReason.NO_OBSERVATIONS_IN_RANGE;
        } else if (selectedRows.isEmpty()) {
            noDataReason = PriceNoDataReason.VARIANT_NOT_FOUND;
        }

        List<FishPriceObservationResponse> recent = selectedRows.stream()
                .sorted(Comparator.comparing(PriceRow::getObservedAt).reversed())
                .limit(MAX_RECENT_OBSERVATIONS)
                .map(this::toResponse)
                .toList();
        FishPriceObservationResponse latest = recent.isEmpty() ? null : recent.get(0);

        return new FishPriceSummaryResponse(
                fishId,
                days,
                resolution,
                maxPoints,
                variantFilter,
                latest == null ? null : latest.observedAt(),
                CURRENCY,
                normalizedUnit(selectedRows),
                sourceCount(selectedRows),
                noDataReason,
                selectedRows.size(),
                latest,
                recent,
                toGraph(selectedRows, resolution, maxPoints),
                toShopSeries(selectedRows, resolution, maxPoints),
                toVariantSeries(selectedRows, resolution, maxPoints));
    }

    private int clamp(Integer requested, int fallback, int min, int max) {
        int value = requested == null ? fallback : requested;
        return Math.max(min, Math.min(max, value));
    }

    private FishPriceObservationResponse toResponse(PriceRow row) {
        return new FishPriceObservationResponse(
                row.getObservedAt(),
                row.getPriceMinKrw(),
                row.getPriceMaxKrw(),
                normalizeUnit(row.getUnit()),
                row.getOrigin(),
                row.getSizeGrade(),
                PUBLIC_SOURCE_LABEL,
                shopName(row));
    }

    private List<FishPriceGraphPointResponse> toGraph(
            List<PriceRow> observations, PriceResolution resolution, int maxPoints) {
        Map<LocalDate, List<PriceRow>> byBucket = new LinkedHashMap<>();
        observations.stream()
                .sorted(Comparator.comparing(PriceRow::getObservedAt))
                .forEach(row -> byBucket
                        .computeIfAbsent(bucketDate(row, resolution), ignored -> new ArrayList<>())
                        .add(row));

        List<FishPriceGraphPointResponse> points = byBucket.entrySet().stream()
                .map(entry -> toGraphPoint(entry.getKey(), entry.getValue()))
                .toList();
        return reducePoints(points, maxPoints);
    }

    private List<FishShopPriceSeriesResponse> toShopSeries(
            List<PriceRow> observations, PriceResolution resolution, int maxPoints) {
        Map<String, List<PriceRow>> byShop = new LinkedHashMap<>();
        observations.stream()
                .sorted(Comparator.comparing(PriceRow::getObservedAt))
                .forEach(row -> byShop.computeIfAbsent(shopName(row), ignored -> new ArrayList<>()).add(row));

        return byShop.entrySet().stream()
                .map(entry -> {
                    List<PriceRow> shopRows = entry.getValue();
                    PriceRow latest = shopRows.stream()
                            .max(Comparator.comparing(PriceRow::getObservedAt))
                            .orElseThrow();
                    return new FishShopPriceSeriesResponse(
                            entry.getKey(),
                            shopRows.size(),
                            toResponse(latest),
                            toGraph(shopRows, resolution, maxPoints));
                })
                .sorted(Comparator.comparingLong(FishShopPriceSeriesResponse::observationCount)
                        .reversed()
                        .thenComparing(FishShopPriceSeriesResponse::shopName))
                .toList();
    }

    private List<FishVariantPriceSeriesResponse> toVariantSeries(
            List<PriceRow> observations, PriceResolution resolution, int maxPoints) {
        Map<String, List<PriceRow>> byVariant = new LinkedHashMap<>();
        observations.stream()
                .sorted(Comparator.comparing(PriceRow::getObservedAt))
                .forEach(row -> byVariant.computeIfAbsent(variantKey(row), ignored -> new ArrayList<>()).add(row));

        return byVariant.entrySet().stream()
                .map(entry -> {
                    List<PriceRow> variantRows = entry.getValue();
                    PriceRow latest = variantRows.stream()
                            .max(Comparator.comparing(PriceRow::getObservedAt))
                            .orElseThrow();
                    return new FishVariantPriceSeriesResponse(
                            entry.getKey(),
                            variantLabel(latest),
                            farming(latest),
                            blankToEmpty(latest.getOrigin()),
                            normalizeUnit(latest.getUnit()),
                            variantRows.size(),
                            toResponse(latest),
                            toGraph(variantRows, resolution, maxPoints));
                })
                .sorted(Comparator.comparingLong(FishVariantPriceSeriesResponse::observationCount)
                        .reversed()
                        .thenComparing(FishVariantPriceSeriesResponse::variantKey))
                .toList();
    }

    private String variantKey(PriceRow row) {
        return String.join(
                "|",
                farming(row),
                blankToEmpty(row.getOrigin()),
                normalizeUnit(row.getUnit()));
    }

    private String variantLabel(PriceRow row) {
        List<String> parts = new ArrayList<>();
        String origin = blankToEmpty(row.getOrigin());
        String farming = farming(row);
        if (!origin.isBlank()) {
            parts.add(origin);
        }
        if (!farming.isBlank()) {
            parts.add(farming);
        }
        return parts.isEmpty() ? "구분 없음" : String.join(" ", parts);
    }

    private String farming(PriceRow row) {
        String condition = row.getCondition() == null ? "" : row.getCondition();
        if (condition.contains("자연산")) {
            return "자연산";
        }
        if (condition.contains("양식")) {
            return "양식";
        }
        return "";
    }

    private FishPriceGraphPointResponse toGraphPoint(LocalDate observedDate, List<PriceRow> observations) {
        int min = observations.stream().mapToInt(PriceRow::getPriceMinKrw).min().orElse(0);
        int max = observations.stream().mapToInt(PriceRow::getPriceMaxKrw).max().orElse(0);
        double avg = observations.stream()
                .mapToInt(row -> (row.getPriceMinKrw() + row.getPriceMaxKrw()) / 2)
                .average()
                .orElse(0);
        return new FishPriceGraphPointResponse(
                observedDate, min, max, (int) Math.round(avg), observations.size());
    }

    private List<FishPriceGraphPointResponse> reducePoints(
            List<FishPriceGraphPointResponse> points, int maxPoints) {
        if (points.size() <= maxPoints) {
            return points;
        }
        int groupSize = (int) Math.ceil((double) points.size() / maxPoints);
        List<FishPriceGraphPointResponse> reduced = new ArrayList<>();
        for (int start = 0; start < points.size(); start += groupSize) {
            List<FishPriceGraphPointResponse> group = points.subList(start, Math.min(start + groupSize, points.size()));
            int min = group.stream().mapToInt(FishPriceGraphPointResponse::priceMinKrw).min().orElse(0);
            int max = group.stream().mapToInt(FishPriceGraphPointResponse::priceMaxKrw).max().orElse(0);
            long count = group.stream().mapToLong(FishPriceGraphPointResponse::observationCount).sum();
            long weightedTotal = group.stream()
                    .mapToLong(point -> (long) point.avgPriceKrw() * point.observationCount())
                    .sum();
            reduced.add(new FishPriceGraphPointResponse(
                    group.get(0).observedDate(),
                    min,
                    max,
                    count == 0 ? 0 : (int) Math.round((double) weightedTotal / count),
                    count));
        }
        return List.copyOf(reduced);
    }

    private LocalDate bucketDate(PriceRow row, PriceResolution resolution) {
        LocalDate date = row.getObservedAt().withOffsetSameInstant(ShopPriceParser.KST).toLocalDate();
        return switch (resolution) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
        };
    }

    private String normalizedUnit(List<PriceRow> rows) {
        Set<String> units = new LinkedHashSet<>();
        rows.stream()
                .map(PriceRow::getUnit)
                .map(this::normalizeUnit)
                .filter(unit -> !unit.isBlank())
                .forEach(units::add);
        if (units.isEmpty()) {
            return null;
        }
        return units.size() == 1 ? units.iterator().next() : "MIXED";
    }

    private long sourceCount(List<PriceRow> rows) {
        return rows.stream().map(this::shopName).distinct().count();
    }

    private String normalizeUnit(String value) {
        String unit = blankToEmpty(value).toLowerCase();
        return switch (unit) {
            case "k", "키로", "킬로", "kg." -> "kg";
            case "그램", "g." -> "g";
            default -> unit;
        };
    }

    private String shopName(PriceRow row) {
        return row.getSourceName() == null || row.getSourceName().isBlank()
                ? "미확인 상회"
                : row.getSourceName().trim();
    }

    private String blankToEmpty(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }

    private String blankToNull(String value) {
        String normalized = blankToEmpty(value);
        return normalized.isEmpty() ? null : normalized;
    }
}
