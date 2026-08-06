package com.fishnote.tasting.dto;

public record TastingStatsResponse(
        long totalEntries,
        long distinctFishCount,
        long currentMonthEntries) {
}
