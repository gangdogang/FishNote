package com.fishnote.price.dto;

import java.util.List;

public record FishShopPriceSeriesResponse(
        String shopName,
        long observationCount,
        FishPriceObservationResponse latest,
        List<FishPriceGraphPointResponse> graph) {}
