package com.fishnote.tasting.dto;

import java.util.List;

public record TastingEntryPageResponse(
        List<TastingEntryResponse> items,
        int page,
        int size,
        long totalCount,
        boolean hasNext,
        TastingStatsResponse stats) {
}
