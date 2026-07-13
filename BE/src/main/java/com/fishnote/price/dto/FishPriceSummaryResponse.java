package com.fishnote.price.dto;

import java.util.List;

public record FishPriceSummaryResponse(
        Long fishId,
        int days,
        long observationCount,
        FishPriceObservationResponse latest,
        List<FishPriceObservationResponse> recent,
        List<FishPriceGraphPointResponse> dailyAverage,
        List<FishShopPriceSeriesResponse> byShop) {}
