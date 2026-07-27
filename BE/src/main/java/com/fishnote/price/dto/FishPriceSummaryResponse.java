package com.fishnote.price.dto;

import com.fishnote.price.PriceNoDataReason;
import com.fishnote.price.PriceResolution;
import java.time.OffsetDateTime;
import java.util.List;

public record FishPriceSummaryResponse(
        Long fishId,
        int days,
        PriceResolution resolution,
        int maxPoints,
        String variantKey,
        OffsetDateTime asOf,
        String currency,
        String normalizedUnit,
        long sourceCount,
        PriceNoDataReason noDataReason,
        long observationCount,
        FishPriceObservationResponse latest,
        List<FishPriceObservationResponse> recent,
        List<FishPriceGraphPointResponse> dailyAverage,
        List<FishShopPriceSeriesResponse> byShop,
        List<FishVariantPriceSeriesResponse> byVariant) {}
