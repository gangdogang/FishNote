package com.fishnote.fish.dto;

import com.fishnote.fish.FishCategory;
import java.util.List;
import java.util.Map;

public record FishDetailResponse(
        Long id,
        String slug,
        FishCategory category,
        String name,
        String nameEn,
        String scientificName,
        List<String> aliases,
        FishMediaResponse media,
        String imageUrl,
        List<String> images,
        List<FishMediaResponse> galleryMedia,
        String description,
        String tasteDesc,
        List<String> tasteTags,
        List<Short> seasonMonths,
        Short priceLevel,
        double avgRating,
        long reviewCount,
        long ratingCount,
        Map<String, Long> ratingDistribution,
        List<String> tips,
        List<SimilarFishResponse> similarFishes
) {
}
