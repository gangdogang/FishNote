package com.fishnote.fish.dto;

import com.fishnote.fish.FishCategory;
import java.util.List;

public record FishSummaryResponse(
        Long id,
        String slug,
        FishCategory category,
        String name,
        FishMediaResponse media,
        String imageUrl,
        String description,
        Short priceLevel,
        List<String> tasteTags,
        List<Short> seasonMonths,
        boolean featured,
        double avgRating,
        long reviewCount,
        long ratingCount
) {
}
