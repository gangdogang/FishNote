package com.fishnote.fish.dto;

import java.util.List;

public record SimilarFishResponse(
        Long id,
        String slug,
        String name,
        FishMediaResponse media,
        String imageUrl,
        Short priceLevel,
        double avgRating,
        long ratingCount,
        List<Short> seasonMonths
) {
}
