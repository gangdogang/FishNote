package com.fishnote.fish.query;

import com.fishnote.fish.dto.FishFacetsResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import java.math.BigDecimal;
import java.util.List;

public record FishCatalogSlice(
        List<FishSummaryResponse> items,
        FishFacetsResponse facets,
        boolean hasNext,
        Long lastReviewCount,
        BigDecimal lastAvgRating,
        String lastName,
        Long lastId
) {
}
