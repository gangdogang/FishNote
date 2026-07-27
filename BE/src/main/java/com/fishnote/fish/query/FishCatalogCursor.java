package com.fishnote.fish.query;

import java.math.BigDecimal;

public record FishCatalogCursor(
        int version,
        String sort,
        Long reviewCount,
        BigDecimal avgRating,
        String name,
        Long id
) {
}
