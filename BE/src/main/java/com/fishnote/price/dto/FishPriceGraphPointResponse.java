package com.fishnote.price.dto;

import java.time.LocalDate;

public record FishPriceGraphPointResponse(
        LocalDate observedDate,
        int priceMinKrw,
        int priceMaxKrw,
        int avgPriceKrw,
        long observationCount) {}
