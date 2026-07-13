package com.fishnote.price.dto;

import java.time.OffsetDateTime;

public record FishPriceObservationResponse(
        OffsetDateTime observedAt,
        int priceMinKrw,
        int priceMaxKrw,
        String unit,
        String origin,
        String sizeGrade,
        String sourceLabel,
        String shopName) {}
