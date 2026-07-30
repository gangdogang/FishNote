package com.fishnote.admin.dto;

import com.fishnote.fish.FishCategory;
import java.time.OffsetDateTime;
import java.util.List;

public record AdminFishResponse(
        Long id,
        String name,
        String nameEn,
        String slug,
        FishCategory category,
        String scientificName,
        String imageUrl,
        String tasteDesc,
        Short priceLevel,
        boolean featured,
        String description,
        List<Short> seasonMonths,
        List<String> tasteTags,
        List<String> tips,
        List<String> aliases,
        OffsetDateTime updatedAt
) {
}
